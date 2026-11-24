import { expect, test, type Page } from '@playwright/test'

const userId = '11111111-1111-4111-8111-111111111111'
const courseId = '22222222-2222-4222-8222-222222222222'
const lessonId = '33333333-3333-4333-8333-333333333333'
const moduleId = '44444444-4444-4444-8444-444444444444'

async function prepareDashboard(page: Page, options: { questionsFail?: boolean; completionFail?: boolean; progressFail?: boolean; moduleCount?: number; noEnrollment?: boolean; roomOnly?: boolean; notebook?: boolean } = {}) {
  const requests: { path: string; method: string; query: URLSearchParams; body: unknown }[] = []
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
    requests.push({ path, method: request.method(), query: url.searchParams, body: request.postDataJSON() })
    let data: unknown = []
    let status = 200
    const course = { id: courseId, title: 'Curso de referência', slug: 'referencia', category: 'Tecnologia', status: 'published', visibility: 'public', creator_id: userId }
    if (path === 'user') data = user
    if (path === 'profiles') data = { id: userId, display_name: 'Aluno', username: 'aluno', streak_count: 0 }
    if (path === 'notebooks' && options.notebook) data = [{ id: 'notebook-desktop-overlay', title: 'Curso de referência', user_id: userId, created_at: '2026-10-01T12:00:00Z' }]
    if (path === 'notebook_pages' && options.notebook) data = [{ id: 'notebook-page-desktop-overlay', notebook_id: 'notebook-desktop-overlay', title: 'Página fixture', content: 'Anotação de teste', position: 0, created_at: '2026-10-01T12:00:00Z', updated_at: '2026-10-01T12:00:00Z' }]
    if (path === 'courses') data = request.headers()['accept']?.includes('object') ? course : [course]
    if (path === 'course_review_status') data = [{
      course_id: courseId, course_title: course.title, can_review: false,
      reason: 'REVIEW_NOT_ELIGIBLE', question_count: 0, sample_count: 0, module_counts: [],
    }]
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

async function verifyDashboardNavigationAtShortHeight(
  page: Page,
  options: { noEnrollment?: boolean; roomOnly?: boolean },
  state: 'individual' | 'sala' | 'sem curso',
  expandedScreenshotPath: string,
) {
  await page.setViewportSize({ width: 568, height: 320 })
  await prepareDashboard(page, options)

  if (state === 'individual') {
    await expect(page.locator('.course-review-card')).toHaveCount(1)
  } else {
    await expect(page.locator('.course-review-card')).toHaveCount(0)
  }
  if (state === 'sala') {
    await expect(page.getByText('Sala: Sala de referência', { exact: true })).toBeAttached()
    await expect(page.getByText('Revisar curso', { exact: true })).toHaveCount(0)
  }

  const sidebar = page.locator('.sidebarL')
  const main = page.locator('.page-layout__main')
  const toggle = page.locator('.sidebarL__toggle')
  const nav = page.getByRole('navigation', { name: 'Navegação principal', exact: true })
  await expect(toggle).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(sidebar).toHaveAttribute('data-mobile-expanded', 'true')
  await expect(nav).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Início', exact: true })).toHaveAttribute('aria-current', 'page')

  const sidebarBottom = await sidebar.evaluate(element => element.getBoundingClientRect().bottom)
  const mainTop = await main.evaluate(element => element.getBoundingClientRect().top)
  expect(mainTop, `${state}: conteúdo começa após a altura natural da navegação`).toBeGreaterThanOrEqual(sidebarBottom - 1)
  expect(await main.evaluate(element => getComputedStyle(element).paddingLeft)).toBe('0px')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(568)
  expect(await page.evaluate(() => document.body.scrollHeight)).toBeGreaterThan(320)

  if (state === 'individual') {
    const reviewCard = page.locator('.course-review-card')
    const cardTop = await reviewCard.evaluate(element => element.getBoundingClientRect().top)
    expect(cardTop, 'cartão individual não fica sobre a navegação expandida').toBeGreaterThanOrEqual(sidebarBottom - 1)
  }

  const lastDestination = nav.getByRole('link', { name: 'Cadernos', exact: true })
  await lastDestination.focus()
  await expect(lastDestination).toBeFocused()
  const account = page.getByRole('button', { name: 'Abrir opções de conta', exact: true })
  await account.scrollIntoViewIfNeeded()
  await expect(account).toBeVisible()
  const accountBounds = await account.boundingBox()
  expect(accountBounds).not.toBeNull()
  expect(accountBounds!.y).toBeGreaterThanOrEqual(0)
  expect(accountBounds!.y + accountBounds!.height).toBeLessThanOrEqual(320)
  await page.screenshot({ path: expandedScreenshotPath, animations: 'disabled' })

  await account.focus()
  await page.keyboard.press('Escape')
  await expect(nav).toBeHidden()
  await expect(page.getByRole('button', { name: 'Abrir opções de conta', exact: true })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Abrir navegação', exact: true })).toBeFocused()
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

for (const state of [
  { name: 'individual', options: {} },
  { name: 'sala', options: { noEnrollment: true, roomOnly: true } },
  { name: 'sem curso', options: { noEnrollment: true } },
] as const) {
  test(`dashboard ${state.name} mantém navegação alcançável em 568×320`, async ({ page }, testInfo) => {
    await verifyDashboardNavigationAtShortHeight(
      page,
      state.options,
      state.name,
      testInfo.outputPath(`dashboard-${state.name}-nav-expandida-568x320.png`),
    )
    await page.screenshot({ path: testInfo.outputPath(`dashboard-${state.name}-nav-recolhida-568x320.png`), animations: 'disabled' })
  })
}

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

test('overlays do Dashboard desktop abrem sem deslocar a casca, a âncora ou o notebook', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const requests = await prepareDashboard(page, { notebook: true })
  const geometry = async () => ({
    sidebar: await page.locator('.sidebarL').evaluate(element => element.getBoundingClientRect().width),
    mainX: (await page.locator('.dashboard').boundingBox())?.x,
    panelTrigger: await page.getByRole('button', { name: 'Abrir seletor de cursos e salas', exact: true }).boundingBox(),
    notebookTrigger: await page.locator('[data-toggle-notebook]').boundingBox(),
  })
  const before = await geometry()
  expect(before).toMatchObject({
    sidebar: 230,
    mainX: 230,
    panelTrigger: { x: 294 },
    notebookTrigger: { x: 294, width: 84, height: 84 },
  })

  const rightPanelTrigger = page.getByRole('button', { name: 'Abrir painel', exact: true })
  await rightPanelTrigger.click()
  await expect(page.getByRole('button', { name: 'Recolher painel', exact: true })).toBeVisible()
  expect(await geometry()).toEqual(before)
  await page.getByRole('button', { name: 'Recolher painel', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Abrir painel', exact: true })).toBeVisible()

  await page.locator('[data-toggle-notebook]').click()
  const notebook = page.locator('[role="dialog"][aria-labelledby="course-notebook-title"]')
  await expect(notebook).toBeVisible()
  await expect(notebook.getByRole('button', { name: 'Fechar notebook', exact: true })).toBeVisible()
  await page.mouse.move(0, 899)
  await page.waitForTimeout(400)
  expect(await geometry()).toEqual(before)
  await notebook.getByRole('button', { name: 'Fechar notebook', exact: true }).click()
  await expect(notebook).toHaveCount(0)

  await page.mouse.move(0, 899)
  await page.waitForTimeout(400)
  expect(await geometry()).toEqual(before)
  expect(requests.filter(request => ['notebooks', 'notebook_pages'].includes(request.path)).map(request => request.method)).toEqual(['GET', 'GET'])
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
    await expect(page.getByRole('dialog', { name: 'Selecionar curso ou sala' })).toHaveCSS('width', '756px')
    await page.screenshot({ path: testInfo.outputPath(`seletor-${width}.png`), animations: 'disabled' })
  })
}

test('Dashboard desktop preserva rolagem vertical da sidebar sem overflow horizontal e mantém o gradiente', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 500 })
  await prepareDashboard(page)

  const sidebar = page.locator('.sidebarL')
  const geometry = await sidebar.evaluate(element => ({
    borderBoxWidth: element.getBoundingClientRect().width,
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    overflowX: getComputedStyle(element).overflowX,
    overflowY: getComputedStyle(element).overflowY,
    scrollport: (() => {
      const content = element.querySelector<HTMLElement>('.sidebarL__scroll')
      if (!content) return null
      return {
        clientWidth: content.clientWidth,
        scrollWidth: content.scrollWidth,
        clientHeight: content.clientHeight,
        scrollHeight: content.scrollHeight,
        overflowY: getComputedStyle(content).overflowY,
      }
    })(),
    decoration: {
      display: getComputedStyle(element, '::after').display,
      width: getComputedStyle(element, '::after').width,
      backgroundImage: getComputedStyle(element, '::after').backgroundImage,
    },
  }))
  expect(geometry.borderBoxWidth).toBeCloseTo(230, 0)
  // A decoração pode ultrapassar o border box; o aside externo permanece visível
  // e não é uma região de rolagem. Só o scroller interno precisa conter o conteúdo.
  expect(geometry.overflowX).toBe('visible')
  expect(geometry.overflowY).toBe('visible')
  expect(geometry.scrollport).not.toBeNull()
  expect(geometry.scrollport!.scrollWidth).toBeLessThanOrEqual(geometry.scrollport!.clientWidth)
  expect(geometry.scrollport!.scrollHeight).toBeGreaterThan(geometry.scrollport!.clientHeight)
  expect(geometry.scrollport!.overflowY).toBe('auto')
  expect(geometry.decoration.display).not.toBe('none')
  expect(geometry.decoration.width).toBe('100px')
  expect(geometry.decoration.backgroundImage).toContain('linear-gradient')
  await page.screenshot({ path: testInfo.outputPath('dashboard-sidebar-scroll-gradient-1440x500.png'), animations: 'disabled' })

  const account = page.getByRole('button', { name: 'Abrir opções de conta', exact: true })
  await account.scrollIntoViewIfNeeded()
  const accountBounds = await account.boundingBox()
  expect(accountBounds).not.toBeNull()
  expect(accountBounds!.y).toBeGreaterThanOrEqual(0)
  expect(accountBounds!.y + accountBounds!.height).toBeLessThanOrEqual(501)
})
