import { test, expect, installPlatform } from './support/platform'

test('carrega a página inicial do Athen', async ({ page }) => {
  await installPlatform(page, false)
  await page.goto('/')

  await expect(page).toHaveTitle(/Athen/i)
  await expect(
    page.getByRole('heading', { name: /Aprenda qualquer coisa/i }),
  ).toBeVisible()
})

test('visitante inicia o cadastro pela ação principal', async ({ page }) => {
  await installPlatform(page, false)
  await page.goto('/')
  await page.getByRole('button', { name: 'Começar grátis', exact: true }).click()
  await expect(page).toHaveURL('/register-page')
  await expect(page.getByRole('heading', { name: 'Criar conta', exact: true })).toBeVisible()
})
