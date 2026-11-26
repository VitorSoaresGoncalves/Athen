import { test, expect } from './support/platform'

const tipos = ['multiple_choice', 'match', 'fill_blank', 'sum_alternatives']

async function preencherCursoComQuatroQuestoes(page: import('@playwright/test').Page) {
  await page.goto('/criar-curso')
  await page.getByLabel('Título', { exact: true }).fill('Curso responsivo de teste')
  await page.getByLabel('Título do módulo', { exact: true }).fill('Módulo de geometria')
  await page.getByLabel('Título da aula', { exact: true }).fill('Aula de editores')

  await page.getByRole('button', { name: 'Adicionar questão', exact: true }).click()
  const tiposQuestao = page.getByRole('combobox', { name: 'Tipo', exact: true })
  await tiposQuestao.nth(0).selectOption('multiple_choice')
  await page.getByLabel('Enunciado', { exact: true }).nth(0).fill('Escolha uma alternativa.')
  await page.getByPlaceholder('Alternativa 1').fill('Resposta correta')
  await page.getByLabel('Correta', { exact: true }).first().check()
  await page.getByPlaceholder('Alternativa 2').fill('Resposta incorreta')

  for (const [index, tipo] of tipos.slice(1).entries()) {
    await page.getByRole('button', { name: 'Adicionar questão', exact: true }).click()
    await tiposQuestao.nth(index + 1).selectOption(tipo)
    await page.getByLabel('Enunciado', { exact: true }).nth(index + 1).fill(`Enunciado ${tipo}`)
  }

  await page.getByPlaceholder('Esquerda').fill('Termo da esquerda')
  await page.getByPlaceholder('Direita').fill('Termo da direita')
  await page.getByPlaceholder('Resposta aceita 1').fill('Resposta aceita')
  await page.getByLabel('Valor da afirmativa 1').fill('1')
  await page.getByLabel('Correta', { exact: true }).last().check()
}

async function expectControlsWithinViewport(page: import('@playwright/test').Page) {
  const overflowing = await page.locator('.criar-curso').evaluate(root => {
    const width = document.documentElement.clientWidth
    const content = root.querySelector('.criar-curso__main')!.getBoundingClientRect()
    return [...root.querySelectorAll('header, .criar-curso__cartao, .criar-curso__aula, .criar-curso__questao, input, textarea, select, button')].flatMap((element) => {
      const rect = element.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return []
      return rect.left >= Math.max(-1, content.left - 1) && rect.right <= Math.min(width + 1, content.right + 1)
        ? []
        : [`${element.tagName}.${element.className}: ${rect.left}..${rect.right}; content ${content.left}..${content.right}; viewport ${width}`]
    })
  })
  expect(overflowing).toEqual([])
}

test('quatro editores cabem em 320/390/768/1440px e mantêm ações visíveis', async ({ page, platform }, testInfo) => {
  expect(platform.unexpected).toEqual([])
  await preencherCursoComQuatroQuestoes(page)

  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expectControlsWithinViewport(page)
    await expect(page.getByRole('combobox', { name: 'Tipo', exact: true })).toHaveCount(4)
    await expect(page.getByRole('button', { name: 'Publicar', exact: true })).toBeAttached()
    if (width === 320 || width === 1440) {
      await page.screenshot({
        path: testInfo.outputPath(`criar-curso-${width}.png`),
        fullPage: true,
        animations: 'disabled',
      })
    }
  }
})

test('resize, paisagem e sidebar preservam os quatro rascunhos sem escritas', async ({ page, platform }) => {
  await preencherCursoComQuatroQuestoes(page)
  const writesBefore = platform.calls.filter(call => ['POST', 'PATCH', 'DELETE'].includes(call.method)).length
  const navigation = page.getByRole('button', { name: /navegação/i })

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 568, height: 320 },
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    await expectControlsWithinViewport(page)
    await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Curso responsivo de teste')
    await expect(page.getByLabel('Título do módulo', { exact: true })).toHaveValue('Módulo de geometria')
    await expect(page.getByRole('combobox', { name: 'Tipo', exact: true }).first()).toHaveValue(tipos[0])
    await expect(page.getByPlaceholder('Esquerda')).toHaveValue('Termo da esquerda')
    await expect(page.getByPlaceholder('Resposta aceita 1')).toHaveValue('Resposta aceita')
    await expect(page.getByLabel('Valor da afirmativa 1')).toHaveValue('1')
  }

  await navigation.click()
  await navigation.click()
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Curso responsivo de teste')
  expect(platform.calls.filter(call => ['POST', 'PATCH', 'DELETE'].includes(call.method))).toHaveLength(writesBefore)
})

test('adicionar/remover configurações por teclado e erros não apagam os dados', async ({ page, platform }, testInfo) => {
  await preencherCursoComQuatroQuestoes(page)
  const addPair = page.getByRole('button', { name: /Adicionar par/ })
  await addPair.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByPlaceholder('Esquerda')).toHaveCount(2)
  await page.getByRole('button', { name: 'Remover par' }).last().click()
  await expect(page.getByPlaceholder('Esquerda')).toHaveCount(1)

  const addAlternative = page.getByRole('button', { name: /Adicionar alternativa/ }).first()
  await addAlternative.click()
  await expect(page.getByPlaceholder('Alternativa 3')).toBeVisible()
  await page.getByRole('button', { name: 'Remover alternativa' }).last().click()
  await expect(page.getByPlaceholder('Alternativa 3')).toHaveCount(0)

  const addAnswer = page.getByRole('button', { name: /Adicionar resposta aceita/ })
  await addAnswer.click()
  await expect(page.getByPlaceholder('Resposta aceita 2')).toBeVisible()
  await page.getByRole('button', { name: 'Remover resposta' }).last().click()
  await expect(page.getByPlaceholder('Resposta aceita 2')).toHaveCount(0)

  const addStatement = page.getByRole('button', { name: /Adicionar afirmativa/ })
  const statementCount = await page.getByRole('spinbutton', { name: /Valor da afirmativa/ }).count()
  await addStatement.click()
  await expect(page.getByRole('spinbutton', { name: /Valor da afirmativa/ })).toHaveCount(statementCount + 1)
  await page.getByRole('button', { name: 'Remover afirmativa' }).last().click()
  await expect(page.getByRole('spinbutton', { name: /Valor da afirmativa/ })).toHaveCount(statementCount)

  await page.getByLabel('Título', { exact: true }).clear()
  await page.getByRole('button', { name: 'Publicar', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Informe o título do curso.')
  await expect(page.getByLabel('Título do módulo', { exact: true })).toHaveValue('Módulo de geometria')
  await expect(page.getByPlaceholder('Esquerda')).toHaveValue('Termo da esquerda')
  expect(platform.calls.some(call => call.method === 'POST' && call.path === 'courses')).toBe(false)

  const dependencyError = `Serviço temporariamente indisponível: ${'não foi possível concluir a gravação '.repeat(5)}`
  platform.on('courses', () => ({ status: 503, data: { message: dependencyError } }))
  await page.getByLabel('Título', { exact: true }).fill('Curso responsivo de teste')
  await page.setViewportSize({ width: 320, height: 844 })
  await page.getByRole('button', { name: 'Publicar', exact: true }).click()
  const alert = page.getByRole('alert')
  await expect(alert).toContainText(dependencyError)
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Curso responsivo de teste')
  await expect(page.getByPlaceholder('Esquerda')).toHaveValue('Termo da esquerda')
  const alertFits = await alert.evaluate(element => {
    const rect = element.getBoundingClientRect()
    return rect.left >= -1 && rect.right <= document.documentElement.clientWidth + 1
  })
  expect(alertFits).toBe(true)
  await page.screenshot({
    path: testInfo.outputPath('criar-curso-erro-dependencia-320.png'),
    fullPage: true,
    animations: 'disabled',
  })
})

test('publicar quatro tipos de questão preserva configurações no contrato HTTP', async ({ page, platform }) => {
  await preencherCursoComQuatroQuestoes(page)
  const publish = page.getByRole('button', { name: 'Publicar', exact: true })
  await publish.focus()
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL('/catalogo')
  expect(platform.calls.find(call => call.path === 'courses' && call.method === 'POST')?.body).toMatchObject({
    title: 'Curso responsivo de teste',
    slug: 'curso-responsivo-de-teste',
    status: 'published',
  })
  const questions = platform.calls.filter(call => call.path === 'questions' && call.method === 'POST')
  expect(questions.map(call => call.body)).toMatchObject([
    { type: 'multiple_choice', prompt: 'Escolha uma alternativa.', config: { options: [{ text: 'Resposta correta', correct: true }, { text: 'Resposta incorreta', correct: false }] } },
    { type: 'match', prompt: 'Enunciado match', config: { pairs: [{ left: 'Termo da esquerda', right: 'Termo da direita' }] } },
    { type: 'fill_blank', prompt: 'Enunciado fill_blank', config: { answers: ['Resposta aceita'] } },
    { type: 'sum_alternatives', prompt: 'Enunciado sum_alternatives', config: { statements: [{ value: 1, correct: false }, { value: 2, correct: false }, { value: 4, correct: true }] } },
  ])
})
