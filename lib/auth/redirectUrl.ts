import Constants from 'expo-constants';

/** 与 `app.json` scheme 一致；Supabase 控制台须将同 URL 加入 Redirect URLs。 */
export function getEmailAuthRedirectTo(): string {
  const scheme = Constants.expoConfig?.scheme ?? 'jike';
  return `${scheme}://auth/callback`;
}
