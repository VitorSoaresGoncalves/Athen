import { test, expect } from './support/platform'

const data = '2026-11-24T12:00:00Z'

function uuid(value: number) {
  return `a5400000-0000-4000-8000-${String(value).padStart(12, '0')}`
}

function seedNotebook(
  platform: { tables: Record<string, Array<Record<string, unknown>>> },
  id: string,
  title: string,
  pages: string[],
) {
  platform.tables.notebooks.push({
    id,
    user_id: '11111111-1111-4111-8111-111111111111',
    title,
    created_at: data,
    updated_at: data,
  })
  pages.forEach((pageTitle, index) => platform.tables.notebook_pages.push({
    id: uuid(1000 + index + Number(id.slice(-3))),
    notebook_id: id,
    title: pageTitle,
    content: `Conteúdo original de ${pageTitle}`,
    position: index,
    created_at: data,
    updated_at: data,
  }))
}

async function expectLayoutFitsUsefulWidth(page: import('@playwright/test').Page) {
  const overflow = await page.locator('.page-layout__main').evaluate(main => {
    const rect = main.getBoundingClientRect()
    const style = getComputedStyle(main)
    const left = rect.left + parseFloat(style.paddingLeft)
    const right = rect.right - parseFloat(style.paddingRight)
    const nodes = [...main.querySelectorAll('header, section, button, input, textarea, select, [role="alert"]')]
    return nodes.flatMap(element => {
      const box = element.getBoundingClientRect()
      if (!box.width || !box.height) return []
      // Abas podem usar rolagem horizontal local; a última e a ação de criar
      // são verificadas separadamente por teclado no cenário de várias páginas.
      let ancestor = element.parentElement
      while (ancestor && ancestor !== main) {
        const overflowX = getComputedStyle(ancestor).overflowX
        if ((overflowX === 'auto' || overflowX === 'scroll') && ancestor.scrollWidth > ancestor.clientWidth + 1) return []
        ancestor = ancestor.parentElement
      }
      return box.left >= left - 1 && box.right <= right + 1
        ? []
        : [`${element.tagName}.${element.className}: ${box.left}..${box.right}; útil ${left}..${right}`]
    })
  })
  expect(overflow).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}

const widths = [320, 390, 768, 1440]

test('estante vazia e preenchida cabe nas larguras do contrato e filtra nomes extensos', async ({ page, platform }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await page.goto('/caderno')
  await expect(page.getByRole('heading', { name: 'Sua estante está vazia', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Criar notebook', exact: true })).toBeVisible()
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 })
    await expectLayoutFitsUsefulWidth(page)
    await expect(page.getByRole('heading', { name: 'Sua estante está vazia', exact: true })).toBeVisible()
  }

  const longName = 'CadernoComNomeExtremamenteLongoSemEspacosParaExercitarQuebraDeLinhaNaEstante'
  seedNotebook(platform, uuid(100), longName, ['Página inicial'])
  seedNotebook(platform, uuid(101), 'Caderno de leitura', ['Anotação de leitura'])
  await page.reload()
  await expect(page.getByRole('button', { name: new RegExp(longName) })).toBeVisible()

  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 })
    await expectLayoutFitsUsefulWidth(page)
    if (width === 320 || width === 1440) {
      await page.screenshot({
        path: testInfo.outputPath(`caderno-estante-${width}.png`),
        fullPage: true,
        animations: 'disabled',
      })
    }
  }
  await page.getByRole('searchbox', { name: 'Pesquisar notebooks' }).fill('sem correspondência')
  await expect(page.getByText('Nenhum notebook encontrado.', { exact: true })).toBeVisible()
})

test('resize, paisagem e navegação preservam editor e seleção sem escritas', async ({ page, platform }, testInfo) => {
  const notebookId = uuid(200)
  seedNotebook(platform, notebookId, 'Caderno rascunho', ['Página 01', 'Página 02'])
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/caderno')
  await page.getByRole('button', { name: /Caderno rascunho/ }).click()
  await expect(page.getByPlaceholder('Escreva suas anotações aqui...')).toHaveValue('Conteúdo original de Página 01')

  const editName = page.getByRole('button', { name: 'Editar nome', exact: true })
  await editName.first().click()
  await page.getByRole('textbox', { name: 'Nome do notebook' }).fill('Caderno rascunho editado')
  await editName.last().click()
  await page.getByPlaceholder('Nome da página').fill('Página selecionada editada')
  await page.getByPlaceholder('Escreva suas anotações aqui...').fill('Rascunho preservado em toda a sequência de viewport.')
  const writesBefore = platform.calls.filter(call => ['POST', 'PATCH', 'DELETE'].includes(call.method)).length

  for (const viewport of [
    { width: 320, height: 844 },
    { width: 390, height: 844 },
    { width: 568, height: 320 },
    { width: 768, height: 900 },
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    await expectLayoutFitsUsefulWidth(page)
    await expect(page.getByRole('textbox', { name: 'Nome do notebook' })).toHaveValue('Caderno rascunho editado')
    await expect(page.getByPlaceholder('Nome da página')).toHaveValue('Página selecionada editada')
    await expect(page.getByPlaceholder('Escreva suas anotações aqui...')).toHaveValue('Rascunho preservado em toda a sequência de viewport.')
    if (viewport.width === 320 || viewport.width === 1440) {
      await page.screenshot({
        path: testInfo.outputPath(`caderno-editor-${viewport.width}.png`),
        fullPage: true,
        animations: 'disabled',
      })
    }
  }

  const navigation = page.getByRole('button', { name: /navegação/i })
  await navigation.click()
  await navigation.click()
  await expect(page.getByPlaceholder('Escreva suas anotações aqui...')).toHaveValue('Rascunho preservado em toda a sequência de viewport.')
  const savePage = page.getByRole('button', { name: 'Salvar', exact: true }).last()
  await savePage.scrollIntoViewIfNeeded()
  await expect(savePage).toBeInViewport()
  expect(platform.calls.filter(call => ['POST', 'PATCH', 'DELETE'].includes(call.method))).toHaveLength(writesBefore)
})

test('busca, salva payloads existentes e alcança última página e nova página pelo teclado', async ({ page, platform }) => {
  const notebookId = uuid(300)
  const pageTitles = Array.from({ length: 12 }, (_, index) =>
    index === 11 ? 'Página 12 — um título final deliberadamente comprido para a rolagem' : `Página ${String(index + 1).padStart(2, '0')}`,
  )
  seedNotebook(platform, notebookId, 'Caderno responsivo de leitura', pageTitles)
  await page.setViewportSize({ width: 320, height: 844 })
  await page.goto('/caderno')
  await page.getByRole('searchbox', { name: 'Pesquisar notebooks' }).fill('responsivo de leitura')
  const notebookCard = page.getByRole('button', { name: /Caderno responsivo de leitura/ })
  await expect(notebookCard).toBeVisible()
  await notebookCard.click()

  const editName = page.getByRole('button', { name: 'Editar nome', exact: true })
  await editName.first().click()
  await page.getByRole('textbox', { name: 'Nome do notebook' }).fill('Caderno renomeado pelo ensaio de página')
  await editName.last().click()
  const pageTitle = 'Uma página intitulada com texto bastante longo para a área do editor'
  await page.getByPlaceholder('Nome da página').fill(pageTitle)
  const content = 'Anotações atualizadas sem alterar o formato de gravação já utilizado pelo caderno.'
  await page.getByPlaceholder('Escreva suas anotações aqui...').fill(content)
  await page.getByRole('button', { name: 'Salvar', exact: true }).last().click()

  const notebookUpdate = platform.calls.find(call => call.path === 'notebooks' && call.method === 'PATCH')
  const pageUpdate = platform.calls.find(call => call.path === 'notebook_pages' && call.method === 'PATCH')
  expect(notebookUpdate?.body).toEqual({ title: 'Caderno renomeado pelo ensaio de página' })
  expect(pageUpdate?.body).toEqual({ title: pageTitle, content })

  const lastPage = page.getByRole('button', { name: pageTitles[11], exact: true })
  await page.getByRole('button', { name: pageTitles[10], exact: true }).focus()
  await page.keyboard.press('Tab')
  await expect(lastPage).toBeFocused()
  await expect(lastPage).toBeInViewport()
  expect(await lastPage.evaluate(element => {
    const style = getComputedStyle(element)
    return element.matches(':focus-visible') && style.outlineStyle !== 'none' && style.outlineWidth !== '0px'
  })).toBe(true)
  const addPage = page.getByRole('button', { name: /Nova página/ })
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: pageTitle, exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(addPage).toBeFocused()
  await expect(addPage).toBeInViewport()
  expect(await addPage.evaluate(element => {
    const style = getComputedStyle(element)
    return element.matches(':focus-visible') && style.outlineStyle !== 'none' && style.outlineWidth !== '0px'
  })).toBe(true)
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Shift+Tab')
  await expect(lastPage).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByPlaceholder('Nome da página')).toHaveValue(pageTitles[11])

  await addPage.focus()
  await page.keyboard.press('Enter')
  expect(platform.calls.find(call => call.path === 'notebook_pages' && call.method === 'POST')?.body).toMatchObject({
    notebook_id: notebookId,
    title: 'Nova página',
    content: '',
    position: pageTitles.length,
  })
})

test('voltar/trocar protege rascunho e falha HTTP ao salvar não apaga conteúdo', async ({ page, platform }, testInfo) => {
  const notebookA = uuid(400)
  const notebookB = uuid(401)
  seedNotebook(platform, notebookA, 'Caderno Alfa', ['Página Alfa'])
  seedNotebook(platform, notebookB, 'Caderno Beta', ['Página Beta'])
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/caderno')
  await page.getByRole('button', { name: /Caderno Alfa/ }).click()
  const text = page.getByPlaceholder('Escreva suas anotações aqui...')
  await text.fill('Alteração ainda não salva.')

  await page.getByRole('button', { name: /Voltar para a estante/ }).click()
  await expect(page.getByRole('dialog')).toContainText('Alterações não salvas')
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(text).toHaveValue('Alteração ainda não salva.')

  await page.getByRole('button', { name: /Caderno Beta/ }).click()
  await expect(page.getByRole('dialog')).toContainText('Alterações não salvas')
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(text).toHaveValue('Alteração ainda não salva.')

  platform.on('notebook_pages', () => ({ status: 503, data: { message: 'Falha temporária ao salvar anotação.' } }))
  await page.getByRole('button', { name: 'Salvar', exact: true }).last().click()
  await expect(page.getByText(/Falha temporária ao salvar anotação/)).toBeVisible()
  await expect(text).toHaveValue('Alteração ainda não salva.')
  expect(platform.tables.notebook_pages.find(row => row.id === uuid(1400))?.content).toBe('Conteúdo original de Página Alfa')
  await page.setViewportSize({ width: 320, height: 844 })
  await expectLayoutFitsUsefulWidth(page)
  await expect(text).toHaveValue('Alteração ainda não salva.')
  await page.screenshot({
    path: testInfo.outputPath('caderno-erro-save-320.png'),
    fullPage: true,
    animations: 'disabled',
  })
})
