import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/qa/smoke-seed');
  await page.getByRole('button', { name: 'Cargar dataset QA smoke' }).click();
  await expect(page.getByText('Dataset QA smoke cargado')).toBeVisible();
});

test('home critical CTA navigates to target page', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('home-main-import-sales').click();
  await expect(page).toHaveURL(/\/sales\/import/);
});

test('setup critical CTA navigates to product editor with context', async ({ page }) => {
  await page.goto('/setup?branch=Consolidado&month=2026-03');
  await page.getByTestId('setup-review-price').first().click();
  await expect(page).toHaveURL(/\/products\/.+focus=price/);
  await expect(page).toHaveURL(/returnTo=%2Fsetup%3Fbranch%3DConsolidado%26month%3D2026-03/);
});

test('return to previous panel navigates back to origin', async ({ page }) => {
  await page.goto('/products/qa_product_americano_no_price?returnTo=%2Fdashboard&focus=price');
  await page.getByTestId('return-to-link').click();
  await expect(page).toHaveURL(/\/dashboard$/);
});
