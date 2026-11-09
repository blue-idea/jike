/**
 * tests/auth-errors.test.mjs
 *
 * 验证认证错误映射与边界处理（纯函数单元测试）
 */
import assert from 'node:assert/strict';
import { mapAuthErrorToZh, maskEmail, maskUserId, isSessionExpiredError } from '../lib/auth/authErrors.ts';

function runTests() {
  console.log('--- 开始执行认证模块单元测试 ---');

  // 1. 注册场景 - 频率与邮件发信配额限制
  assert.strictEqual(
    mapAuthErrorToZh({ name: 'AuthApiError', message: 'email rate limit exceeded', status: 429, code: 'over_email_send_rate_limit' }, 'register'),
    '邮件发送过于频繁，请稍后再试。',
    '应当正确映射 over_email_send_rate_limit'
  );

  assert.strictEqual(
    mapAuthErrorToZh({ name: 'AuthApiError', message: 'For security purposes, you can only request this after 49 seconds.', status: 429, code: 'over_email_send_rate_limit' }, 'register'),
    '邮件发送过于频繁，请稍后再试。',
    '应当正确映射 security cooldown 错误'
  );

  assert.strictEqual(
    mapAuthErrorToZh({ name: 'AuthApiError', message: 'too many requests', status: 429 }, 'register'),
    '邮件发送过于频繁，请稍后再试。',
    '应当正确映射 429 too many requests'
  );

  // 2. 注册场景 - 邮箱已注册
  assert.strictEqual(
    mapAuthErrorToZh({ name: 'AuthApiError', message: 'User already registered', code: 'user_already_exists', status: 422 }, 'register'),
    '该邮箱已注册，请直接登录或使用其他邮箱。',
    '应当正确映射 user_already_exists'
  );

  assert.strictEqual(
    mapAuthErrorToZh({ name: 'AuthApiError', message: 'A user with this email address has already been registered', code: 'email_exists', status: 422 }, 'register'),
    '该邮箱已注册，请直接登录或使用其他邮箱。',
    '应当正确映射 email_exists'
  );

  // 3. 注册场景 - 密码不符合要求
  assert.strictEqual(
    mapAuthErrorToZh({ name: 'AuthWeakPasswordError', message: 'Password should be at least 6 characters.', status: 422, code: 'weak_password' }, 'register'),
    '密码强度不足，请设置至少 8 位包含字母和数字的密码。',
    '应当正确映射 weak_password'
  );

  // 4. 注册场景 - 邮箱格式不正确
  assert.strictEqual(
    mapAuthErrorToZh({ message: 'Unable to validate email address: invalid format', code: 'invalid_email' }, 'register'),
    '邮箱格式不正确，请输入有效的邮箱地址。',
    '应当正确映射 invalid_email'
  );

  // 5. 注册场景 - 网络异常
  assert.strictEqual(
    mapAuthErrorToZh({ name: 'AuthRetryableFetchError', message: 'fetch failed', status: 0 }, 'register'),
    '网络连接失败，请检查网络设置或代理后重试。',
    '应当正确映射网络异常'
  );

  // 6. 注册场景 - 未知错误兜底
  assert.strictEqual(
    mapAuthErrorToZh({ message: 'Unexpected server internal error' }, 'register'),
    '注册失败，请稍后重试。',
    '未知错误应当安全兜底，且不误导为检查邮箱与密码'
  );

  // 7. 登录场景 - 凭据错误
  assert.strictEqual(
    mapAuthErrorToZh({ message: 'Invalid login credentials', code: 'invalid_credentials' }, 'login'),
    '邮箱或密码不正确，请重试。'
  );

  // 8. 敏感脱敏
  assert.strictEqual(maskEmail('test@example.com'), 't**t@example.com');
  assert.strictEqual(maskUserId('1234567890abcdef'), '1234****cdef');

  // 9. 会话过期判断
  assert.strictEqual(isSessionExpiredError(new Error('JWT expired')), true);
  assert.strictEqual(isSessionExpiredError(new Error('Other error')), false);

  console.log('✅ 所有认证错误映射单元测试通过 (100%)');
}

runTests();
