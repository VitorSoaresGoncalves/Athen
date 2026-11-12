import { describe, expect, it } from 'vitest'
import { prazoAbsoluto, prazoRelativo, rotuloContexto } from '../../src/pages/missoes-labels'

describe('informações das missões', () => {
  it('distingue missões de curso das globais', () => {
    expect(rotuloContexto('course_daily', 'Lógica')).toBe('Diária de curso · Lógica')
    expect(rotuloContexto('global_daily', null)).toBe('Diária global')
    expect(rotuloContexto('global_weekly', null)).toBe('Semanal global')
  })
  it.each([
    ['2026-11-09T11:59:00Z', 'encerrada'],
    ['2026-11-09T12:00:00Z', 'encerrada'],
    ['2026-11-09T12:00:30Z', 'em 1 min'],
    ['2026-11-09T12:59:00Z', 'em 59 min'],
    ['2026-11-09T13:00:00Z', 'em 1h'],
    ['2026-11-10T12:00:00Z', 'em 1d'],
    ['inválida', ''],
  ])('apresenta o prazo %s como %s', (end, expected) => {
    expect(prazoRelativo(end, new Date('2026-11-09T12:00:00Z'))).toBe(expected)
  })
  it('expõe a data e hora em Brasília independentemente do fuso da máquina', () => {
    expect(prazoAbsoluto('2026-11-10T03:00:00Z')).toMatch(/10\/11\/2026.*00:00.*\(BRT\)/)
    expect(prazoAbsoluto('inválida')).toBe('')
  })
})
