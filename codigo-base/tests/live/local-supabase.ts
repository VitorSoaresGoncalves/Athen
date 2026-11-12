import { execFileSync } from 'node:child_process'

// Não aceita URL remota nem lê .env. As chaves são obtidas da pilha Docker local
// e mantidas em memória; nunca são impressas ou passadas pela linha de comando.
export function localSupabase() {
  let output: string
  try {
    output = process.platform === 'win32'
      ? execFileSync('cmd.exe', ['/d', '/s', '/c', 'npx.cmd supabase status -o json'], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
      : execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch {
    throw new Error('Supabase local indisponível. Inicie o Docker e execute npx supabase start em codigo-base antes de test:e2e:live.')
  }
  const status: Record<string, string> = JSON.parse(output.slice(output.indexOf('{')))
  const url = status.API_URL
  const anonKey = status.ANON_KEY
  if (!url || !anonKey || !['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) {
    throw new Error('A jornada real exige API_URL de loopback e ANON_KEY da pilha Supabase local.')
  }
  return { url, anonKey }
}
