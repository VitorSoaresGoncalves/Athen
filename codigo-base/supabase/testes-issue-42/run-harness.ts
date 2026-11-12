// run-harness.ts — Executa o harness SQL da issue 42 contra um banco de ENSAIO.
//
// Usa a connection string de SUPABASE_DB_URL (NUNCA produção). Cada script
// roda em transacao e da ROLLBACK, sem persistir dados. Uma falha interrompe
// a sequencia e sai com codigo != 0; fechar a conexao reverte a transacao aberta.
//
// Uso:
//   SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres \
//     npx tsx supabase/testes-issue-42/run-harness.ts
//   (ou via o script npm: npm run test:issue42)
//
// Pre-requisitos no banco alvo: migracoes 0001-0041 aplicadas e seed base
// (supabase/seed.sql) carregado (fornece as contas/cursos usados).

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Client } from 'pg'

const here = dirname(fileURLToPath(import.meta.url))
const harnessPaths = ['harness.sql', 'live-standings.sql', 'missions.sql'].map(file => join(here, file))
const reviewPath = join(here, 'review-fixes.sql')

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL
  if (!connectionString) {
    console.error('SUPABASE_DB_URL nao definido. Aponte para um banco de ENSAIO (nunca producao).')
    process.exit(2)
  }

  // Trava de seguranca minima: recusa URLs que pareçam de producao.
  if (/rzrqunjtydvkvfqtjque/i.test(connectionString)) {
    console.error('Recusando rodar o harness contra o projeto de producao (Athen).')
    process.exit(2)
  }

  const scripts = harnessPaths.map(path => readFileSync(path, 'utf8'))
  const review = readFileSync(reviewPath, 'utf8')
  const client = new Client({ connectionString, connectionTimeoutMillis: 10_000, query_timeout: 60_000 })

  try {
    await client.connect()
    await client.query('set plpgsql.check_asserts = on')
    // O harness ja contem begin/rollback e os asserts; uma falha de assert
    // chega aqui como erro de query, abortando com exit != 0.
    for (const sql of scripts) await client.query(sql)
    // Este ensaio complementar não contém BEGIN/ROLLBACK próprios.
    // A transação pertence ao runner, inclusive em caso de asserção falhar.
    await client.query('begin')
    try {
      await client.query(review)
    } finally {
      await client.query('rollback')
    }
    // console.warn: a config de ESLint do projeto só permite warn/error.
    console.warn('HARNESS ISSUE 42: OK (todas as assercoes passaram; rollback aplicado)')
  } catch (err) {
    console.error('HARNESS ISSUE 42: FALHOU')
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

void main()
