import { expect, test, ids, installPlatform } from './support/platform'
import type { Page } from '@playwright/test'

async function carouselControls(page: Page) {
  return page.locator('.module-carousel__arrow, .module-carousel__viewport').evaluateAll(elements => {
    const boxes = elements.map(element => element.getBoundingClientRect())
    const x = Math.min(...boxes.map(box => box.left))
    const y = Math.min(...boxes.map(box => box.top))
    return { x, y, width: Math.max(...boxes.map(box => box.right)) - x, height: Math.max(...boxes.map(box => box.bottom)) - y }
  })
}

const occurrenceId = ids.reviewOccurrence
const sessionId = ids.reviewSession
const questionId = ids.question
const expiresAt = '2026-12-01T12:00:00.000Z'

const occurrence = (overrides: Record<string, unknown> = {}) => ({
  occurrence_id: occurrenceId,
  period_index: 1,
  course_id: ids.course,
  course_title: 'Lógica de Programação',
  state: 'available',
  due_at: '2026-11-16T12:00:00.000Z',
  expires_at: expiresAt,
  bonus_xp: 10,
  delivery_state: 'suppressed',
  resume_session_id: null,
  last_finished_session_id: null,
  reward_session_id: null,
  rewarded_at: null,
  ...overrides,
})

const status = (overrides: Record<string, unknown> = {}) => ({
  course_id: ids.course,
  course_title: 'Lógica de Programação',
  can_review: true,
  reason: null,
  question_count: 1,
  sample_count: 1,
  module_counts: [{ module_id: ids.module, question_count: 1, sample_count: 1 }],
  ...overrides,
})

const reviewItem = {
  question_id: questionId,
  ordinal: 1,
  module_id: ids.module,
  module_title: 'Fundamentos',
  lesson_id: ids.lesson,
  type: 'multiple_choice',
  prompt: 'Quanto é 1 + 1?',
  config: { options: [
    { id: 'a', text: 'Dois', correct: true },
    { id: 'b', text: 'Três', correct: false },
  ] },
  explanation: null,
  submitted: null,
  is_correct: null,
}

const session = (mode: 'normal' | 'bonus', overrides: Record<string, unknown> = {}) => ({
  session_id: sessionId,
  course_id: ids.course,
  course_title: 'Lógica de Programação',
  mode,
  occurrence_id: mode === 'bonus' ? occurrenceId : null,
  expires_at: mode === 'bonus' ? expiresAt : null,
  bonus_xp: mode === 'bonus' ? 10 : 0,
  finished_at: null,
  result: null,
  items: [reviewItem],
  ...overrides,
})

type PlatformFixture = Awaited<ReturnType<typeof installPlatform>>

const finishedReview = (overrides: Record<string, unknown> = {}) => ({
  id: sessionId, user_id: ids.user, course_id: ids.course, mode: 'normal',
  finished_at: '2026-11-15T12:00:00.000Z', correct_count: 3, total_count: 4,
  approved: true, bonus_earned: 0, bonus_outcome: 'not_applicable', xp_event_id: null,
  ...overrides,
})

function prepareCourse(platform: PlatformFixture) {
  platform.tables.enrollments.push({
    id: 'review-enrollment',
    user_id: ids.user,
    course_id: ids.course,
    status: 'active',
    progress: 100,
  })
}

function configureReview(platform: PlatformFixture, options: {
  occurrence?: ReturnType<typeof occurrence> | null
  status?: ReturnType<typeof status>
} = {}) {
  platform.on('course_review_status', () => ({ data: [options.status ?? status()] }))
  platform.on('my_current_course_review', () => ({ data: options.occurrence ? [options.occurrence] : [] }))
  platform.on('my_course_review_occurrence', ({ body }: { body: Record<string, unknown> }) => {
    expect(body.p_occurrence_id).toBe(occurrenceId)
    return { data: [options.occurrence ?? occurrence()] }
  })
}

test('prática normal mostra a introdução sem criar sessão até o clique e usa só as RPCs de revisão', async ({ page, platform }) => {
  prepareCourse(platform)
  configureReview(platform)
  platform.on('my_course_review', ({ body }) => {
    expect(body.p_session_id).toBe(sessionId)
    return { data: [session('normal')] }
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  platform.on('start_course_review', ({ body }) => {
    expect(body.p_course_id).toBe(ids.course)
    expect(body.p_occurrence_id).toBeUndefined()
    expect(body.p_request_id).toMatch(/^[0-9a-f-]{36}$/i)
    return { data: [session('normal')] }
  })

  await page.goto(`/dashboard?curso=${ids.course}`)
  await expect(page.getByRole('button', { name: 'Revisar curso', exact: true })).toBeEnabled()
  const cardBounds = await page.getByRole('complementary', { name: 'Revisão do curso', exact: true }).boundingBox()
  const carouselBounds = await carouselControls(page)
  expect(carouselBounds!.x + carouselBounds!.width <= cardBounds!.x
    || carouselBounds!.y + carouselBounds!.height <= cardBounds!.y
    || carouselBounds!.x >= cardBounds!.x + cardBounds!.width
    || carouselBounds!.y >= cardBounds!.y + cardBounds!.height).toBe(true)
  await page.screenshot({ path: '../.scratch/issue-47-evidence/review-card-desktop.png', animations: 'disabled' })
  await page.getByRole('button', { name: 'Revisar curso', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`revisao=normal`))
  await expect(page.getByText('Sem bônus de revisão')).toBeVisible()
  await expect(page.getByText('A amostra só será sorteada ao começar.')).toBeVisible()
  await page.screenshot({ path: '../.scratch/issue-47-evidence/review-intro-desktop.png', animations: 'disabled' })
  expect(platform.calls.some(call => call.path === 'start_course_review')).toBe(false)
  expect(platform.calls.some(call => ['attempts', 'answers', 'finalize_attempt'].includes(call.path))).toBe(false)

  await page.getByRole('button', { name: 'Começar revisão' }).click()
  await expect(page.getByRole('heading', { name: 'Quanto é 1 + 1?' })).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`sessao=${sessionId}`))
  expect(new URL(page.url()).searchParams.has('curso')).toBe(false)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Quanto é 1 + 1?' })).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`sessao=${sessionId}`))
  await page.getByRole('button', { name: 'Fechar revisão' }).click()
  await expect(page).toHaveURL('/dashboard')
  await expect(page.getByRole('button', { name: 'Revisar curso', exact: true })).toBeEnabled()
  expect(platform.calls.filter(call => call.path === 'start_course_review')).toHaveLength(1)
  expect(platform.calls.some(call => ['attempts', 'answers', 'finalize_attempt'].includes(call.path))).toBe(false)
})

test('cartão sem aviso entrega bônus pelo único botão estável de revisão', async ({ page, platform }) => {
  prepareCourse(platform)
  platform.tables.profiles[0].notification_preferences = { revisao_curso: false }
  configureReview(platform, { occurrence: occurrence({ delivery_state: 'suppressed' }) })
  platform.on('start_course_review', () => ({ data: [session('bonus')] }))

  await page.goto(`/dashboard?curso=${ids.course}`)
  const card = page.getByRole('complementary', { name: 'Revisão do curso', exact: true })
  await expect(card.getByText(/Bônus disponível · \+10 XP · Meta: 70%/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Revisar curso', exact: true })).toHaveCount(1)
  await expect(page.locator('.dashboard-header')).not.toContainText('Revisar curso')
  await expect(page.locator('.dashboard-review-banner')).toHaveCount(0)
  await page.getByRole('button', { name: 'Revisar curso', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`revisao=${occurrenceId}`))
  await expect(page.getByText(/Revisão com bônus · \+10 XP/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Começar revisão' })).toBeEnabled()
  expect(platform.calls.some(call => call.path === 'my_current_course_review')).toBe(true)
})

test('notificação resolvida por ocorrência abre o mesmo curso, mesmo já lida', async ({ page, platform }) => {
  platform.tables.notifications.push({
    id: 'review-notification',
    user_id: ids.user,
    type: 'revisao_curso',
    title: 'Revisão semanal',
    body: 'Sua revisão está disponível',
    reference_id: occurrenceId,
    is_read: true,
    created_at: '2026-11-20T12:00:00Z',
  })
  configureReview(platform, { occurrence: occurrence() })
  platform.on('start_course_review', () => ({ data: [session('bonus')] }))

  await page.goto('/notificacoes')
  await page.getByRole('button', { name: 'Abrir notificação: Revisão semanal', exact: true }).click()
  await expect(page).toHaveURL(`/dashboard?revisao=${occurrenceId}`)
  await expect(page.getByText('Revisão com bônus · +10 XP')).toBeVisible()
  expect(platform.calls.some(call => call.path === 'my_course_review_occurrence')).toBe(true)
  expect(platform.calls.filter(call => call.path === 'notifications' && call.method === 'PATCH')).toHaveLength(0)
})

test('pedido UUID sobrevive a falha inicial e reload sem virar uma nova intenção', async ({ page, platform }) => {
  prepareCourse(platform)
  configureReview(platform)
  const startRequests: Record<string, unknown>[] = []
  platform.on('my_course_review', ({ body }) => {
    expect(body.p_session_id).toBe(sessionId)
    return { data: [session('normal')] }
  })
  platform.on('start_course_review', ({ body }) => {
    startRequests.push(body)
    if (startRequests.length <= 2) {
      return { status: 503, data: { code: 'XX000', message: 'transient dependency failure' } }
    }
    return { data: [session('normal')] }
  })

  await page.goto(`/dashboard?curso=${ids.course}&revisao=normal`)
  await page.getByRole('button', { name: 'Começar revisão' }).click()
  await expect(page.getByRole('alert')).toContainText('Não foi possível carregar ou salvar a revisão.')
  const receipt = new URL(page.url()).searchParams.get('pedido')
  expect(receipt).toMatch(/^[0-9a-f-]{36}$/i)

  await page.reload()
  // Reload replays the persisted intention automatically; another transient
  // failure must leave an explicit retry without allocating a new request ID.
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Não foi possível carregar ou salvar a revisão.')
  await expect(page.getByRole('button', { name: 'Repetir pedido de início' })).toBeVisible()
  await page.getByRole('button', { name: 'Repetir pedido de início' }).click()
  await expect(page.getByRole('heading', { name: 'Quanto é 1 + 1?' })).toBeVisible()
  expect(startRequests).toHaveLength(3)
  expect(startRequests[0].p_request_id).toBe(receipt)
  expect(startRequests[1].p_request_id).toBe(receipt)
  expect(startRequests[2].p_request_id).toBe(receipt)
})

test('curso sem questões é estado vazio e erro de dependência permanece recuperável', async ({ page, platform }) => {
  prepareCourse(platform)
  configureReview(platform, { status: status({ can_review: false, reason: 'REVIEW_EMPTY', question_count: 0, sample_count: 0, module_counts: [] }) })
  await page.goto(`/dashboard?curso=${ids.course}`)
  await expect(page.getByRole('button', { name: 'Revisar curso', exact: true })).toBeDisabled()
  await expect(page.getByText('Este curso não tem questões para revisão')).toBeVisible()
  expect(platform.calls.some(call => call.path === 'start_course_review')).toBe(false)

  await page.goto(`/dashboard?curso=${ids.course}&revisao=normal`)
  await expect(page.getByRole('dialog').getByText('Este curso não tem questões para revisão')).toBeVisible()

  platform.on('course_review_status', () => ({ status: 503, data: { message: 'temporary failure' } }))
  await page.goto(`/dashboard?curso=${ids.course}&revisao=normal`)
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('alert')).toContainText('Não foi possível carregar ou salvar a revisão.')
  await expect(dialog.getByRole('button', { name: 'Tentar carregar novamente' })).toBeEnabled()
  await expect(dialog.getByText('Este curso não tem questões para revisão')).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Marcar como concluída' })).toHaveCount(0)
  expect(platform.calls.some(call => call.path === 'start_course_review')).toBe(false)
  configureReview(platform)
  await dialog.getByRole('button', { name: 'Tentar carregar novamente' }).click()
  await expect(dialog.getByRole('button', { name: 'Começar revisão' })).toBeEnabled()
  await expect(dialog.getByRole('alert')).toHaveCount(0)
})

test('URL alheia, sala, UUID inválido, expiração e curso divergente não ganham fallback', async ({ page, platform }) => {
  prepareCourse(platform)
  configureReview(platform)
  platform.on('my_course_review_occurrence', () => ({
    status: 403,
    data: { code: '42501', message: 'REVIEW_FORBIDDEN' },
  }))
  await page.goto(`/dashboard?curso=${ids.course}&revisao=${occurrenceId}`)
  await expect(page.getByRole('alert')).toContainText('Você não tem acesso a esta revisão.')
  expect(platform.calls.some(call => call.path === 'start_course_review')).toBe(false)

  await page.goto(`/dashboard?curso=${ids.course}&revisao=not-a-uuid`)
  await expect(page.getByRole('alert')).toContainText('Link de revisão inválido')
  expect(platform.calls.some(call => call.path === 'start_course_review')).toBe(false)

  await page.goto(`/dashboard?curso=${ids.course}&sala=99999999-9999-4999-8999-999999999999&revisao=${occurrenceId}`)
  await expect(page.getByRole('alert')).toContainText('Link de revisão inválido')
  expect(platform.calls.some(call => call.path === 'start_course_review')).toBe(false)

  configureReview(platform, { occurrence: occurrence({ state: 'expired', due_at: '2026-10-25T12:00:00.000Z', expires_at: '2026-11-01T12:00:00.000Z' }) })
  await page.goto(`/dashboard?curso=${ids.course}&revisao=${occurrenceId}`)
  await expect(page.getByText('Esta ocorrência não está disponível para uma nova revisão com bônus.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Começar revisão' })).toBeDisabled()
  expect(platform.calls.some(call => call.path === 'start_course_review')).toBe(false)

  const mismatch = occurrence({ course_id: ids.educator })
  configureReview(platform, { occurrence: mismatch })
  await page.goto(`/dashboard?curso=${ids.course}&revisao=${occurrenceId}`)
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('O curso não corresponde à revisão solicitada.')
  expect(platform.calls.some(call => call.path === 'start_course_review')).toBe(false)
})

test('resultado premiado vem do servidor; teclado, foco, fechamento e viewport móvel permanecem utilizáveis', async ({ page, platform }) => {
  prepareCourse(platform)
  configureReview(platform, { occurrence: occurrence() })
  const completed = {
    session_id: sessionId,
    course_id: ids.course,
    course_title: 'Lógica de Programação',
    mode: 'bonus',
    occurrence_id: occurrenceId,
    expires_at: expiresAt,
    bonus_xp: 10,
    finished_at: '2026-11-21T12:00:00.000Z',
    result: {
      session_id: sessionId,
      correct_count: 1,
      total_count: 1,
      approved: true,
      bonus_earned: 10,
      bonus_outcome: 'awarded',
      xp_event_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      finished_at: '2026-11-21T12:00:00.000Z',
    },
    items: [{ ...reviewItem, submitted: { selected: ['a'] }, is_correct: true }],
  }
  platform.on('my_course_review', () => ({ data: [completed] }))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/dashboard?curso=${ids.course}&revisao=${occurrenceId}&sessao=${sessionId}`)
  const dialog = page.getByRole('dialog', { name: 'Lógica de Programação' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Fechar revisão' })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(dialog.getByRole('button', { name: 'Voltar à trilha', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(dialog.getByRole('button', { name: 'Fechar revisão' })).toBeFocused()
  await expect(dialog.getByText('Bônus de revisão recebido!')).toBeVisible()
  await expect(dialog.getByRole('status').getByText('+10', { exact: true })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Aula concluída!' })).toHaveCount(0)
  await dialog.getByRole('heading', { name: 'Revisão finalizada' }).click()
  await expect(dialog).toBeVisible()
  const bounds = await dialog.boundingBox()
  expect(bounds).not.toBeNull()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390)
  expect(bounds!.y).toBeGreaterThanOrEqual(0)
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844)
  await page.screenshot({ path: '../.scratch/issue-47-evidence/review-awarded-mobile.png', animations: 'disabled' })
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page).toHaveURL(new RegExp(`curso=${ids.course}$`))
  await expect(page.getByRole('button', { name: 'Revisar curso', exact: true })).toBeEnabled()
  await page.getByLabel('Navegação entre módulos').scrollIntoViewIfNeeded()
  const cardBounds = await page.getByRole('complementary', { name: 'Revisão do curso', exact: true }).boundingBox()
  const carouselBounds = await carouselControls(page)
  expect(carouselBounds!.x + carouselBounds!.width <= cardBounds!.x
    || carouselBounds!.y + carouselBounds!.height <= cardBounds!.y
    || carouselBounds!.x >= cardBounds!.x + cardBounds!.width
    || carouselBounds!.y >= cardBounds!.y + cardBounds!.height).toBe(true)
  expect(carouselBounds!.x).toBeGreaterThanOrEqual(0)
  expect(carouselBounds!.x + carouselBounds!.width).toBeLessThanOrEqual(390)
  await page.screenshot({ path: '../.scratch/issue-47-evidence/review-card-mobile.png', animations: 'disabled' })

  await page.getByRole('button', { name: 'Revisar curso', exact: true }).focus()
  await page.getByRole('button', { name: 'Revisar curso', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Lógica de Programação' })).toBeVisible()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.getByRole('dialog')).toHaveCSS('animation-name', 'none')
  await page.screenshot({ path: '../.scratch/issue-47-evidence/review-intro-mobile.png', animations: 'disabled' })
  await page.getByRole('button', { name: 'Fechar revisão' }).click()
  await expect(page.getByRole('button', { name: 'Revisar curso', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'Revisar curso', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.locator('.lesson-modal__fundo').click({ position: { x: 2, y: 2 } })
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('última revisão é persistida, filtra dono e curso e ignora sessões inacabadas', async ({ page, platform }) => {
  prepareCourse(platform)
  configureReview(platform)
  platform.tables.course_review_sessions.push(
    finishedReview({ finished_at: '2026-11-10T12:00:00.000Z', correct_count: 1 }),
    finishedReview(),
    finishedReview({ user_id: ids.friend, correct_count: 4, finished_at: '2026-11-16T12:00:00.000Z' }),
    finishedReview({ course_id: ids.educator, correct_count: 4, finished_at: '2026-11-17T12:00:00.000Z' }),
    finishedReview({ finished_at: null, correct_count: null }),
  )
  await page.goto(`/dashboard?curso=${ids.course}`)
  const card = page.getByRole('complementary', { name: 'Revisão do curso', exact: true })
  await expect(card).toContainText('75%')
  await expect(card).toContainText('3/4 acertos · +0 XP')
  await expect(card).toContainText('Meta atingida')
  await page.reload()
  await expect(card).toContainText('3/4 acertos · +0 XP')
  const call = platform.calls.find(call => call.path === 'course_review_sessions')
  expect(call?.query.get('user_id')).toBe(`eq.${ids.user}`)
  expect(call?.query.get('course_id')).toBe(`eq.${ids.course}`)
  expect(call?.query.get('finished_at')).toBe('not.is.null')
  expect(call?.query.get('order')).toBe('finished_at.desc,id.desc')
  expect(call?.query.get('limit')).toBe('1')
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    await page.getByLabel('Navegação entre módulos').scrollIntoViewIfNeeded()
    await expect(card).toContainText('3/4 acertos · +0 XP')
    await page.screenshot({ path: `../.scratch/issue-47-evidence/review-card-history-${width}.png`, animations: 'disabled' })
  }
})

test('histórico inválido exibe erro recuperável em vez de mostrar fatos alheios ou vazio', async ({ page, platform }) => {
  prepareCourse(platform)
  configureReview(platform)
  platform.on('course_review_sessions', () => ({ data: [finishedReview({ user_id: ids.friend })] }))
  await page.goto(`/dashboard?curso=${ids.course}`)
  const card = page.getByRole('complementary', { name: 'Revisão do curso', exact: true })
  await expect(card.getByRole('alert')).toHaveText('Não foi possível consultar a última revisão.')
  await expect(card).not.toContainText('3/4')
  await expect(card).not.toContainText('Nenhuma revisão finalizada')
  platform.on('course_review_sessions', () => ({ data: [finishedReview()] }))
  await card.getByRole('button', { name: 'Atualizar revisão' }).click()
  await expect(card).toContainText('3/4 acertos · +0 XP')
  await expect(card.getByRole('alert')).toHaveCount(0)
  await expect(card.getByRole('button')).toHaveCount(1)
})

test('bônus descoberto depois do início não converte sessão normal já aberta', async ({ page, platform }) => {
  prepareCourse(platform)
  configureReview(platform)
  platform.on('start_course_review', () => ({ data: [session('normal')] }))
  await page.goto(`/dashboard?curso=${ids.course}`)
  await page.getByRole('button', { name: 'Revisar curso', exact: true }).click()
  await page.getByRole('button', { name: 'Começar revisão' }).click()
  await expect(page.getByRole('heading', { name: 'Quanto é 1 + 1?' })).toBeVisible()
  platform.on('my_current_course_review', () => ({ data: [occurrence()] }))
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByRole('complementary', { name: 'Revisão do curso', exact: true })).toContainText('Bônus disponível')
  await expect(page.getByRole('dialog').getByText('Sem bônus de revisão')).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`revisao=normal&sessao=${sessionId}`))
  expect(platform.calls.filter(call => call.path === 'start_course_review')).toHaveLength(1)
})

test('troca de curso ignora histórico anterior ainda em trânsito', async ({ page, platform }) => {
  prepareCourse(platform)
  configureReview(platform, { occurrence: occurrence() })
  const otherCourse = '22222222-2222-4222-8222-333333333333'
  platform.tables.courses.push({ ...platform.tables.courses[0], id: otherCourse, title: 'Curso novo', slug: 'novo' })
  platform.tables.enrollments.push({ id: 'new-enrollment', user_id: ids.user, course_id: otherCourse, status: 'active', progress: 100 })
  platform.on('course_review_status', ({ body }) => ({ data: [status({ course_id: body.p_course_id, course_title: body.p_course_id === otherCourse ? 'Curso novo' : 'Lógica de Programação' })] }))
  let releaseOld: (() => void) | undefined
  const pendingOld = new Promise<void>(resolve => { releaseOld = resolve })
  platform.on('course_review_sessions', async ({ query }) => {
    if (query.get('course_id') === `eq.${otherCourse}`) return { data: [] }
    await pendingOld
    return { data: [finishedReview()] }
  })
  await page.goto(`/dashboard?curso=${ids.course}`)
  await expect.poll(() => platform.calls.some(call => call.path === 'course_review_sessions')).toBe(true)
  await page.getByRole('button', { name: 'Abrir seletor de cursos e salas' }).click()
  await page.getByRole('button', { name: /Curso novo/ }).click()
  const card = page.getByRole('complementary', { name: 'Revisão do curso', exact: true })
  await expect(card).toContainText('Curso novo')
  await expect(card).toContainText('Nenhuma revisão finalizada neste curso.')
  releaseOld?.()
  await expect(card.getByRole('button', { name: 'Revisar curso', exact: true })).toBeEnabled()
  await expect(card).not.toContainText('3/4')
  await expect(card).not.toContainText('Bônus disponível')
})

for (const scenario of ['outro curso', 'expirada'] as const) {
  test(`botão único usa prática normal quando ocorrência é ${scenario}`, async ({ page, platform }) => {
    prepareCourse(platform)
    configureReview(platform, { occurrence: occurrence(scenario === 'outro curso'
      ? { course_id: ids.educator, course_title: 'Outro curso' }
      : { state: 'expired', due_at: '2026-10-25T12:00:00.000Z', expires_at: '2026-11-01T12:00:00.000Z' }) })
    await page.goto(`/dashboard?curso=${ids.course}`)
    const card = page.getByRole('complementary', { name: 'Revisão do curso', exact: true })
    await expect(card.getByRole('button', { name: 'Revisar curso', exact: true })).toBeEnabled()
    await expect(card).not.toContainText('Bônus disponível')
    await expect(card).not.toContainText('Outro curso')
    await page.getByRole('button', { name: 'Revisar curso', exact: true }).click()
    await expect(page).toHaveURL(/revisao=normal/)
    await expect(page.getByRole('dialog').getByText('Sem bônus de revisão')).toBeVisible()
  })
}

test('sala que compartilha curso concluído não exibe cartão ou entrada de revisão', async ({ page, platform }) => {
  prepareCourse(platform)
  configureReview(platform, { occurrence: occurrence() })
  const roomId = '99999999-9999-4999-8999-999999999999'
  platform.tables.rooms.push({ id: roomId, course_id: ids.course, name: 'Sala compartilhada', educator_id: ids.educator, created_at: expiresAt })
  platform.tables.room_members.push({ room_id: roomId, user_id: ids.user, status: 'active', joined_at: expiresAt })
  await page.goto(`/dashboard?curso=${ids.course}&sala=${roomId}`)
  await expect(page.getByText('Sala: Sala compartilhada')).toBeAttached()
  await expect(page.getByRole('complementary', { name: 'Revisão do curso', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Revisar curso|revisão com bônus/ })).toHaveCount(0)
  await expect(page.getByText(/Bônus disponível/)).toHaveCount(0)
  expect(platform.calls.some(call => ['start_course_review', 'course_review_sessions', 'my_current_course_review'].includes(call.path))).toBe(false)
  await page.goto(`/dashboard?curso=${ids.course}&sala=${roomId}&revisao=${occurrenceId}`)
  await expect(page.getByRole('alert')).toContainText('Link de revisão inválido')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(platform.calls.some(call => call.path === 'start_course_review')).toBe(false)
  await page.goto(`/dashboard?curso=${ids.course}`)
  await expect(page.getByRole('button', { name: 'Revisar curso', exact: true })).toBeEnabled()
})
