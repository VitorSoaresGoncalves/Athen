import { test, expect, installPlatform } from './support/platform'

const protectedRoutes = ['/crud', '/dashboard', '/salas', '/profile', '/configuracoes', '/amigos', '/caderno', '/notificacoes', '/catalogo', '/criar-curso', '/ligas', '/missoes', '/missoes/inexistente']
for (const path of protectedRoutes) {
  test(`visitante não acessa ${path}`, async ({ page }) => {
    const backend = await installPlatform(page, false)
    await page.goto(path)
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('heading', { name: /Aprenda qualquer coisa/i })).toBeVisible()
    expect(backend.calls.some(call => call.path === 'token')).toBe(false)
  })
}

test('login inválido mantém o formulário e permite tentar novamente', async ({ page }) => {
  const backend = await installPlatform(page, false)
  backend.on('token', () => ({ status: 400, data: { error_code: 'invalid_credentials', msg: 'Credenciais inválidas' } }))
  await page.goto('/login-page')
  await page.getByLabel('E-mail', { exact: true }).fill('carla@example.test')
  await page.getByLabel('Senha', { exact: true }).fill('senha-invalida')
  await page.getByRole('button', { name: 'Mostrar', exact: true }).click()
  await expect(page.getByLabel('Senha', { exact: true })).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByText(/Falha no login/)).toBeVisible()
  await expect(page).toHaveURL('/login-page')
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeEnabled()
})

test('cadastro envia papel e nome de usuário e oferece retorno ao login', async ({ page }) => {
  const backend = await installPlatform(page, false)
  await page.goto('/register-page')
  await page.getByLabel('E-mail', { exact: true }).fill('nova@example.test')
  await page.getByLabel('Senha', { exact: true }).fill('nova-senha-123')
  await page.getByLabel('Cargo', { exact: true }).selectOption('student')
  await page.getByLabel('Nome de usuário', { exact: true }).fill('nova_aluna')
  await page.getByRole('button', { name: 'Cadastrar', exact: true }).click()
  await expect(page.getByText('Cadastro realizado com sucesso!')).toBeVisible()
  expect(backend.calls.find(call => call.path === 'signup')?.body).toMatchObject({ email: 'nova@example.test', data: { role: 'student', username: 'nova_aluna' } })
  await page.getByRole('link', { name: 'Ir para o login' }).click()
  await expect(page).toHaveURL('/login-page')
})

test('cadastro recusado preserva os dados para correção', async ({ page }) => {
  const backend = await installPlatform(page, false)
  backend.on('signup', () => ({ status: 422, data: { msg: 'Usuário já cadastrado' } }))
  await page.goto('/register-page')
  await page.getByLabel('E-mail', { exact: true }).fill('existente@example.test')
  await page.getByLabel('Senha', { exact: true }).fill('senha-123')
  await page.getByLabel('Cargo', { exact: true }).selectOption('educator')
  await page.getByLabel('Nome de usuário', { exact: true }).fill('existente')
  await page.getByRole('button', { name: 'Cadastrar', exact: true }).click()
  await expect(page.getByText(/Falha no cadastro/)).toBeVisible()
  await expect(page.getByLabel('Nome de usuário', { exact: true })).toHaveValue('existente')
})

test('login válido abre a área de estudo e mantém a sessão ao recarregar', async ({ page }) => {
  const backend = await installPlatform(page, false)
  await page.goto('/login-page')
  await page.getByLabel('E-mail', { exact: true }).fill('carla@example.test')
  await page.getByLabel('Senha', { exact: true }).fill('senha-123')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL('/dashboard')
  await expect(page.getByText(/Você ainda não está matriculado/)).toBeVisible()
  expect(backend.calls.find(call => call.path === 'token')?.body).toMatchObject({ email: 'carla@example.test', password: 'senha-123' })
  await page.reload()
  await expect(page).toHaveURL('/dashboard')
  await expect(page.getByText(/Você ainda não está matriculado/)).toBeVisible()
})
