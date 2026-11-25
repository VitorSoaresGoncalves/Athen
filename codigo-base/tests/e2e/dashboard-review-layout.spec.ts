import { test, expect, ids } from './support/platform'

for (const completed of [false, true]) {
  test(`atalhos cabem em paisagem com navegação aberta e curso ${completed ? 'concluído' : 'em andamento'}`, async ({ page, platform }, testInfo) => {
    await page.setViewportSize({ width: 568, height: 320 })
    platform.tables.enrollments.push({ user_id: ids.user, course_id: ids.course, status: 'active' })
    if (completed) platform.tables.completions.push({ user_id: ids.user, lesson_id: ids.lesson, context: 'course', completed_at: new Date().toISOString() })
    platform.tables.notebooks.push({ id: 'landscape-notebook', user_id: ids.user, title: platform.tables.courses.find(course => course.id === ids.course)!.title })
    await page.goto(`/dashboard?curso=${ids.course}`)
    const selector = page.getByRole('button', { name: 'Abrir seletor de cursos e salas', exact: true })
    const notebook = page.getByRole('button', { name: 'Abrir notebook', exact: true })
    const review = page.getByRole('button', { name: 'Revisar', exact: true })
    await expect(notebook).toBeEnabled()
    await expect(review).toHaveCount(completed ? 1 : 0)
    await page.getByRole('button', { name: 'Abrir navegação', exact: true }).click()

    const shortcuts = completed ? [selector, review, notebook] : [selector, notebook]
    const bounds = []
    for (const shortcut of shortcuts) {
      const box = await shortcut.boundingBox()
      expect(box!.height).toBeGreaterThanOrEqual(44)
      expect(box!.y).toBeGreaterThanOrEqual(0)
      expect(box!.y + box!.height).toBeLessThanOrEqual(320)
      expect(await shortcut.evaluate(element => {
        const rect = element.getBoundingClientRect()
        return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2))
      })).toBe(true)
      for (const previous of bounds) {
        expect(box!.x < previous.x + previous.width && box!.x + box!.width > previous.x
          && box!.y < previous.y + previous.height && box!.y + box!.height > previous.y).toBe(false)
      }
      bounds.push(box!)
    }
    const title = await page.locator('.dashboard-header').boundingBox()
    const lastShortcut = bounds.at(-1)!
    expect(title!.x).toBeGreaterThanOrEqual(lastShortcut.x + lastShortcut.width + 12)
    for (const arrow of await page.locator('.module-carousel__arrow').all()) {
      expect(await arrow.evaluate(element => {
        const rect = element.getBoundingClientRect()
        return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2))
      })).toBe(true)
    }
    await page.screenshot({ path: testInfo.outputPath('atalhos-paisagem-navegacao-aberta.png'), animations: 'disabled' })
    await selector.click()
    const picker = page.getByRole('dialog', { name: 'Selecionar curso ou sala', exact: true })
    await expect(picker).toBeInViewport({ ratio: 1 })
    await picker.getByRole('button', { name: 'Fechar seletor de cursos e salas', exact: true }).click()
    await expect(selector).toBeFocused()
    await notebook.click()
    const notebookDialog = page.locator('[role="dialog"][aria-labelledby="course-notebook-title"]')
    await expect(notebookDialog).toBeInViewport({ ratio: 1 })
    await notebookDialog.getByRole('button', { name: 'Fechar notebook', exact: true }).click()
    await expect(notebook).toBeFocused()
    if (completed) {
      await review.click()
      await expect(page.getByRole('dialog', { name: 'Revisão do curso', exact: true })).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(review).toBeFocused()
    }
    await page.getByRole('button', { name: 'Recolher navegação', exact: true }).click()
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(notebook).toBeInViewport({ ratio: 1 })
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(844)
  })
}

for (const viewport of [{ width: 390, height: 844 }, { width: 568, height: 320 }, { width: 1024, height: 768 }, { width: 1280, height: 900 }, { width: 1440, height: 900 }, { width: 1440, height: 768 }]) {
  test(`revisão sob demanda preserva trilha em ${viewport.width}×${viewport.height}`, async ({ page, platform }, testInfo) => {
    await page.setViewportSize(viewport)
    platform.tables.enrollments.push({ user_id: ids.user, course_id: ids.course, status: 'active', progress: 100 })
    platform.tables.completions.push({ user_id: ids.user, lesson_id: ids.lesson, context: 'course', completed_at: new Date().toISOString() })
    platform.tables.course_review_sessions.push({
      id: ids.reviewSession, user_id: ids.user, course_id: ids.course, mode: 'normal',
      finished_at: '2026-11-15T12:00:00.000Z', correct_count: 3, total_count: 4,
      approved: true, bonus_earned: 0, bonus_outcome: 'not_applicable', xp_event_id: null,
    })
    await page.goto(`/dashboard?curso=${ids.course}`)
    const trigger = page.getByRole('button', { name: 'Revisar', exact: true })
    await expect(trigger).toBeVisible()
    await expect(page.locator('.course-review-card')).toHaveCount(0)
    const trail = await page.getByLabel('Trilha de aprendizagem').boundingBox()
    const carousel = await page.getByLabel('Navegação entre módulos').boundingBox()
    const triggerBox = await trigger.boundingBox()
    const courseTriggerBox = await page.locator('.dashboard-course-trigger').boundingBox()
    const notebookBox = await page.locator('.course-notebook-trigger').boundingBox()
    await expect(trigger.locator('.course-review-entry__icon')).toBeVisible()
    expect(triggerBox!.y + triggerBox!.height).toBeLessThanOrEqual(carousel!.y)
    if (viewport.width <= 760) {
      expect(triggerBox!.y).toBeGreaterThan(courseTriggerBox!.y + courseTriggerBox!.height)
      expect(notebookBox!.y - triggerBox!.y - triggerBox!.height).toBe(12)
      expect(triggerBox!.x).toBe(courseTriggerBox!.x)
      expect(notebookBox!.x).toBe(courseTriggerBox!.x)
    } else {
      expect(triggerBox!.y).toBeGreaterThan(courseTriggerBox!.y)
      expect(triggerBox!.x).toBe(courseTriggerBox!.x)
      expect(notebookBox!.y).toBeGreaterThan(triggerBox!.y)
    }
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(viewport.height)
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: 'Revisão do curso', exact: true })
    await expect(dialog).toContainText('3/4 acertos · +0 XP')
    await expect(dialog.getByRole('button', { name: 'Revisar curso', exact: true })).toBeInViewport()
    const bounds = await dialog.boundingBox()
    const action = await dialog.getByRole('button', { name: 'Revisar curso', exact: true }).boundingBox()
    expect(action!.y + action!.height).toBeLessThanOrEqual(bounds!.y + bounds!.height - 8)
    expect(bounds!.y).toBeGreaterThanOrEqual(0)
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height)
    await page.screenshot({ path: testInfo.outputPath(`review-dialog-${viewport.width}-${viewport.height}.png`), animations: 'disabled' })
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
    expect(await page.getByLabel('Trilha de aprendizagem').boundingBox()).toEqual(trail)
    expect(await page.getByLabel('Navegação entre módulos').boundingBox()).toEqual(carousel)
  })
}
