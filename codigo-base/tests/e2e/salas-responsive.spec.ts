import { test, expect, ids } from './support/platform'

function sala(id: string, name: string) {
  return {
    id,
    name,
    educator_id: ids.educator,
    access_code: 'TURMA1',
    code_active: true,
    course_id: ids.course,
    pac_visibility: 'all',
    created_at: '2026-11-01T12:00:00Z',
  }
}

test('Salas vazia e painel adicionar cabem no mobile sem perder formulário ao expandir a navegação', async ({ page, platform }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await page.goto('/salas')

  await expect(page.getByRole('heading', { name: /Você ainda não participa de nenhuma sala/ })).toBeVisible()
  await expect(page.getByRole('main')).toHaveCount(1)
  const add = page.locator('.salas__cabecalho').getByRole('button', { name: 'Adicionar sala', exact: true })
  await add.click()
  const code = page.getByPlaceholder('Código de acesso', { exact: true })
  await code.fill('CODIGO-TESTE')
  await page.getByPlaceholder('Nome da sala', { exact: true }).fill('Turma de teste')
  await page.getByRole('button', { name: 'Abrir navegação', exact: true }).click()
  await expect(code).toHaveValue('CODIGO-TESTE')
  await expect(page.getByPlaceholder('Nome da sala', { exact: true })).toHaveValue('Turma de teste')
  await expect(page.getByRole('button', { name: 'Criar sala', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  expect(platform.unexpected).toEqual([])
})

test('estado carregando de Salas termina no estado vazio sem confundir falha e mantém ações acessíveis', async ({ page, platform }) => {
  let releaseRooms!: () => void
  const roomsReady = new Promise<void>(resolve => { releaseRooms = resolve })
  platform.on('rooms', async () => {
    await roomsReady
    return { data: [] }
  })
  await page.setViewportSize({ width: 320, height: 844 })
  const roomsRequest = page.waitForRequest(request => request.url().includes('/rest/v1/rooms'))
  await page.goto('/salas')
  await roomsRequest
  await expect(page.getByText('Carregando salas...', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Você ainda não participa de nenhuma sala/ })).toHaveCount(0)

  releaseRooms()
  await expect(page.getByRole('heading', { name: /Você ainda não participa de nenhuma sala/ })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.locator('.salas__cabecalho').getByRole('button', { name: 'Adicionar sala', exact: true })).toBeVisible()
  expect(platform.unexpected).toEqual([])
})

test('Salas vazia e painel adicionar permanecem utilizáveis na matriz móvel, fronteiras e desktop', async ({ page, platform }) => {
  for (const { width, height } of [
    { width: 320, height: 844 },
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1025, height: 768 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize({ width, height })
    await page.goto('/salas')
    const context = `${width}×${height}`
    await expect(page.getByRole('heading', { name: /Você ainda não participa de nenhuma sala/ }), context).toBeVisible()
    const add = page.locator('.salas__cabecalho').getByRole('button', { name: 'Adicionar sala', exact: true })
    await expect(add, context).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth), context).toBeLessThanOrEqual(width)

    await add.click()
    const code = page.getByPlaceholder('Código de acesso', { exact: true })
    const roomName = page.getByPlaceholder('Nome da sala', { exact: true })
    await expect(code, context).toBeVisible()
    await expect(page.getByRole('button', { name: 'Entrar na sala', exact: true }), context).toBeVisible()
    await expect(roomName, context).toBeVisible()
    await expect(page.getByRole('button', { name: 'Criar sala', exact: true }), context).toBeVisible()
    const formBounds = await page.getByRole('region', { name: 'Adicionar sala', exact: true }).boundingBox()
    expect(formBounds, context).not.toBeNull()
    expect(formBounds!.x, context).toBeGreaterThanOrEqual(0)
    expect(formBounds!.x + formBounds!.width, context).toBeLessThanOrEqual(width + 1)
    await add.click()
  }
  expect(platform.unexpected).toEqual([])
})

test('cria sala com curso e PAC escolhidos, preservando payload e seleção ao abrir navegação e redimensionar', async ({ page, platform }) => {
  const ownProfile = platform.tables.profiles.find(profile => profile.id === ids.user)
  if (ownProfile) ownProfile.role = 'educator'
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/salas')
  await page.locator('.salas__cabecalho').getByRole('button', { name: 'Adicionar sala', exact: true }).click()

  await page.getByPlaceholder('Nome da sala', { exact: true }).fill('Sala criada pela matriz')
  const course = page.getByLabel('Curso da sala (opcional)')
  const pac = page.getByLabel('Quem pode ver o PAC dos alunos')
  await course.selectOption(ids.course)
  await pac.selectOption('educator_only')

  await page.getByRole('button', { name: 'Abrir navegação', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Recolher navegação', exact: true })).toHaveAttribute('aria-expanded', 'true')
  await page.getByRole('button', { name: 'Recolher navegação', exact: true }).click()
  for (const width of [759, 760, 761, 390]) {
    await page.setViewportSize({ width, height: 844 })
    await expect(page.getByPlaceholder('Nome da sala', { exact: true })).toHaveValue('Sala criada pela matriz')
    await expect(course).toHaveValue(ids.course)
    await expect(pac).toHaveValue('educator_only')
  }

  await page.getByRole('button', { name: 'Criar sala', exact: true }).click()
  await expect(page.getByRole('status')).toContainText(/Sala criada! Código de acesso:/)
  await expect(page.getByRole('heading', { name: 'Sala criada pela matriz', exact: true })).toBeVisible()
  const creates = platform.calls.filter(call => call.path === 'rooms' && call.method === 'POST')
  expect(creates).toHaveLength(1)
  expect(creates[0].body).toMatchObject({
    educator_id: ids.user,
    name: 'Sala criada pela matriz',
    course_id: ids.course,
    pac_visibility: 'educator_only',
  })
  expect(creates[0].body.access_code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/)
  expect(platform.unexpected).toEqual([])
})

test('Salas distingue erro da lista vazia e preserva resultado da busca e ações', async ({ page, platform }) => {
  platform.on('rooms', () => ({ status: 500, data: { message: 'Salas indisponíveis' } }))
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/salas')
  await expect(page.getByRole('alert')).toContainText('Salas indisponíveis')
  await expect(page.getByText('Você ainda não participa', { exact: false })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Filtrar salas', exact: true })).toBeVisible()
})

test('Salas preenchida usa cartões alcançáveis e busca sem resultado sem clipping essencial', async ({ page, platform }) => {
  platform.tables.rooms.push(
    sala('room-a', 'Turma de aprendizagem com nome extenso para testar quebra responsiva'),
    sala('room-b', 'Outra turma de estudos'),
    sala('room-c', 'Terceira turma'),
    sala('room-outsider', 'Sala de outra pessoa'),
  )
  platform.tables.room_members.push(
    { room_id: 'room-a', user_id: ids.user, status: 'active', xp_internal: 0, joined_at: '2026-11-01T12:00:00Z' },
    { room_id: 'room-b', user_id: ids.user, status: 'active', xp_internal: 0, joined_at: '2026-11-01T12:00:00Z' },
    { room_id: 'room-c', user_id: ids.user, status: 'active', xp_internal: 0, joined_at: '2026-11-01T12:00:00Z' },
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/salas')

  await expect(page.getByRole('heading', { name: 'Turma de aprendizagem com nome extenso para testar quebra responsiva', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sala de outra pessoa', exact: true })).toHaveCount(0)
  expect(await page.locator('.salas__grade').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(1)
  const card = page.getByRole('button', { name: /Turma de aprendizagem com nome extenso/ })
  await card.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')

  await page.getByPlaceholder('Buscar por nome, curso ou educador...').fill('sem correspondência')
  await expect(page.getByText(/Nenhuma sala encontrada/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Filtrar salas', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('nome de sala com 80 caracteres sem espaços não cria overflow horizontal nem encobre o cartão', async ({ page, platform }) => {
  const longName = 'Sala' + 'X'.repeat(76)
  platform.tables.rooms.push(sala('room-long-unbroken', longName))
  platform.tables.room_members.push({
    room_id: 'room-long-unbroken',
    user_id: ids.user,
    status: 'active',
    xp_internal: 0,
    joined_at: '2026-11-01T12:00:00Z',
  })

  for (const width of [320, 390, 760, 768, 1025]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/salas')
    const heading = page.getByRole('heading', { name: longName, exact: true })
    await expect(heading, `${width}px`).toBeVisible()
    const card = page.locator('.salas__card').filter({ has: heading })
    const geometry = await card.evaluate(element => {
      const rect = element.getBoundingClientRect()
      const title = element.querySelector('.salas__nome')
      return {
        card: { x: rect.x, right: rect.right, width: rect.width },
        cardClientWidth: element.clientWidth,
        cardScrollWidth: element.scrollWidth,
        titleClientWidth: title?.clientWidth ?? 0,
        titleScrollWidth: title?.scrollWidth ?? 0,
      }
    })
    expect(geometry.card.x, `${width}px card left`).toBeGreaterThanOrEqual(0)
    expect(geometry.card.right, `${width}px card right`).toBeLessThanOrEqual(width + 1)
    expect(geometry.cardScrollWidth, `${width}px card scroll`).toBeLessThanOrEqual(geometry.cardClientWidth + 1)
    expect(geometry.titleClientWidth, `${width}px title width`).toBeGreaterThan(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `${width}px document`).toBeLessThanOrEqual(width)
  }
  expect(platform.unexpected).toEqual([])
})

test('detalhe educador consome fixtures fixas das RPCs 0046, fecha por Escape e devolve foco', async ({ page, platform }, testInfo) => {
  const roomId = 'room-educator-responsive'
  platform.tables.rooms.push(sala(roomId, 'Sala educadora responsiva'))
  platform.tables.rooms[0].educator_id = ids.user
  platform.on('room_stats_overview', () => ({
    data: [{ active_members: 3, avg_progress: 62, avg_first_try: 75, attention_count: 1 }],
  }))
  platform.on('room_stats_students', () => ({
    data: [{
      user_id: ids.friend,
      display_name: 'Estudante fornecido pela fixture',
      days_idle: 7,
      progress: 50,
      first_try_rate: 40,
      last_access: '2026-11-16T12:00:00Z',
      needs_attention: true,
      xp: 21,
    }],
  }))
  platform.on('room_stats_modules', () => ({
    data: [{ module_id: ids.module, module_position: 0, title: 'Módulo fixture', completion_pct: 40, lesson_count: 2 }],
  }))
  platform.on('room_stats_hard_questions', () => ({
    data: [{
      question_id: ids.question,
      prompt: 'Questão fixture de maior erro',
      lesson_title: 'Aula fixture',
      first_try_rate: 30,
      answers_count: 6,
    }],
  }))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/salas')
  const card = page.locator('.salas__card').filter({ hasText: 'Sala educadora responsiva' })
  await expect(card).toBeVisible()
  await card.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Membros ativos', { exact: true })).toBeVisible()
  await expect(dialog.getByText('3', { exact: true })).toBeVisible()
  await dialog.getByRole('tab', { name: 'Alunos', exact: true }).click()
  await expect(dialog.getByText('Estudante fornecido pela fixture', { exact: true })).toBeVisible()
  await dialog.getByRole('tab', { name: 'Conteúdo', exact: true }).click()
  await expect(dialog.getByText('Módulo fixture', { exact: true })).toBeVisible()
  await expect(dialog.getByText('Questão fixture de maior erro', { exact: true })).toBeVisible()
  await expect(page.locator('.course-review-card')).toHaveCount(0)

  const statsCalls = platform.calls.filter(call => call.method === 'POST' && [
    'room_stats_overview', 'room_stats_students', 'room_stats_modules', 'room_stats_hard_questions',
  ].includes(call.path))
  expect(statsCalls.map(call => call.path).sort()).toEqual([
    'room_stats_hard_questions', 'room_stats_modules', 'room_stats_overview', 'room_stats_students',
  ])
  expect(statsCalls.every(call => call.body.p_room_id === roomId)).toBe(true)
  expect(platform.unexpected).toEqual([])

  await page.screenshot({ path: testInfo.outputPath('salas-educador-conteudo-fixture.png'), animations: 'disabled' })
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(card).toBeFocused()
})

test('grade de Salas mantém 1/2/3 colunas nos breakpoints da matriz sem perder cursos ou filtro', async ({ page, platform }) => {
  platform.tables.rooms.push(
    sala('room-a', 'Turma com nome longo para conferir o fluxo responsivo dos cartões'),
    sala('room-b', 'Segunda turma'),
    sala('room-c', 'Terceira turma'),
  )
  platform.tables.room_members.push(
    { room_id: 'room-a', user_id: ids.user, status: 'active', xp_internal: 0, joined_at: '2026-11-01T12:00:00Z' },
    { room_id: 'room-b', user_id: ids.user, status: 'active', xp_internal: 0, joined_at: '2026-11-01T12:00:00Z' },
    { room_id: 'room-c', user_id: ids.user, status: 'active', xp_internal: 0, joined_at: '2026-11-01T12:00:00Z' },
  )

  for (const { width, columns } of [
    { width: 320, columns: 1 },
    { width: 360, columns: 1 },
    { width: 390, columns: 1 },
    { width: 768, columns: 2 },
    { width: 1024, columns: 2 },
    { width: 1025, columns: 2 },
    { width: 1100, columns: 2 },
    { width: 1101, columns: 3 },
    { width: 1440, columns: 3 },
  ]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/salas')
    const grid = page.locator('.salas__grade')
    await expect(page.getByRole('heading', { name: 'Turma com nome longo para conferir o fluxo responsivo dos cartões', exact: true })).toBeVisible()
    expect(await grid.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length), `${width}px`).toBe(columns)
    await expect(page.getByRole('button', { name: 'Adicionar sala', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Filtrar salas', exact: true })).toBeVisible()
  }
  expect(platform.unexpected).toEqual([])
})

test('código de sala inválido mantém o valor e pode ser corrigido em 320px', async ({ page, platform }) => {
  platform.on('join_room', () => ({ status: 400, data: { message: 'Código inválido' } }))
  await page.setViewportSize({ width: 320, height: 844 })
  await page.goto('/salas')
  await page.getByRole('button', { name: 'Adicionar sala', exact: true }).click()
  const code = page.getByPlaceholder('Código de acesso', { exact: true })
  await code.fill('ERRADO')
  await page.getByRole('button', { name: 'Entrar na sala', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(/inválido/i)
  await expect(code).toHaveValue('ERRADO')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
})

test('entrada com código válido confirma o retorno HTTP e limpa o campo sem exigir backend real', async ({ page, platform }) => {
  const membershipId = '99999999-9999-4999-8999-999999999999'
  platform.on('join_room', call => {
    expect(call.body).toEqual({ p_access_code: 'TURMA1' })
    return { data: membershipId }
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/salas')
  await page.getByRole('button', { name: 'Adicionar sala', exact: true }).first().click()
  const code = page.getByPlaceholder('Código de acesso', { exact: true })
  await code.fill('TURMA1')
  await page.getByRole('button', { name: 'Entrar na sala', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Você entrou na sala.')
  await expect(code).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Adicionar sala', exact: true })).toHaveCount(0)
  const joins = platform.calls.filter(call => call.path === 'join_room' && call.method === 'POST')
  expect(joins).toHaveLength(1)
  expect(joins[0].body).toEqual({ p_access_code: 'TURMA1' })
  expect(platform.unexpected).toEqual([])
})
