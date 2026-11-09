/**
 * scripts/auto-test-auth-e2e.cjs
 *
 * 全自动端到端认证测试套件：
 * 1. 后端 Supabase Auth 真实 API 校验 (注册、SMTP发信、登录、防刷保护)
 * 2. Web 前端产物本地服务器托管与 Playwright UI 交互自动化测试
 */
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const url = 'https://filzrurpzixnxljzrzny.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpbHpydXJweml4bnhsanpyem55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NDQ1NTksImV4cCI6MjA5MjEyMDU1OX0.3kQnEubCZ62EKosVp-eBHQwREQkr2oxp3qL4HHT5jwU';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpbHpydXJweml4bnhsanpyem55Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjU0NDU1OSwiZXhwIjoyMDkyMTIwNTU5fQ.89w-VTL7D3ANBBiJk4QigV5G7OEYiMzndoXPD7_6g2E';

const client = createClient(url, anonKey);
const admin = createClient(url, serviceRoleKey);

// 简易静态文件服务器用于托管 dist 产物
function startDistServer(port = 3000) {
  const distDir = path.resolve(__dirname, '..', 'dist');
  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/' || reqPath.startsWith('/(auth)')) {
      reqPath = '/index.html';
    }
    let filePath = path.join(distDir, reqPath);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(distDir, 'index.html');
    }

    const ext = path.extname(filePath);
    const contentTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json',
      '.png': 'image/png',
      '.ico': 'image/x-icon',
    };
    const contentType = contentTypes[ext] || 'application/octet-stream';

    try {
      const data = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`[Static Server] 运行在 http://localhost:${port}`);
      resolve(server);
    });
  });
}

async function runAutoTests() {
  console.log('====================================================');
  console.log('            集刻 (jike) 自动化全链路测试');
  console.log('====================================================\n');

  let testPassed = 0;
  let testTotal = 0;

  function report(name, ok, detail = '') {
    testTotal++;
    if (ok) {
      testPassed++;
      console.log(`✅ [PASS] ${name} ${detail}`);
    } else {
      console.error(`❌ [FAIL] ${name} ${detail}`);
    }
  }

  // --- 第 1 部分：后端真实 Supabase Auth 接口测试 ---
  console.log('\n--- 阶段 1: Supabase Auth 云端 API 校验 ---');

  // 1.1 清理测试账号状态与使用动态测试邮箱
  const testEmail = `test_auto_${Date.now()}@126.com`;

  // 1.2 错误凭据登录测试
  const loginFailRes = await client.auth.signInWithPassword({
    email: 'nonexistent@example.com',
    password: 'wrongpassword'
  });
  report(
    '无效账号登录拦截',
    loginFailRes.error && loginFailRes.error.code === 'invalid_credentials',
    `(返回 code: ${loginFailRes.error?.code})`
  );

  // 1.3 注册测试 (走 163 自定义 SMTP 发信，受 Supabase 1m 发信频率保护)
  const signUpRes = await client.auth.signUp({
    email: testEmail,
    password: 'Password123'
  });
  const isSignUpSuccess = !signUpRes.error && signUpRes.data?.user?.email === testEmail;
  const isRateLimited = signUpRes.error?.code === 'over_email_send_rate_limit';
  report(
    '全新邮箱注册与 SMTP 发信链路',
    isSignUpSuccess || isRateLimited,
    isSignUpSuccess ? `(成功生成 user: ${signUpRes.data?.user?.id})` : `(命中云端 1m0s 发信安全冷却保护)`
  );

  // 1.4 对未验证邮箱重复注册时，Supabase 重新补发确认邮件或发信冷却
  const signUpDupRes = await client.auth.signUp({
    email: testEmail,
    password: 'Password123'
  });
  const isResentOrCooledDown =
    (signUpDupRes.data?.user && signUpDupRes.data.user.id === signUpRes.data?.user?.id) ||
    signUpDupRes.error?.code === 'over_email_send_rate_limit';
  report(
    '未验证邮箱重复注册补发邮件/冷却安全机制',
    Boolean(isResentOrCooledDown),
    `(返回同一 user id: ${signUpDupRes.data?.user?.id || 'cooldown'})`
  );

  // 1.5 恢复环境：清理刚才注册的测试账号
  if (signUpRes.data?.user?.id) {
    await admin.auth.admin.deleteUser(signUpRes.data.user.id);
  }

  // --- 第 2 部分：Playwright 浏览器端 UI 自动化测试 ---
  console.log('\n--- 阶段 2: 浏览器端 UI 自动化与真实请求测试 ---');

  const server = await startDistServer(3000);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let failedNetworkRequests = [];
  page.on('requestfailed', req => {
    failedNetworkRequests.push({ url: req.url(), error: req.failure()?.errorText });
  });

  try {
    // 2.1 访问登录页面
    await page.goto('http://localhost:3000/(auth)/login', { waitUntil: 'networkidle' });
    const pageTitle = await page.textContent('body');
    report('登录页面正常渲染', pageTitle.includes('欢迎回来') && pageTitle.includes('探索名录、地图与路线'));

    // 2.2 测试表单空值提交预校验
    await page.click('button[aria-label="登录"]');
    await page.waitForTimeout(300);
    const emptyEmailError = await page.textContent('body');
    report('登录页面空邮箱预校验', emptyEmailError.includes('请输入邮箱地址。'));

    // 2.3 测试密码非空预校验
    await page.fill('input[type="email"]', 'test@example.com');
    await page.click('button[aria-label="登录"]');
    await page.waitForTimeout(300);
    const emptyPwdError = await page.textContent('body');
    report('登录页面空密码预校验', emptyPwdError.includes('请输入密码。'));

    // 2.4 测试真实提交网络请求到 filzrurpzixnxljzrzny.supabase.co
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[aria-label="登录"]');

    // 等待接口返回并渲染错误文案（最大 8 秒）
    await page.waitForFunction(
      () => document.body && document.body.innerText.includes('邮箱或密码不正确，请重试。'),
      { timeout: 8000 }
    );

    const afterSubmitText = await page.textContent('body');
    const isNetworkError = afterSubmitText.includes('网络连接失败');
    const isCorrectAuthError = afterSubmitText.includes('邮箱或密码不正确，请重试。');

    report(
      '真实网络请求目标地址正确且无网络阻断',
      !isNetworkError,
      `（确认不再报错网络连接失败）`
    );
    report(
      '业务错误文案显示正确',
      isCorrectAuthError,
      `（显示：邮箱或密码不正确，请重试。）`
    );

    // 2.5 检查是否存在连接关闭 net::ERR_CONNECTION_CLOSED
    const hasConnectionClosed = failedNetworkRequests.some(r => r.error?.includes('ERR_CONNECTION_CLOSED'));
    report('无 ERR_CONNECTION_CLOSED 异常', !hasConnectionClosed);

    // 2.6 切换到注册页面测试
    await page.goto('http://localhost:3000/(auth)/register', { waitUntil: 'networkidle' });
    const registerText = await page.textContent('body');
    report('注册页面正常渲染', registerText.includes('创建账号'));

    // 2.7 截图保存作为测试证据
    const screenshotDir = path.resolve(__dirname, '..', 'tests', 'visual-regression.spec.ts-snapshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    const screenshotPath = path.join(screenshotDir, 'auto-test-login-verified.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`📸 测试截图已保存至: ${screenshotPath}`);

  } catch (err) {
    console.error('E2E 测试异常:', err);
    report('E2E 流程执行', false, err.message);
  } finally {
    await browser.close();
    server.close();
  }

  // --- 统计总结 ---
  console.log('\n====================================================');
  console.log(`测试完成：共 ${testTotal} 项用例，通过 ${testPassed} 项，失败 ${testTotal - testPassed} 项`);
  console.log(`通过率：${Math.round((testPassed / testTotal) * 100)}%`);
  console.log('====================================================\n');

  if (testPassed !== testTotal) {
    process.exit(1);
  }
}

runAutoTests().catch((e) => {
  console.error('测试套件致命异常:', e);
  process.exit(1);
});
