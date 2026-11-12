import { test, expect } from './support/platform'

const pending = {
  occurrence_id: 'occ-pendente', definition_id: 'def1', scope: 'global_daily', objective: 'complete_lessons',
  code: 'daily-lesson', title: 'Conclua uma aula', description: 'Conclua uma aula hoje.',
  course_id: null, course_title: null, target: 1, reward_xp: 2,
  period_start: '2026-11-09T03:00:00Z', period_end: '2026-11-10T03:00:00Z', progress: 0, current_count: 0, completed: false,
}
const course = { ...pending, occurrence_id: 'occ-curso', scope: 'course_daily', title: 'Conclua aulas do curso', course_id: 'c1', course_title: 'Lógica de Programação', target: 2, current_count: 1, progress: 50 }
const completed = { ...pending, occurrence_id: 'occ-concluida', title: 'Estude em três dias', scope: 'global_weekly', objective: 'study_days', target: 3, current_count: 3, progress: 100, completed: true, reward_xp: 8 }

test.beforeEach(async ({ page, platform }) => {
  await page.clock.install({ time: new Date('2026-11-09T12:00:00Z') })
  platform.on('my_missions', () => ({ data: [pending, course, completed] }))
  platform.on('my_mission_detail', () => ({ data: [pending] }))
})

test('lista separa pendentes e concluídas com contexto, meta, progresso e bônus', async ({ page }) => {
  await page.goto('/missoes')
  await expect(page.getByRole('heading', { name: 'Pendentes', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Concluídas', exact: true })).toBeVisible()
  const card = page.getByRole('link', { name: 'Abrir detalhe da missão Conclua aulas do curso' })
  await expect(card).toContainText('Diária de curso · Lógica de Programação')
  await expect(card).toContainText('1/2')
  await expect(card.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
  await expect(card.getByLabel('Recompensa de 2 XP')).toBeVisible()
  const done = page.getByRole('link', { name: 'Abrir detalhe da missão Estude em três dias' })
  await expect(done).toContainText('concluída')
  await expect(done.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
})

test('detalhe mostra os valores e converte o prazo para Brasília', async ({ page }) => {
  await page.goto('/missoes/occ-pendente')
  await expect(page.getByRole('heading', { name: 'Conclua uma aula', exact: true })).toBeVisible()
  await expect(page.getByText('Concluir aulas', { exact: true })).toBeVisible()
  await expect(page.getByText('0/1', { exact: true })).toBeVisible()
  await expect(page.getByText('+2 XP', { exact: true })).toBeVisible()
  await expect(page.getByText(/10\/11\/2026.*00:00.*\(BRT\)/)).toBeVisible()
  await page.getByRole('link', { name: 'Escolher conteúdo para estudar' }).click()
  await expect(page).toHaveURL('/catalogo')
})

test('detalhe informa indisponibilidade de uma ocorrência inexistente', async ({ page, platform }) => {
  platform.on('my_mission_detail', () => ({ data: [] }))
  await page.goto('/missoes/inexistente')
  await expect(page.getByText(/Esta missão não está disponível/)).toBeVisible()
})

test('navegação posiciona Missões depois de Ligas e permite abrir a lista', async ({ page }) => {
  await page.goto('/ligas')
  const nav = page.getByRole('navigation')
  const names = await nav.getByRole('link').allTextContents()
  expect(names.indexOf('Missões')).toBe(names.indexOf('Ligas') + 1)
  await nav.getByRole('link', { name: 'Missões', exact: true }).click()
  await expect(page).toHaveURL('/missoes')
  await expect(page.getByRole('heading', { name: 'Missões', exact: true })).toBeVisible()
})

test('lista vazia explica ausência de missões', async ({ page, platform }) => {
  platform.on('my_missions', () => ({ data: [] }))
  await page.goto('/missoes')
  await expect(page.getByText('Nenhuma missão disponível no momento.')).toBeVisible()
})

for (const path of ['/missoes', '/missoes/occ-pendente']) {
  test(`falha da RPC em ${path} aparece como erro, sem estado vazio enganoso`, async ({ page, platform }) => {
    platform.on(path === '/missoes' ? 'my_missions' : 'my_mission_detail', () => ({ status: 400, data: { message: 'Missões indisponíveis' } }))
    await page.goto(path)
    await expect(page.getByText(/Missões indisponíveis/)).toBeVisible()
    await expect(page.getByText('Nenhuma missão disponível no momento.')).toHaveCount(0)
    await expect(page.getByText(/Esta missão não está disponível/)).toHaveCount(0)
  })
}
