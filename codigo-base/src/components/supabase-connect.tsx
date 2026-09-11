import { useEffect, useState } from 'react'
import { supabase, supabaseConfigured } from '../lib/supabase'

export function SupaConnect() {
  const [message, setMessage] = useState('Verificando conexão')

  useEffect(() => {
    async function check() {
      if (!supabaseConfigured || !supabase) {
        setMessage('Supabase não configurado')
        return
      }

      setMessage('Conexão funcionando')
    }

    void check()
    }, [])

  return <p>{message}</p>
}