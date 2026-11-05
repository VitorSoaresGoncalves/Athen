import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { expect, it } from 'vitest'
import { Modal } from '../../src/components/modal/Modal'

function Example() {
  const [open, setOpen] = useState(false)
  return <>
    <button onClick={() => setOpen(true)}>Abrir</button>
    {open && <Modal onFechar={() => setOpen(false)} ariaLabel="Exemplo">
      <button>Primeira ação</button><button>Última ação</button>
    </Modal>}
  </>
}

it('fecha ao clicar no fundo e devolve o foco ao gatilho', () => {
  const { container } = render(<Example />)
  const trigger = screen.getByRole('button', { name: 'Abrir' })
  trigger.focus()
  fireEvent.click(trigger)
  const backdrop = container.querySelector('.modal__fundo')!
  fireEvent.mouseDown(backdrop)
  fireEvent.mouseUp(backdrop)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
})

it('recebe foco ao abrir e mantém a navegação dentro do diálogo', () => {
  render(<Example />)
  fireEvent.click(screen.getByRole('button', { name: 'Abrir' }))
  const first = screen.getByRole('button', { name: 'Primeira ação' })
  const last = screen.getByRole('button', { name: 'Última ação' })
  expect(first).toHaveFocus()
  last.focus()
  fireEvent.keyDown(document, { key: 'Tab' })
  expect(first).toHaveFocus()
  first.focus()
  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
  expect(last).toHaveFocus()
})
