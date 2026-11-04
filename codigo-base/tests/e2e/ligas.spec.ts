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
}

async function prepareLigas(page: Page, options: Options = {}) {
  const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'aluno@example.test', user_metadata: {}, app_metadata: {} }
  await page.addInitScript(({ user }) => {
    localStorage.setItem('sb-example-auth-token', JSON.stringify({
      access_token: 'test-token', refresh_token: 'test-refresh', token_type: 'bearer',
      expires_at: Math.floor(Date.now() / 1000) + 3600, user,
    }))
  }, { user })

  const season = options.season === undefined
    ? { id: seasonId, status: 'open' }
    : options.season

  await page.route('https://example.supabase.co/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.split('/').at(-1) ?? ''
    let data: unknown = []
    const status = 200

    if (path === 'user') data = user
    if (path === 'profiles') data = { id: userId, display_name: 'Aluno', username: 'aluno', streak_count: 0 }
    // RPCs de temporada (POST para /rest/v1/rpc/<nome>): retornam SETOF (arrays).
    if (path === 'current_season') data = season ? [{ id: season.id, starts_at: '2026-10-26T03:00:00Z', ends_at: '2026-11-02T03:00:00Z', status: season.status }] : []
    if (path === 'my_season_summary') data = options.summary === null ? [] : [options.summary ?? {
      season_id: seasonId, category: 'silver', group_id: 'g1', group_index: 1,
      season_xp: 240, final_rank: 3, result_category: null, group_size: 6,
    }]
    if (path === 'my_season_group') data = options.group ?? [
      { user_id: 'u1', display_name: 'Ana Ribeiro', avatar_url: null, banner_url: null, season_xp: 410, rank_position: 1, is_self: false, hidden: false },
      { user_id: 'u2', display_name: 'Bruno Carvalho', avatar_url: null, banner_url: null, season_xp: 305, rank_position: 2, is_self: false, hidden: false },
      { user_id: userId, display_name: 'Aluno', avatar_url: null, banner_url: null, season_xp: 240, rank_position: 3, is_self: true, hidden: false },
    ]

    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
  })

  await page.goto('/ligas')
}

test('U1: mostra a temporada corrente, a categoria e a classificação do próprio grupo', async ({ page }, testInfo) => {
  await prepareLigas(page)
  await expect(page.getByRole('heading', { name: 'Ligas', exact: true })).toBeVisible()
  // Resumo pessoal: categoria do usuário (Prata) e XP de temporada.
  await expect(page.getByText('SUA TEMPORADA')).toBeVisible()
  // "Liga Prata" aparece no resumo e na tabela; basta ao menos uma ocorrência.
  await expect(page.getByText('Liga Prata').first()).toBeVisible()
  await expect(page.getByText('XP DA TEMPORADA', { exact: true })).toBeVisible()
  // Classificação do próprio grupo lista os participantes por XP (nomes aparecem
  // no pódio e na lista; basta ao menos uma ocorrência).
  await expect(page.getByText('Ana Ribeiro').first()).toBeVisible()
  await expect(page.getByText('Bruno Carvalho').first()).toBeVisible()
  // A linha do próprio usuário é destacada como VOCÊ.
  await expect(page.getByText('VOCÊ').first()).toBeVisible()
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
})
