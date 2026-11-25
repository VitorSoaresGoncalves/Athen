import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { CursoNotebook } from '../../src/components/notebook/CursoNotebook'
import type { Database } from '../../src/types/database'

const api = vi.hoisted(() => ({
  listar: vi.fn(), pages: vi.fn(), save: vi.fn(), create: vi.fn(),
}))
vi.mock('../../src/data/repositories', () => ({
  notebookRepository: { listarPorUsuario: api.listar },
  anotacoesRepository: { listarPorNotebook: api.pages, atualizar: api.save, criar: api.create },
}))
vi.mock('../../src/lib/supabase', () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: { id: 'u' } }, error: null }) } },
}))
const course: Database['public']['Tables']['courses']['Row'] = {
  id: 'c', title: 'Curso', slug: 'curso', category: null, cover_url: null, created_at: '',
  creator_id: 'u', description: null, duration_minutes: 0, published_at: null,
  status: 'published', tags: [], updated_at: '', visibility: 'public',
}
const page = { id: 'p', notebook_id: 'n', title: 'Primeira', content: 'Salvo', position: 0 }
beforeEach(() => {
  vi.clearAllMocks()
  api.listar.mockResolvedValue([{ id: 'n', title: 'Curso' }, { id: 'other', title: 'Outro' }])
  api.pages.mockResolvedValue([page, { ...page, id: 'p2', title: 'Segunda' }])
  api.save.mockRejectedValue(new Error('Save negado'))
  vi.stubGlobal('innerWidth', 1440)
  vi.stubGlobal('innerHeight', 900)
  vi.stubGlobal('visualViewport', undefined)
})
async function open() {
  const view = render(<CursoNotebook course={course} />)
  const trigger = await screen.findByRole('button', { name: 'Abrir notebook' })
  await userEvent.click(trigger)
  return { ...view, trigger }
}

it('mantém editor, rascunho e foco no resize, limita janela e recupera por clique', async () => {
  await open()
  const editor = screen.getByRole('textbox', { name: 'Anotações' })
  fireEvent.change(editor, { target: { value: 'Rascunho preservado' } })
  editor.focus()
  act(() => {
    vi.stubGlobal('innerWidth', 320)
    vi.stubGlobal('innerHeight', 201)
    window.dispatchEvent(new Event('resize'))
  })
  expect(screen.getByRole('textbox', { name: 'Anotações' })).toBe(editor)
  expect(editor).toHaveValue('Rascunho preservado')
  expect(editor).toHaveFocus()
  expect(screen.getByRole('dialog')).toHaveStyle({ left: '8px', top: '8px', width: '304px', height: '185px' })
  await userEvent.click(screen.getByRole('button', { name: 'Ajustar à tela' }))
  expect(api.save).not.toHaveBeenCalled()
  expect(api.pages).toHaveBeenCalledTimes(1)
})

it('falha de salvar não cria página nem troca notebook e cancelar conserva edição', async () => {
  await open()
  const editor = screen.getByRole('textbox', { name: 'Anotações' })
  fireEvent.change(editor, { target: { value: 'Não perder' } })
  await userEvent.click(screen.getByRole('button', { name: 'Criar nova página' }))
  await userEvent.click(within(screen.getByRole('dialog', { name: 'Alterações não salvas' })).getByRole('button', { name: 'Salvar' }))
  await screen.findByRole('alert')
  expect(editor).toHaveValue('Não perder')
  expect(api.create).not.toHaveBeenCalled()
  fireEvent.change(screen.getByRole('combobox', { name: 'Selecionar notebook' }), { target: { value: 'other' } })
  await userEvent.click(within(screen.getByRole('dialog', { name: 'Alterações não salvas' })).getByRole('button', { name: 'Salvar' }))
  await waitFor(() => expect(api.save).toHaveBeenCalledTimes(2))
  expect(api.pages).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('combobox')).toHaveValue('n')
  await userEvent.click(screen.getByRole('button', { name: 'Fechar notebook' }))
  await userEvent.keyboard('{Escape}')
  expect(screen.getByRole('dialog', { name: 'Notebook do curso' })).toBeInTheDocument()
  expect(editor).toHaveValue('Não perder')
})

it('aplica geometria numérica, recusa vazio e fecha sem trap devolvendo foco', async () => {
  const { trigger } = await open()
  expect(screen.getByRole('button', { name: 'Fechar notebook' })).toHaveFocus()
  await userEvent.click(screen.getByRole('button', { name: 'Ajustar janela' }))
  fireEvent.change(screen.getByLabelText('Largura'), { target: { value: '' } })
  fireEvent.submit(screen.getByRole('button', { name: 'Aplicar' }).closest('form')!)
  expect(screen.getByRole('alert')).toHaveTextContent('válidas')
  fireEvent.change(screen.getByLabelText('Largura'), { target: { value: '300' } })
  fireEvent.submit(screen.getByRole('button', { name: 'Aplicar' }).closest('form')!)
  expect(screen.getByRole('dialog')).toHaveStyle({ width: '300px' })
  await userEvent.click(screen.getByRole('button', { name: 'Fechar notebook' }))
  expect(trigger).toHaveFocus()
})

it('usa offsets da visual viewport e remove listeners ao fechar', async () => {
  const viewport = Object.assign(new EventTarget(), { width: 390, height: 844, offsetLeft: 20, offsetTop: 30 })
  const remove = vi.spyOn(viewport, 'removeEventListener')
  vi.stubGlobal('visualViewport', viewport)
  const { unmount } = await open()
  const editor = screen.getByRole('textbox', { name: 'Anotações' })
  editor.focus()
  act(() => {
    Object.assign(viewport, { width: 320, height: 201, offsetLeft: 40, offsetTop: 60 })
    viewport.dispatchEvent(new Event('resize'))
    viewport.dispatchEvent(new Event('scroll'))
  })
  expect(screen.getByRole('dialog')).toHaveStyle({ left: '48px', top: '68px', width: '304px', height: '185px' })
  expect(editor).toHaveFocus()
  unmount()
  expect(remove).toHaveBeenCalledWith('resize', expect.any(Function))
  expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function))
})

it('Escape cancela primeiro título e depois protege o texto não salvo', async () => {
  await open()
  const title = screen.getByRole('textbox', { name: 'Título da página' })
  fireEvent.change(title, { target: { value: 'Rascunho do título' } })
  fireEvent.change(screen.getByRole('textbox', { name: 'Anotações' }), { target: { value: 'Rascunho do texto' } })
  title.focus()
  await userEvent.keyboard('{Escape}')
  expect(title).toHaveValue('Primeira')
  expect(title).toHaveFocus()
  await userEvent.keyboard('{Escape}')
  expect(screen.getByRole('dialog', { name: 'Alterações não salvas' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(screen.getByRole('textbox', { name: 'Anotações' })).toHaveValue('Rascunho do texto')
})

it('salvar e criar prossegue somente após sucesso, com conteúdo salvo preservado', async () => {
  api.save.mockResolvedValue({ ...page, content: 'Texto novo' })
  api.create.mockResolvedValue({ ...page, id: 'p3', title: 'Nova página', content: '' })
  await open()
  fireEvent.change(screen.getByRole('textbox', { name: 'Anotações' }), { target: { value: 'Texto novo' } })
  await userEvent.click(screen.getByRole('button', { name: 'Criar nova página' }))
  await userEvent.click(within(screen.getByRole('dialog', { name: 'Alterações não salvas' })).getByRole('button', { name: 'Salvar' }))
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Título da página' })).toHaveValue('Nova página'))
  await userEvent.click(screen.getByRole('button', { name: 'Primeira' }))
  expect(screen.getByRole('textbox', { name: 'Anotações' })).toHaveValue('Texto novo')
})

it('é não modal: Tab pode sair para o conteúdo e Escape fora não fecha', async () => {
  const user = userEvent.setup()
  render(<><CursoNotebook course={course} /><button>Fora do notebook</button></>)
  await user.click(await screen.findByRole('button', { name: 'Abrir notebook' }))
  expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'false')
  screen.getByRole('button', { name: 'Salvar' }).focus()
  await user.tab()
  expect(screen.getByRole('button', { name: 'Fora do notebook' })).toHaveFocus()
  await user.keyboard('{Escape}')
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(document.body.style.overflow).not.toBe('hidden')
})

it('erro de leitura não vira página vazia e mantém a janela fechável', async () => {
  api.pages.mockRejectedValue(new Error('Leitura indisponível'))
  const { trigger } = await open()
  expect(screen.getByRole('alert')).toHaveTextContent('Leitura indisponível')
  expect(screen.queryByText('Nenhuma página ainda')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Fechar notebook' }))
  expect(trigger).toHaveFocus()
})
