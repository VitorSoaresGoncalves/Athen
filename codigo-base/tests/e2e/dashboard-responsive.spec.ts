import { expect, test, ids, installPlatform } from './support/platform'
import type { Page } from '@playwright/test'

const secondCourseId = '99999999-9999-4999-8999-999999999981'
const roomId = '99999999-9999-4999-8999-999999999982'
const notebookId = '99999999-9999-4999-8999-999999999983'
const pageId = '99999999-9999-4999-8999-999999999984'

function seedIndividual(platform: Awaited<ReturnType<typeof installPlatform>>) {
  platform.tables.enrollments.push({
    id: 'dashboard-responsive-enrollment',
    user_id: ids.user,
    course_id: ids.course,
    status: 'active',
    progress: 25,
  })
  platform.tables.modules.push(
    { ...platform.tables.modules[0], id: 'module-responsive-2', title: 'Segundo módulo', position: 1 },
    { ...platform.tables.modules[0], id: 'module-responsive-3', title: 'Terceiro módulo', position: 2 },
  )
  platform.tables.notebooks.push({
    id: notebookId,
    title: 'Lógica de Programação',
    user_id: ids.user,
    created_at: '2026-11-01T12:00:00Z',
  })
  platform.tables.notebook_pages.push({
    id: pageId,
    notebook_id: notebookId,
    title: 'Página inicial',
    content: 'Rascunho inicial',
    position: 0,
    created_at: '2026-11-01T12:00:00Z',
    updated_at: '2026-11-01T12:00:00Z',
  })
}

async function openDashboard(page: Page, size: { width: number; height: number } = { width: 390, height: 844 }) {
  await page.setViewportSize(size)
  await page.goto(`/dashboard?curso=${ids.course}`)
  await expect(page.getByRole('heading', { name: 'Primeira aula', exact: true })).toBeVisible()
}

async function expectVerticalOrder(page: Page) {
  const order = await page.evaluate(() => {
    const trigger = document.querySelector<HTMLElement>('.dashboard-course-trigger')
    const trail = document.querySelector<HTMLElement>('.trail-scroll')
    const footer = document.querySelector<HTMLElement>('.dashboard-footer')
    const card = document.querySelector<HTMLElement>('.course-review-card')
    return {
      triggerPosition: trigger && getComputedStyle(trigger).position,
      trailTop: trail?.getBoundingClientRect().top,
      footerTop: footer?.getBoundingClientRect().top,
      cardTop: card?.getBoundingClientRect().top,
      cardPosition: card && getComputedStyle(card).position,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      viewportHeight: document.documentElement.clientHeight,
    }
  })
  expect(order.documentWidth).toBeLessThanOrEqual(order.viewportWidth + 1)
  expect(order.triggerPosition).toBe('absolute')
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(order.viewportHeight + 1)
  expect(order.trailTop).toBeDefined()
  expect(order.footerTop).toBeGreaterThan(order.trailTop!)
  if (order.cardTop !== undefined) {
    expect(order.cardPosition).not.toBe('fixed')
    expect(order.cardTop).toBeGreaterThan(order.footerTop!)
  }
}

test('contexto individual em largura e altura compactas mantém trilha na viewport com controles sobrepostos', async ({ page, platform }) => {
  seedIndividual(platform)
  for (const size of [{ width: 390, height: 844 }, { width: 568, height: 320 }, { width: 1000, height: 900 }, { width: 1001, height: 600 }]) {
    await openDashboard(page, size)
    await expectVerticalOrder(page)
    await expect(page.getByRole('region', { name: 'Trilha de aprendizagem' })).toBeVisible()
    await expect(page.locator('.module-carousel')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Módulo anterior' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Próximo módulo' })).toBeVisible()
    await expect(page.locator('.course-review-card')).toHaveCount(0)
  }

  const nodes = page.locator('.trail-node')
  const lastIndex = (await nodes.count()) - 1
  await nodes.first().scrollIntoViewIfNeeded()
  await nodes.first().click()
  await expect(page.locator('[data-trail-index].trail-node--active')).toHaveAttribute('data-trail-index', '0')
  await nodes.nth(lastIndex).scrollIntoViewIfNeeded()
  await nodes.nth(lastIndex).click()
  await expect(page.locator('[data-trail-index].trail-node--active')).toHaveAttribute('data-trail-index', String(lastIndex))
  await page.getByRole('button', { name: 'Módulo anterior' }).click()
  await expect(page.locator('.module-carousel__button[aria-current="true"]')).toHaveCount(1)

  const selectedBefore = await page.locator('[data-trail-index].trail-node--active').getAttribute('data-trail-index')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('[data-trail-index].trail-node--active')).toHaveAttribute('data-trail-index', selectedBefore!)
  expect(platform.calls.filter(call => ['attempts', 'answers', 'notebook_pages'].includes(call.path) && call.method !== 'GET')).toEqual([])
})

test('modo sala e sem curso não exibem cartão nem ação de revisão; controles vazios continuam acessíveis', async ({ page, platform }) => {
  platform.tables.rooms.push({
    id: roomId,
    educator_id: ids.educator,
    course_id: ids.course,
    name: 'Sala responsiva',
    access_code: 'ABC123',
    created_at: '2026-11-01T12:00:00Z',
  })
  platform.tables.room_members.push({
    id: 'room-responsive-membership',
    room_id: roomId,
    user_id: ids.user,
    status: 'active',
    joined_at: '2026-11-01T12:00:00Z',
  })
  await page.setViewportSize({ width: 568, height: 320 })
  await page.goto(`/dashboard?curso=${ids.course}&sala=${roomId}`)
  await expect(page.getByText('Sala: Sala responsiva', { exact: true })).toBeAttached()
  await expect(page.locator('.course-review-card')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Revisar curso/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Abrir seletor de cursos e salas', exact: true })).toBeVisible()

  const mutatingStudyCallsBefore = platform.calls.filter(call =>
    ['attempts', 'answers', 'notebook_pages', 'notebooks'].includes(call.path) && call.method !== 'GET',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('.course-review-card')).toHaveCount(0)
  expect(platform.calls.filter(call =>
    ['attempts', 'answers', 'notebook_pages', 'notebooks'].includes(call.path) && call.method !== 'GET',
  )).toEqual(mutatingStudyCallsBefore)
  expect(platform.calls.filter(call => [
    'start_course_review',
    'submit_course_review_answer',
    'finalize_course_review',
    'finalize_attempt',
    'complete_empty_lesson',
  ].includes(call.path))).toEqual([])

  platform.tables.rooms = []
  platform.tables.room_members = []
  await page.goto('/dashboard')
  await expect(page.getByText('Você ainda não está matriculado em nenhum curso.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Abrir seletor de cursos e salas', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Criar notebook', exact: true })).toHaveCount(0)
  await expect(page.locator('.course-review-card')).toHaveCount(0)
})

test('limites 999/1000/1001px e 599/600/601px preservam composição sobreposta sem resetar seleção', async ({ page, platform }) => {
  seedIndividual(platform)
  await openDashboard(page, { width: 1000, height: 900 })
  const active = page.locator('[data-trail-index].trail-node--active')
  const selected = await active.getAttribute('data-trail-index')
  for (const size of [
    { width: 999, height: 900, compact: true },
    { width: 1000, height: 900, compact: true },
    { width: 1001, height: 900, compact: false },
    { width: 1200, height: 599, compact: true },
    { width: 1200, height: 600, compact: true },
    { width: 1200, height: 601, compact: false },
  ]) {
    await page.setViewportSize({ width: size.width, height: size.height })
    const positions = await page.evaluate(() => ({
      courseTrigger: getComputedStyle(document.querySelector('.dashboard-course-trigger')!).position,
      scrollHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(positions.courseTrigger).toBe('absolute')
    expect(positions.scrollHeight).toBeLessThanOrEqual(size.height + 1)
    expect(positions.scrollWidth).toBeLessThanOrEqual(positions.clientWidth + 1)
    await expect(active).toHaveAttribute('data-trail-index', selected!)
  }
  expect(platform.calls.filter(call => ['attempts', 'answers', 'notebook_pages', 'notebooks'].includes(call.path) && call.method !== 'GET')).toEqual([])
})

test('SidebarRight compacto é disclosure operável, não prende foco e preserva estado ao redimensionar', async ({ page, platform }) => {
  seedIndividual(platform)
  await openDashboard(page, { width: 390, height: 844 })
  const open = page.getByRole('button', { name: 'Abrir painel', exact: true })
  await expect(open).toHaveAttribute('aria-expanded', 'false')
  const callsBefore = platform.calls.length
  await open.click()
  const close = page.getByRole('button', { name: 'Recolher painel', exact: true })
  await expect(close).toHaveAttribute('aria-expanded', 'true')
  await expect(close).toHaveAttribute('aria-controls', /.+/)
  await expect(page.getByText('Nenhuma missão pendente agora.', { exact: true })).toBeVisible()
  await page.setViewportSize({ width: 568, height: 320 })
  await expect(close).toBeVisible()
  await expect(close).toHaveAttribute('aria-expanded', 'true')
  await close.focus()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Abrir painel', exact: true })).toBeFocused()
  expect(platform.calls.slice(callsBefore).filter(call =>
    (['attempts', 'answers', 'notebook_pages', 'notebooks'].includes(call.path) && call.method !== 'GET')
    || ['start_course_review', 'submit_course_review_answer', 'finalize_course_review'].includes(call.path),
  )).toEqual([])
})

test('erro de dependência no painel não é apresentado como lista vazia nem bloqueia recolher', async ({ page, platform }) => {
  seedIndividual(platform)
  platform.on('friends_course_pac', () => ({ status: 503, data: { message: 'Ranking indisponível para ensaio.' } }))
  platform.on('my_missions', () => ({ status: 503, data: { message: 'Missões indisponíveis para ensaio.' } }))
  await openDashboard(page, { width: 568, height: 320 })
  await page.getByRole('button', { name: 'Abrir painel', exact: true }).click()
  await expect(page.getByText(/Ranking indisponível para ensaio\./)).toBeVisible()
  await expect(page.getByText(/Missões indisponíveis para ensaio\./)).toBeVisible()
  await expect(page.getByText('Nenhuma missão pendente agora.', { exact: true })).toHaveCount(0)
  const close = page.getByRole('button', { name: 'Recolher painel', exact: true })
  await expect(close).toBeVisible()
  await close.click()
  await expect(page.getByRole('button', { name: 'Abrir painel', exact: true })).toBeVisible()
})

test('seletor compacto contém foco, fecha por Escape sem descartar rascunho e não fabrica mutações', async ({ page, platform }) => {
  seedIndividual(platform)
  platform.tables.courses.push({
    ...platform.tables.courses[0],
    id: secondCourseId,
    title: 'Curso alternativo',
    slug: 'alternativo',
  })
  platform.tables.enrollments.push({
    id: 'dashboard-responsive-enrollment-2',
    user_id: ids.user,
    course_id: secondCourseId,
    status: 'active',
    progress: 0,
  })
  await openDashboard(page, { width: 390, height: 844 })
  await page.getByRole('button', { name: 'Abrir notebook', exact: true }).click()
  const notebook = page.locator('[role="dialog"][aria-labelledby="course-notebook-title"]')
  await expect(notebook).toBeVisible()
  const editor = notebook.getByPlaceholder('Escreva suas anotações aqui...')
  await editor.fill('Rascunho permanece com seletor aberto.')
  await page.getByRole('button', { name: 'Abrir seletor de cursos e salas', exact: true }).click()

  const picker = page.getByRole('dialog', { name: 'Selecionar curso ou sala', exact: true })
  await expect(picker).toBeVisible()
  await expect(picker.getByRole('button', { name: /Curso alternativo/ })).toBeVisible()
  const focusable = picker.locator('button:visible:not([disabled]), a[href]:visible, input:visible:not([disabled]), select:visible:not([disabled])')
  const first = focusable.first()
  const last = focusable.last()
  await expect.poll(async () => picker.evaluate(dialog => dialog.contains(document.activeElement))).toBe(true)
  await first.focus()
  await page.keyboard.press('Shift+Tab')
  await expect(last).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(first).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(picker).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Abrir seletor de cursos e salas', exact: true })).toBeFocused()
  await expect(editor).toHaveValue('Rascunho permanece com seletor aberto.')
  await expect(notebook.getByRole('button', { name: 'Fechar notebook', exact: true })).toBeVisible()
  expect(platform.calls.filter(call => ['attempts', 'answers', 'notebook_pages', 'notebooks'].includes(call.path) && call.method !== 'GET')).toEqual([])
})

test('seletor permite escolher curso e sala; sala sem curso é desabilitada e nunca abre revisão', async ({ page, platform }) => {
  seedIndividual(platform)
  platform.tables.courses.push({
    ...platform.tables.courses[0],
    id: secondCourseId,
    title: 'Curso alternativo',
    slug: 'alternativo',
  })
  platform.tables.enrollments.push({
    id: 'dashboard-responsive-enrollment-2',
    user_id: ids.user,
    course_id: secondCourseId,
    status: 'active',
    progress: 0,
  })
  platform.tables.modules.push({
    ...platform.tables.modules[0],
    id: 'module-alternative-course',
    course_id: secondCourseId,
    title: 'Módulo alternativo',
    position: 0,
  })
  platform.tables.rooms.push(
    {
      id: roomId,
      educator_id: ids.educator,
      course_id: ids.course,
      name: 'Sala disponível',
      access_code: 'SALA1',
      created_at: '2026-11-01T12:00:00Z',
    },
    {
      id: '99999999-9999-4999-8999-999999999985',
      educator_id: ids.educator,
      course_id: null,
      name: 'Sala sem curso',
      access_code: 'SEMCRS',
      created_at: '2026-11-02T12:00:00Z',
    },
  )
  platform.tables.room_members.push(
    { id: 'room-membership-available', room_id: roomId, user_id: ids.user, status: 'active', joined_at: '2026-11-01T12:00:00Z' },
    { id: 'room-membership-unavailable', room_id: '99999999-9999-4999-8999-999999999985', user_id: ids.user, status: 'active', joined_at: '2026-11-02T12:00:00Z' },
  )
  await openDashboard(page, { width: 390, height: 844 })
  const openPicker = page.getByRole('button', { name: 'Abrir seletor de cursos e salas', exact: true })
  await openPicker.click()
  const picker = page.getByRole('dialog', { name: 'Selecionar curso ou sala', exact: true })
  await picker.getByRole('button', { name: /Curso alternativo/ }).click()
  await expect(page.getByRole('heading', { name: 'Módulo alternativo', exact: true })).toBeVisible()
  await expect(page).not.toHaveURL(/sala=/)
  await expect(page.getByRole('button', { name: 'Abrir seletor de cursos e salas', exact: true })).toBeFocused()

  await page.getByRole('button', { name: 'Abrir seletor de cursos e salas', exact: true }).click()
  const roomTab = page.getByRole('button', { name: 'Salas', exact: true })
  await roomTab.click()
  const unavailableRoom = picker.getByRole('button', { name: 'Abrir a sala Sala sem curso', exact: true })
  await expect(unavailableRoom).toBeDisabled()
  await expect(unavailableRoom).toHaveAttribute('title', /não tem um curso disponível/)
  await expect(unavailableRoom).toContainText('Esta sala não tem um curso disponível para você.')
  await picker.getByRole('button', { name: 'Abrir a sala Sala disponível', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`sala=${roomId}`))
  await expect(page.getByText('Sala: Sala disponível', { exact: true })).toBeAttached()
  await expect(page.getByRole('button', { name: 'Abrir seletor de cursos e salas', exact: true })).toBeFocused()
  await expect(page.locator('.course-review-card')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Revisar curso/ })).toHaveCount(0)
  expect(platform.calls.some(call => ['start_course_review', 'submit_course_review_answer', 'finalize_course_review'].includes(call.path))).toBe(false)
})

test('seletor apresenta estados vazios de cursos e salas sem fabricar mutações', async ({ page, platform }) => {
  await page.setViewportSize({ width: 320, height: 201 })
  await page.goto('/dashboard')
  const trigger = page.getByRole('button', { name: 'Abrir seletor de cursos e salas', exact: true })
  await expect(trigger).toBeVisible()
  await trigger.click()
  const picker = page.getByRole('dialog', { name: 'Selecionar curso ou sala', exact: true })
  await expect(picker).toBeVisible()
  await expect(picker.getByText(/Você não está matriculado em nenhum curso\./)).toBeVisible()
  await picker.getByRole('button', { name: 'Salas', exact: true }).click()
  await expect(picker.getByText(/Você não participa de nenhuma sala\./)).toBeVisible()
  await expect(picker.getByRole('button', { name: 'Fechar seletor de cursos e salas', exact: true })).toBeVisible()
  expect(platform.calls.filter(call =>
    ['attempts', 'answers', 'notebook_pages', 'notebooks'].includes(call.path) && call.method !== 'GET',
  )).toEqual([])
})

test('erro ao carregar salas no seletor permanece erro e não é ocultado como estado vazio', async ({ page, platform }) => {
  seedIndividual(platform)
  platform.on('rooms', () => ({ status: 503, data: { message: 'Falha controlada ao listar salas.' } }))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'Primeira aula', exact: true })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Abrir seletor de cursos e salas', exact: true }).click()
  const picker = page.getByRole('dialog', { name: 'Selecionar curso ou sala', exact: true })
  await picker.getByRole('button', { name: 'Salas', exact: true }).click()
  await expect(picker.getByText(/Falha controlada ao listar salas\./)).toBeVisible()
  await expect(picker.getByText(/Você não participa de nenhuma sala\./)).toHaveCount(0)
  await expect(picker.getByRole('button', { name: 'Fechar seletor de cursos e salas', exact: true })).toBeVisible()
})

test('seletor com lista longa permite rolar e acionar primeiro e último curso com título extenso', async ({ page, platform }) => {
  seedIndividual(platform)
  const longCourses = Array.from({ length: 12 }, (_, index) => {
    const id = `aaaaaaaa-aaaa-4aaa-8aaa-${String(index + 1).padStart(12, '0')}`
    const moduleId = `bbbbbbbb-bbbb-4bbb-8bbb-${String(index + 1).padStart(12, '0')}`
    const lessonId = `cccccccc-cccc-4ccc-8ccc-${String(index + 1).padStart(12, '0')}`
    const title = `Curso${index + 1}`.padEnd(80, 'X')
    platform.tables.courses.push({
      ...platform.tables.courses[0],
      id,
      title,
      slug: `curso-longo-${index + 1}`,
    })
    platform.tables.enrollments.push({
      id: `dashboard-picker-enrollment-${index + 1}`,
      user_id: ids.user,
      course_id: id,
      status: 'active',
      progress: 0,
    })
    if (index === 0 || index === 11) {
      platform.tables.modules.push({
        ...platform.tables.modules[0],
        id: moduleId,
        course_id: id,
        title: index === 0 ? 'Módulo do primeiro curso' : 'Módulo do último curso',
        position: 0,
      })
      platform.tables.lessons.push({
        ...platform.tables.lessons[0],
        id: lessonId,
        module_id: moduleId,
        title: index === 0 ? 'Aula do primeiro curso' : 'Aula do último curso',
        position: 0,
      })
    }
    return { id, title }
  })
  await openDashboard(page, { width: 320, height: 844 })
  await page.getByRole('button', { name: 'Abrir seletor de cursos e salas', exact: true }).click()
  const picker = page.getByRole('dialog', { name: 'Selecionar curso ou sala', exact: true })
  const cards = picker.locator('.dashboard-picker__list > button')
  await expect(cards).toHaveCount(13)
  const first = cards.nth(1)
  await first.scrollIntoViewIfNeeded()
  await expect(first).toContainText(longCourses[0].title)
  await first.click()
  await expect(page.getByRole('heading', { name: 'Aula do primeiro curso', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Abrir seletor de cursos e salas', exact: true }).click()
  const lastCourse = page.getByRole('dialog', { name: 'Selecionar curso ou sala', exact: true })
    .locator('.dashboard-picker__list > button').filter({ hasText: longCourses[11].title })
  await lastCourse.scrollIntoViewIfNeeded()
  await expect(lastCourse).toBeVisible()
  await lastCourse.click()
  await expect(page.getByRole('heading', { name: 'Aula do último curso', exact: true })).toBeVisible()
  expect(platform.calls.filter(call =>
    ['attempts', 'answers', 'notebook_pages', 'notebooks'].includes(call.path) && call.method !== 'GET',
  )).toEqual([])
})
