/**
 * tests/test-loader.mjs
 *
 * 为 Node.js 单元测试环境提供 react-native / expo-audio 模拟与 TypeScript 路径解析
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'react-native-url-polyfill/auto') {
    return {
      format: 'module',
      shortCircuit: true,
      url: 'data:text/javascript,export default {};',
    };
  }

  if (specifier === '@react-native-async-storage/async-storage') {
    return {
      format: 'module',
      shortCircuit: true,
      url: 'data:text/javascript,' + encodeURIComponent(`
        const storage = new Map();
        export default {
          getItem: async (key) => storage.get(key) || null,
          setItem: async (key, value) => { storage.set(key, value); },
          removeItem: async (key) => { storage.delete(key); },
          clear: async () => { storage.clear(); },
        };
      `),
    };
  }

  if (specifier === 'expo') {
    return {
      format: 'module',
      shortCircuit: true,
      url: 'data:text/javascript,' + encodeURIComponent(`
        export const requireOptionalNativeModule = () => null;
        export const requireNativeModule = (name) => { throw new Error('Cannot find native module ' + name); };
        export const Platform = { OS: process.env.TEST_PLATFORM || 'android' };
      `),
    };
  }

  if (specifier === 'react-native') {
    return {
      format: 'module',
      shortCircuit: true,
      url: 'data:text/javascript,' + encodeURIComponent(`
        export const Platform = {
          OS: process.env.TEST_PLATFORM || 'android',
          select: (obj) => obj[process.env.TEST_PLATFORM || 'android'] || obj.default,
        };
      `),
    };
  }

  if (specifier === 'expo-audio') {
    return {
      format: 'module',
      shortCircuit: true,
      url: 'data:text/javascript,' + encodeURIComponent(`
        export class MockAudioPlayer {
          constructor(source) {
            this.source = source;
            this.playing = false;
            this.listeners = [];
            this.removed = false;
          }
          play() {
            this.playing = true;
            this._emit({ isLoaded: true, playing: true, didJustFinish: false });
          }
          pause() {
            this.playing = false;
            this._emit({ isLoaded: true, playing: false, didJustFinish: false });
          }
          remove() {
            this.removed = true;
            this.playing = false;
          }
          addListener(event, cb) {
            this.listeners.push(cb);
            return {
              remove: () => {
                const idx = this.listeners.indexOf(cb);
                if (idx >= 0) this.listeners.splice(idx, 1);
              }
            };
          }
          _emit(status) {
            for (const cb of this.listeners) {
              cb(status);
            }
          }
        }
        export const createAudioPlayer = (source) => new MockAudioPlayer(source);
        export const setAudioModeAsync = async () => {};
      `),
    };
  }

  // 补齐 @/ 别名
  if (specifier.startsWith('@/')) {
    const targetPath = path.resolve(rootDir, specifier.slice(2));
    for (const ext of ['.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.js']) {
      const fullPath = targetPath + ext;
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        return nextResolve(pathToFileURL(fullPath).href, context);
      }
    }
  }

  // 补齐 .ts / .tsx / .js 相对路径扩展名
  if (specifier.startsWith('.') && context.parentURL) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL));
    const targetPath = path.resolve(parentDir, specifier);
    for (const ext of ['.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.js']) {
      const fullPath = targetPath + ext;
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        return nextResolve(pathToFileURL(fullPath).href, context);
      }
    }
  }

  return nextResolve(specifier, context);
}
