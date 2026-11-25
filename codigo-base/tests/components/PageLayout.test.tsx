import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { PageLayout } from '../../src/components/layout/PageLayout'

vi.mock('../../src/components/sidebar/SidebarLeft', () => ({
  SidebarLeft: () => <aside aria-label="Sidebar" />,
}))

it('preserva conteúdo, classes e estilo sem impor um offset inline', () => {
  const view = render(<PageLayout className="raiz" mainClassName="conteudo" mainStyle={{ background: 'red' }}
    overlay={<div role="dialog">Overlay</div>}><input aria-label="Campo" defaultValue="Preservado" /></PageLayout>)
  const main = screen.getByRole('main')
  expect(main).toHaveClass('page-layout__main', 'conteudo')
  expect(main.style.paddingLeft).toBe('')
  expect(main).toHaveStyle({ background: 'red' })
  expect(main.parentElement).toHaveClass('page-layout', 'raiz')
  expect(main).not.toContainElement(screen.getByRole('dialog'))
  expect(main.firstElementChild).toHaveClass('page-layout__container')
  view.rerender(<PageLayout variant="bare" offset={false}><input aria-label="Campo" defaultValue="Preservado" /></PageLayout>)
  expect(screen.getByRole('main').parentElement).toHaveClass('page-layout--no-offset')
  expect(screen.getByRole('main').firstElementChild).toBe(screen.getByRole('textbox'))
  expect(screen.getByRole('textbox')).toHaveValue('Preservado')
  expect(screen.getByRole('complementary', { name: 'Sidebar' })).toBeInTheDocument()
})
