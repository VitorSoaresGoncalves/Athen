import { expect, test, type Page } from '@playwright/test'

// E2E da pagina de Missoes e navegacao (U3, U4, U5 do plano da issue 42). Mocka
// auth e a RPC my_missions / my_mission_detail. O TopDown (U6) depende de curso
// ativo no dashboard e e exercitado no spec do dashboard; aqui cobrimos a pagina
// dedicada e o detalhe.

const userId = '11111111-1111-4111-8111-111111111111'
const occPendente = 'occ-pendente-0001'
const occConcluida = 'occ-concluida-0001'

const missaoPendente = {
  occurrence_id: occPendente, definition_id: 'def1', scope: 'global_daily', objective: 'complete_lessons',
  code: 'global_daily_complete_lesson', title: 'Conclua uma aula', description: 'Conclua uma aula hoje.',
  course_id: null, course_title: null, target: 1, reward_xp: 2,
  period_start: '2026-11-01T03:00:00Z', period_end: '2030-11-02T03:00:00Z',
  progress: 0, current_count: 0, completed: false,
}
const missaoCurso = {
  occurrence_id: 'occ-curso', definition_id: 'def2', scope: 'course_daily', objective: 'complete_lessons',
  code: 'course_daily_complete_lesson', title: 'Conclua uma aula do curso', description: null,
  course_id: 'c1', course_title: 'Lógica de Programação', target: 1, reward_xp: 1,
  period_start: '2026-11-01T03:00:00Z', period_end: '2030-11-02T03:00:00Z',
  progress: 50, current_count: 0, completed: false,
}
const missaoConcluida = {
  occurrence_id: occConcluida, definition_id: 'def3', scope: 'global_weekly', objective: 'study_days',
  code: 'global_weekly_study_3_days', title: 'Estude em três dias', description: null,
  course_id: null, course_title: null, target: 3, reward_xp: 8,
  period_start: '2026-10-26T03:00:00Z', period_end: '2030-11-02T03:00:00Z',
  progress: 100, current_count: 3, completed: true,
}

async function prepare(page: Page, options: { missions?: unknown[]; detail?: unknown } = {}) {
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
    let data: unknown = []
    if (path === 'user') data = user
    if (path === 'profiles') data = { id: userId, display_name: 'Aluno', username: 'aluno', streak_count: 0 }
    if (path === 'my_missions') data = options.missions ?? [missaoPendente, missaoCurso, missaoConcluida]
    if (path === 'my_mission_detail') data = options.detail !== undefined ? options.detail : [missaoPendente]
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
  })
}

test('U3: lista pendentes e concluídas com contexto, meta, progresso e bônus', async ({ page }, testInfo) => {
  await prepare(page)
  await page.goto('/missoes')
  await expect(page.getByRole('heading', { name: 'Missões', exact: true })).toBeVisible()
  // Seções
  await expect(page.getByRole('heading', { name: 'Pendentes', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Concluídas', exact: true })).toBeVisible()
  // Rótulo de contexto (global e curso) e bônus
  await expect(page.getByText('Diária global').first()).toBeVisible()
  await expect(page.getByText('Diária de curso · Lógica de Programação')).toBeVisible()
  await expect(page.getByText('+2 XP')).toBeVisible()
  // A concluída aparece na sua seção
  await expect(page.getByText('Estude em três dias')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('missoes-lista.png'), animations: 'disabled' })
})

test('U4: detalhe mostra critério, meta, prazo com fuso e recompensa', async ({ page }) => {
  await prepare(page)
  await page.goto('/missoes/' + occPendente)
  await expect(page.getByRole('heading', { name: 'Conclua uma aula', exact: true })).toBeVisible()
  await expect(page.getByText('Critério')).toBeVisible()
  await expect(page.getByText('Concluir aulas')).toBeVisible()
  await expect(page.getByText('Recompensa')).toBeVisible()
  await expect(page.getByText('Prazo')).toBeVisible()
  // Prazo com fuso (BRT) exibido.
  await expect(page.getByText(/BRT/)).toBeVisible()
})

test('U4: detalhe indisponível quando a ocorrência não existe', async ({ page }) => {
  await prepare(page, { detail: [] })
  await page.goto('/missoes/inexistente')
  await expect(page.getByText(/Esta missão não está disponível/)).toBeVisible()
})

test('U5: navegação tem "Missões" ao lado de "Ligas" e leva à página', async ({ page }) => {
  await prepare(page)
  await page.goto('/missoes')
  // O item de navegação existe e aponta para /missoes.
  const navMissoes = page.getByRole('link', { name: 'Missões', exact: true })
  await expect(navMissoes.first()).toBeVisible()
  // E o item de Ligas também está na navegação (ordem preservada).
  await expect(page.getByRole('link', { name: 'Ligas', exact: true }).first()).toBeVisible()
})

test('lista vazia quando não há missões', async ({ page }) => {
  await prepare(page, { missions: [] })
  await page.goto('/missoes')
  await expect(page.getByText('Nenhuma missão disponível no momento.')).toBeVisible()
})
