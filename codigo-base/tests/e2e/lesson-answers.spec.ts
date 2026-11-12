import { test, expect, ids } from './support/platform'

const cases = [
  { type: 'multiple_choice', config: { options: [{ id: 'a', text: 'Dois', correct: true }, { id: 'b', text: 'Três', correct: false }] }, submitted: { selected: ['a'] } },
  { type: 'fill_blank', config: { answers: ['Lógica'] }, submitted: { text: 'Lógica' } },
  { type: 'sum_alternatives', config: { statements: [{ value: 1, text: 'Primeira', correct: true }, { value: 2, text: 'Segunda', correct: false }, { value: 4, text: 'Terceira', correct: true }] }, submitted: { sum: 5 } },
  { type: 'match', config: { pairs: [{ left: 'Brasil', right: 'Brasília' }, { left: 'França', right: 'Paris' }] }, submitted: { pairs: [{ left: 'Brasil', right: 'Brasília' }, { left: 'França', right: 'Paris' }] } },
]

for (const scenario of cases) {
  test(`aula envia resposta de ${scenario.type} no contrato esperado e usa o resultado oficial`, async ({ page, platform }) => {
    platform.tables.enrollments.push({ id: 'enrollment', user_id: ids.user, course_id: ids.course, status: 'active', progress: 0 })
    Object.assign(platform.tables.questions[0], { type: scenario.type, config: scenario.config })
    // Feedback imediato indisponível não pode impedir finalizar a tentativa.
    platform.on('grade_answer', () => ({ status: 400, data: { message: 'Feedback indisponível' } }))
    platform.on('finalize_attempt', () => ({ data: [{ xp_earned: 2, correct_count: 1, total_count: 1 }] }))
    await page.goto(`/dashboard?curso=${ids.course}`)
    await page.getByRole('button', { name: 'Aula Primeira aula', exact: true }).click()
    await page.getByRole('button', { name: 'Começar atividade', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Verificar', exact: true })).toBeDisabled()
    switch (scenario.type) {
      case 'multiple_choice': await page.getByRole('checkbox', { name: 'Dois', exact: true }).click(); break
      case 'fill_blank': await page.getByPlaceholder('Digite sua resposta', { exact: true }).fill('Lógica'); break
      case 'sum_alternatives':
        await page.getByRole('checkbox', { name: /Primeira/ }).click()
        await page.getByRole('checkbox', { name: /Terceira/ }).click()
        break
      case 'match':
        await page.getByRole('combobox', { name: /^Brasil/ }).selectOption('Brasília')
        await page.getByRole('combobox', { name: /^França/ }).selectOption('Paris')
        break
    }
    await page.getByRole('button', { name: 'Verificar', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Resposta salva.')
    expect(platform.calls.find(call => call.path === 'answers' && call.method === 'POST')?.body).toMatchObject({ attempt_id: 'attempts-0', question_id: ids.question, submitted: scenario.submitted })
    await page.getByRole('button', { name: 'Finalizar aula', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Aula concluída!', exact: true })).toBeVisible()
    await expect(page.getByText('+2', { exact: true })).toBeVisible()
    expect(platform.calls.find(call => call.path === 'finalize_attempt')?.body).toEqual({ p_attempt_id: 'attempts-0' })
  })
}

test('erro ao salvar resposta permite repetir sem iniciar outra tentativa', async ({ page, platform }) => {
  platform.tables.enrollments.push({ id: 'enrollment', user_id: ids.user, course_id: ids.course, status: 'active', progress: 0 })
  let failed = false
  platform.on('answers', ({ body }) => {
    if (!failed) { failed = true; return { status: 400, data: { message: 'Resposta não salva' } } }
    return { data: { id: 'answer', ...body } }
  })
  platform.on('grade_answer', () => ({ data: [{ is_correct: true, xp: 4 }] }))
  await page.goto(`/dashboard?curso=${ids.course}`)
  await page.getByRole('button', { name: 'Aula Primeira aula', exact: true }).click()
  await page.getByRole('button', { name: 'Começar atividade', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Dois', exact: true }).click()
  await page.getByRole('button', { name: 'Verificar', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Resposta não salva')
  await expect(page.getByRole('button', { name: 'Finalizar aula', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Verificar', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Correto!')
  expect(platform.calls.filter(call => call.path === 'attempts' && call.method === 'POST')).toHaveLength(1)
})
