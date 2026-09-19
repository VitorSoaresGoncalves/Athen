/* eslint-disable no-console */
import path from 'path'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'


const pastaDoScript = path.dirname(path.resolve(process.argv[1]))
config({ path: path.resolve(pastaDoScript, '../../.env') })

const url = process.env.SUPABASE_TEST_URL
const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Defina SUPABASE_TEST_URL e SUPABASE_TEST_SERVICE_ROLE_KEY no backend/.env')
  process.exit(1)
}
const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ------------------------------------------------------------
// Funções 
// ------------------------------------------------------------
async function buscarUsuarioPorEmail(email: string) {
  const alvo = email.trim().toLowerCase()
  const porPagina = 200

  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: porPagina })
    if (error) throw error

    const user = data.users.find((u) => u.email?.toLowerCase() === alvo)
    if (user) return user
    if (data.users.length < porPagina) return null
  }
}

async function obterIdPorEmail(email: string) {
  const user = await buscarUsuarioPorEmail(email)
  if (!user) throw new Error(`Nenhum usuário encontrado com o e-mail: ${email}`)
  return user.id
}

async function tornarAdmin(userId: string) {
  const { error } = await supabase
    .from('Admin')
    .upsert({ fk_Usuario_ID: userId }, { onConflict: 'fk_Usuario_ID' })

  if (error) {
    if (error.code === '23503') {
      throw new Error('Este usuário não tem perfil na tabela "Usuario".')
    }
    throw error
  }
}

async function removerAdmin(userId: string) {
  const { error } = await supabase.from('Admin').delete().eq('fk_Usuario_ID', userId)
  if (error) throw error
}

async function listarAdmins() {
  const { data: admins, error } = await supabase
    .from('Admin')
    .select('fk_Usuario_ID, Data_Criacao')
  if (error) throw error

  const resultado = []
  for (const a of admins ?? []) {
    const { data } = await supabase.auth.admin.getUserById(a.fk_Usuario_ID)
    resultado.push({
      email: data.user?.email ?? '(não encontrado)',
      id: a.fk_Usuario_ID,
      desde: a.Data_Criacao,
    })
  }
  return resultado
}

// ------------------------------------------------------------
// Comandos
// ------------------------------------------------------------
async function executarEmLote(emails: string[], acao: (id: string) => Promise<void>) {
  if (!emails.length) throw new Error('Informe ao menos um e-mail.')

  const resultados: { email: string; ok: boolean; erro?: string }[] = []
  for (const email of emails) {
    try {
      await acao(await obterIdPorEmail(email))
      resultados.push({ email, ok: true })
    } catch (e) {
      resultados.push({ email, ok: false, erro: (e as Error).message })
    }
  }
  console.table(resultados)
  if (resultados.some((r) => !r.ok)) process.exitCode = 1
}

const [comando, ...args] = process.argv.slice(2)

async function main() {
  switch (comando) {
    case 'promover':
      return executarEmLote(args, tornarAdmin)
    case 'remover':
      return executarEmLote(args, removerAdmin)
    case 'listar':
      return console.table(await listarAdmins())
    default:
      console.log('Uso:')
      console.log('  npx tsx administrador/CriaAdmin.ts promover <email> [email...]')
      console.log('  npx tsx administrador/CriaAdmin.ts remover  <email> [email...]')
      console.log('  npx tsx administrador/CriaAdmin.ts listar')
      process.exitCode = 1
  }
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exitCode = 1 
})

/*
para rodar: 
cd C:\codigo-base\supabase
npx tsx administrador/CriaAdmin.ts promover voce@email.com
npx tsx administrador/CriaAdmin.ts promover a@email.com b@email.com
npx tsx administrador/CriaAdmin.ts remover b@email.com
npx tsx administrador/CriaAdmin.ts listar
*/