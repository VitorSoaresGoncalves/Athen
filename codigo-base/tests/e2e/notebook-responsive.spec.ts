import { expect, test, ids, installPlatform } from './support/platform'

const notebookId = '99999999-9999-4999-8999-999999999991'
const pageId = '99999999-9999-4999-8999-999999999992'
const secondNotebookId = '99999999-9999-4999-8999-999999999993'
const secondPageId = '99999999-9999-4999-8999-999999999994'

function seedNotebook(platform: Awaited<ReturnType<typeof installPlatform>>) {
  platform.tables.enrollments.push({
    id: 'responsive-enrollment',
    user_id: ids.user,
    course_id: ids.course,
    status: 'active',
    progress: 0,
  })
  platform.tables.notebooks.push(
    { id: notebookId, title: 'Lógica de Programação', user_id: ids.user, created_at: '2026-11-01T12:00:00Z' },
    { id: secondNotebookId, title: 'Outro caderno', user_id: ids.user, created_at: '2026-11-02T12:00:00Z' },
  )
  platform.tables.notebook_pages.push({
    id: pageId,
    notebook_id: notebookId,
    title: 'Página inicial',
    content: 'Texto inicial que deve sobreviver a cada mudança de viewport.',
    position: 0,
    created_at: '2026-11-01T12:00:00Z',
    updated_at: '2026-11-01T12:00:00Z',
  }, {
    id: secondPageId,
    notebook_id: notebookId,
    title: 'Segunda página',
    content: 'Segunda anotação.',
    position: 1,
    created_at: '2026-11-02T12:00:00Z',
    updated_at: '2026-11-02T12:00:00Z',
  })
}

async function openNotebook(page: import('@playwright/test').Page) {
  await page.goto(`/dashboard?curso=${ids.course}`)
  const trigger = page.getByRole('button', { name: 'Abrir notebook', exact: true })
  await expect(trigger).toBeVisible()
  await trigger.click()
  const dialog = page.locator('[role="dialog"][aria-labelledby="course-notebook-title"]')
  await expect(dialog).toBeVisible()
  return dialog
}

async function expectNotebookContained(page: import('@playwright/test').Page) {
  const geometry = await page.locator('[role="dialog"][aria-labelledby="course-notebook-title"]').evaluate(element => {
    const box = element.getBoundingClientRect()
    const viewport = window.visualViewport
    const left = viewport?.offsetLeft ?? 0
    const top = viewport?.offsetTop ?? 0
    const right = left + (viewport?.width ?? document.documentElement.clientWidth)
    const bottom = top + (viewport?.height ?? document.documentElement.clientHeight)
    return { x: box.left, y: box.top, right: box.right, bottom: box.bottom, left, top, rightEdge: right, bottomEdge: bottom }
  })
  expect(geometry.x).toBeGreaterThanOrEqual(geometry.left + 7)
  expect(geometry.y).toBeGreaterThanOrEqual(geometry.top + 7)
  expect(geometry.right).toBeLessThanOrEqual(geometry.rightEdge - 7)
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.bottomEdge - 7)
  return geometry
}

test('edição, foco e conteúdo sobrevivem a resize, giro e Ajustar à tela', async ({ page, platform }) => {
  seedNotebook(platform)
  await page.setViewportSize({ width: 390, height: 844 })
  const dialog = await openNotebook(page)
  const editor = dialog.getByPlaceholder('Escreva suas anotações aqui...')
  const title = dialog.getByRole('textbox', { name: 'Título da página' })
  await title.fill('Rascunho persistente')
  await editor.fill('Texto editado antes do resize e que não pode ser perdido.')
  await editor.focus()
  const callsBeforeResize = platform.calls.length

  for (const viewport of [{ width: 844, height: 390 }, { width: 568, height: 320 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport)
    await expectNotebookContained(page)
    await expect(title).toHaveValue('Rascunho persistente')
    await expect(editor).toHaveValue('Texto editado antes do resize e que não pode ser perdido.')
    await expect(editor).toBeFocused()
  }
  expect(platform.calls.slice(callsBeforeResize).filter(call => ['notebooks', 'notebook_pages'].includes(call.path))).toEqual([])

  await dialog.getByRole('button', { name: 'Ajustar à tela', exact: true }).click()
  await expectNotebookContained(page)
  await expect(editor).toHaveValue('Texto editado antes do resize e que não pode ser perdido.')
  expect(platform.calls.filter(call => ['notebooks', 'notebook_pages'].includes(call.path) && call.method !== 'GET')).toEqual([])
  await dialog.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(editor).toHaveValue('Texto editado antes do resize e que não pode ser perdido.')
  expect(platform.calls.filter(call => call.path === 'notebook_pages' && call.method === 'PATCH')).toHaveLength(1)
  await page.reload()
  await page.getByRole('button', { name: 'Abrir notebook', exact: true }).click()
  await expect(page.locator('[role="dialog"][aria-labelledby="course-notebook-title"]').getByPlaceholder('Escreva suas anotações aqui...'))
    .toHaveValue('Texto editado antes do resize e que não pode ser perdido.')
})

test('ajuste geométrico por teclado rejeita dados inválidos e confina retângulo em viewport mínima', async ({ page, platform }) => {
  seedNotebook(platform)
  await page.setViewportSize({ width: 320, height: 201 })
  const dialog = await openNotebook(page)
  await expectNotebookContained(page)
  await dialog.getByRole('button', { name: 'Ajustar janela', exact: true }).click()

  const width = dialog.getByRole('spinbutton', { name: 'Largura' })
  const apply = dialog.getByRole('button', { name: 'Aplicar', exact: true })
  await width.fill('0')
  await apply.click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expectNotebookContained(page)
  await width.fill('')
  await apply.click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await dialog.getByRole('spinbutton', { name: 'Altura' }).fill('-1')
  await apply.click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  expect(platform.calls.filter(call => ['notebooks', 'notebook_pages'].includes(call.path) && call.method !== 'GET')).toEqual([])

  await width.fill('240')
  await dialog.getByRole('spinbutton', { name: 'Altura' }).fill('200')
  await apply.click()
  const geometry = await expectNotebookContained(page)
  expect(geometry.rightEdge - geometry.left).toBeLessThanOrEqual(320)
  expect(geometry.bottomEdge - geometry.top).toBeLessThanOrEqual(201)
})

test('falha ao salvar não limpa nem descarta rascunho e bloqueia troca encadeada de notebook', async ({ page, platform }) => {
  seedNotebook(platform)
  platform.on('notebook_pages', ({ method, query }) => method === 'PATCH'
    ? { status: 403, data: { message: 'A gravação foi recusada.' } }
    : { data: platform.tables.notebook_pages.filter(row => row.notebook_id === query.get('notebook_id')?.replace(/^eq\./, '')) })
  await page.setViewportSize({ width: 390, height: 844 })
  const dialog = await openNotebook(page)
  const editor = dialog.getByPlaceholder('Escreva suas anotações aqui...')
  await editor.fill('Rascunho não deve desaparecer.')
  await dialog.getByRole('combobox', { name: 'Selecionar notebook' }).selectOption(secondNotebookId)

  const confirmation = page.getByRole('dialog', { name: 'Alterações não salvas' })
  await expect(confirmation).toBeVisible()
  await confirmation.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('A gravação foi recusada.')
  await expect(editor).toHaveValue('Rascunho não deve desaparecer.')
  await expect(dialog.getByRole('combobox', { name: 'Selecionar notebook' })).toHaveValue(notebookId)
  expect(platform.calls.filter(call => call.path === 'notebook_pages' && call.method === 'PATCH')).toHaveLength(1)
  expect(platform.calls.filter(call => call.path === 'notebook_pages' && call.method === 'POST')).toHaveLength(0)
})

test('falha ao salvar antes de criar página interrompe a ação encadeada e preserva o rascunho', async ({ page, platform }) => {
  seedNotebook(platform)
  platform.on('notebook_pages', ({ method, query }) => method === 'PATCH'
    ? { status: 403, data: { message: 'Não foi possível salvar antes de criar a página.' } }
    : { data: platform.tables.notebook_pages.filter(row => row.notebook_id === query.get('notebook_id')?.replace(/^eq\./, '')) })
  const dialog = await openNotebook(page)
  const editor = dialog.getByPlaceholder('Escreva suas anotações aqui...')
  await editor.fill('Rascunho antes da criação.')
  await dialog.getByRole('button', { name: 'Criar nova página', exact: true }).click()
  const confirmation = page.getByRole('dialog', { name: 'Alterações não salvas' })
  await expect(confirmation).toBeVisible()
  await confirmation.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Não foi possível salvar antes de criar a página.')
  await expect(editor).toHaveValue('Rascunho antes da criação.')
  await expect(dialog.getByRole('textbox', { name: 'Título da página' })).toHaveValue('Página inicial')
  expect(platform.calls.filter(call => call.path === 'notebook_pages' && call.method === 'PATCH')).toHaveLength(1)
  expect(platform.calls.filter(call => call.path === 'notebook_pages' && call.method === 'POST')).toHaveLength(0)
})

test('cancelar troca de página conserva edição; descartar troca apenas após confirmação explícita', async ({ page, platform }) => {
  seedNotebook(platform)
  const dialog = await openNotebook(page)
  const editor = dialog.getByPlaceholder('Escreva suas anotações aqui...')
  const title = dialog.getByRole('textbox', { name: 'Título da página' })
  await editor.fill('Não descartar no primeiro pedido.')
  const secondTab = dialog.getByRole('button', { name: 'Segunda página', exact: true })
  await secondTab.click()
  const confirmation = page.getByRole('dialog', { name: 'Alterações não salvas' })
  await expect(confirmation).toBeVisible()
  await confirmation.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(confirmation).toHaveCount(0)
  await expect(title).toHaveValue('Página inicial')
  await expect(editor).toHaveValue('Não descartar no primeiro pedido.')

  await secondTab.click()
  await expect(confirmation).toBeVisible()
  await confirmation.getByRole('button', { name: 'Descartar e trocar', exact: true }).click()
  await expect(title).toHaveValue('Segunda página')
  await expect(editor).toHaveValue('Segunda anotação.')
  expect(platform.calls.filter(call => call.path === 'notebook_pages' && call.method !== 'GET')).toEqual([])
})

test('estado loading ao trocar caderno mantém diálogo e controles sem perder estado', async ({ page, platform }) => {
  seedNotebook(platform)
  const secondNotebookPage = {
    id: '99999999-9999-4999-8999-999999999995',
    notebook_id: secondNotebookId,
    title: 'Página do outro caderno',
    content: 'Conteúdo carregado após espera.',
    position: 0,
    created_at: '2026-11-03T12:00:00Z',
    updated_at: '2026-11-03T12:00:00Z',
  }
  platform.tables.notebook_pages.push(secondNotebookPage)
  let releaseRequest!: () => void
  let notifyStarted!: () => void
  const held = new Promise<void>(resolve => { releaseRequest = resolve })
  const started = new Promise<void>(resolve => { notifyStarted = resolve })
  platform.on('notebook_pages', async ({ method, query }) => {
    const selectedNotebook = query.get('notebook_id')?.replace(/^eq\./, '')
    if (method === 'GET' && selectedNotebook === secondNotebookId) {
      notifyStarted()
      await held
    }
    return { data: platform.tables.notebook_pages.filter(row => row.notebook_id === selectedNotebook) }
  })
  const dialog = await openNotebook(page)
  const selector = dialog.getByRole('combobox', { name: 'Selecionar notebook' })
  await selector.selectOption(secondNotebookId)
  await started
  await expect(selector).toBeDisabled()
  await expect(dialog.getByText('Salvando...', { exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Fechar notebook', exact: true })).toBeVisible()
  releaseRequest()
  await expect(selector).toBeEnabled()
  await expect(dialog.getByRole('textbox', { name: 'Título da página' })).toHaveValue('Página do outro caderno')
  await expect(dialog.getByPlaceholder('Escreva suas anotações aqui...')).toHaveValue('Conteúdo carregado após espera.')
})

test('páginas e cadernos numerosos com títulos de 80 caracteres continuam selecionáveis', async ({ page, platform }) => {
  seedNotebook(platform)
  const longPages = Array.from({ length: 10 }, (_, index) => {
    const title = `Pagina${index}`.padEnd(80, 'X')
    return {
      id: `66666666-6666-4666-8666-${String(index + 1).padStart(12, '0')}`,
      notebook_id: notebookId,
      title,
      content: `Texto extenso da página ${index}: ${'anotação '.repeat(200)}`,
      position: index + 2,
      created_at: '2026-11-04T12:00:00Z',
      updated_at: '2026-11-04T12:00:00Z',
    }
  })
  const longNotebooks = Array.from({ length: 12 }, (_, index) => ({
    id: `55555555-5555-4555-8555-${String(index + 1).padStart(12, '0')}`,
    title: `Caderno${index}`.padEnd(80, 'N'),
    user_id: ids.user,
    created_at: '2026-11-05T12:00:00Z',
  }))
  platform.tables.notebook_pages.push(...longPages)
  platform.tables.notebooks.push(...longNotebooks)
  await page.setViewportSize({ width: 320, height: 844 })
  const dialog = await openNotebook(page)
  const editor = dialog.getByPlaceholder('Escreva suas anotações aqui...')
  const firstLongPage = dialog.getByRole('button', { name: longPages[0].title, exact: true })
  const lastLongPage = dialog.getByRole('button', { name: longPages.at(-1)!.title, exact: true })
  await firstLongPage.scrollIntoViewIfNeeded()
  await firstLongPage.click()
  await expect(dialog.getByRole('textbox', { name: 'Título da página' })).toHaveValue(longPages[0].title)
  await lastLongPage.scrollIntoViewIfNeeded()
  await lastLongPage.click()
  await expect(dialog.getByRole('textbox', { name: 'Título da página' })).toHaveValue(longPages.at(-1)!.title)
  expect(await dialog.getByRole('combobox', { name: 'Selecionar notebook' }).locator('option').count()).toBe(14)
  await dialog.getByRole('combobox', { name: 'Selecionar notebook' }).selectOption(longNotebooks.at(-1)!.id)
  await expect(page.getByText('Nenhuma página ainda', { exact: true })).toBeVisible()
  await expect(editor).toHaveCount(0)
})

test('estado vazio e erro de leitura permanecem distinguíveis e fecháveis sem escrita', async ({ page, platform }) => {
  platform.tables.enrollments.push({ id: 'responsive-enrollment', user_id: ids.user, course_id: ids.course, status: 'active', progress: 0 })
  platform.tables.notebooks.push({
    id: notebookId,
    title: 'Lógica de Programação',
    user_id: ids.user,
    created_at: '2026-11-01T12:00:00Z',
  })
  await page.goto(`/dashboard?curso=${ids.course}`)
  await page.getByRole('button', { name: 'Abrir notebook', exact: true }).click()
  const dialog = page.locator('[role="dialog"][aria-labelledby="course-notebook-title"]')
  await expect(dialog).toBeVisible()
  await expect(page.getByText('Nenhuma página ainda', { exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Criar página', exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Fechar notebook', exact: true }).click()
  expect(platform.calls.filter(call => ['notebooks', 'notebook_pages'].includes(call.path) && call.method !== 'GET')).toHaveLength(0)
})

test('falha de leitura mostra erro recuperável sem substituir conteúdo ou esconder fechar', async ({ page, platform }) => {
  platform.tables.enrollments.push({ id: 'responsive-enrollment', user_id: ids.user, course_id: ids.course, status: 'active', progress: 0 })
  platform.tables.notebooks.push({
    id: notebookId,
    title: 'Lógica de Programação',
    user_id: ids.user,
    created_at: '2026-11-01T12:00:00Z',
  })
  platform.on('notebook_pages', ({ method }) => method === 'GET'
    ? { status: 503, data: { message: 'Leitura temporariamente indisponível.' } }
    : { data: [] })
  await page.goto(`/dashboard?curso=${ids.course}`)
  await page.getByRole('button', { name: 'Abrir notebook', exact: true }).click()
  const dialog = page.locator('[role="dialog"][aria-labelledby="course-notebook-title"]')
  await expect(dialog.getByRole('alert')).toContainText('Leitura temporariamente indisponível.')
  await expect(dialog.getByRole('button', { name: 'Fechar notebook', exact: true })).toBeVisible()
  await expect(dialog.getByText('Nenhuma página ainda', { exact: true })).toHaveCount(0)
  expect(platform.calls.filter(call => ['notebooks', 'notebook_pages'].includes(call.path) && call.method !== 'GET')).toEqual([])
})

test('Escape resolve primeiro a confirmação de rascunho; fechar depois devolve foco ao gatilho', async ({ page, platform }) => {
  seedNotebook(platform)
  await page.setViewportSize({ width: 320, height: 201 })
  await page.goto(`/dashboard?curso=${ids.course}`)
  const trigger = page.getByRole('button', { name: 'Abrir notebook', exact: true })
  await expect(trigger).toBeVisible()
  await trigger.click()
  const notebook = page.locator('[role="dialog"][aria-labelledby="course-notebook-title"]')
  const close = notebook.getByRole('button', { name: 'Fechar notebook', exact: true })
  await expect(close).toBeFocused()
  const editor = notebook.getByPlaceholder('Escreva suas anotações aqui...')
  await editor.fill('Rascunho mantido ao cancelar a proteção.')
  await page.keyboard.press('Escape')
  const confirmation = page.getByRole('dialog', { name: 'Alterações não salvas' })
  await expect(confirmation).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(confirmation).toHaveCount(0)
  await expect(notebook).toBeVisible()
  await expect(editor).toHaveValue('Rascunho mantido ao cancelar a proteção.')

  await close.click()
  await expect(confirmation).toBeVisible()
  await confirmation.getByRole('button', { name: 'Fechar sem salvar', exact: true }).click()
  await expect(notebook).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('criar notebook e página é intenção explícita e os controles cabem em viewport estreita', async ({ page, platform }) => {
  platform.tables.enrollments.push({ id: 'responsive-enrollment', user_id: ids.user, course_id: ids.course, status: 'active', progress: 0 })
  await page.setViewportSize({ width: 320, height: 844 })
  await page.goto(`/dashboard?curso=${ids.course}`)
  await page.getByRole('button', { name: 'Criar notebook', exact: true }).click()
  const notebook = page.locator('[role="dialog"][aria-labelledby="course-notebook-title"]')
  await expect(notebook).toBeVisible()
  await expect(notebook.getByRole('button', { name: 'Salvar', exact: true })).toBeVisible()
  await expect(notebook.getByPlaceholder('Escreva suas anotações aqui...')).toBeVisible()
  expect(platform.calls.filter(call => call.path === 'notebooks' && call.method === 'POST')).toHaveLength(1)
  expect(platform.calls.filter(call => call.path === 'notebook_pages' && call.method === 'POST')).toHaveLength(1)

  await notebook.getByRole('button', { name: 'Criar nova página', exact: true }).click()
  await expect(notebook.getByRole('button', { name: 'Nova página', exact: true }).last()).toBeVisible()
  expect(platform.calls.filter(call => call.path === 'notebook_pages' && call.method === 'POST')).toHaveLength(2)
})
