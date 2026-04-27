# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual-regression.spec.ts >> Visual Regression Tests - AI Screens >> AI Guide Detail Screen
- Location: tests\visual-regression.spec.ts:4:7

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  49279 pixels (ratio 0.20 of all image pixels) are different.

  Snapshot: ai-guide-detail.png

Call log:
  - Expect "toHaveScreenshot(ai-guide-detail.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - 48736 pixels (ratio 0.19 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - 49279 pixels (ratio 0.20 of all image pixels) are different.

```

# Page snapshot

```yaml
- generic [ref=e15]:
  - generic [ref=e17]:
    - generic [ref=e18]: 欢迎回来
    - generic [ref=e19]: 登录后即可探索名录、地图与路线。
  - generic [ref=e23]:
    - generic [ref=e24]:
      - generic [ref=e25]: 邮箱
      - textbox "name@example.com" [ref=e26]
    - generic [ref=e27]:
      - generic [ref=e28]: 密码
      - textbox "请输入密码" [ref=e29]
    - button "登录" [ref=e30] [cursor=pointer]:
      - generic [ref=e31]: 登录
    - generic [ref=e33] [cursor=pointer]: 忘记密码？
    - link "没有账号？去注册" [ref=e34] [cursor=pointer]:
      - /url: /register
      - generic [ref=e35]: 没有账号？去注册
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Visual Regression Tests - AI Screens', () => {
  4  |   test('AI Guide Detail Screen', async ({ page }) => {
  5  |     await page.goto('/ai-guide-detail');
  6  |     // Wait for content and images to load
  7  |     await page.waitForLoadState('networkidle');
> 8  |     await expect(page).toHaveScreenshot('ai-guide-detail.png', {
     |                        ^ Error: expect(page).toHaveScreenshot(expected) failed
  9  |       fullPage: true,
  10 |       maxDiffPixelRatio: 0.05,
  11 |     });
  12 |   });
  13 | 
  14 |   test('AI Camera Result Screen', async ({ page }) => {
  15 |     await page.goto('/ai-camera-result');
  16 |     await page.waitForLoadState('networkidle');
  17 |     await expect(page).toHaveScreenshot('ai-camera-result.png', {
  18 |       fullPage: true,
  19 |       maxDiffPixelRatio: 0.05,
  20 |     });
  21 |   });
  22 | 
  23 |   test('AI Camera Viewfinder Screen', async ({ page }) => {
  24 |     await page.goto('/ai-camera-viewfinder');
  25 |     await page.waitForLoadState('networkidle');
  26 |     await expect(page).toHaveScreenshot('ai-camera-viewfinder.png', {
  27 |       fullPage: true,
  28 |       maxDiffPixelRatio: 0.05,
  29 |     });
  30 |   });
  31 | });
  32 | 
```