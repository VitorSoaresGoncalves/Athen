import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'

async function main() {
  const raw = process.env.SUPABASE_DB_URL
  if (!raw) throw new Error('SUPABASE_DB_URL não definido; use o banco local descartável.')
  const target = new URL(raw)
  if (!['postgres:', 'postgresql:'].includes(target.protocol)
    || target.hostname !== '127.0.0.1' || target.port !== '55322' || target.pathname !== '/postgres'
    || target.search !== '' || target.hash !== '') {
    throw new Error('Alvo recusado: esperado somente 127.0.0.1:55322/postgres de ensaio.')
  }
  const client = new Client({
    host: '127.0.0.1', port: 55322, database: 'postgres',
    user: decodeURIComponent(target.username), password: decodeURIComponent(target.password),
    connectionTimeoutMillis: 5000, statement_timeout: 30000,
  })
  try {
    await client.connect()
    for (const path of ['../testes-issue-56/harness.sql', './catalogo.sql']) {
      await client.query(readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8'))
      console.warn(`PASS leituras: ${path}`)
    }
  } finally {
    await client.end()
  }
}

main().catch((error: unknown) => {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'sem código'
  // Não imprime mensagens de conexão, URLs ou credenciais.
  console.error(`Falha no harness de leituras (${code}).`)
  process.exitCode = 1
})
