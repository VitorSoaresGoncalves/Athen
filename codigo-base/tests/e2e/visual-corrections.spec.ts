import { expect, test, ids } from './support/platform'

test('dashboard ocupa viewport com controles sobrepostos e seletor sem escala', async ({ page, platform }, testInfo) => {
  platform.tables.enrollments.push({ user_id: ids.user, course_id: ids.course, status: 'active' })
  platform.tables.courses.push({ ...platform.tables.courses[0], id: 'other-course', title: 'Outro curso' })
  platform.tables.enrollments.push({ user_id: ids.user, course_id: 'other-course', status: 'active' })
  for (const viewport of [{ width: 320, height: 844 }, { width: 390, height: 844 }, { width: 760, height: 900 }, { width: 761, height: 900 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }, { width: 568, height: 320 }]) {
    await page.setViewportSize(viewport)
    await page.goto(`/dashboard?curso=${ids.course}`)
    await expect(page.getByRole('heading', { name: 'Primeira aula', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(viewport.height + 1)
    const selector = await page.locator('.dashboard-course-trigger').boundingBox()
    const notebook = await page.locator('.course-notebook-trigger').boundingBox()
    if (viewport.width <= 760) {
      expect(notebook!.y).toBeGreaterThanOrEqual(selector!.y + selector!.height + 8)
      expect(notebook!.x).toBe(selector!.x)
    } else {
      expect(notebook!.x).toBe(260 + 40)
      expect(selector!.x).toBe(notebook!.x)
      expect(notebook!.width).toBe(84)
      const rootFontSize = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize))
      expect(viewport.height - notebook!.y - notebook!.height).toBe(rootFontSize * 1.5)
    }
    const panel = await page.locator('.sidebarR__toggle').boundingBox()
    expect(panel!.x + panel!.width).toBeGreaterThan(viewport.width - 32)
    const activeNode = await page.locator('.trail-node--active').boundingBox()
    const footer = await page.locator('.dashboard-footer').boundingBox()
    expect(activeNode!.x < selector!.x + selector!.width && activeNode!.x + activeNode!.width > selector!.x
      && activeNode!.y < selector!.y + selector!.height && activeNode!.y + activeNode!.height > selector!.y).toBe(false)
    expect(activeNode!.y + activeNode!.height).toBeLessThanOrEqual(footer!.y)
    if (viewport.width <= 760) {
      const bell = await page.getByRole('link', { name: /Notificações/ }).boundingBox()
      const avatar = await page.getByRole('button', { name: 'Abrir opções de conta' }).boundingBox()
      const toggle = await page.getByRole('button', { name: 'Abrir navegação' }).boundingBox()
      for (const gap of [avatar!.x - bell!.x - bell!.width, toggle!.x - avatar!.x - avatar!.width]) {
        expect(gap).toBeGreaterThanOrEqual(8)
        expect(gap).toBeLessThanOrEqual(16)
      }
    }
    await page.locator('.dashboard-course-trigger').click()
    const cards = page.locator('.dashboard-picker__list > button')
    const sizes = await cards.evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect()
      return { width: box.width, height: box.height }
    }))
    expect(sizes[0]).toEqual(sizes[1])
    await page.getByRole('button', { name: 'Fechar seletor de cursos e salas' }).click()
    await page.screenshot({ path: testInfo.outputPath(`dashboard-${viewport.width}.png`), animations: 'disabled' })
  }
})

test('ligas informativas não mudam aparência com clique ou hover', async ({ page, platform }) => {
  platform.on('current_season', () => ({ data: [] }))
  await page.goto('/ligas')
  const badge = page.locator('.ligas__liga').first()
  const appearance = () => badge.evaluate(element => {
    const style = getComputedStyle(element)
    return { background: style.backgroundColor, border: style.borderColor, transform: style.transform }
  })
  await page.mouse.move(0, 0)
  const before = await appearance()
  await badge.click()
  await page.waitForTimeout(250)
  expect(await appearance()).toEqual(before)
  await expect(badge).not.toHaveAttribute('role', 'button')
})

test('revisão só abre pelo botão após conclusão e sinaliza bônus ativo do curso', async ({ page, platform }) => {
  platform.tables.enrollments.push({ user_id: ids.user, course_id: ids.course, status: 'active', progress: 100 })
  platform.on('course_review_status', () => ({ data: [{ course_id: ids.course, course_title: 'Lógica', can_review: true, reason: null, question_count: 1, sample_count: 1, module_counts: [] }] }))
  platform.on('my_current_course_review', () => ({ data: [{ occurrence_id: ids.reviewOccurrence, course_id: ids.course, course_title: 'Lógica', state: 'available', due_at: new Date().toISOString(), expires_at: new Date(Date.now() + 86400000).toISOString(), period_index: 1, bonus_xp: 10, delivery_state: 'suppressed', resume_session_id: null, last_finished_session_id: null, reward_session_id: null, rewarded_at: null }] }))
  await page.goto(`/dashboard?curso=${ids.course}`)
  await expect(page.getByRole('heading', { name: 'Primeira aula', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Revisar', exact: true })).toHaveCount(0)
  platform.tables.completions.push({ user_id: ids.user, lesson_id: ids.lesson, context: 'course', completed_at: new Date().toISOString() })
  await page.reload()
  const trigger = page.getByRole('button', { name: /Revisar/ }).first()
  await expect(trigger.getByRole('img', { name: 'Bônus de XP de revisão ativo' })).toBeVisible()
  await expect(page.locator('.course-review-card')).toHaveCount(0)
  const before = platform.calls.filter(call => call.path === 'start_course_review').length
  await trigger.click()
  await expect(page.getByRole('dialog', { name: 'Revisão do curso', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Revisar curso', exact: true })).toBeEnabled()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  expect(platform.calls.filter(call => call.path === 'start_course_review')).toHaveLength(before)
})
