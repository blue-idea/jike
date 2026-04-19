/**
 * lib/auth/authErrors.ts
 *
 * 统一认证错误映射（中文提示，敏感信息脱敏）
 * EARS-19: 认证错误文案统一与敏感日志脱敏
 */
import type { AuthError } from '@supabase/supabase-js';

type LoginMessages = Record<string, string>;
type RegisterMessages = Record<string, string>;
type ResetMessages = Record<string, string>;
type UpdateMessages = Record<string, string>;
type SessionMessages = Record<string, string>;

const LOGIN_MSGS: LoginMessages = {
  invalid_credentials: '邮箱或密码不正确，请重试。',
  user_not_found: '该账号不存在，请先注册。',
  email_not_confirmed: '邮箱尚未验证，请在邮箱中点击验证链接。',
  rate_limit: '登录尝试过于频繁，请稍后再试。',
  default: '登录失败，请检查邮箱与密码后重试。',
};

const REGISTER_MSGS: RegisterMessages = {
  user_already_exists: '该邮箱已注册，请直接登录或使用其他邮箱。',
  weak_password: '密码强度不足，请设置至少 8 位包含字母和数字的密码。',
  invalid_email: '邮箱格式不正确，请输入有效的邮箱地址。',
  rate_limit: '注册操作过于频繁，请稍后再试。',
  default: '注册失败，请稍后重试。',
};

const RESET_MSGS: ResetMessages = {
  user_not_found: '该邮箱未注册，将无法发送重置邮件。',
  rate_limit: '密码重置邮件发送过于频繁，请稍后再试。',
  invalid_email: '邮箱格式不正确。',
  default: '发送失败，请检查邮箱后重试。',
};

const UPDATE_MSGS: UpdateMessages = {
  same_password: '新密码不能与当前密码相同。',
  weak_password: '新密码强度不足，请设置至少 8 位包含字母和数字的密码。',
  expired: '会话已过期，请重新登录。',
  default: '密码更新失败，请重试。',
};

const SESSION_MSGS: SessionMessages = {
  expired: '会话已过期，请重新登录。',
  invalid: '登录状态异常，请重新登录。',
  refresh_failed: '会话刷新失败，请重新登录。',
};

function getMessages(context: string): Record<string, string> {
  switch (context) {
    case 'login': return LOGIN_MSGS;
    case 'register': return REGISTER_MSGS;
    case 'reset': return RESET_MSGS;
    case 'update': return UPDATE_MSGS;
    case 'session': return SESSION_MSGS;
    default: return LOGIN_MSGS;
  }
}

/**
 * 统一错误映射为中文提示（不暴露内部错误详情）
 */
export function mapAuthErrorToZh(
  error: AuthError | Error | null | undefined,
  context: 'login' | 'register' | 'reset' | 'update' | 'session',
): string {
  const codeMessages = getMessages(context);
  const defaultMsg = codeMessages.default ?? '操作失败，请稍后重试。';

  if (!error) return defaultMsg;

  const code = 'code' in error ? String((error as AuthError).code ?? '') : '';
  const msg = (error.message ?? '').toLowerCase();

  // 优先精确匹配 code
  if (code && code in codeMessages) {
    return codeMessages[code];
  }

  // 关键词匹配
  if (msg.includes('already registered') || msg.includes('user_already_exists') || msg.includes('already exists')) {
    return codeMessages['user_already_exists'] ?? defaultMsg;
  }
  if (msg.includes('not confirmed') || msg.includes('email not confirmed')) {
    return codeMessages['email_not_confirmed'] ?? defaultMsg;
  }
  if (msg.includes('rate limit') || msg.includes('too many requests')) {
    return codeMessages['rate_limit'] ?? defaultMsg;
  }
  if (msg.includes('invalid') || msg.includes('malformed')) {
    return codeMessages['invalid_email'] ?? defaultMsg;
  }
  if (msg.includes('weak') || msg.includes('short')) {
    return codeMessages['weak_password'] ?? defaultMsg;
  }
  if (msg.includes('same')) {
    return codeMessages['same_password'] ?? defaultMsg;
  }
  if (msg.includes('expired') || msg.includes('session')) {
    return codeMessages['expired'] ?? defaultMsg;
  }
  if (msg.includes('invalid credentials') || msg.includes('wrong password') || msg.includes('incorrect')) {
    return codeMessages['invalid_credentials'] ?? defaultMsg;
  }

  return defaultMsg;
}

/**
 * 脱敏邮箱用于日志（不输出完整邮箱）
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '[invalid_email]';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `**@${domain}`;
  return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
}

/**
 * 脱敏用户 ID 用于日志
 */
export function maskUserId(userId: string | undefined): string {
  if (!userId) return '[no_user]';
  if (userId.length <= 8) return `${userId.slice(0, 4)}****`;
  return `${userId.slice(0, 4)}****${userId.slice(-4)}`;
}

/**
 * 判断是否为会话过期错误
 */
export function isSessionExpiredError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('expired') ||
    msg.includes('session') ||
    msg.includes('401') ||
    msg.includes('unauthorized')
  );
}
