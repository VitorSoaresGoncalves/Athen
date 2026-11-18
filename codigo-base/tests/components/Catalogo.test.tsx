import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Database } from '../../src/types/database'
import { CursoModal } from '../../src/pages/Catalogo'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  listarPublicados: vi.fn(),
  listarPorCurso: vi.fn(),
  listarPorModulo: vi.fn(),
  obter: vi.fn(),
  obterMediaPorCurso: vi.fn(),
  salvar: vi.fn(),
  deletar: vi.fn(),
  listarPorContexto: vi.fn(),
  matricular: vi.fn(),
  atualizarStatus: vi.fn(),
  listarPorUsuario: vi.fn(),
  obterDisponibilidade: vi.fn(),
  obterOcorrenciaAtual: vi.fn(),
}))

vi.mock('../../src/lib/supabase', () => ({
  supabase: { auth: { getUser: mocks.getUser } },
}))

vi.mock('../../src/data/repositories', () => ({
  aulaRepository: { listarPorModulo: mocks.listarPorModulo },
  avaliacaoRepository: {
    obter: mocks.obter,
    obterMediaPorCurso: mocks.obterMediaPorCurso,
    salvar: mocks.salvar,
    deletar: mocks.deletar,
  },
  concluiRepository: { listarPorContexto: mocks.listarPorContexto },
  cursoRepository: { listarPublicados: mocks.listarPublicados },
  matriculaRepository: {
    obter: mocks.obter,
    matricular: mocks.matricular,
    atualizarStatus: mocks.atualizarStatus,
  },
  moduloRepository: { listarPorCurso: mocks.listarPorCurso },
  revisaoRepository: {
    obterDisponibilidade: mocks.obterDisponibilidade,
    obterOcorrenciaAtual: mocks.obterOcorrenciaAtual,
  },
  tentativaRepository: { listarPorUsuario: mocks.listarPorUsuario },
  usuarioRepository: { obterPorId: vi.fn() },
}))

vi.mock('../../src/components/layout/PageLayout', () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const curso: Database['public']['Tables']['courses']['Row'] = {
  id: 'course-1',
  title: 'Lógica de Programação',
  slug: 'logica-de-programacao',
  description: 'Curso de lógica',
  category: 'Tecnologia',
  creator_id: 'teacher-1',
  tags: ['algoritmos'],
  cover_url: null,
  created_at: '2026-01-01T00:00:00Z',
  duration_minutes: 90,
  published_at: '2026-01-01T00:00:00Z',
  status: 'published',
  updated_at: '2026-01-01T00:00:00Z',
  visibility: 'public',
}

const modulo = {
  id: 'mod-1',
  course_id: curso.id,
  title: 'Fundamentos',
  description: 'Módulo inicial',
  color: '#a855f7',
  order: 1,
  created_at: '2026-01-01T00:00:00Z',
}

const aula = {
  id: 'lesson-1',
  module_id: modulo.id,
  title: 'Introdução',
  description: 'Primeira aula',
  order: 1,
  created_at: '2026-01-01T00:00:00Z',
  duration_seconds: 60,
  video_url: null,
  text_content: null,
  lesson_type: 'video',
}

describe('CursoModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mocks.listarPorCurso.mockResolvedValue([modulo])
    mocks.listarPorModulo.mockResolvedValue([aula])
    mocks.listarPorContexto.mockResolvedValue([])
    mocks.obter.mockResolvedValue(null)
    mocks.obterMediaPorCurso.mockResolvedValue({ media: 4.5, total: 2 })
    mocks.listarPorUsuario.mockResolvedValue([])
    mocks.obterDisponibilidade.mockResolvedValue({ can_review: true, reason: null, course_id: curso.id })
    mocks.obterOcorrenciaAtual.mockResolvedValue(null)
  })

  it('mostra as ações do aluno matriculado imediatamente, sem esperar a consulta assíncrona de matrícula', async () => {
    const pending = new Promise(() => undefined)
    mocks.obter.mockImplementationOnce(() => pending)

    render(
      <MemoryRouter>
        <CursoModal
          curso={curso}
          educador="Prof. Ada"
          nota={4.5}
          avaliacoes={2}
          onFechar={vi.fn()}
          onAtualizar={vi.fn()}
          statusMatriculaInicial="active"
        />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: 'Fechar' })).toBeVisible()
    expect(screen.getByRole('button', { name: /Continuar curso/i })).toBeVisible()
    expect(screen.getByRole('button', { name: /Revisar curso/i })).toBeVisible()
  })
})
