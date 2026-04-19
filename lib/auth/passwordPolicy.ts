/** 客户端最低强度（须与 Supabase 项目侧策略协调，取更严者）。 */
export const PASSWORD_RULES_HINT = '至少 8 位，需同时包含字母与数字。';

export function validatePasswordForSignup(password: string): string | null {
  if (password.length < 8) return '密码长度至少为 8 位。';
  if (!/[A-Za-z]/.test(password)) return '密码需包含至少一个字母。';
  if (!/\d/.test(password)) return '密码需包含至少一个数字。';
  return null;
}
