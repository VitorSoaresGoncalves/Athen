import { test, expect, ids } from './support/platform'

const longTitle = 'Trilha de aprendizagem responsiva com conteúdo longo para conferir a composição'
const mission = {
  occurrence_id: 'responsive-mission',
  definition_id: 'responsive-definition',
  scope: 'global_daily',
  objective: 'complete_lessons',
  code: 'responsive',
  title: longTitle,
  description: 'Descrição longa preservada no detalhe da missão.',
  course_id: null,
  course_title: null,
  target: 2,
  reward_xp: 5,
  period_start: '2026-11-09T03:00:00Z',
  period_end: '2026-11-10T03:00:00Z',
  progress: 1,
  current_count: 1,
  completed: false,
}

function expectNoDocumentOverflow(page: import('@playwright/test').Page, width: number) {
  return expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth), `${width}px document`).toBeLessThanOrEqual(width)
}

async function expectOneMainAndNoOverflow(page: import('@playwright/test').Page, width: number) {
  await expect(page.getByRole('main')).toHaveCount(1)
  await expectNoDocumentOverflow(page, width)
}

test('entradas r6 e detalhes essenciais mantêm conteúdo alcançável em 320 e 1440px', async ({ page, platform }, testInfo) => {
  platform.tables.friendships.push({
    id: 'responsive-friendship',
    requester_id: ids.friend,
    addressee_id: ids.user,
    status: 'accepted',
    created_at: '2026-11-01T12:00:00Z',
  })
  const friend = platform.tables.profiles.find(profile => profile.id === ids.friend)
  if (friend) friend.bio = `${longTitle} com umaURLSemEspacos${'x'.repeat(48)}`
  platform.tables.notifications.push({
    id: 'responsive-notice',
    user_id: ids.user,
    type: 'atualizacao_curso',
    title: longTitle,
    message: `${longTitle}.`,
    is_read: true,
    reference_id: ids.course,
    created_at: '2026-11-01T12:00:00Z',
  })
  platform.on('my_missions', () => ({ data: [mission] }))
  platform.on('my_mission_detail', () => ({ data: [mission] }))
  platform.on('current_season', () => ({
    data: [{ id: 'responsive-season', starts_at: '2026-11-02T03:00:00Z', ends_at: '2026-11-09T03:00:00Z', status: 'open' }],
  }))
  platform.on('my_season_summary', () => ({
    data: [{ season_id: 'responsive-season', category: 'silver', group_id: 'group', group_index: 1, season_xp: 240, final_rank: null, result_category: null, group_size: 2 }],
  }))
  platform.on('my_season_standings', () => ({
    data: [
      { user_id: ids.friend, display_name: longTitle, avatar_url: null, banner_url: null, season_xp: 410, rank_position: 1, is_self: false, hidden: false },
      { user_id: ids.user, display_name: 'Carla Estudante', avatar_url: null, banner_url: null, season_xp: 240, rank_position: 2, is_self: true, hidden: false },
    ].map(row => ({ movement: 'stayed', projected_category: 'silver', entry_kind: 'late', ...row })),
  }))

  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: width === 320 ? 844 : 900 })

    await page.goto('/profile')
    await expect(page.getByRole('button', { name: 'Editar perfil', exact: true })).toBeVisible()
    await expectOneMainAndNoOverflow(page, width)
    if (width === 320) await page.screenshot({ path: testInfo.outputPath('perfil-320.png'), animations: 'disabled' })

    await page.goto('/amigos')
    const friendCard = page.getByRole('button', { name: 'Ver perfil de Diego Colega', exact: true })
    await expect(friendCard).toBeVisible()
    await friendCard.click()
    const friendDialog = page.getByRole('dialog')
    await expect(friendDialog.getByRole('heading', { name: 'Diego Colega', exact: true })).toBeVisible()
    await expect(friendDialog.getByText(/umaURLSemEspacos/)).toBeVisible()
    await expectOneMainAndNoOverflow(page, width)
    await page.screenshot({ path: testInfo.outputPath(`amigos-detalhe-${width}.png`), animations: 'disabled' })
    await page.keyboard.press('Escape')
    await expect(friendDialog).toBeHidden()
    await expect(friendCard).toBeFocused()

    await page.goto('/missoes')
    await expect(page.getByRole('heading', { name: 'Pendentes', exact: true })).toBeVisible()
    await expectOneMainAndNoOverflow(page, width)
    await page.getByRole('link', { name: `Abrir detalhe da missão ${longTitle}` }).click()
    await expect(page.getByRole('heading', { name: longTitle, exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Escolher conteúdo para estudar' })).toBeVisible()
    await expectOneMainAndNoOverflow(page, width)
    await page.getByRole('link', { name: 'Escolher conteúdo para estudar' }).click()
    await expect(page).toHaveURL('/catalogo')

    await page.getByRole('button', { name: /Lógica de Programação/ }).click()
    const courseDialog = page.getByRole('dialog')
    await expect(courseDialog.getByRole('heading', { name: 'Lógica de Programação', exact: true })).toBeVisible()
    await expect(courseDialog.getByRole('button', { name: 'Fechar', exact: true })).toBeVisible()
    await expectOneMainAndNoOverflow(page, width)
    await page.screenshot({ path: testInfo.outputPath(`catalogo-detalhe-${width}.png`), animations: 'disabled' })
    await page.keyboard.press('Escape')
    await expect(courseDialog).toBeHidden()

    await page.goto('/notificacoes')
    await expect(page.getByRole('button', { name: `Abrir notificação: ${longTitle}` })).toBeVisible()
    await expect(page.getByRole('button', { name: `Remover notificação: ${longTitle}` })).toBeVisible()
    await expectOneMainAndNoOverflow(page, width)

    await page.goto('/configuracoes')
    await expect(page.getByRole('heading', { name: 'Configurações', exact: true })).toBeVisible()
    await expect(page.getByRole('switch')).toHaveCount(4)
    await expectOneMainAndNoOverflow(page, width)

    await page.goto('/ligas')
    await expect(page.getByRole('heading', { name: 'Ligas', exact: true })).toBeVisible()
    await expect(page.getByText(longTitle, { exact: true }).first()).toBeVisible()
    await expectOneMainAndNoOverflow(page, width)
    if (width === 320) await page.screenshot({ path: testInfo.outputPath('ligas-320.png'), animations: 'disabled' })
  }
  expect(platform.unexpected).toEqual([])
})

test('detalhes de Salas de aluno e educador preservam ações e rascunho no resize', async ({ page, platform }, testInfo) => {
  const studentRoomId = 'responsive-student-room'
  const educatorRoomId = 'responsive-educator-room'
  const sala = (id: string, name: string) => ({
    id,
    name,
    educator_id: id === educatorRoomId ? ids.user : ids.educator,
    access_code: 'TURMA1',
    code_active: true,
    course_id: ids.course,
    pac_visibility: 'all',
    created_at: '2026-11-01T12:00:00Z',
  })
  platform.tables.rooms.push(sala(studentRoomId, longTitle), sala(educatorRoomId, 'Sala educadora responsiva'))
  platform.tables.room_members.push({
    room_id: studentRoomId,
    user_id: ids.user,
    status: 'active',
    xp_internal: 21,
    pac_internal: 70,
    progress: 50,
    joined_at: '2026-11-01T12:00:00Z',
  }, {
    room_id: studentRoomId,
    user_id: ids.friend,
    status: 'active',
    xp_internal: 17,
    pac_internal: 60,
    progress: 40,
    joined_at: '2026-11-01T12:00:00Z',
  })
  platform.tables.announcements.push({
    id: 'responsive-announcement',
    room_id: studentRoomId,
    author_id: ids.educator,
    title: longTitle,
    content: `${longTitle}.`,
    status: 'published',
    created_at: '2026-11-01T12:00:00Z',
  })
  platform.on('room_stats_overview', () => ({ data: [{ active_members: 3, avg_progress: 62, avg_first_try: 75, attention_count: 1 }] }))
  platform.on('room_stats_students', () => ({
    data: [{ user_id: ids.friend, display_name: longTitle, days_idle: 7, progress: 50, first_try_rate: 40, last_access: '2026-11-16T12:00:00Z', needs_attention: true, xp: 21 }],
  }))
  platform.on('room_stats_modules', () => ({ data: [{ module_id: ids.module, module_position: 0, title: longTitle, completion_pct: 40, lesson_count: 1 }] }))
  platform.on('room_stats_hard_questions', () => ({
    data: [{ question_id: ids.question, prompt: longTitle, lesson_title: 'Primeira aula', first_try_rate: 30, answers_count: 6 }],
  }))

  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: width === 320 ? 844 : 900 })
    await page.goto('/salas')
    const studentCard = page.locator('.salas__card').filter({ hasText: longTitle })
    await expect(studentCard).toBeVisible()
    await studentCard.click()
    const studentDialog = page.getByRole('dialog')
    await expect(studentDialog.getByRole('heading', { name: longTitle, exact: true })).toBeVisible()
    await expect(studentDialog.getByRole('heading', { name: 'Trilha de aprendizagem', exact: true })).toBeVisible()
    await expect(studentDialog.getByText('Seu desempenho na sala', { exact: false })).toBeVisible()
    await expect(studentDialog.locator('.salas__aviso-titulo', { hasText: longTitle })).toBeVisible()
    await expect(studentDialog.getByText('CÓDIGO DE ACESSO', { exact: true })).toHaveCount(0)
    await expectOneMainAndNoOverflow(page, width)
    await page.screenshot({ path: testInfo.outputPath(`salas-aluno-${width}.png`), animations: 'disabled' })
    await page.keyboard.press('Escape')
    await expect(studentDialog).toBeHidden()

    const educatorCard = page.locator('.salas__card').filter({ hasText: 'Sala educadora responsiva' })
    await educatorCard.click()
    const educatorDialog = page.getByRole('dialog')
    await expect(educatorDialog.getByRole('heading', { name: 'Sala educadora responsiva', exact: true })).toBeVisible()
    for (const tab of ['Visão geral', 'Alunos', 'Conteúdo', 'Ranking', 'Mural']) {
      await educatorDialog.getByRole('tab', { name: tab, exact: true }).click()
      await expect(educatorDialog.getByRole('tab', { name: tab, exact: true })).toHaveAttribute('aria-selected', 'true')
      if (tab === 'Alunos') {
        const table = educatorDialog.getByRole('region', { name: 'Estatísticas dos alunos', exact: true })
        await expect(table.getByRole('cell', { name: longTitle, exact: true })).toBeVisible()
        await table.evaluate(element => { element.scrollLeft = element.scrollWidth })
        await expect(table.getByRole('columnheader', { name: 'Último acesso', exact: true })).toBeInViewport()
      }
    }
    const title = educatorDialog.getByRole('textbox', { name: 'Título do aviso', exact: true })
    const message = educatorDialog.getByRole('textbox', { name: 'Mensagem (opcional)', exact: true })
    await title.fill(longTitle)
    await message.fill(`${longTitle} ${'texto '.repeat(12)}`)
    await page.setViewportSize({ width: 568, height: 320 })
    await expect(title).toHaveValue(longTitle)
    await expect(message).toHaveValue(`${longTitle} ${'texto '.repeat(12)}`)
    await expect(educatorDialog.getByRole('button', { name: 'Publicar aviso', exact: true })).toBeVisible()
    await expectNoDocumentOverflow(page, 568)
    await page.locator('.modal__rodape').scrollIntoViewIfNeeded()
    await expect(educatorDialog.getByRole('button', { name: 'Fechar', exact: true })).toBeVisible()
    await expectOneMainAndNoOverflow(page, 568)
    await page.screenshot({ path: testInfo.outputPath(`salas-educador-568x320-${width}.png`), animations: 'disabled' })
    expect(platform.calls.some(call => call.path === 'announcements' && call.method === 'POST')).toBe(false)
    await page.keyboard.press('Escape')
    await expect(educatorDialog).toBeHidden()
  }
  expect(platform.unexpected).toEqual([])
})

test('erro ao salvar perfil conserva edição; cancelar exclusão não chama a dependência', async ({ page, platform }) => {
  platform.on('profiles', call => call.method === 'PATCH'
    ? { status: 503, data: { message: 'Perfil indisponível' } }
    : { data: platform.tables.profiles.find(profile => profile.id === ids.user) })
  await page.setViewportSize({ width: 320, height: 844 })
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Editar perfil', exact: true }).click()
  const displayName = page.getByLabel('Nome de exibição', { exact: true })
  const username = page.getByLabel('Nome de usuário', { exact: true })
  await displayName.fill(longTitle)
  await username.fill('carla responsiva')
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(displayName).toHaveValue(longTitle)
  await expect(username).toHaveValue('carla responsiva')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByText(/Perfil indisponível/)).toBeVisible()
  await expect(displayName).toHaveValue(longTitle)
  await expect(username).toHaveValue('carla responsiva')

  await page.goto('/configuracoes')
  const configuredName = page.getByPlaceholder('Digite o nome exibido no perfil')
  const updates = page.getByRole('switch', { name: /Atualização de curso/ })
  await configuredName.fill(longTitle)
  await expect(updates).toBeChecked()
  await updates.click()
  await expect(updates).not.toBeChecked()
  await page.getByRole('button', { name: 'Excluir conta', exact: true }).click()
  const confirmation = page.getByRole('alert')
  await expect(confirmation).toBeVisible()
  await page.setViewportSize({ width: 568, height: 320 })
  await expect(configuredName).toHaveValue(longTitle)
  await expect(updates).not.toBeChecked()
  await confirmation.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(confirmation).toHaveCount(0)
  expect(platform.calls.some(call => call.path === 'deactivate_account')).toBe(false)
  expect(platform.unexpected).toEqual([])
})
