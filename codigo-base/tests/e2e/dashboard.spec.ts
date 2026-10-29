import { expect, test, type Page } from '@playwright/test'

const userId = '11111111-1111-4111-8111-111111111111'
const courseId = '22222222-2222-4222-8222-222222222222'
const lessonId = '33333333-3333-4333-8333-333333333333'
const moduleId = '44444444-4444-4444-8444-444444444444'

async function prepareDashboard(page: Page, options: { questionsFail?: boolean; completionFail?: boolean; progressFail?: boolean; moduleCount?: number; noEnrollment?: boolean; roomOnly?: boolean } = {}) {
  const requests: { path: string; query: URLSearchParams; body: unknown }[] = []
  let completed = false
  const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'aluno@example.test', user_metadata: {}, app_metadata: {} }
  await page.addInitScript(({ user }) => {
    localStorage.setItem('sb-example-auth-token', JSON.stringify({
      access_token: 'test-token', refresh_token: 'test-refresh', token_type: 'bearer',
      expires_at: Math.floor(Date.now() / 1000) + 3600, user,
    }))
  }, { user })
  await page.route('https://example.supabase.co/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.split('/').at(-1) ?? ''
    requests.push({ path, query: url.searchParams, body: request.postDataJSON() })
    let data: unknown = []
    let status = 200
    const course = { id: courseId, title: 'Curso de referência', slug: 'referencia', category: 'Tecnologia', status: 'published', visibility: 'public', creator_id: userId }
    if (path === 'user') data = user
    if (path === 'profiles') data = { id: userId, display_name: 'Aluno', username: 'aluno', streak_count: 0 }
    if (path === 'courses') data = request.headers()['accept']?.includes('object') ? course : [course]
    if (path === 'enrollments' && !options.noEnrollment) data = [{ id: 'enrollment', course_id: courseId, user_id: userId, status: 'active', created_at: '2026-10-01T12:00:00Z' }]
    if (path === 'rooms' && options.roomOnly) data = [{ id: 'room-demo', course_id: courseId, name: 'Sala de referência', educator_id: 'educator-demo', created_at: '2026-10-01T12:00:00Z' }]
    if (path === 'room_members' && options.roomOnly) data = [{ room_id: 'room-demo', user_id: userId, status: 'active', joined_at: '2026-10-01T12:00:00Z' }]
    if (path === 'modules') data = Array.from({ length: options.moduleCount ?? 1 }, (_, index) => ({ id: index === 0 ? moduleId : `module-${index}`, course_id: courseId, title: index === 0 ? 'Módulo inicial' : `Módulo ${index + 1}`, position: index, color: '#06b6d4', icon: '📘' }))
    if (path === 'lessons' && url.searchParams.get('module_id') === 'eq.' + moduleId) data = [{ id: lessonId, module_id: moduleId, title: 'Leitura introdutória', content: 'Leia este material antes de continuar.', position: 0 }]
    if (path === 'completions' && completed) data = [{ user_id: userId, lesson_id: lessonId, context: 'course' }]
    if (path === 'complete_empty_lesson') {
      status = options.completionFail ? 400 : 204
      completed = !options.completionFail
      data = { message: 'Falha ao concluir' }
    }
    if ((path === 'questions' && options.questionsFail) || (path === 'mission_progress' && options.progressFail)) {
      status = 400
      data = { message: 'Falha controlada na consulta' }
    }
    await route.fulfill({ status, contentType: 'application/json', body: status === 204 ? '' : JSON.stringify(data) })
  })
  await page.goto((process.env.DASHBOARD_REFERENCE_URL ?? '') + '/dashboard' + (options.noEnrollment ? '' : '?curso=' + courseId))
  if (options.noEnrollment && !options.roomOnly) {
    await expect(page.getByText('Você ainda não está matriculado em nenhum curso. Escolha um no Catálogo.', { exact: true })).toBeVisible()
  } else {
    await expect(page.getByRole('heading', { name: /Leitura introdutória|Módulo inicial/ })).toBeVisible()
  }
  await page.addStyleTag({ content: '.trail-node--active { animation: none !important; } .trail-node, .trail-node__face { transition: none !important; }' })
  return requests
}

test('sem matrícula ou sala mantém o aviso do fork no dashboard e oferece o Catálogo', async ({ page }, testInfo) => {
  await prepareDashboard(page, { noEnrollment: true })
  await expect(page).toHaveURL(/\/dashboard$/)
  const catalog = page.getByRole('link', { name: 'Ver todos os cursos', exact: true })
  await expect(catalog).toHaveAttribute('href', '/catalogo')
  await page.screenshot({ path: testInfo.outputPath('dashboard-sem-cursos.png'), animations: 'disabled' })
  await catalog.click()
  await expect(page).toHaveURL(/\/catalogo$/)
  await expect(page.getByRole('heading', { name: 'Catálogo', exact: true })).toBeVisible()
})

test('sem matrícula abre a trilha da sala quando há participação ativa', async ({ page }) => {
  await prepareDashboard(page, { noEnrollment: true, roomOnly: true })
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.getByRole('button', { name: 'Abrir seletor de cursos e salas', exact: true }).click()
  await page.getByRole('button', { name: 'Cursos', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Ver cursos', exact: true })).toHaveAttribute('href', '/catalogo')
})

test('conclui aula sem questões pela RPC e atualiza o progresso', async ({ page }) => {
  const requests = await prepareDashboard(page)
  await page.getByRole('button', { name: 'Aula Leitura introdutória' }).click()
  await page.getByRole('button', { name: 'Marcar como concluída' }).click()
  await expect(page.getByRole('heading', { name: 'Aula concluída!' })).toBeVisible()
  await expect(page.getByText('Esta aula não tinha atividades, então não vale XP.')).toBeVisible()
  expect(requests.filter(r => r.path === 'complete_empty_lesson').map(r => r.body)).toEqual([{ p_lesson_id: lessonId }])
  expect(requests.some(r => r.path === 'start_attempt' || r.path === 'finalize_attempt')).toBe(false)
  await page.getByRole('button', { name: 'Voltar à trilha' }).click()
  await expect(page.getByLabel('Progresso do módulo: 100%')).toBeVisible()
})

test('não trata falha na leitura de questões como aula vazia', async ({ page }) => {
  const requests = await prepareDashboard(page, { questionsFail: true })
  await page.getByRole('button', { name: 'Aula Leitura introdutória' }).click()
  await expect(page.getByRole('alert')).toContainText('Falha controlada')
  await expect(page.getByRole('button', { name: 'Marcar como concluída' })).toBeDisabled()
  expect(requests.some(r => r.path === 'complete_empty_lesson')).toBe(false)
})

test('mantém a aula pendente quando a RPC falha', async ({ page }) => {
  await prepareDashboard(page, { completionFail: true })
  await page.getByRole('button', { name: 'Aula Leitura introdutória' }).click()
  await page.getByRole('button', { name: 'Marcar como concluída' }).click()
  await expect(page.getByRole('alert')).toContainText('Falha ao concluir')
  await expect(page.getByRole('heading', { name: 'Aula concluída!' })).toHaveCount(0)
})

test('TopDown consulta o curso e usuário corretos e expõe falha de progresso', async ({ page }) => {
  const requests = await prepareDashboard(page, { progressFail: true })
  await page.getByRole('button', { name: 'Abrir painel', exact: true }).click()
  await expect(page.getByText(/Erro ao listar progresso de missões/)).toBeVisible()
  expect(requests.find(r => r.path === 'friends_course_pac')?.body).toEqual({ p_course_id: courseId })
  const missions = requests.find(r => r.path === 'missions')
  expect(missions?.query.get('status')).toBe('eq.published')
  expect(missions?.query.get('limit')).toBe('3')
  expect(missions?.query.get('or')).toContain('deadline.is.null,deadline.gte.')
  expect(requests.find(r => r.path === 'mission_progress')?.query.get('user_id')).toBe('eq.' + userId)
})

for (const count of [2, 3]) {
  test(`carrossel mantém o módulo atual no centro com ${count} módulos`, async ({ page }) => {
    await prepareDashboard(page, { moduleCount: count })
    await expect(page.locator('.module-carousel__item')).toHaveCount(3)
    await expect(page.locator('.module-carousel__item--current')).toContainText('Módulo inicial')
    await page.getByRole('button', { name: 'Próximo módulo', exact: true }).click()
    await expect(page.locator('.module-carousel__item--current')).toContainText('Módulo 2')
    await expect(page.getByRole('heading', { name: 'Módulo 2', exact: true })).toBeVisible()
  })
}

for (const width of [1280, 1440, 1920]) {
  test(`layout da referência em ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await prepareDashboard(page)
    await page.getByRole('button', { name: 'Módulo Módulo inicial', exact: true }).click()
    const dashboard = await page.locator('.dashboard').boundingBox()
    expect(dashboard?.x).toBe(230)
    expect(dashboard?.width).toBe(width - 230)
    const trigger = await page.getByRole('button', { name: 'Abrir seletor de cursos e salas', exact: true }).boundingBox()
    expect(trigger?.x).toBe(294)
    expect(trigger?.y).toBe(27)
    const notebook = await page.locator('[data-toggle-notebook]').boundingBox()
    expect(notebook).toMatchObject({ x: 294, y: 789, width: 84, height: 84 })
    await expect(page.locator('.module-carousel__item')).toHaveCount(3)
    await page.screenshot({ path: testInfo.outputPath(`dashboard-${width}.png`), animations: 'disabled' })
    await page.getByRole('button', { name: 'Abrir seletor de cursos e salas', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Selecionar curso ou sala' })).toHaveCSS('max-width', '756px')
    await page.screenshot({ path: testInfo.outputPath(`seletor-${width}.png`), animations: 'disabled' })
  })
}
