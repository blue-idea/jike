const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');

const travelServicePath = path.join(repoRoot, 'lib', 'travel', 'travelService.ts');
const journeyPagePath = path.join(repoRoot, 'app', '(tabs)', 'journey.tsx');
const edgePath = path.join(repoRoot, 'supabase', 'functions', 'ai-travel-journal', 'index.ts');

const travelServiceSource = readFileSync(travelServicePath, 'utf8');
const journeyPageSource = readFileSync(journeyPagePath, 'utf8');
const edgeSource = readFileSync(edgePath, 'utf8');

assert.match(
  travelServiceSource,
  /functions\/v1\/ai-travel-journal/,
  '客户端必须通过 Supabase Edge ai-travel-journal 生成游记',
);
assert.match(
  travelServiceSource,
  /请先登录后再生成游记/,
  '未登录必须禁止云端游记生成并提示登录',
);
assert.match(
  travelServiceSource,
  /user_travel_logs/,
  '游记终稿应同步到 user_travel_logs',
);
assert.match(
  travelServiceSource,
  /user_journey/,
  '轨迹会话应同步到 user_journey',
);
assert.match(
  journeyPageSource,
  /TravelJournalPanel/,
  '路线页应接入轨迹记录与游记生成面板',
);
assert.match(
  edgeSource,
  /const MODEL_TIMEOUT_MS = 60_000;/,
  'Edge 侧需有 60s 超时控制',
);
assert.match(
  edgeSource,
  /请先登录后再生成游记/,
  'Edge 侧需校验登录态',
);
assert.match(
  edgeSource,
  /functions\/v1\/ai-travel-journal|ai-travel-journal/,
  'Edge 函数文件需实现 ai-travel-journal',
);

console.log('ai-travel-journal tests passed');
