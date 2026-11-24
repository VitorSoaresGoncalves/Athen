import { test, expect, ids } from './support/platform'
import type { Page } from '@playwright/test'

async function carouselControls(page: Page) {
  return page.locator('.module-carousel__arrow, .module-carousel__viewport').evaluateAll(elements => {
    const boxes = elements.map(element => element.getBoundingClientRect())
    const x = Math.min(...boxes.map(box => box.left))
    const y = Math.min(...boxes.map(box => box.top))
    return { x, y, width: Math.max(...boxes.map(box => box.right)) - x, height: Math.max(...boxes.map(box => box.bottom)) - y }
  })
}

for (const viewport of [{ width: 1024, height: 768 }, { width: 1280, height: 900 }, { width: 1440, height: 900 }, { width: 1440, height: 768 }]) {
  test(`regressão desktop preserva altura e posição da trilha em ${viewport.width}×${viewport.height}`, async ({ page, platform }, testInfo) => {
    await page.setViewportSize(viewport)
    platform.tables.enrollments.push({ id: 'layout-enrollment', user_id: ids.user, course_id: ids.course, status: 'active', progress: 100 })
    await page.goto(`/dashboard?curso=${ids.course}`)
    const card = page.getByRole('complementary', { name: 'Revisão do curso', exact: true })
    await expect(card).toBeVisible()
    await expect(card.getByRole('button', { name: 'Revisar curso', exact: true })).toBeDisabled()
    await expect(card).toContainText('Nenhuma revisão finalizada')
    const main = page.locator('.dashboard-main')
    // The fixed card does not contribute to normal flow. Removing only its
    // layout modifier gives the pre-card geometry of the same loaded trail.
    await main.evaluate(element => element.classList.remove('dashboard-main--review-card'))
    const referenceTrail = await page.getByLabel('Trilha de aprendizagem').boundingBox()
    const referenceCarousel = await page.getByLabel('Navegação entre módulos').boundingBox()
    await main.evaluate(element => element.classList.add('dashboard-main--review-card'))
    const trail = await page.getByLabel('Trilha de aprendizagem').boundingBox()
    const carousel = await page.getByLabel('Navegação entre módulos').boundingBox()
    const controls = await carouselControls(page)
    const cardBox = await card.boundingBox()
    const notebook = await page.locator('[data-toggle-notebook]').boundingBox()
    const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight)
    await page.screenshot({ path: testInfo.outputPath(`desktop-review-layout-${viewport.width}-${viewport.height}.png`), animations: 'disabled' })
    expect.soft(pageHeight, 'O cartão não pode criar rolagem vertical no desktop').toBeLessThanOrEqual(viewport.height)
    expect.soft(trail!.y).toBeCloseTo(referenceTrail!.y, 0)
    expect.soft(trail!.height).toBeCloseTo(referenceTrail!.height, 0)
    expect.soft(carousel!.y, 'O carrossel permanece na posição anterior ao cartão').toBeCloseTo(referenceCarousel!.y, 0)
    const intersects = (a: NonNullable<typeof cardBox>, b: NonNullable<typeof cardBox>) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
    expect.soft(intersects(cardBox!, controls), 'Cartão e controles do carrossel não se sobrepõem').toBe(false)
    expect.soft(intersects(cardBox!, notebook!), 'Cartão e caderno não se sobrepõem').toBe(false)
    expect(cardBox!.x + cardBox!.width).toBeLessThanOrEqual(viewport.width)
    expect(cardBox!.y + cardBox!.height).toBeLessThanOrEqual(viewport.height)
  })
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`histórico longo permanece alcançável sem sobreposição em ${viewport.width}px`, async ({ page, platform }, testInfo) => {
    await page.setViewportSize(viewport)
    platform.tables.enrollments.push({ id: 'history-layout', user_id: ids.user, course_id: ids.course, status: 'active', progress: 100 })
    platform.tables.course_review_sessions.push({
      id: ids.reviewSession, user_id: ids.user, course_id: ids.course, mode: 'normal',
      finished_at: '2026-11-15T12:00:00.000Z', correct_count: 3, total_count: 4,
      approved: true, bonus_earned: 0, bonus_outcome: 'not_applicable', xp_event_id: null,
    })
    await page.goto(`/dashboard?curso=${ids.course}`)
    const card = page.getByRole('complementary', { name: 'Revisão do curso', exact: true })
    await expect(card).toContainText('3/4 acertos · +0 XP')
    await page.getByLabel('Navegação entre módulos').scrollIntoViewIfNeeded()
    const carousel = await carouselControls(page)
    const cardBox = await card.boundingBox()
    const compact = viewport.width <= 1000 || viewport.height <= 600
    if (compact) {
      expect(await card.evaluate(element => getComputedStyle(element).position)).not.toBe('fixed')
      expect(cardBox!.y).toBeGreaterThanOrEqual(carousel!.y + carousel!.height - 1)
    } else {
      expect(carousel!.x + carousel!.width <= cardBox!.x || carousel!.y + carousel!.height <= cardBox!.y).toBe(true)
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(viewport.height)
    }
    await card.scrollIntoViewIfNeeded()
    await expect(card.getByRole('button', { name: 'Revisar curso', exact: true })).toBeInViewport()
    if (compact) expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(viewport.height)
    await page.screenshot({ path: testInfo.outputPath(`review-history-flow-${viewport.width}-${viewport.height}.png`), animations: 'disabled' })
  })
}
