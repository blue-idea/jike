const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFileSync, rmSync } = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const outDir = path.join(repoRoot, '.tmp', 'ai-itinerary-planning-test');
const tscCli = path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');

rmSync(outDir, { recursive: true, force: true });
execFileSync(
  process.execPath,
  [
    tscCli,
    'supabase/functions/ai-itinerary/planning.ts',
    '--module',
    'commonjs',
    '--target',
    'es2022',
    '--strict',
    '--skipLibCheck',
    '--outDir',
    outDir,
  ],
  { cwd: repoRoot, stdio: 'inherit' },
);

const planning = require(path.join(outDir, 'planning.js'));

function makePoi(index, poiType, score) {
  return {
    poi_id: `${poiType}-${index}`,
    poi_name: `${poiType} ${index}`,
    poi_type: poiType,
    lng: 106.5 + index * 0.001,
    lat: 29.5 + index * 0.001,
    score,
  };
}

const scenic = Array.from({ length: 15 }, (_, index) => makePoi(index, 'scenic', 120 - index));
const museum = Array.from({ length: 8 }, (_, index) => makePoi(index, 'museum', 80 - index));
const heritage = Array.from({ length: 8 }, (_, index) => makePoi(index, 'heritage', 78 - index));
const candidates = [...scenic, ...museum, ...heritage];

function buildConstraints(overrides) {
  const themeTags = overrides.themeTags ?? ['景点', '博物馆', '文保'];
  const query = overrides.query ?? '偏好类型：景点、博物馆、文保。 行程节奏：适中。';
  return {
    query,
    destination: '重庆',
    days: 3,
    dailyHours: 8,
    intensity: 2,
    themeTags,
    preferredPoiTypes: planning.inferPreferredPoiTypes(themeTags),
    dayPreferences: planning.parseDayPreferencesFromText(query),
    mustVisitIds: [],
    excludeIds: [],
    ...overrides,
  };
}

function plan(overrides) {
  const constraints = buildConstraints(overrides);
  const selected = planning.pickSelectedCandidates(candidates, constraints);
  return planning.buildDays(selected, constraints);
}

function countTypes(days) {
  return days
    .flatMap((day) => day.stops)
    .reduce((counts, stop) => {
      counts[stop.poi_type] = (counts[stop.poi_type] ?? 0) + 1;
      return counts;
    }, {});
}

function countStops(days) {
  return days.reduce((sum, day) => sum + day.stops.length, 0);
}

const query = '第二天以博物馆和文保为主 偏好类型：景点、博物馆、文保。 行程节奏：适中。';
const dayPreferences = planning.parseDayPreferencesFromText(query);

assert.deepEqual(dayPreferences[2], ['museum', 'heritage']);

const dayPreferenceConstraints = {
  query,
  destination: '重庆',
  days: 3,
  dailyHours: 8,
  intensity: 2,
  themeTags: ['景点', '博物馆', '文保'],
  preferredPoiTypes: planning.inferPreferredPoiTypes(['景点', '博物馆', '文保']),
  dayPreferences,
  mustVisitIds: [],
  excludeIds: [],
};

const selected = planning.pickSelectedCandidates(candidates, dayPreferenceConstraints);
const days = planning.buildDays(selected, dayPreferenceConstraints);
const secondDayTypes = days[1].stops.map((stop) => stop.poi_type);
const preferredCount = secondDayTypes.filter((type) => type === 'museum' || type === 'heritage').length;

assert.equal(days.length, 3);
assert.ok(
  preferredCount > secondDayTypes.length / 2,
  `expected day 2 to be mostly museum/heritage, got ${secondDayTypes.join(', ')}`,
);

const thirdDayQuery = '第三天以博物馆和文保为主 偏好类型：景点、博物馆、文保。 行程节奏：适中。';
const thirdDayPlan = plan({
  query: thirdDayQuery,
  dayPreferences: planning.parseDayPreferencesFromText(thirdDayQuery),
});
const thirdDayTypes = thirdDayPlan[2].stops.map((stop) => stop.poi_type);
assert.deepEqual(planning.parseDayPreferencesFromText(thirdDayQuery)[3], ['museum', 'heritage']);
assert.ok(
  thirdDayTypes.every((type) => type === 'museum' || type === 'heritage'),
  `expected day 3 to reserve museum/heritage candidates, got ${thirdDayTypes.join(', ')}`,
);

const museumOnlyCounts = countTypes(plan({ themeTags: ['博物馆'] }));
assert.equal(museumOnlyCounts.scenic ?? 0, 0);
assert.equal(museumOnlyCounts.heritage ?? 0, 0);
assert.ok((museumOnlyCounts.museum ?? 0) >= 8);

const museumHeritageCounts = countTypes(plan({ themeTags: ['博物馆', '文保'] }));
assert.equal(museumHeritageCounts.scenic ?? 0, 0);
assert.ok(Math.abs((museumHeritageCounts.museum ?? 0) - (museumHeritageCounts.heritage ?? 0)) <= 1);

const balancedCounts = countTypes(plan({ themeTags: ['景点', '博物馆', '文保'] }));
assert.ok(
  Math.max(balancedCounts.scenic ?? 0, balancedCounts.museum ?? 0, balancedCounts.heritage ?? 0) -
    Math.min(balancedCounts.scenic ?? 0, balancedCounts.museum ?? 0, balancedCounts.heritage ?? 0) <=
    1,
  `expected all selected types to be balanced, got ${JSON.stringify(balancedCounts)}`,
);

assert.equal(plan({ days: 2 }).length, 2);
assert.equal(plan({ days: 4 }).length, 4);
assert.ok(countStops(plan({ intensity: 3 })) > countStops(plan({ intensity: 1 })));
assert.ok(countStops(plan({ dailyHours: 10 })) > countStops(plan({ dailyHours: 6 })));

const edgeSource = readFileSync(
  path.join(repoRoot, 'supabase', 'functions', 'ai-itinerary', 'index.ts'),
  'utf8',
);
assert.match(edgeSource, /normalized === '5A'\) return 100;/);
assert.match(edgeSource, /一级馆'\)\) return 100;/);
assert.match(edgeSource, /text\.includes\('第一批'\)\) return 100;/);
assert.match(edgeSource, /景区优先：5A > 4A。/);
assert.match(edgeSource, /博物馆优先：一级博物馆 > 二级博物馆。/);
assert.match(edgeSource, /文保优先：第一批 > 第二批。/);
assert.match(edgeSource, /排布原则：按点位坐标就近串联，减少往返折返。/);
assert.match(edgeSource, /async function generateDaysByModel/);

rmSync(outDir, { recursive: true, force: true });

console.log('ai-itinerary planning tests passed');
