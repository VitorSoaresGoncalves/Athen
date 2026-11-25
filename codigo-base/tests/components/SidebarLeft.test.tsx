import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { SidebarLeft } from '../../src/components/sidebar/SidebarLeft'
import userEvent from '@testing-library/user-event'

vi.mock('../../src/data/repositories', () => ({
  usuarioRepository: { obterAtual: vi.fn().mockResolvedValue(null) },
  notificacaoRepository: { contarNaoLidas: vi.fn().mockResolvedValue(0) },
}))
vi.mock('../../src/lib/supabase', () => ({
  supabase: { auth: { onAuthStateChange: vi.fn(), signOut: vi.fn().mockResolvedValue({}) } },
}))

let narrow = true
const listeners = new Set<(event: { matches: boolean }) => void>()
beforeEach(() => {
  narrow = true
  listeners.clear()
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches: narrow,
    addEventListener: (_: string, listener: (event: { matches: boolean }) => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: (event: { matches: boolean }) => void) => listeners.delete(listener),
  })))
})
function resize(matches: boolean) {
  act(() => {
    narrow = matches
    listeners.forEach(listener => listener({ matches }))
  })
}
function example() {
  return render(<MemoryRouter initialEntries={['/salas']}><SidebarLeft /><main><button>Conteúdo</button></main></MemoryRouter>)
}

it('começa recolhida e expõe navegação e conta somente após abrir', async () => {
  example()
  const toggle = screen.getByRole('button', { name: 'Abrir navegação' })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Abrir opções de conta' })).toBeVisible()
  toggle.focus()
  fireEvent.click(toggle)
  expect(toggle).toHaveAccessibleName('Recolher navegação')
  expect(toggle).toHaveFocus()
  expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible()
  expect(screen.getByRole('link', { name: 'Salas' })).toHaveAttribute('aria-current', 'page')
  expect(document.getElementById(toggle.getAttribute('aria-controls')!)).toBeVisible()
  await screen.findByText('Estudante')
})

it('percorre controles nativos sem trap e fecha primeiro conta, depois navegação', async () => {
  const user = userEvent.setup()
  example()
  const toggle = screen.getByRole('button', { name: 'Abrir navegação' })
  toggle.focus()
  await user.keyboard('{Enter}')
  await user.tab()
  expect(screen.getByRole('link', { name: 'Início' })).toHaveFocus()
  const account = screen.getByRole('button', { name: 'Abrir opções de conta' })
  account.focus()
  await user.keyboard(' ')
  expect(account).toHaveFocus()
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  await user.tab()
  expect(screen.getByRole('button', { name: 'Ver perfil' })).toHaveFocus()
  await user.keyboard('{Escape}')
  expect(account).toHaveFocus()
  expect(screen.queryByRole('group', { name: 'Opções de conta' })).not.toBeInTheDocument()
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await user.keyboard('{Escape}')
  expect(toggle).toHaveFocus()
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await user.tab()
  expect(screen.getByRole('button', { name: 'Conteúdo' })).toHaveFocus()
})

it('Escape e clique fora no main não recolhem navegação nem roubam foco', async () => {
  example()
  fireEvent.click(screen.getByRole('button', { name: 'Abrir navegação' }))
  fireEvent.click(screen.getByRole('button', { name: 'Abrir opções de conta' }))
  const main = screen.getByRole('button', { name: 'Conteúdo' })
  main.focus()
  fireEvent.mouseDown(main)
  fireEvent.keyDown(main, { key: 'Escape' })
  expect(main).toHaveFocus()
  expect(screen.getByRole('button', { name: 'Recolher navegação' })).toHaveAttribute('aria-expanded', 'true')
  expect(screen.queryByRole('group', { name: 'Opções de conta' })).not.toBeInTheDocument()
  await screen.findByText('Estudante')
})

it('limpa estado ao cruzar breakpoint e transfere apenas foco que seria ocultado', async () => {
  example()
  const toggle = screen.getByRole('button', { name: 'Abrir navegação' })
  toggle.focus()
  fireEvent.click(toggle)
  resize(false)
  expect(screen.queryByRole('button', { name: 'Abrir navegação' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Salas' })).toHaveFocus()
  resize(true)
  expect(screen.getByRole('button', { name: 'Abrir navegação' })).toHaveFocus()
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  const main = screen.getByRole('button', { name: 'Conteúdo' })
  main.focus()
  resize(false)
  resize(true)
  expect(main).toHaveFocus()
  await screen.findByText('Estudante')
})

it('ativar a rota já ativa recolhe o grupo e recupera foco', async () => {
  example()
  fireEvent.click(screen.getByRole('button', { name: 'Abrir navegação' }))
  const salas = screen.getByRole('link', { name: 'Salas' })
  salas.focus()
  fireEvent.click(salas)
  expect(screen.getByRole('button', { name: 'Abrir navegação' })).toHaveFocus()
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  await screen.findByText('Estudante')
})

it('remove o listener de media query na desmontagem', async () => {
  const view = example()
  await screen.findByText('Estudante')
  expect(listeners.size).toBe(1)
  view.unmount()
  expect(listeners.size).toBe(0)
})

it('ao limpar a conta no desktop recupera foco de opção que ficará oculta', async () => {
  example()
  fireEvent.click(screen.getByRole('button', { name: 'Abrir navegação' }))
  const account = screen.getByRole('button', { name: 'Abrir opções de conta' })
  fireEvent.click(account)
  screen.getByRole('button', { name: 'Ver perfil' }).focus()
  resize(false)
  expect(screen.getByRole('button', { name: 'Abrir opções de conta' })).toHaveFocus()
  expect(screen.queryByRole('group', { name: 'Opções de conta' })).not.toBeInTheDocument()
  await screen.findByText('Estudante')
})
