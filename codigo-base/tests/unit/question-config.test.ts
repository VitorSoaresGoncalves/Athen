import { describe, expect, it } from 'vitest'
import { configVaziaPara, gerarSlug, somaEsperada, validarConfigQuestao, xpPadraoPara, type TipoQuestao } from '../../src/pages/criar-curso/questionConfig'

const validConfigs: Array<{ type: TipoQuestao; config: Parameters<typeof validarConfigQuestao>[1] }> = [
  { type: 'match', config: { pairs: [{ left: 'A', right: 'B' }] } },
  { type: 'multiple_choice', config: { options: [{ id: 'a', text: 'Sim', correct: true }, { id: 'b', text: 'Não', correct: false }] } },
  { type: 'fill_blank', config: { answers: ['Lógica'] } },
  { type: 'sum_alternatives', config: { statements: [{ value: 1, correct: true }] } },
]

describe('conteúdo criado pelo educador', () => {
  it.each([
    ['Introdução à Lógica!', 'introducao-a-logica'],
    ['  React / TypeScript  ', 'react-typescript'],
    ['---', ''],
  ])('gera um slug para %s', (input, expected) => {
    expect(gerarSlug(input)).toBe(expected)
  })

  it.each([
    ['match', 2], ['multiple_choice', 4], ['fill_blank', 6], ['sum_alternatives', 8],
  ] as const)('inicia %s com XP padrão e exige completar o conteúdo', (type, xp) => {
    expect(xpPadraoPara(type)).toBe(xp)
    expect(validarConfigQuestao(type, configVaziaPara(type))).not.toBeNull()
  })

  it.each(validConfigs)('aceita uma configuração completa de $type', ({ type, config }) => {
    // Literais independentes dos modelos vazios do editor.
    expect(validarConfigQuestao(type, config)).toBeNull()
  })

  it('impede publicar alternativas sem resposta correta', () => {
    expect(validarConfigQuestao('multiple_choice', { options: [{ id: 'a', text: 'A', correct: false }, { id: 'b', text: 'B', correct: false }] })).toBe('Marque ao menos uma alternativa correta.')
  })
  it('soma apenas as afirmativas corretas no editor', () => {
    expect(somaEsperada({ statements: [{ value: 1, correct: true }, { value: 2, correct: false }, { value: 4, correct: true }] })).toBe(5)
  })
})
