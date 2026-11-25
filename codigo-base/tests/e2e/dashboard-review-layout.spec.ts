import { test, expect, ids } from './support/platform'

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
    expect(triggerBox!.y + triggerBox!.height).toBeLessThanOrEqual(carousel!.y)
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
