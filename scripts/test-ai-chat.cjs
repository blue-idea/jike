const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');

const qaQuerySource = readFileSync(
  path.join(repoRoot, 'lib', 'ai', 'aiQaQueries.ts'),
  'utf8',
);
const qaHookSource = readFileSync(
  path.join(repoRoot, 'hooks', 'useQa.ts'),
  'utf8',
);
const edgeSource = readFileSync(
  path.join(repoRoot, 'supabase', 'functions', 'ai-chat', 'index.ts'),
  'utf8',
);

assert.match(qaQuerySource, /functions\/v1\/ai-chat/);
assert.doesNotMatch(qaHookSource, /sendQaQuestionMock/);
assert.match(edgeSource, /const MODEL_TIMEOUT_MS = 60_000;/);
assert.match(edgeSource, /请先登录后再使用问答功能/);
assert.match(edgeSource, /DEFAULT_DISCLAIMER/);

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.TEST_SUPABASE_URL;
const anonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.TEST_SUPABASE_ANON_KEY;
const email = process.env.TEST_QA_EMAIL;
const password = process.env.TEST_QA_PASSWORD;

async function runLive() {
  if (!supabaseUrl || !anonKey || !email || !password) {
    console.log(
      '[test-ai-chat] 跳过在线集成校验（缺少 EXPO_PUBLIC_SUPABASE_URL/ANON_KEY 或 TEST_QA_EMAIL/TEST_QA_PASSWORD）。',
    );
    return;
  }

  const signInResp = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(signInResp.ok, true, `登录失败: HTTP ${signInResp.status}`);
  const signInJson = await signInResp.json();
  assert.equal(typeof signInJson.access_token, 'string');

  const qaResp = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${signInJson.access_token}`,
    },
    body: JSON.stringify({
      query: '中国四大石窟有哪些？',
      messages: [],
    }),
  });
  assert.equal(qaResp.ok, true, `问答失败: HTTP ${qaResp.status}`);
  const qaJson = await qaResp.json();
  const data = qaJson?.data ?? qaJson;
  assert.equal(typeof data.answer, 'string');
  assert.equal(typeof data.disclaimer, 'string');
  assert.equal(typeof data.generated_at, 'string');
  assert.ok(data.answer.length > 0, '问答结果为空');

  console.log('[test-ai-chat] 在线集成校验通过。');
}

runLive().then(
  () => console.log('[test-ai-chat] 静态校验通过。'),
  (error) => {
    console.error('[test-ai-chat] 失败:', error);
    process.exitCode = 1;
  },
);
