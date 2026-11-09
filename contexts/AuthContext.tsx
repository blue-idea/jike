import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { getEmailAuthRedirectTo } from '@/lib/auth/redirectUrl';
import { mapAuthErrorToZh } from '@/lib/auth/authErrors';
import { parseAuthRedirectUrl } from '@/lib/auth/parseAuthUrl';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  initialized: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsEmailConfirmation?: boolean }>;
  signOut: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function applyAuthDeepLink(url: string): Promise<void> {
  const { access_token, refresh_token, type } = parseAuthRedirectUrl(url);
  if (!access_token || !refresh_token) return;
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) return;
  if (type === 'recovery') {
    router.replace('/(auth)/reset-password');
  } else {
    router.replace('/(tabs)');
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void supabase.auth
      .getSession()
      .then(({ data: { session: next } }) => {
        if (cancelled) return;
        setSession(next);
      })
      .catch((error) => {
        console.warn('auth.getSession failed', error);
      })
      .finally(() => {
        if (cancelled) return;
        setInitialized(true);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    const onUrl = ({ url }: { url: string }) => {
      void applyAuthDeepLink(url);
    };
    const sub = Linking.addEventListener('url', onUrl);
    void Linking.getInitialURL().then((url) => {
      if (url) void applyAuthDeepLink(url);
    });

    // Web 端页面直接加载时若带有 auth 回调 hash 参数，立即处理登录态回跳
    if (typeof window !== 'undefined' && window.location?.href && window.location.hash.includes('access_token')) {
      void applyAuthDeepLink(window.location.href);
    }

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      sub.remove();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      if (__DEV__) {
        console.warn('[Auth:signIn] 失败详情:', error.name, error.message, (error as { status?: number }).status, (error as { code?: string }).code);
      }
      return { error: mapAuthErrorToZh(error, 'login') };
    }
    return { error: null };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: getEmailAuthRedirectTo() },
    });
    if (error) {
      if (__DEV__) {
        console.warn('[Auth:signUp] 失败详情:', error.name, error.message, (error as { status?: number }).status, (error as { code?: string }).code);
      }
      return { error: mapAuthErrorToZh(error, 'register') };
    }

    // Supabase 开启防用户枚举时，若邮箱已存在，返回 user 但 identities 为空数组
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { error: '该邮箱已注册，请直接登录或更换邮箱。' };
    }

    if (data.user && !data.session) {
      return { error: null, needsEmailConfirmation: true };
    }
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  }, []);

  const resetPasswordForEmail = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: getEmailAuthRedirectTo(),
    });
    if (error) return { error: mapAuthErrorToZh(error, 'reset') };
    return { error: null };
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { error: mapAuthErrorToZh(error, 'update') };
    await supabase.auth.signOut();
    return { error: null };
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      initialized,
      signIn,
      signUp,
      signOut,
      resetPasswordForEmail,
      updatePassword,
    }),
    [session, initialized, signIn, signUp, signOut, resetPasswordForEmail, updatePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
