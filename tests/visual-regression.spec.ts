import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests - AI Screens', () => {
  test('AI Guide Detail Screen', async ({ page }) => {
    await page.goto('/ai-guide-detail');
    // Wait for content and images to load
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('ai-guide-detail.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
    });
  });

  test('AI Camera Result Screen', async ({ page }) => {
    await page.goto('/ai-camera-result');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('ai-camera-result.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
    });
  });

  test('AI Camera Viewfinder Screen', async ({ page }) => {
    await page.goto('/ai-camera-viewfinder');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('ai-camera-viewfinder.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
    });
  });
});
