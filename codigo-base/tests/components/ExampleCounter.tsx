import { useState } from 'react'

type ExampleCounterProps = {
  initialValue?: number
}

export function ExampleCounter({ initialValue = 0 }: ExampleCounterProps) {
  const [value, setValue] = useState(initialValue)

  return (
    <section aria-label="Contador de exemplo">
      <output aria-label="Valor atual" role="status">{value}</output>
      <button type="button" onClick={() => setValue((current) => current + 1)}>
        Incrementar
      </button>
    </section>
  )
}