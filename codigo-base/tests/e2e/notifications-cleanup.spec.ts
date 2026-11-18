import { test, expect, ids } from './support/platform'

const reviewNotice = {
  id: 'review-notice', recipient_id: ids.user, type: 'revisao_curso',
  title: 'Revisão de curso disponível', message: 'Lógica · +10 XP',
  is_read: false, reference_id: ids.reviewOccurrence, created_at: '2026-11-01T12:00:00Z',
}

test('remove aviso de revisão sem abrir ou consumir a revisão e persiste após reload', async ({ page, platform }) => {
  platform.tables.notifications.push({ ...reviewNotice })
  await page.goto('/notificacoes')
  await page.getByRole('button', { name: 'Remover notificação: Revisão de curso disponível', exact: true }).click()
  await expect(page.getByText('Você ainda não tem notificações.', { exact: true })).toBeVisible()
  expect(platform.calls.some(call => call.method === 'DELETE' && call.path === 'notifications' && call.query.get('id') === 'eq.review-notice')).toBe(true)
  expect(platform.calls.some(call => call.path === 'my_course_review_occurrence' || call.path === 'start_course_review')).toBe(false)
  await expect(page).toHaveURL('/notificacoes')
  await page.reload()
  await expect(page.getByText('Você ainda não tem notificações.', { exact: true })).toBeVisible()
})

test('limpa lidas incluindo revisão e mantém aviso novo que chegou depois', async ({ page, platform }) => {
  platform.tables.notifications.push({ ...reviewNotice }, { ...reviewNotice, id: 'notice-other', type: 'atualizacao_curso', title: 'Nova aula', is_read: true })
  await page.goto('/notificacoes')
  const clear = page.getByRole('button', { name: 'Limpar lidas', exact: true })
  await expect(clear).toBeEnabled()
  platform.tables.notifications.push({ ...reviewNotice, id: 'arrived-later', is_read: false })
  await clear.click()
  await expect(page.getByRole('button', { name: 'Remover notificação: Revisão de curso disponível', exact: true })).toHaveCount(0)
  expect(platform.tables.notifications.map(row => row.id)).toEqual(['arrived-later'])
  expect(platform.calls.some(call => call.method === 'DELETE' && call.path === 'notifications' && call.query.get('is_read') === 'eq.true')).toBe(true)
})

test('falha ao remover é anunciada sem esconder a caixa', async ({ page, platform }) => {
  platform.tables.notifications.push({ ...reviewNotice, is_read: true })
  platform.on('notifications', call => call.method === 'DELETE'
    ? { status: 500, data: { message: 'Falha temporária' } }
    : { data: platform.tables.notifications })
  await page.goto('/notificacoes')
  await page.getByRole('button', { name: 'Remover notificação: Revisão de curso disponível', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Falha temporária')
  await expect(page.getByRole('button', { name: 'Remover notificação: Revisão de curso disponível', exact: true })).toBeEnabled()
  expect(platform.tables.notifications).toHaveLength(1)
})

test('falha ao limpar lidas conserva os avisos e permite tentar novamente', async ({ page, platform }) => {
  platform.tables.notifications.push({ ...reviewNotice, is_read: true })
  let fail = true
  platform.on('notifications', call => {
    if (call.method !== 'DELETE') return { data: platform.tables.notifications }
    if (fail) return { status: 500, data: { message: 'Falha ao limpar' } }
    const removed = platform.tables.notifications.filter(row => row.is_read)
    platform.tables.notifications = platform.tables.notifications.filter(row => !row.is_read)
    return { data: removed.map(row => ({ id: row.id })) }
  })
  await page.goto('/notificacoes')
  await page.getByRole('button', { name: 'Limpar lidas', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Falha ao limpar')
  await expect(page.getByRole('button', { name: 'Remover notificação: Revisão de curso disponível', exact: true })).toBeVisible()
  fail = false
  await page.getByRole('button', { name: 'Limpar lidas', exact: true }).click()
  await expect(page.getByText('Você ainda não tem notificações.', { exact: true })).toBeVisible()
})
