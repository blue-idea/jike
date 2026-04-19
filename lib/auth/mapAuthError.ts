import type { AuthError } from '@supabase/supabase-js';

const LOGIN_BLUR = '邮箱或密码不正确，请重试。';

export function mapAuthErrorToZh(
  error: AuthError | Error | null | undefined,
  context: 'login' | 'register' | 'reset' | 'update',
): string {
  if (!error) return '操作失败，请稍后重试。';
  const code = 'code' in error ? String((error as AuthError).code ?? '') : '';
  const msg = (error.message ?? '').toLowerCase();

  if (context === 'login') {
    return LOGIN_BLUR;
  }

  if (context === 'register') {
    if (code === 'user_already_exists' || msg.includes('already registered')) {
      return '该邮箱已注册，请直接登录或更换邮箱。';
    }
    if (msg.includes('password')) {
      return '密码不符合要求，请按提示调整后重试。';
    }
    if (msg.includes('invalid email')) {
      return '邮箱格式不正确。';
    }
    return '注册失败，请检查邮箱与密码后重试。';
  }

  if (context === 'reset') {
    if (msg.includes('rate limit')) {
      return '请求过于频繁，请稍后再试。';
    }
    return '发送失败，请检查邮箱地址后重试。';
  }

  if (context === 'update') {
    if (msg.includes('same')) {
      return '新密码不能与旧密码相同。';
    }
    return '更新密码失败，请重试。';
  }

  return '操作失败，请稍后重试。';
}
