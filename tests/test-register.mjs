import { register } from 'node:module';

if (!process.env.EXPO_PUBLIC_SUPABASE_URL) {
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://mock.supabase.co';
}
if (!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key';
}

register('./test-loader.mjs', import.meta.url);

