/**
 * tests/tts.test.mjs
 *
 * 验证 TTS 模块从 expo-av 迁移至 expo-audio 的功能与生命周期管理（TDD 单元测试）
 */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { bytesToBase64, useTts } from '../hooks/useTts.ts';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

async function runTests() {
  console.log('--- 开始执行 TTS 模块单元测试 ---');
  assert.strictEqual(typeof useTts, 'function', 'useTts 应当导出为函数');

  // 1. 测试 Base64 二进制转换工具
  console.log('测试 1: 验证 bytesToBase64 音频二进制编码...');
  const text = 'Hello, AI Guide!';
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  const base64Str = bytesToBase64(bytes);
  const expectedBase64 = Buffer.from(text).toString('base64');
  assert.strictEqual(base64Str, expectedBase64, 'Base64 编码结果应与标准 base64 一致');

  // 2. 测试 expo-audio 模拟播放器交互与生命周期
  console.log('测试 2: 验证 expo-audio 播放器创建与控制接口...');
  const player = createAudioPlayer({ uri: 'data:audio/mpeg;base64,AAAA' });
  assert.ok(player, 'createAudioPlayer 应当返回播放器实例');

  let lastStatus = null;
  const sub = player.addListener('playbackStatusUpdate', (status) => {
    lastStatus = status;
  });

  player.play();
  assert.strictEqual(player.playing, true, 'play() 之后 player.playing 应为 true');
  assert.strictEqual(lastStatus?.playing, true, 'playbackStatusUpdate 事件应反映 playing 状态');

  player.pause();
  assert.strictEqual(player.playing, false, 'pause() 之后 player.playing 应为 false');
  assert.strictEqual(lastStatus?.playing, false, 'playbackStatusUpdate 事件应反映 paused 状态');

  sub.remove();
  player.remove();
  assert.strictEqual(player.removed, true, 'remove() 应当标记播放器为已释放');

  // 3. 测试 setAudioModeAsync 配置支持
  console.log('测试 3: 验证 setAudioModeAsync 音频模式配置...');
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: false,
    interruptionMode: 'duckOthers',
  });

  console.log('--- TTS 模块单元测试全部通过 ---');
}

runTests().catch((err) => {
  console.error('测试失败:', err);
  process.exit(1);
});

