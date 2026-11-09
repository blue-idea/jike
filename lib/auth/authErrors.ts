/**
 * lib/auth/authErrors.ts
 *
 * 统一认证错误映射（中文提示，敏感信息脱敏）
 * EARS-19: 认证错误文案统一与敏感日志脱敏
 */
import type { AuthError } from '@supabase/supabase-js';

type ErrorMessages = Record<string, string>;

const LOGIN_MSGS: ErrorMessages = {
  invalid_credentials: '邮箱或密码不正确，请重试。',
  user_not_found: '该账号不存在，请先注册。',
  email_not_confirmed: '邮箱尚未验证，请在邮箱中点击验证链接。',
  rate_limit: '登录尝试过于频繁，请稍后再试。',
  network_error: '网络连接失败，请检查网络设置或代理后重试。',
  default: '邮箱或密码不正确，请重试。',
};

const REGISTER_MSGS: ErrorMessages = {
  user_already_exists: '该邮箱已注册，请直接登录或使用其他邮箱。',
  email_exists: '该邮箱已注册，请直接登录或使用其他邮箱。',
  weak_password: '密码强度不足，请设置至少 8 位包含字母和数字的密码。',
  invalid_email: '邮箱格式不正确，请输入有效的邮箱地址。',
  rate_limit: '注册或发信过于频繁，请稍后再试。',
  over_email_send_rate_limit: '邮件发送过于频繁，请稍后再试。',
  network_error: '网络连接失败，请检查网络设置或代理后重试。',
  default: '注册失败，请稍后重试。',
};

const RESET_MSGS: ErrorMessages = {
  user_not_found: '该邮箱未注册，将无法发送重置邮件。',
  rate_limit: '密码重置邮件发送过于频繁，请稍后再试。',
  over_email_send_rate_limit: '密码重置邮件发送过于频繁，请稍后再试。',
  invalid_email: '邮箱格式不正确。',
  network_error: '网络连接失败，请检查网络设置或代理后重试。',
  default: '发送失败，请检查邮箱后重试。',
};

const UPDATE_MSGS: ErrorMessages = {
  same_password: '新密码不能与当前密码相同。',
  weak_password: '新密码强度不足，请设置至少 8 位包含字母和数字的密码。',
  expired: '会话已过期，请重新登录。',
  network_error: '网络连接失败，请检查网络设置或代理后重试。',
  default: '密码更新失败，请重试。',
};

const SESSION_MSGS: ErrorMessages = {
  expired: '会话已过期，请重新登录。',
  invalid: '登录状态异常，请重新登录。',
  refresh_failed: '会话刷新失败，请重新登录。',
  network_error: '网络连接失败，请检查网络设置或代理后重试。',
  default: '会话异常，请重新登录。',
};

function getMessages(context: string): ErrorMessages {
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

  const code = 'code' in error ? String((error as AuthError).code ?? '').toLowerCase() : '';
  const status =
    'status' in error && typeof (error as { status?: unknown }).status === 'number'
      ? (error as { status: number }).status
      : undefined;
  const name = 'name' in error ? String((error as { name?: unknown }).name ?? '') : '';
  const msg = (error.message ?? '').toLowerCase();

  // 1. 网络连接失败判定
  if (
    name === 'AuthRetryableFetchError' ||
    status === 0 ||
    msg.includes('fetch failed') ||
    msg.includes('network request failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('network error')
  ) {
    return codeMessages.network_error ?? '网络连接失败，请检查网络设置后重试。';
  }

  // 2. 频率限制 / 邮件发信超限判定 (429 / over_email_send_rate_limit)
  if (
    status === 429 ||
    code === 'over_email_send_rate_limit' ||
    code === 'rate_limit' ||
    msg.includes('rate limit') ||
    msg.includes('too many requests') ||
    msg.includes('only request this after')
  ) {
    return codeMessages.over_email_send_rate_limit ?? codeMessages.rate_limit ?? '请求过于频繁，请稍后再试。';
  }

  // 3. 优先精确匹配 code
  if (code && code in codeMessages) {
    return codeMessages[code];
  }

  // 4. 用户已存在
  if (
    code === 'user_already_exists' ||
    code === 'email_exists' ||
    msg.includes('already registered') ||
    msg.includes('user_already_exists') ||
    msg.includes('already exists')
  ) {
    return codeMessages.user_already_exists ?? defaultMsg;
  }

  // 5. 邮箱未验证
  if (msg.includes('not confirmed') || msg.includes('email not confirmed')) {
    return codeMessages.email_not_confirmed ?? defaultMsg;
  }

  // 6. 邮箱格式非法
  if (
    code === 'invalid_email' ||
    msg.includes('invalid email') ||
    msg.includes('malformed') ||
    msg.includes('valid email')
  ) {
    return codeMessages.invalid_email ?? defaultMsg;
  }

  // 7. 密码弱/短
  if (
    code === 'weak_password' ||
    msg.includes('weak') ||
    msg.includes('short') ||
    msg.includes('password')
  ) {
    return codeMessages.weak_password ?? defaultMsg;
  }

  // 8. 密码相同
  if (msg.includes('same')) {
    return codeMessages.same_password ?? defaultMsg;
  }

  // 9. 会话过期
  if (msg.includes('expired') || msg.includes('session')) {
    return codeMessages.expired ?? defaultMsg;
  }

  // 10. 凭据错误
  if (
    code === 'invalid_credentials' ||
    msg.includes('invalid credentials') ||
    msg.includes('wrong password') ||
    msg.includes('incorrect')
  ) {
    return codeMessages.invalid_credentials ?? defaultMsg;
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
