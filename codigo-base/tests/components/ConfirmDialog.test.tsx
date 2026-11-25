import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, it } from 'vitest'
import { ConfirmDialog } from '../../src/components/dialogbox/ConfirmDialog'

function Example() {
  const [open, setOpen] = useState(false)
  return <><button onClick={() => setOpen(true)}>Abrir confirmação</button>
    <ConfirmDialog open={open} title="Rascunho" tertiaryLabel="Descartar" onTertiary={() => setOpen(false)}
      onConfirm={() => setOpen(false)} onCancel={() => setOpen(false)} />
  </>
}
it('contém Tab, fecha com Escape e devolve foco sem acionar o ancestral', async () => {
  const user = userEvent.setup()
  render(<Example />)
  const trigger = screen.getByRole('button', { name: 'Abrir confirmação' })
  await user.click(trigger)
  expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
  screen.getByRole('button', { name: 'Confirmar' }).focus()
  await user.tab()
  expect(screen.getByRole('button', { name: 'Descartar' })).toHaveFocus()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
})
