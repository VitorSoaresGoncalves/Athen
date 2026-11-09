import { test, expect, ids } from './support/platform'

test('catálogo busca sem acentos, filtra categoria e mostra ausência de matrícula', async ({ page, platform }) => {
  platform.tables.courses.push({ ...platform.tables.courses[0], id: 'other-course', title: 'História Antiga', category: 'Humanas' })
  await page.goto('/catalogo')
  await expect(page.getByRole('heading', { name: 'Lógica de Programação', exact: true })).toBeVisible()
  await page.getByPlaceholder('Buscar por nome ou assunto...').fill('logica')
  await expect(page.getByRole('heading', { name: 'História Antiga', exact: true })).toHaveCount(0)
  await page.getByPlaceholder('Buscar por nome ou assunto...').clear()
  await page.getByLabel('Filtrar por categoria').selectOption('Humanas')
  await expect(page.getByRole('heading', { name: 'História Antiga', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Lógica de Programação', exact: true })).toHaveCount(0)
  await page.getByLabel('Filtrar por categoria').selectOption('')
  await page.getByRole('button', { name: 'Meus cursos', exact: true }).click()
  await expect(page.getByText('Você ainda não está matriculado em nenhum curso.', { exact: true })).toBeVisible()
})

test('catálogo expõe falha da consulta sem inventar cursos', async ({ page, platform }) => {
  platform.on('courses', () => ({ status: 500, data: { message: 'Catálogo indisponível' } }))
  await page.goto('/catalogo')
  await expect(page.getByText(/Catálogo indisponível/)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Lógica de Programação', exact: true })).toHaveCount(0)
})

test('salas permite entrar por código e apresenta a sala retornada', async ({ page, platform }) => {
  platform.on('join_room', ({ body }) => {
    expect(body).toEqual({ p_access_code: 'LOGICA' })
    platform.tables.rooms.push({ id: 'room-demo', name: 'Turma de lógica', educator_id: ids.educator, access_code: 'LOGICA', course_id: ids.course, pac_visibility: 'all', created_at: '2026-11-01T12:00:00Z' })
    platform.tables.room_members.push({ room_id: 'room-demo', user_id: ids.user, status: 'active', xp: 0, joined_at: '2026-11-01T12:00:00Z' })
    return { data: 'room-demo' }
  })
  await page.goto('/salas')
  await page.getByRole('button', { name: 'Adicionar sala', exact: true }).click()
  await page.getByPlaceholder('Código de acesso', { exact: true }).fill('LOGICA')
  await page.getByRole('button', { name: 'Entrar na sala', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Você entrou na sala')
  await expect(page.getByRole('heading', { name: 'Turma de lógica', exact: true })).toBeVisible()
})

test('salas mantém o código e explica uma entrada recusada', async ({ page, platform }) => {
  platform.on('join_room', () => ({ status: 400, data: { message: 'Código inválido' } }))
  await page.goto('/salas')
  await page.getByRole('button', { name: 'Adicionar sala', exact: true }).click()
  await page.getByPlaceholder('Código de acesso', { exact: true }).fill('ERRADO')
  await page.getByRole('button', { name: 'Entrar na sala', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(/inválido/i)
  await expect(page.getByPlaceholder('Código de acesso', { exact: true })).toHaveValue('ERRADO')
})

test('perfil edita nome e biografia e preserva alterações após recarregar', async ({ page, platform }) => {
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Editar perfil', exact: true }).click()
  await page.getByLabel('Nome de exibição', { exact: true }).fill('Carla Atualizada')
  await page.getByRole('textbox', { name: /^Bio/ }).fill('Estudando lógica todos os dias')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Editar perfil', exact: true })).toBeVisible()
  await expect(page.getByText('Carla Atualizada', { exact: true }).first()).toBeVisible()
  expect(platform.calls.find(call => call.path === 'profiles' && call.method === 'PATCH')?.body).toMatchObject({ display_name: 'Carla Atualizada', bio: 'Estudando lógica todos os dias' })
  await page.reload()
  await expect(page.getByText('Estudando lógica todos os dias', { exact: true })).toBeVisible()
})

test('configurações salva preferências e nome sem solicitar troca de senha', async ({ page, platform }) => {
  await page.goto('/configuracoes')
  await expect(page.getByLabel('Nome de usuário', { exact: false }).first()).toHaveValue('carla')
  await page.getByPlaceholder('Digite o nome exibido no perfil').fill('Carla Configurada')
  const updates = page.getByRole('switch', { name: /Atualização de curso/ })
  await expect(updates).toBeChecked()
  await updates.click()
  await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Alterações salvas com sucesso.')
  expect(platform.calls.filter(call => call.path === 'profiles' && call.method === 'PATCH').map(call => call.body)).toEqual([
    { display_name: 'Carla Configurada', username: 'carla' },
    { notification_preferences: { atualizacao_curso: false, pedido_amizade: true, lembrete_estudo: true } },
  ])
  expect(platform.calls.some(call => call.path === 'user' && call.method === 'PUT')).toBe(false)
  await page.reload()
  await expect(updates).not.toBeChecked()
})

test('configurações rejeita confirmação divergente antes de gravar', async ({ page, platform }) => {
  await page.goto('/configuracoes')
  await page.getByPlaceholder('Digite a nova senha').fill('nova-senha-123')
  await page.getByPlaceholder('Repita a nova senha').fill('outra-senha-123')
  await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('A nova senha e a confirmação não coincidem.')
  expect(platform.calls.some(call => call.method === 'PATCH')).toBe(false)
})

test('amigos busca um usuário e envia um pedido', async ({ page, platform }) => {
  platform.on('search_profiles', ({ body }) => {
    expect(body).toEqual({ p_query: 'diego' })
    return { data: [platform.tables.profiles[2]] }
  })
  await page.goto('/amigos')
  await page.getByPlaceholder('Buscar usuários por nome ou usuário').fill('diego')
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Cancelar pedido', exact: true })).toBeVisible()
  expect(platform.calls.find(call => call.path === 'friendships' && call.method === 'POST')?.body).toEqual({ requester_id: ids.user, addressee_id: ids.friend })
})

test('amigos aceita um pedido recebido e move o contato para meus amigos', async ({ page, platform }) => {
  platform.tables.friendships.push({ id: 'friendship-1', requester_id: ids.friend, addressee_id: ids.user, status: 'pending', created_at: '2026-11-01T12:00:00Z' })
  await page.goto('/amigos')
  await page.getByRole('tab', { name: /Pedidos recebidos/ }).click()
  await page.getByRole('button', { name: 'Aceitar', exact: true }).click()
  await page.getByRole('tab', { name: /Meus amigos/ }).click()
  await expect(page.getByRole('button', { name: 'Ver perfil de Diego Colega', exact: true })).toBeVisible()
  expect(platform.calls.find(call => call.path === 'friendships' && call.method === 'PATCH')?.body).toMatchObject({ status: 'accepted' })
})

test('notificações marca a caixa como lida e abre o destino da atualização', async ({ page, platform }) => {
  platform.tables.notifications.push({ id: 'notice-1', user_id: ids.user, type: 'atualizacao_curso', title: 'Nova aula de lógica', message: 'Continue seus estudos', is_read: false, reference_id: ids.course, created_at: '2026-11-01T12:00:00Z' })
  await page.goto('/notificacoes')
  await page.getByRole('button', { name: /Nova aula de lógica/ }).click()
  await expect(page).toHaveURL('/catalogo')
  expect(platform.calls.some(call => call.path === 'notifications' && call.method === 'PATCH' && call.body.is_read === true)).toBe(true)
  await page.goto('/notificacoes')
  await expect(page.getByText('Tudo em dia.', { exact: true })).toBeVisible()
})

test('notificações distingue caixa vazia de erro de carregamento', async ({ page, platform }) => {
  await page.goto('/notificacoes')
  await expect(page.getByText('Você ainda não tem notificações.', { exact: true })).toBeVisible()
  platform.on('notifications', () => ({ status: 400, data: { message: 'Caixa indisponível' } }))
  await page.reload()
  await expect(page.getByText(/Erro ao listar notificações: Caixa indisponível/)).toBeVisible()
  await expect(page.getByText('Você ainda não tem notificações.', { exact: true })).toHaveCount(0)
})

test('caderno cria página, salva conteúdo e protege alterações não salvas', async ({ page, platform }) => {
  await page.goto('/caderno')
  await page.getByRole('button', { name: 'Criar notebook', exact: true }).click()
  await page.getByRole('textbox', { name: 'Nome do notebook', exact: true }).fill('Meu estudo')
  await page.getByRole('button', { name: 'Concluir', exact: true }).click()
  await page.getByRole('button', { name: 'Criar primeira página', exact: true }).click()
  const text = page.getByPlaceholder('Escreva suas anotações aqui...')
  await text.fill('Uma expressão pode produzir um resultado.')
  await page.getByRole('button', { name: 'Salvar', exact: true }).last().click()
  await expect.poll(() => platform.tables.notebook_pages[0]?.content).toBe('Uma expressão pode produzir um resultado.')
  await text.fill('Alteração ainda não salva')
  await page.getByRole('button', { name: /Voltar/ }).click()
  await expect(page.getByRole('dialog')).toContainText('Alterações não salvas')
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(text).toHaveValue('Alteração ainda não salva')
  await page.reload()
  await page.getByRole('button', { name: /Meu estudo/ }).click()
  await expect(text).toHaveValue('Uma expressão pode produzir um resultado.')
})

test('criação de curso valida dados obrigatórios e salva uma estrutura como rascunho', async ({ page, platform }) => {
  await page.goto('/criar-curso')
  await page.getByRole('button', { name: 'Publicar', exact: true }).click()
  await expect(page.getByText('Informe o título do curso.', { exact: true })).toBeVisible()
  expect(platform.calls.some(call => call.method === 'POST' && call.path === 'courses')).toBe(false)
  await page.getByLabel('Título', { exact: true }).fill('Introdução à Lógica')
  await page.getByLabel('Título do módulo', { exact: true }).fill('Módulo inicial')
  await page.getByLabel('Título da aula', { exact: true }).fill('Leitura inicial')
  await page.getByRole('button', { name: 'Salvar rascunho', exact: true }).click()
  await expect(page).toHaveURL('/catalogo')
  expect(platform.calls.find(call => call.path === 'courses' && call.method === 'POST')?.body).toMatchObject({ title: 'Introdução à Lógica', slug: 'introducao-a-logica', status: 'draft', creator_id: ids.user })
  expect(platform.calls.find(call => call.path === 'lessons' && call.method === 'POST')?.body).toMatchObject({ title: 'Leitura inicial' })
})

test('console CRUD alterna entidades e carrega os registros da sessão', async ({ page, platform }) => {
  await page.goto('/crud')
  const tabs = page.getByRole('navigation', { name: 'Tabelas do banco' })
  await expect(page.getByText('Carla Estudante', { exact: true })).toBeVisible()
  await tabs.getByRole('button', { name: 'Cursos', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'Lógica de Programação', exact: true })).toBeVisible()
  await tabs.getByRole('button', { name: 'Aulas', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'Primeira aula', exact: true })).toBeVisible()
  expect(platform.calls.some(call => call.path === 'lessons')).toBe(true)
})
