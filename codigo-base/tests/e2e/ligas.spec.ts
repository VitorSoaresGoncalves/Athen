import { expect, test, type Page } from '@playwright/test'

// E2E da pagina de Ligas (U1, U2 do plano de testes da issue 42). O build de teste
// usa Supabase fake (example.supabase.co); aqui mockamos auth (localStorage) e as
// RPCs de temporada (current_season / my_season_summary / my_season_group) para
// exercitar a UI sem banco real.

const userId = '11111111-1111-4111-8111-111111111111'
const seasonId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

type Options = {
  // null => sem temporada corrente (estado de espera)
  season?: { id: string; status: string } | null
  summary?: Record<string, unknown> | null
  group?: Record<string, unknown>[]
  secondXp?: number
  failRefresh?: boolean
}

async function prepareLigas(page: Page, options: Options = {}) {
  await page.clock.install({ time: new Date('2026-11-04T12:00:00Z') })
  const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'aluno@example.test', user_metadata: {}, app_metadata: {} }
  await page.addInitScript(({ user }) => {
    localStorage.setItem('sb-example-auth-token', JSON.stringify({
      access_token: 'test-token', refresh_token: 'test-refresh', token_type: 'bearer',
      // A suíte avança até quatro dias para exercitar a janela final da semana.
      expires_at: Math.floor(Date.now() / 1000) + 14 * 24 * 3600, user,
    }))
  }, { user })

  const season = options.season === undefined
    ? { id: seasonId, status: 'open' }
    : options.season

  let leituras = 0
  await page.route('https://example.supabase.co/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.split('/').at(-1) ?? ''
    let data: unknown = []
    let status = 200

    if (path === 'user') data = user
    if (path === 'profiles') data = { id: userId, display_name: 'Aluno', username: 'aluno', streak_count: 0 }
    // RPCs de temporada (POST para /rest/v1/rpc/<nome>): retornam SETOF (arrays).
    if (path === 'current_season') {
      leituras++
      data = season ? [{ id: season.id, starts_at: '2026-11-02T03:00:00Z', ends_at: '2026-11-09T03:00:00Z', status: season.status }] : []
      if (leituras > 1 && options.failRefresh) { status = 503; data = { message: 'Falha simulada' } }
    }
    if (path === 'my_season_summary') data = options.summary === null ? [] : [options.summary ?? {
      season_id: seasonId, category: 'silver', group_id: 'g1', group_index: 1,
      season_xp: leituras > 1 ? options.secondXp ?? 240 : 240, final_rank: 3, result_category: null, group_size: 6,
    }]
    if (path === 'my_season_standings') data = (options.group ?? [
      { user_id: 'u1', display_name: 'Ana Ribeiro', avatar_url: null, banner_url: null, season_xp: 410, rank_position: 1, is_self: false, hidden: false },
      { user_id: 'u2', display_name: 'Bruno Carvalho', avatar_url: null, banner_url: null, season_xp: 305, rank_position: 2, is_self: false, hidden: false },
      { user_id: userId, display_name: 'Aluno', avatar_url: null, banner_url: null, season_xp: 240, rank_position: 3, is_self: true, hidden: false },
    ]).map(row => ({ movement: 'stayed', projected_category: 'silver', entry_kind: 'late', ...row,
      ...(row.is_self && leituras > 1 && options.secondXp !== undefined ? { season_xp: options.secondXp } : {}) }))

    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
  })

  await page.goto('/ligas')
}

test('U1: mostra a temporada corrente, a categoria e a classificação do próprio grupo', async ({ page }, testInfo) => {
  await prepareLigas(page)
  await expect(page.getByRole('heading', { name: 'Ligas', exact: true })).toBeVisible()
  // Resumo pessoal: categoria do usuário (Prata) e XP de temporada.
  await expect(page.getByText('SUA SEMANA')).toBeVisible()
  // "Liga Prata" aparece no resumo e na tabela; basta ao menos uma ocorrência.
  await expect(page.getByText('Liga Prata').first()).toBeVisible()
  await expect(page.getByText('XP DA SEMANA', { exact: true })).toBeVisible()
  // Classificação do próprio grupo lista os participantes por XP (nomes aparecem
  // no pódio e na lista; basta ao menos uma ocorrência).
  await expect(page.getByText('Ana Ribeiro').first()).toBeVisible()
  await expect(page.getByText('Bruno Carvalho').first()).toBeVisible()
  // A linha do próprio usuário é destacada como VOCÊ.
  await expect(page.getByText('VOCÊ').first()).toBeVisible()
  await expect(page.getByText('Temporada de 02/11 a 09/11 · termina em', { exact: false })).toBeVisible()
  await expect(page.getByText('Entrada durante a semana')).toBeVisible()
  await expect(page.getByText('Se a semana fechasse agora, você continuaria em Prata.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Atualizar', exact: true })).toHaveCount(0)
  await expect(page.locator('.ligas__liga')).toHaveCount(6)
  await expect(page.locator('.ligas__podio').getByRole('img')).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('ligas-temporada.png'), animations: 'disabled' })
})

test('U2: identidade oculta aparece sem nome, mas mantém posição e XP', async ({ page }) => {
  await prepareLigas(page, {
    group: [
      { user_id: userId, display_name: 'Aluno', avatar_url: null, banner_url: null, season_xp: 300, rank_position: 1, is_self: true, hidden: false },
      { user_id: 'u2', display_name: null, avatar_url: null, banner_url: null, season_xp: 120, rank_position: 2, is_self: false, hidden: true },
    ],
  })
  // A linha oculta vira "Participante oculto" (aparece no pódio e na lista) e conserva o XP.
  await expect(page.getByText('Participante oculto').first()).toBeVisible()
  await expect(page.getByText('120 XP').first()).toBeVisible()
})

test('estado sem temporada ativa quando não há corrente', async ({ page }) => {
  await prepareLigas(page, { season: null })
  await expect(page.getByText('Aguardando a próxima temporada')).toBeVisible()
  await expect(page.locator('.ligas__liga')).toHaveCount(6)
})

test('atualiza automaticamente o resumo a cada minuto', async ({ page }) => {
  await prepareLigas(page, { secondXp: 300 })
  const resumo = page.locator('.ligas__resumo')
  await expect(resumo.getByText('240', { exact: true })).toBeVisible()
  await page.clock.fastForward(60_000)
  await expect(resumo.getByText('300', { exact: true })).toBeVisible()
})

test('mantém os dados e apresenta aviso quando a atualização falha', async ({ page }) => {
  await prepareLigas(page, { failRefresh: true })
  await expect(page.getByText('Ana Ribeiro').first()).toBeVisible()
  await page.clock.fastForward(60_000)
  await expect(page.getByRole('alert')).toContainText('Exibindo os últimos dados carregados')
  await expect(page.getByText('Ana Ribeiro').first()).toBeVisible()
  await expect(page.locator('.ligas__resumo').getByText('240', { exact: true })).toBeVisible()
})

test('relê ao voltar para uma aba visível', async ({ page }) => {
  await prepareLigas(page, { secondXp: 300 })
  await expect(page.locator('.ligas__resumo').getByText('240', { exact: true })).toBeVisible()
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.clock.fastForward(60_000)
  await expect(page.locator('.ligas__resumo').getByText('240', { exact: true })).toBeVisible()
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(page.locator('.ligas__resumo').getByText('300', { exact: true })).toBeVisible()
})

test('mostra projeção, zonas, foto e preserva o contorno do usuário', async ({ page }, testInfo) => {
  await prepareLigas(page, { group: [
    { user_id: userId, display_name: 'Aluno', avatar_url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="36" height="36"%3E%3Crect width="36" height="36" fill="gold"/%3E%3C/svg%3E', season_xp: 300, rank_position: 1, is_self: true, hidden: false, movement: 'promoted', projected_category: 'gold', entry_kind: 'snapshot' },
    { user_id: 'u2', display_name: 'Bruno', avatar_url: null, season_xp: 10, rank_position: 2, is_self: false, hidden: false, movement: 'demoted', projected_category: 'bronze' },
    { user_id: 'u3', display_name: 'Zero', avatar_url: null, season_xp: 0, rank_position: 3, is_self: false, hidden: false, movement: 'demoted', projected_category: 'bronze' },
  ] })
  await expect(page.getByText('Inscrito no início da semana')).toBeVisible()
  await expect(page.getByText('Se a semana fechasse agora, você subiria para Ouro.')).toBeVisible()
  const promocao = page.getByRole('region', { name: 'Zona de promoção' })
  const rebaixamento = page.getByRole('region', { name: 'Zona de rebaixamento' })
  await expect(promocao.locator('.ligas__linha')).toHaveCount(1)
  await expect(rebaixamento.locator('.ligas__linha')).toHaveCount(1)
  await expect(promocao.getByText('Aluno', { exact: false })).toBeVisible()
  await expect(rebaixamento.getByText('Bruno', { exact: true })).toBeVisible()
  const eu = page.locator('.ligas__linha--voce')
  await expect(eu).toHaveClass(/ligas__linha--promocao/)
  await expect(eu.locator('img')).toBeVisible()
  await expect(eu.getByText('Sobe', { exact: true })).toBeVisible()
  expect(await eu.evaluate(el => getComputedStyle(el).boxShadow)).not.toBe('none')
  await expect(page.locator('.ligas__linha').filter({ hasText: 'Bruno' }).getByText('Desce', { exact: true })).toBeVisible()
  await expect(page.locator('.ligas__linha').filter({ hasText: 'Zero' }).getByText('Desce', { exact: true })).toHaveCount(0)
  await expect(page.locator('.ligas__linha-posicao')).toHaveText(['1º', '2º', '3º'])
  await page.screenshot({ path: testInfo.outputPath('ligas-zonas.png'), fullPage: true, animations: 'disabled' })
  await page.clock.fastForward(4 * 24 * 60 * 60 * 1000)
  await expect(page.locator('.ligas__linha').filter({ hasText: 'Zero' }).getByText('Desce', { exact: true })).toBeVisible()
  await expect(rebaixamento.locator('.ligas__linha')).toHaveCount(2)
  await expect(page.locator('.ligas__linha-posicao')).toHaveText(['1º', '2º', '3º'])
})

test('zonas na lista explicam grupo Bronze sem participantes elegíveis', async ({ page }, testInfo) => {
  await prepareLigas(page, {
    summary: { season_id: seasonId, category: 'bronze', group_id: 'g1', group_size: 8 },
    group: Array.from({ length: 8 }, (_, index) => ({
      user_id: index === 0 ? userId : `u${index}`, display_name: `Participante ${index + 1}`,
      season_xp: index < 6 ? 60 - index : 0, rank_position: index + 1,
      is_self: index === 0, hidden: false, movement: 'stayed', projected_category: 'bronze',
    })),
  })
  const promocao = page.getByRole('region', { name: 'Zona de promoção' })
  const permanencia = page.getByRole('region', { name: 'Zona de permanência' })
  const rebaixamento = page.getByRole('region', { name: 'Zona de rebaixamento' })
  await expect(promocao).toContainText('pelo menos 10 participantes com XP')
  await expect(rebaixamento).toContainText('Bronze não tem rebaixamento')
  await expect(promocao.locator('.ligas__linha')).toHaveCount(0)
  await expect(permanencia.locator('.ligas__linha')).toHaveCount(8)
  await expect(rebaixamento.locator('.ligas__linha')).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('ligas-zonas-bronze.png'), fullPage: true, animations: 'disabled' })
})

test('mostra entrada dedicada para usuário sem inscrição', async ({ page }) => {
  await prepareLigas(page, { summary: null, group: [] })
  await expect(page.getByRole('heading', { name: 'Conclua uma aula para entrar' })).toBeVisible()
  await expect(page.locator('.ligas__podio')).toHaveCount(0)
  await expect(page.locator('.ligas__tabela')).toHaveCount(0)
  await expect(page.locator('.ligas__liga--ativa')).toHaveCount(0)
})

test('legado sem tipo de entrada usa descrição neutra', async ({ page }) => {
  await prepareLigas(page, { group: [
    { user_id: userId, display_name: 'Aluno', season_xp: 240, rank_position: 1, is_self: true, hidden: false, entry_kind: null },
  ] })
  await expect(page.getByText('Inscrição registrada nesta temporada')).toBeVisible()
})

for (const width of [360, 768, 1440]) {
  test(`legibilidade e ausência de sobreposição em ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 })
    await prepareLigas(page)
    const main = page.locator('.ligas__main')
    await expect(page.getByText('SUA SEMANA')).toBeVisible()
    await main.scrollIntoViewIfNeeded()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    expect(await main.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1)
    await page.screenshot({ path: testInfo.outputPath(`ligas-${width}.png`), fullPage: true, animations: 'disabled' })
  })
}
