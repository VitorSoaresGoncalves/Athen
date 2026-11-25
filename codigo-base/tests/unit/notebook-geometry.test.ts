import { expect, it } from 'vitest'
import { clampNotebookRect } from '../../src/components/notebook/notebook-geometry'

it('limita dimensão antes de posição, inclusive viewport de zoom e offsets visuais', () => {
  expect(clampNotebookRect({ x: 500, y: 400, width: 440, height: 420 }, { left: 0, top: 0, width: 320, height: 201 }))
    .toEqual({ x: 8, y: 8, width: 304, height: 185 })
  expect(clampNotebookRect({ x: -50, y: -50, width: 10, height: 10 }, { left: 30, top: 50, width: 500, height: 600 }))
    .toEqual({ x: 38, y: 58, width: 240, height: 200 })
})

it('conserva o retângulo que já cabe e não restaura dimensões ao crescer', () => {
  expect(clampNotebookRect({ x: 80, y: 90, width: 304, height: 200 }, { left: 0, top: 0, width: 1440, height: 900 }))
    .toEqual({ x: 80, y: 90, width: 304, height: 200 })
})
