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
import { mapAuthErrorToZh } from '@/lib/auth/mapAuthError';
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

    void supabase.auth.getSession().then(({ data: { session: next } }) => {
      if (cancelled) return;
      setSession(next);
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

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      sub.remove();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { error: mapAuthErrorToZh(error, 'login') };
    return { error: null };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: getEmailAuthRedirectTo() },
    });
    if (error) return { error: mapAuthErrorToZh(error, 'register') };
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
