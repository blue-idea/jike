import { useEffect, type ReactNode } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { CatalogLocationProvider } from '@/contexts/CatalogLocationContext';

void SplashScreen.preventAutoHideAsync();

const AUTH_STAY: Record<string, true> = {
  'reset-password': true,
  'pending-email': true,
  callback: true,
};

function AuthNavigationShell({ children }: { children: ReactNode }) {
  const { initialized, session } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useFrameworkReady();

  useEffect(() => {
    if (!initialized) return;
    void SplashScreen.hideAsync();
  }, [initialized]);

  useEffect(() => {
    if (!initialized) return;

    const path = segments as string[];
    const root = path[0];
    const leaf = path[1];
    const inAuth = root === '(auth)';
    const inTabs = root === '(tabs)';

    if (!session && inTabs) {
      router.replace('/(auth)/login');
      return;
    }

    if (session && inAuth && !(leaf && AUTH_STAY[leaf])) {
      router.replace('/(tabs)');
    }
  }, [initialized, session, segments, router]);

  if (!initialized) {
    return null;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <CatalogLocationProvider>
        <AuthNavigationShell>
          <>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="+not-found" />
            </Stack>
            <StatusBar style="auto" />
          </>
        </AuthNavigationShell>
      </CatalogLocationProvider>
    </AuthProvider>
  );
}
