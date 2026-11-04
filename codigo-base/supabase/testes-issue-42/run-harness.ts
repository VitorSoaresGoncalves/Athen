// run-harness.ts — Executa o harness SQL da issue 42 contra um banco de ENSAIO.
//
// Usa a connection string de SUPABASE_DB_URL (NUNCA produção). Aplica o harness
// numa unica execucao; o proprio harness roda em transacao e da ROLLBACK, entao
// nao persiste dados. Sai com codigo != 0 se qualquer assercao falhar.
//
// Uso:
//   SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres \
//     npx tsx supabase/testes-issue-42/run-harness.ts
//   (ou via o script npm: npm run test:issue42)
//
// Pre-requisitos no banco alvo: migracoes 0001-0037 aplicadas e seed base
// (supabase/seed.sql) carregado (fornece as contas/cursos usados).

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Client } from 'pg'

const here = dirname(fileURLToPath(import.meta.url))
const harnessPath = join(here, 'harness.sql')

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

  const sql = readFileSync(harnessPath, 'utf8')
  const client = new Client({ connectionString })

  try {
    await client.connect()
    // O harness ja contem begin/rollback e os asserts; uma falha de assert
    // chega aqui como erro de query, abortando com exit != 0.
    await client.query(sql)
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
