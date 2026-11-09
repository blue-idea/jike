const assert = require('node:assert/strict');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('node:path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.TEST_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.TEST_SUPABASE_ANON_KEY;
const email = process.env.TEST_QA_EMAIL;
const password = process.env.TEST_QA_PASSWORD;

async function run() {
  if (!url || !anonKey || !email || !password) {
    console.log('[test-ai-guide] 缺少环境变量，跳过在线集成验证。');
    return;
  }

  const sb = createClient(url, anonKey);
  const { data: authData, error: authError } = await sb.auth.signInWithPassword({
    email,
    password,
  });
  assert.equal(authError, null, `登录失败: ${authError?.message}`);
  const token = authData.session.access_token;

  const testCases = [
    { name: '南禅寺大殿', type: 'heritage' },
    { name: '陕西历史博物馆', type: 'museum' },
    { name: '秦始皇帝陵博物院', type: 'scenic' },
    { name: '平遥文庙', type: 'heritage' },
  ];

  for (const tc of testCases) {
    const res = await fetch(`${url}/functions/v1/ai-guide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ poi_name: tc.name, poi_type: tc.type }),
    });

    assert.equal(res.status, 200, `调用失败 HTTP ${res.status}`);
    const json = await res.json();
    assert.ok(json.data, '未返回 data 对象');
    assert.equal(typeof json.data.poi_name, 'string');
    assert.equal(Array.isArray(json.data.sections), true);
    assert.equal(json.data.sections.length, 6, 'sections 数量必须为 6');

    for (const sec of json.data.sections) {
      const charCount = sec.content.length;
      assert.ok(
        charCount >= 60 && charCount <= 140,
        `[${tc.name} - ${sec.title}] 字数 ${charCount} 不在 [60, 140] 范围内！内容: ${sec.content}`,
      );
      console.log(`[PASS] ${tc.name} -> ${sec.title}: ${charCount}字`);
    }
  }

  console.log('✅ 所有 AI 导游测试用例均严格满足 60 到 140 个汉字限制！');
}

run().catch((err) => {
  console.error('[test-ai-guide] 失败:', err);
  process.exitCode = 1;
});

