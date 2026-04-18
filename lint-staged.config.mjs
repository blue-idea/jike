/**
 * 仅对暂存区匹配的文件运行 ESLint；若存在暂存的 TypeScript 文件则额外执行一次全项目 `tsc --noEmit`。
 */
export default {
  '*.{ts,tsx,js,jsx,mjs,cjs}': ['eslint --fix'],
  '*.{ts,tsx}': (filenames) => (filenames.length > 0 ? 'npm run typecheck' : []),
};
