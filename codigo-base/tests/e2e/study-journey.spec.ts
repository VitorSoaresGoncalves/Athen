import { test, expect, ids, installPlatform } from './support/platform'

test('jornada do estudante: entrar, escolher curso, estudar, acompanhar missão e sair', async ({ page }) => {
  const platform = await installPlatform(page, false)
  const mission = {
    occurrence_id: 'mission-study', definition_id: 'definition-study', scope: 'global_daily', objective: 'complete_lessons',
    code: 'study', title: 'Conclua sua primeira aula', description: 'Estude uma aula hoje.', course_id: null, course_title: null,
    target: 1, reward_xp: 2, period_start: '2026-11-09T03:00:00Z', period_end: '2030-11-10T03:00:00Z',
    progress: 0, current_count: 0, completed: false,
  }
  platform.on('my_missions', () => ({ data: [mission] }))
  platform.on('my_mission_detail', () => ({ data: [mission] }))
  platform.on('grade_answer', () => ({ data: [{ is_correct: true, xp: 4 }] }))
  platform.on('finalize_attempt', ({ body }) => {
    expect(body).toEqual({ p_attempt_id: 'attempts-0' })
    expect(platform.tables.answers).toEqual([expect.objectContaining({ attempt_id: 'attempts-0', question_id: ids.question, submitted: { selected: ['a'] } })])
    // Resposta pronta do serviço: o teste não reproduz o algoritmo de XP/missões.
    platform.tables.completions.push({ user_id: ids.user, lesson_id: ids.lesson, context: 'course' })
    platform.tables.enrollments[0].progress = 100
    Object.assign(mission, { completed: true, progress: 100, current_count: 1 })
    return { data: [{ attempt_id: 'attempts-0', xp_earned: 4, correct_count: 1, total_count: 1 }] }
  })

  await test.step('visitante entra pela página inicial', async () => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await page.getByLabel('E-mail', { exact: true }).fill('carla@example.test')
    await page.getByLabel('Senha', { exact: true }).fill('senha-123')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL('/dashboard')
  })
  await test.step('escolhe um curso e se matricula', async () => {
    await page.getByRole('link', { name: 'Ver todos os cursos', exact: true }).click()
    await page.getByRole('button', { name: /Lógica de Programação/ }).click()
    await page.getByRole('button', { name: 'Matricular-se', exact: true }).click()
    await expect(page).toHaveURL(`/dashboard?curso=${ids.course}`)
    expect(platform.calls.find(call => call.path === 'enrollments' && call.method === 'POST')?.body).toEqual({ course_id: ids.course, user_id: ids.user })
  })
  await test.step('responde e finaliza uma aula', async () => {
    await page.getByRole('button', { name: 'Aula Primeira aula', exact: true }).click()
    await page.getByRole('button', { name: 'Começar atividade', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Verificar', exact: true })).toBeDisabled()
    await page.getByRole('checkbox', { name: 'Dois', exact: true }).click()
    await page.getByRole('button', { name: 'Verificar', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Correto! +4 XP')
    await page.getByRole('button', { name: 'Finalizar aula', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Aula concluída!', exact: true })).toBeVisible()
    await expect(page.getByText('+4', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Voltar à trilha', exact: true }).click()
    await expect(page.getByLabel('Progresso do módulo: 100%')).toBeVisible()
    await page.reload()
    await expect(page.getByLabel('Progresso do módulo: 100%')).toBeVisible()
  })
  await test.step('consulta a missão concluída e seu detalhe', async () => {
    await page.getByRole('link', { name: 'Missões', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Concluídas', exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Abrir detalhe da missão Conclua sua primeira aula' }).click()
    await expect(page).toHaveURL('/missoes/mission-study')
    await expect(page.getByText('Concluída', { exact: true })).toBeVisible()
    await expect(page.getByText('1/1', { exact: true })).toBeVisible()
  })
  await test.step('encerra a sessão e não consegue voltar à área privada', async () => {
    await page.getByRole('button', { name: 'Abrir opções de conta', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Sair da conta' }).click()
    // A proteção da rota também pode levar à Home ao receber SIGNED_OUT.
    await expect(page).toHaveURL(/\/(?:login-page)?$/)
    await expect.poll(() => page.evaluate(() => localStorage.getItem('sb-example-auth-token'))).toBeNull()
    await page.goto('/dashboard')
    await expect(page).toHaveURL('/')
    expect(platform.calls.some(call => call.path === 'logout')).toBe(true)
  })
  expect(platform.unexpected).toEqual([])
})
