import { randomUUID } from 'node:crypto'
import { test, expect } from '@playwright/test'

// Usa somente API/Auth/RPCs reais. Cada execução cria sua própria conta no banco
// LOCAL descartável; os registros de atividade são preservados para diagnóstico.
test('cadastro, matrícula e conclusão persistem no Supabase local real', async ({ page }) => {
  const suffix = randomUUID().replaceAll('-', '')
  const email = `e2e-${suffix}@example.test`
  const password = `E2e-${randomUUID()}`
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style')
      style.textContent = '.trail-node--active { animation: none !important; }'
      document.head.appendChild(style)
    })
  })
  await page.goto('/register-page')
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByLabel('Cargo', { exact: true }).selectOption('student')
  await page.getByLabel('Nome de usuário', { exact: true }).fill(`e2e_${suffix}`)
  await page.getByRole('button', { name: 'Cadastrar', exact: true }).click()
  await expect(page.getByText('Cadastro realizado com sucesso!', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Ir para o login', exact: true }).click()
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL('/dashboard')
  await page.getByRole('link', { name: 'Ver todos os cursos', exact: true }).click()
  await page.getByRole('button', { name: /Lógica de Programação/ }).click()
  await page.getByRole('button', { name: 'Matricular-se', exact: true }).click()
  await expect(page).toHaveURL('/dashboard?curso=00000000-0000-4000-c000-00000000000a')
  await page.getByRole('button', { name: 'Aula O que é lógica', exact: true }).click()
  await page.getByRole('button', { name: 'Começar atividade', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Uma sequência de passos', exact: true }).click()
  await page.getByRole('button', { name: 'Verificar', exact: true }).click()
  await page.getByRole('button', { name: 'Finalizar aula', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Aula concluída!', exact: true })).toBeVisible()
  await expect(page.getByText('+4', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Voltar à trilha', exact: true }).click()
  await expect(page.getByLabel('Progresso do módulo: 33%')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Progresso do módulo: 33%')).toBeVisible()
  await page.getByRole('link', { name: 'Missões', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Concluídas', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Abrir opções de conta', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Sair da conta' }).click()
  await page.goto('/dashboard')
  await expect(page).toHaveURL('/')
})
