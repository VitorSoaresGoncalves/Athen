import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Navigate } from 'react-router-dom'
import { supabase, supabaseConfigured } from '../lib/supabase'

type SupaConnectProps = {
  onSessionChange?: (session: Session | null) => void
}

export function SupaConnect({ onSessionChange }: SupaConnectProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('Verificando sessão...')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const loadSession = async () => {
      if (!supabaseConfigured) {
        if (mounted) {
          setMessage('Supabase não configurado.')
          setLoading(false)
        }
        return
      }

      const { data, error } = await supabase.auth.getSession()
      if (!mounted) return

      if (error) {
        setMessage(`Erro ao verificar sessão: ${error.message}`)
      } else if (data.session) {
        setMessage(`Sessão ativa: ${data.session.user.email ?? data.session.user.id}`)
      } else {
        setMessage('Faça login para acessar as páginas de testes.')
      }

      setSession(data.session)
      onSessionChange?.(data.session)
      setLoading(false)
    }

    void loadSession()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return
      setSession(nextSession)
      onSessionChange?.(nextSession)
      setMessage(
        nextSession
          ? `Sessão ativa: ${nextSession.user.email ?? nextSession.user.id}`
          : 'Faça login para acessar as páginas de testes.'
      )
      setLoading(false)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [onSessionChange])

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setMessage('Entrando...')

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      setMessage(`Falha no login: ${error.message}`)
      setLoading(false)
      return
    }

    setSession(data.session)
    setPassword('')
    setMessage(`Sessão ativa: ${data.user?.email ?? data.user?.id ?? 'usuário autenticado'}`)
    setLoading(false)
  }

  const handleLogout = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signOut()
    setMessage(error ? `Falha ao sair: ${error.message}` : 'Sessão encerrada.')
    setSession(null)
    setLoading(false)
  }

  if (loading && !session) return <p>{message}</p>

  if (session) {
    return (
      <div>
        <p>{message}</p>
        <button type="button" onClick={() => void handleLogout()} disabled={loading}>
          {loading ? 'Saindo...' : 'Sair'}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={(event) => void handleLogin(event)}>
      <p>{message}</p>
      <label>
        E-mail
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>
      <label>
        Senha
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>
      <button type="submit" disabled={loading}>
        {loading ? 'Entrando...' : 'Entrar'}
      </button>
    </form>
  )
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let mounted = true

    const checkSession = async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      setSession(data.session)
      setChecking(false)
    }

    void checkSession()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return
      setSession(nextSession)
      setChecking(false)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  if (checking) return <p>Verificando sessão...</p>
  if (!session) return <Navigate to="/" replace />

  return <>{children}</>
}