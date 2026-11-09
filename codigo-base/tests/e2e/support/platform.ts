import { test as base, expect, type Page, type Route } from '@playwright/test'

// Simula somente a fronteira HTTP. Correção, XP e RLS continuam sendo testados no SQL.
export const ids = {
  user: '11111111-1111-4111-8111-111111111111',
  educator: '11111111-1111-4111-8111-222222222222',
  friend: '11111111-1111-4111-8111-333333333333',
  course: '22222222-2222-4222-8222-222222222222',
  module: '33333333-3333-4333-8333-333333333333',
  lesson: '44444444-4444-4444-8444-444444444444',
  question: '55555555-5555-4555-8555-555555555555',
  attempt: '66666666-6666-4666-8666-666666666666',
}
type Row = Record<string, unknown>
type Reply = { data?: unknown; status?: number }
type Call = { path: string; method: string; body: Record<string, unknown>; query: URLSearchParams }
type Handler = (call: Call) => Reply | Promise<Reply>
const date = '2026-11-01T12:00:00Z'

export function platformData(): Record<string, Row[]> {
  return {
    profiles: [
      { id: ids.user, display_name: 'Carla Estudante', username: 'carla', role: 'student', xp_global: 0, level: 1, streak_count: 0, bio: 'Aprendendo com Athen', notification_preferences: {}, avatar_url: null, banner_url: null, created_at: date },
      { id: ids.educator, display_name: 'Ana Educadora', username: 'ana', role: 'educator', xp_global: 0, level: 1, streak_count: 0, created_at: date },
      { id: ids.friend, display_name: 'Diego Colega', username: 'diego', role: 'student', xp_global: 20, level: 1, streak_count: 0, created_at: date },
    ],
    courses: [{ id: ids.course, creator_id: ids.educator, title: 'Lógica de Programação', slug: 'logica', category: 'Tecnologia', description: 'Primeiros passos em lógica.', status: 'published', visibility: 'public', tags: [], cover_url: null, created_at: date, updated_at: date }],
    modules: [{ id: ids.module, course_id: ids.course, title: 'Fundamentos', description: 'Comece aqui', position: 0, color: '#06b6d4', icon: '📘', created_at: date }],
    lessons: [{ id: ids.lesson, module_id: ids.module, title: 'Primeira aula', content: 'Aprenda a reconhecer uma expressão.', position: 0, status: 'published', created_at: date }],
    questions: [{ id: ids.question, lesson_id: ids.lesson, type: 'multiple_choice', prompt: 'Quanto é 1 + 1?', position: 0, xp_value: 4, config: { options: [{ id: 'a', text: 'Dois', correct: true }, { id: 'b', text: 'Três', correct: false }] } }],
    enrollments: [], completions: [], attempts: [], answers: [], rooms: [], room_members: [],
    reviews: [], friendships: [], notifications: [], notebooks: [], notebook_pages: [],
    medals: [], user_medals: [], missions: [], mission_progress: [], announcements: [],
  }
}

export async function installPlatform(page: Page, authenticated = true) {
  // A pulsação infinita do nó ativo impede a checagem de estabilidade do clique.
  // Desabilita só esse efeito decorativo, como no cenário de referência do dashboard.
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style')
      style.textContent = '.trail-node--active { animation: none !important; }'
      document.head.appendChild(style)
    })
  })
  const tables = platformData()
  const calls: Call[] = []
  const unexpected: string[] = []
  const handlers = new Map<string, Handler>()
  const user = { id: ids.user, aud: 'authenticated', role: 'authenticated', email: 'carla@example.test', app_metadata: {}, user_metadata: {}, created_at: date }
  const session = { access_token: 'fixture-token', refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 86400, expires_at: Math.floor(Date.now() / 1000) + 86400, user }
  if (authenticated) {
    await page.addInitScript(session => {
      if (!sessionStorage.getItem('fixture-session-initialized')) {
        localStorage.setItem('sb-example-auth-token', JSON.stringify(session))
        sessionStorage.setItem('fixture-session-initialized', 'true')
      }
    }, session)
  }

  function selected(rows: Row[], query: URLSearchParams) {
    return rows.filter(row => [...query].every(([key, value]) => {
      if (value.startsWith('eq.')) return String(row[key]) === value.slice(3)
      if (value.startsWith('in.(')) return value.slice(4, -1).split(',').includes(String(row[key]))
      if (value === 'is.null') return row[key] == null
      return true
    }))
  }
  async function reply(route: Route, { data = null, status = 200 }: Reply) {
    await route.fulfill({ status, contentType: 'application/json', body: status === 204 ? '' : JSON.stringify(data) })
  }
  await page.route('https://example.supabase.co/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.split('/').at(-1) ?? ''
    const call: Call = { path, method: request.method(), query: url.searchParams, body: request.postData() ? request.postDataJSON() : {} }
    calls.push(call)
    const override = handlers.get(path)
    if (override) return reply(route, await override(call))
    if (url.pathname.startsWith('/auth/')) {
      if (path === 'user') return reply(route, { data: user })
      if (path === 'token') return reply(route, { data: session })
      if (path === 'signup') return reply(route, { data: { user, session: null } })
      if (path === 'logout') return reply(route, { status: 204 })
    }
    if (url.pathname.includes('/rpc/')) {
      const emptyLists = ['friends_course_pac', 'friends_course_pac_v2', 'my_missions', 'my_mission_detail', 'current_season', 'my_season_summary', 'my_season_standings', 'my_season_group', 'my_season_history', 'global_ranking', 'room_ranking', 'room_pac', 'search_profiles', 'home_categories', 'home_course_students', 'home_featured_courses', 'home_top_learners', 'home_featured_reviews']
      if (emptyLists.includes(path)) return reply(route, { data: [] })
      if (path === 'is_admin') return reply(route, { data: false })
      if (path === 'home_stats') return reply(route, { data: { students: 3, courses: 1, categories: 1, avg_rating: null } })
      if (path === 'xp_from_question') return reply(route, { data: 4 })
      if (['notify_course_update', 'notify_friend_request', 'notify_room_invite', 'notify_mission'].includes(path)) return reply(route, { status: 204 })
    } else if (tables[path]) {
      const rows = selected(tables[path], url.searchParams)
      if (call.method === 'HEAD') return route.fulfill({ status: 200, headers: { 'content-range': `0-${Math.max(0, rows.length - 1)}/${rows.length}` } })
      let result = rows
      if (call.method === 'POST') {
        const payload: Row[] = Array.isArray(call.body) ? call.body : [call.body]
        const defaults: Row = path === 'friendships' ? { status: 'pending' } : path === 'enrollments' ? { status: 'active', progress: 0 } : {}
        result = payload.map((row, index) => ({ id: `${path}-${tables[path].length + index}`, created_at: date, ...defaults, ...row }))
        tables[path].push(...result)
      }
      if (call.method === 'PATCH') result.forEach(row => Object.assign(row, call.body))
      if (call.method === 'DELETE') tables[path] = tables[path].filter(row => !rows.includes(row))
      if (call.method === 'GET' || request.headers()['prefer']?.includes('return=representation')) {
        const single = request.headers()['accept']?.includes('vnd.pgrst.object')
        if (single && !result.length) return reply(route, { status: 406, data: { code: 'PGRST116', message: 'No rows' } })
        return reply(route, { data: single ? result[0] : result })
      }
      return reply(route, { status: 204 })
    }
    unexpected.push(`${call.method} ${url.pathname}`)
    return reply(route, { status: 501, data: { message: `Endpoint sem fixture: ${path}` } })
  })
  return { tables, calls, unexpected, user, session, on: (path: string, handler: Handler) => handlers.set(path, handler) }
}

export const test = base.extend<{ platform: Awaited<ReturnType<typeof installPlatform>> }>({
  platform: async ({ page }, provide) => {
    const platform = await installPlatform(page)
    await provide(platform)
    expect(platform.unexpected, 'Toda chamada Supabase deve ter fixture explícita').toEqual([])
  },
})
export { expect }
