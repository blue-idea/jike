import { useEffect } from 'react';

declare global {
  // RN Hermes 无 `window`；浏览器里 globalThis 与 window 等价，统一用 globalThis 避免冷启动 effect 抛错。
  var frameworkReady: (() => void) | undefined;
}

export function useFrameworkReady() {
  useEffect(() => {
    globalThis.frameworkReady?.();
  }, []);
}
