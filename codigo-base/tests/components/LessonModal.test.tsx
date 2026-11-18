import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LessonModal } from '../../src/components/lesson/LessonModal'

const mocks = vi.hoisted(() => ({
  availability: vi.fn(),
  occurrence: vi.fn(),
  start: vi.fn(),
  getSession: vi.fn(),
  saveAnswer: vi.fn(),
  finalize: vi.fn(),
  lessonQuestions: vi.fn(),
  startAttempt: vi.fn(),
  saveLessonAnswer: vi.fn(),
  finalizeAttempt: vi.fn(),
  completeEmptyLesson: vi.fn(),
  grade: vi.fn(),
}))

vi.mock('../../src/data/repositories', () => ({
  revisaoRepository: {
    obterDisponibilidade: mocks.availability,
    obterOcorrencia: mocks.occurrence,
    iniciar: mocks.start,
    obter: mocks.getSession,
    salvarResposta: mocks.saveAnswer,
    finalizar: mocks.finalize,
  },
  questaoRepository: { listarPorAula: mocks.lessonQuestions },
  tentativaRepository: { iniciar: mocks.startAttempt, finalizar: mocks.finalizeAttempt },
  respostaRepository: { salvar: mocks.saveLessonAnswer },
  dominioRepository: {
    concluirAulaSemQuestoes: mocks.completeEmptyLesson,
    corrigirResposta: mocks.grade,
  },
}))
vi.mock('../../src/components/sidebar/SidebarLeft', () => ({
  PROFILE_UPDATED_EVENT: 'athen:profile-updated',
}))

const courseId = '22222222-2222-4222-8222-222222222222'
const occurrenceId = '77777777-7777-4777-8777-777777777777'
const requestId = '88888888-8888-4888-8888-888888888888'
const sessionId = '99999999-9999-4999-8999-999999999999'
const questionId = '55555555-5555-4555-8555-555555555555'
const timestamp = '2026-11-20T12:00:00.000Z'

const availability = {
  course_id: courseId,
  course_title: 'Lógica de Programação',
  can_review: true,
  reason: null,
  question_count: 4,
  sample_count: 2,
  module_counts: [
    { module_id: '33333333-3333-4333-8333-333333333333', question_count: 4, sample_count: 1 },
    { module_id: '44444444-4444-4444-8444-444444444444', question_count: 10, sample_count: 2 },
  ],
}

const item = {
  question_id: questionId,
  ordinal: 1,
  module_id: '33333333-3333-4333-8333-333333333333',
  module_title: 'Fundamentos',
  lesson_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  type: 'multiple_choice' as const,
  prompt: 'Quanto é 1 + 1?',
  config: { options: [
    { id: 'a', text: 'Dois', correct: true },
    { id: 'b', text: 'Três', correct: false },
  ] },
  explanation: null,
  submitted: null,
  is_correct: null,
}

const normalSession = {
  session_id: sessionId,
  course_id: courseId,
  course_title: 'Lógica de Programação',
  mode: 'normal' as const,
  occurrence_id: null,
  expires_at: null,
  bonus_xp: 0,
  finished_at: null,
  result: null,
  items: [item],
}

const occurrence = {
  occurrence_id: occurrenceId,
  period_index: 1,
  course_id: courseId,
  course_title: 'Lógica de Programação',
  state: 'available' as const,
  due_at: '2026-11-19T12:00:00.000Z',
  expires_at: '2026-11-27T12:00:00.000Z',
  bonus_xp: 10,
  delivery_state: 'suppressed' as const,
  resume_session_id: null,
  last_finished_session_id: null,
  reward_session_id: null,
  rewarded_at: null,
}

const bonusSession = (id = sessionId) => ({
  ...normalSession,
  session_id: id,
  mode: 'bonus' as const,
  occurrence_id: occurrenceId,
  expires_at: occurrence.expires_at,
  bonus_xp: 10,
})

const props = {
  modo: 'revisao' as const,
  cursoId: courseId,
  cor: '#06b6d4',
  onFechar: vi.fn(),
  onPedido: vi.fn(),
  onSessao: vi.fn(),
  onFinalizada: vi.fn(),
}

describe('LessonModal em revisão de curso', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.availability.mockResolvedValue(availability)
    mocks.occurrence.mockResolvedValue(occurrence)
    mocks.start.mockResolvedValue(normalSession)
    mocks.getSession.mockResolvedValue(normalSession)
    mocks.saveAnswer.mockResolvedValue({
      question_id: questionId, is_correct: true, answered_count: 1, total_count: 1,
    })
    mocks.finalize.mockResolvedValue({
      session_id: sessionId,
      correct_count: 1,
      total_count: 1,
      approved: true,
      bonus_earned: 0,
      bonus_outcome: 'not_applicable',
      xp_event_id: null,
      finished_at: timestamp,
    })
  })

  it('mostra a introdução sem iniciar uma sessão antes da ação explícita', async () => {
    render(<LessonModal {...props} />)
    expect(await screen.findByText('2 questões · 20% por módulo, arredondado para cima.')).toBeVisible()
    expect(screen.getByText('Sem bônus de revisão')).toBeVisible()
    expect(screen.getByText('Módulo 1: 1 de 4 questões')).toBeVisible()
    expect(screen.getByText('Módulo 2: 2 de 10 questões')).toBeVisible()
    expect(mocks.start).not.toHaveBeenCalled()
    expect(mocks.startAttempt).not.toHaveBeenCalled()
    expect(mocks.finalizeAttempt).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Começar revisão' })).toBeEnabled()
  })

  it('registra uma intenção UUID para prática normal sem usar RPCs de aula nem XP', async () => {
    render(<LessonModal {...props} />)
    await screen.findByText('Sem bônus de revisão')
    fireEvent.click(screen.getByRole('button', { name: 'Começar revisão' }))
    await waitFor(() => expect(props.onPedido).toHaveBeenCalledTimes(1))
    expect(props.onPedido.mock.calls[0][0]).toMatch(/^[0-9a-f-]{36}$/i)
    expect(mocks.start).not.toHaveBeenCalled()
    expect(mocks.startAttempt).not.toHaveBeenCalled()
    expect(mocks.saveLessonAnswer).not.toHaveBeenCalled()
    expect(mocks.finalizeAttempt).not.toHaveBeenCalled()
  })

  it('usa a resposta e o resultado oficial e separa revisão de conclusão de aula', async () => {
    mocks.start.mockResolvedValue(bonusSession())
    mocks.finalize.mockResolvedValue({
      session_id: sessionId,
      correct_count: 1,
      total_count: 1,
      approved: true,
      bonus_earned: 10,
      bonus_outcome: 'awarded',
      xp_event_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      finished_at: timestamp,
    })
    render(<LessonModal {...props} ocorrenciaId={occurrenceId} pedidoId={requestId} />)

    await screen.findByRole('heading', { name: 'Quanto é 1 + 1?' })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Dois' }))
    fireEvent.click(screen.getByRole('button', { name: 'Verificar' }))
    await screen.findByText('Correto!')
    expect(mocks.saveAnswer).toHaveBeenCalledWith(sessionId, questionId, { selected: ['a'] })
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar revisão' }))
    expect(await screen.findByText('Bônus de revisão recebido!')).toBeVisible()
    expect(screen.getByText('+10')).toBeVisible()
    expect(screen.queryByText('Aula concluída!')).not.toBeInTheDocument()
    expect(props.onFinalizada).toHaveBeenCalled()
    expect(mocks.finalizeAttempt).not.toHaveBeenCalled()
  })

  it('preserva a reprovação e permite uma nova intenção explícita para refazer', async () => {
    const result = {
      session_id: sessionId,
      correct_count: 0,
      total_count: 1,
      approved: false,
      bonus_earned: 0,
      bonus_outcome: 'below_target',
      xp_event_id: null,
      finished_at: timestamp,
    }
    mocks.getSession.mockResolvedValueOnce({
      ...bonusSession(),
      finished_at: timestamp,
      result,
      items: [{ ...item, submitted: { selected: ['b'] }, is_correct: false }],
    })
    render(<LessonModal {...props} ocorrenciaId={occurrenceId} sessaoId={sessionId} />)

    await screen.findByText('Meta não atingida. Antes do prazo, você pode tentar novamente com outra amostra.')
    expect(await screen.findByText('Meta não atingida. Antes do prazo, você pode tentar novamente com outra amostra.')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await waitFor(() => expect(props.onPedido).toHaveBeenCalledTimes(1))
    expect(props.onPedido.mock.calls[0][0]).toMatch(/^[0-9a-f-]{36}$/i)
    expect(mocks.finalize).not.toHaveBeenCalled()
    expect(screen.getByText('0/1')).toBeVisible()
  })

  it('expõe erro de dependência com retry e nunca transforma falha em curso vazio', async () => {
    mocks.availability.mockRejectedValueOnce(new Error('Não foi possível consultar a revisão.'))
    render(<LessonModal {...props} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível consultar a revisão.')
    expect(screen.getByRole('button', { name: 'Tentar carregar novamente' })).toBeVisible()
    expect(screen.queryByText('Este curso não tem questões para revisão')).not.toBeInTheDocument()
    expect(mocks.start).not.toHaveBeenCalled()
  })

  it('recusa retomar uma sessão de outro curso sem iniciar uma prática normal como fallback', async () => {
    mocks.getSession.mockResolvedValueOnce({ ...normalSession, course_id: occurrenceId })
    render(<LessonModal {...props} sessaoId={sessionId} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('A sessão não corresponde ao curso e ao modo de revisão solicitados.')
    expect(mocks.start).not.toHaveBeenCalled()
    expect(mocks.availability).not.toHaveBeenCalled()
  })
})
