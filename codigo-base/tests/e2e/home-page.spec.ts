import { test, expect } from '@playwright/test'

test('carrega a página inicial do Athen', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle(/codigo-base/i)
  await expect(
    page.getByRole('heading', { name: /Aprenda qualquer coisa/i }),
  ).toBeVisible()
})