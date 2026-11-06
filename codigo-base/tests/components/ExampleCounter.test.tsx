import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ExampleCounter } from './ExampleCounter'

describe('ExampleCounter', () => {
  it('incrementa o valor quando o usuário clica no botão', async () => {
    const user = userEvent.setup()
    render(<ExampleCounter initialValue={1} />)

    await user.click(screen.getByRole('button', { name: 'Incrementar' }))

    expect(screen.getByRole('status')).toHaveTextContent('2')
  })
})