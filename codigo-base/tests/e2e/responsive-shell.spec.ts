import { test, expect } from './support/platform'

const privateRoutes = [
  '/dashboard',
  '/catalogo',
  '/salas',
  '/profile',
  '/configuracoes',
  '/amigos',
  '/caderno',
  '/notificacoes',
  '/criar-curso',
  '/ligas',
  '/missoes',
  '/missoes/responsive-shell',
]

function mutatingRequests(platform: Awaited<ReturnType<typeof import('./support/platform').installPlatform>>) {
  const tables = new Set(Object.keys(platform.tables))
  const mutatingRpcs = new Set(['join_room', 'complete_empty_lesson', 'notify_course_update', 'notify_friend_request', 'notify_room_invite', 'notify_mission'])
  return platform.calls
    .filter(call => ['PATCH', 'DELETE'].includes(call.method) || (call.method === 'POST' && (tables.has(call.path) || mutatingRpcs.has(call.path))))
    .map(call => `${call.method} ${call.path} ${JSON.stringify(call.body)}`)
}

test('casca móvel inicia recolhida e disclosure abre, fecha e devolve foco', async ({ page, platform }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/salas')

  const toggle = page.locator('.sidebarL__toggle')
  const nav = page.getByRole('navigation', { name: 'Navegação principal', exact: true })
  await expect(toggle).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(toggle).toHaveAttribute('aria-controls', /.+/)
  await expect(nav).toBeHidden()
  await expect(page.getByRole('button', { name: 'Abrir opções de conta', exact: true })).toBeVisible()
  await expect(page.getByRole('main')).toHaveCount(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({ path: testInfo.outputPath('salas-mobile-recolhida.png'), animations: 'disabled' })

  await toggle.focus()
  await page.keyboard.press('Enter')
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(toggle).toHaveAccessibleName('Recolher navegação')
  await expect(nav).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Salas', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(toggle).toBeFocused()
  await page.screenshot({ path: testInfo.outputPath('salas-mobile-expandida.png'), animations: 'disabled' })

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(nav).toBeHidden()
  await expect(toggle).toBeFocused()
  expect(platform.unexpected).toEqual([])
})

test('abrir e recolher disclosure e opções de conta não acrescenta requisições mutadoras', async ({ page, platform }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/salas')
  await expect(page.getByRole('button', { name: 'Abrir navegação', exact: true })).toBeVisible()
  await page.waitForLoadState('networkidle')
  const before = mutatingRequests(platform)

  const toggle = page.locator('.sidebarL__toggle')
  await toggle.click()
  const account = page.getByRole('button', { name: 'Abrir opções de conta', exact: true })
  await account.click()
  await expect(page.getByRole('button', { name: 'Sair da conta', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Sair da conta', exact: true })).toBeHidden()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Escape')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')

  expect(mutatingRequests(platform)).toEqual(before)
  expect(platform.unexpected).toEqual([])
})

test('destinos da sidebar, conta e histórico do router recolhem a navegação sem perder back/forward', async ({ page, platform }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const destinations = [
    { name: 'Início', path: '/dashboard' },
    { name: 'Catálogo', path: '/catalogo' },
    { name: 'Salas', path: '/salas' },
    { name: 'Ligas', path: '/ligas' },
    { name: 'Missões', path: '/missoes' },
    { name: 'Amigos', path: '/amigos' },
    { name: 'Cadernos', path: '/caderno' },
  ]

  for (const destination of destinations) {
    await page.goto('/salas')
    const toggle = page.getByRole('button', { name: 'Abrir navegação', exact: true })
    await toggle.click()
    const link = page.getByRole('navigation', { name: 'Navegação principal', exact: true })
      .getByRole('link', { name: destination.name, exact: true })
    await link.click()
    await expect(page).toHaveURL(new RegExp(`${destination.path.replaceAll('/', '\\/')}(?:\\?.*)?$`))
    await expect(page.getByRole('button', { name: 'Abrir navegação', exact: true })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Navegação principal', exact: true })).toBeHidden()
  }

  await page.goto('/salas')
  await page.getByRole('button', { name: 'Abrir navegação', exact: true }).click()
  await page.getByRole('link', { name: 'Catálogo', exact: true }).click()
  await expect(page).toHaveURL(/\/catalogo$/)
  await page.goBack()
  await expect(page).toHaveURL(/\/salas$/)
  await expect(page.getByRole('button', { name: 'Abrir navegação', exact: true })).toHaveAttribute('aria-expanded', 'false')
  await page.goForward()
  await expect(page).toHaveURL(/\/catalogo$/)
  await expect(page.getByRole('button', { name: 'Abrir navegação', exact: true })).toHaveAttribute('aria-expanded', 'false')

  await page.goto('/salas')
  await page.getByRole('link', { name: 'Notificações', exact: true }).click()
  await expect(page).toHaveURL(/\/notificacoes$/)

  await page.goto('/salas')
  const logoToggle = page.getByRole('button', { name: 'Abrir navegação', exact: true })
  await logoToggle.click()
  await page.getByRole('link', { name: 'Ir para o Dashboard', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('button', { name: 'Abrir navegação', exact: true })).toBeVisible()

  await page.goto('/salas')
  await page.getByRole('button', { name: 'Abrir navegação', exact: true }).click()
  await page.getByRole('button', { name: 'Abrir opções de conta', exact: true }).click()
  await page.getByRole('button', { name: 'Ver perfil', exact: true }).click()
  await expect(page).toHaveURL(/\/profile$/)

  await page.goto('/salas')
  await page.getByRole('button', { name: 'Abrir navegação', exact: true }).click()
  await page.getByRole('button', { name: 'Abrir opções de conta', exact: true }).click()
  await page.getByRole('button', { name: 'Configuração', exact: true }).click()
  await expect(page).toHaveURL(/\/configuracoes$/)
  await expect(page.getByRole('button', { name: 'Abrir navegação', exact: true })).toBeVisible()

  await page.goto('/salas')
  await page.getByRole('button', { name: 'Abrir navegação', exact: true }).click()
  await page.getByRole('button', { name: 'Abrir opções de conta', exact: true }).click()
  await page.getByRole('button', { name: 'Sair da conta', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Aprenda qualquer coisa. Do seu jeito.', exact: true })).toBeVisible()
  expect(platform.calls.some(call => call.path === 'logout' && call.method === 'POST')).toBe(true)
  expect(platform.unexpected).toEqual([])
})

test('Shift+Tab sai do primeiro destino para o disclosure e o foco no grupo não fica preso', async ({ page, platform }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/salas')
  const toggle = page.locator('.sidebarL__toggle')
  await toggle.click()
  await page.keyboard.press('Tab')
  const first = page.getByRole('link', { name: 'Início', exact: true })
  await expect(first).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(toggle).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(first).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByRole('link', { name: 'Notificações', exact: true })).toBeFocused()
  expect(platform.unexpected).toEqual([])
})

test('Escape fecha primeiro opções da conta e depois a navegação; Escape no main não fecha', async ({ page, platform }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/catalogo')

  const toggle = page.locator('.sidebarL__toggle')
  await toggle.click()
  const accountTrigger = page.getByRole('button', { name: 'Abrir opções de conta', exact: true })
  await accountTrigger.click()
  const accountId = await accountTrigger.getAttribute('aria-controls')
  expect(accountId).toBeTruthy()
  const account = page.locator(`#${accountId}`)
  await expect(account).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('catalogo-conta-expandida.png'), animations: 'disabled' })
  await page.keyboard.press('Escape')
  await expect(account).toBeHidden()
  await expect(accountTrigger).toBeFocused()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await page.screenshot({ path: testInfo.outputPath('catalogo-conta-recolhida.png'), animations: 'disabled' })

  await page.keyboard.press('Escape')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(toggle).toBeFocused()

  await toggle.click()
  await page.getByPlaceholder('Buscar por nome ou assunto...').focus()
  await page.keyboard.press('Escape')
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  expect(platform.unexpected).toEqual([])
})

test('casca permanece recolhida ao cruzar o breakpoint e migra o foco para controles visíveis', async ({ page, platform }) => {
  await page.setViewportSize({ width: 760, height: 844 })
  await page.goto('/salas')

  const toggle = page.locator('.sidebarL__toggle')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await page.setViewportSize({ width: 761, height: 844 })
  await expect(page.getByRole('button', { name: /^(Abrir|Recolher) navegação$/ })).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: 'Navegação principal', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Salas', exact: true })).toBeFocused()

  const desktopSidebarWidth = await page.locator('.sidebarL').evaluate(element => element.getBoundingClientRect().width)
  expect(desktopSidebarWidth).toBe(260)

  await page.setViewportSize({ width: 760, height: 844 })
  const mobileToggle = page.getByRole('button', { name: 'Abrir navegação', exact: true })
  await expect(mobileToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(mobileToggle).toBeFocused()

  const sidebarWidth = await page.locator('.sidebarL').evaluate(element => element.getBoundingClientRect().width)
  expect(sidebarWidth).toBe(760)
  const mainPadding = await page.locator('.page-layout__main').evaluate(element => getComputedStyle(element).paddingLeft)
  expect(mainPadding).toBe('0px')
  expect(platform.unexpected).toEqual([])
})

test('Salas conserva o formulário preenchido ao redimensionar em torno do breakpoint', async ({ page, platform }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await page.goto('/salas')
  await page.locator('.salas__cabecalho').getByRole('button', { name: 'Adicionar sala', exact: true }).click()
  const code = page.getByPlaceholder('Código de acesso', { exact: true })
  await code.fill('CODIGO-PRESERVADO')
  await page.setViewportSize({ width: 759, height: 844 })
  await page.setViewportSize({ width: 760, height: 844 })
  await page.setViewportSize({ width: 761, height: 844 })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(code).toHaveValue('CODIGO-PRESERVADO')
  await expect(page.locator('.salas__cabecalho').getByRole('button', { name: 'Adicionar sala', exact: true })).toBeVisible()
  expect(platform.unexpected).toEqual([])
})

test('as 12 rotas mantêm disclosure e reserva correta ao abrir e recolher na matriz móvel', async ({ page, platform }) => {
  test.setTimeout(180_000)
  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 844 })
    for (const route of privateRoutes) {
      await page.goto(route)
      const toggle = page.locator('.sidebarL__toggle')
      const nav = page.getByRole('navigation', { name: 'Navegação principal', exact: true })
      const sidebar = page.locator('.sidebarL')
      const main = page.locator('.page-layout__main')
      const context = `${route} em ${width}px`

      await expect(toggle, context).toBeVisible()
      await expect(toggle, context).toHaveAttribute('aria-expanded', 'false')
      await expect(nav, context).toBeHidden()
      expect(await sidebar.evaluate(element => element.getBoundingClientRect().width), context).toBe(width)
      expect(await main.evaluate(element => getComputedStyle(element).paddingLeft), context).toBe('0px')

      await toggle.click()
      await expect(toggle, context).toHaveAttribute('aria-expanded', 'true')
      await expect(nav, context).toBeVisible()
      await expect(page.getByRole('button', { name: 'Abrir opções de conta', exact: true }), context).toBeVisible()
      const expandedBottom = await sidebar.evaluate(element => element.getBoundingClientRect().bottom)
      const mainTop = await main.evaluate(element => element.getBoundingClientRect().top)
      expect(mainTop, `${context}: main após altura real da navegação expandida`).toBeGreaterThanOrEqual(expandedBottom - 1)

      await toggle.click()
      await expect(toggle, context).toHaveAttribute('aria-expanded', 'false')
      await expect(nav, context).toBeHidden()
      await expect(page.getByRole('button', { name: 'Abrir opções de conta', exact: true }), context).toBeVisible()
      expect(await main.evaluate(element => getComputedStyle(element).paddingLeft), context).toBe('0px')
    }
  }
  expect(platform.unexpected).toEqual([])
})

test('falhas de perfil e contagem de notificações não removem destinos nem bloqueiam o disclosure', async ({ page, platform }) => {
  platform.on('profiles', () => ({ status: 500, data: { message: 'Perfil indisponível' } }))
  platform.on('notifications', () => ({ status: 500, data: { message: 'Contagem indisponível' } }))
  await page.setViewportSize({ width: 320, height: 844 })
  await page.goto('/salas')

  const toggle = page.getByRole('button', { name: 'Abrir navegação', exact: true })
  await toggle.click()
  await expect(page.getByRole('link', { name: 'Catálogo', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Abrir opções de conta', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Recolher navegação', exact: true })).toHaveAttribute('aria-expanded', 'true')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
})

test('desktop mantém sidebar de 260px e notificação afastada do nome sem perder recuo direito', async ({ page, platform }) => {
  for (const width of [768, 1023, 1024, 1025, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/salas')
    await expect(page.getByRole('button', { name: 'Abrir navegação', exact: true })).toHaveCount(0)
    expect(await page.locator('.sidebarL').evaluate(element => element.getBoundingClientRect().width)).toBeCloseTo(260, 0)
    expect(await page.locator('.page-layout__main').evaluate(element => getComputedStyle(element).paddingLeft)).toBe('260px')
    const sidebar = await page.locator('.sidebarL').boundingBox()
    const brand = await page.getByRole('link', { name: 'Ir para o Dashboard' }).boundingBox()
    const mail = await page.getByRole('link', { name: /Notificações/ }).boundingBox()
    expect(mail!.x - brand!.x - brand!.width).toBeGreaterThanOrEqual(24)
    expect(sidebar!.x + sidebar!.width - mail!.x - mail!.width).toBeGreaterThanOrEqual(16)
    expect(sidebar!.x + sidebar!.width - mail!.x - mail!.width).toBeLessThanOrEqual(20)
    expect((await page.getByRole('link', { name: 'Salas', exact: true }).boundingBox())!.width).toBeGreaterThan(220)
  }
  expect(platform.unexpected).toEqual([])
})

test('fronteiras preservam reserva da casca nos consumidores dashboard, catálogo, salas e ligas', async ({ page, platform }) => {
  test.setTimeout(90_000)
  const consumers = ['/dashboard', '/catalogo', '/salas', '/ligas']
  for (const route of consumers) {
    for (const width of [759, 760, 761, 1023, 1024, 1025]) {
      await page.setViewportSize({ width, height: 768 })
      await page.goto(route)
      const context = `${route} em ${width}px`
      const mobile = width <= 760
      const toggle = page.getByRole('button', { name: /^(Abrir|Recolher) navegação$/ })
      if (mobile) {
        await expect(toggle, context).toBeVisible()
        await expect(toggle, context).toHaveAttribute('aria-expanded', 'false')
      } else {
        await expect(toggle, context).toHaveCount(0)
      }
      const sidebarWidth = await page.locator('.sidebarL').evaluate(element => element.getBoundingClientRect().width)
      expect(sidebarWidth, context).toBe(mobile ? width : 260)
      const padding = await page.locator('.page-layout__main').evaluate(element => getComputedStyle(element).paddingLeft)
      expect(padding, context).toBe(mobile ? '0px' : '260px')
    }
  }
  expect(platform.unexpected).toEqual([])
})

test('perfil lento com campos extensos continua alcançável e conta operável em desktop baixo', async ({ page, platform }) => {
  const longName = 'N'.repeat(80)
  const longUsername = 'u'.repeat(80)
  let releaseProfile!: () => void
  const profileReady = new Promise<void>(resolve => { releaseProfile = resolve })
  platform.on('profiles', async () => {
    await profileReady
    return { data: {
      id: '11111111-1111-4111-8111-111111111111',
      display_name: longName,
      username: longUsername,
      avatar_url: null,
      banner_url: null,
      streak_count: 0,
      last_study_date: null,
    } }
  })
  await page.setViewportSize({ width: 1024, height: 500 })
  const profileRequest = page.waitForRequest(request => request.url().includes('/rest/v1/profiles'))
  await page.goto('/salas')
  await profileRequest
  const account = page.getByRole('button', { name: 'Abrir opções de conta', exact: true })
  await expect(account.locator('.animate-pulse')).toBeVisible()
  await expect(account).not.toContainText(longName)

  releaseProfile()
  await expect(account).toContainText(longName)
  await account.scrollIntoViewIfNeeded()
  const scrollport = page.locator('.sidebarL__scroll')
  const widthState = await scrollport.evaluate(element => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }))
  expect(widthState.scrollWidth).toBeLessThanOrEqual(widthState.clientWidth)
  expect(widthState.scrollHeight).toBeGreaterThanOrEqual(widthState.clientHeight)
  await account.click()
  const signOut = page.getByRole('button', { name: 'Sair da conta', exact: true })
  await expect(signOut).toBeVisible()
  await expect(signOut).toBeInViewport()
  await page.keyboard.press('Escape')
  await expect(signOut).toBeHidden()
  await expect(account).toBeFocused()
  expect(platform.unexpected).toEqual([])
})
