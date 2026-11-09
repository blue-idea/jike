import { Platform } from 'react-native';
import Constants from 'expo-constants';

/** 与 `app.json` scheme 一致；Supabase 控制台须将同 URL 加入 Redirect URLs。 */
export function getEmailAuthRedirectTo(): string {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
    return 'http://localhost:8081';
  }
  const scheme = Constants.expoConfig?.scheme ?? 'jike';
  return `${scheme}://auth/callback`;
}
