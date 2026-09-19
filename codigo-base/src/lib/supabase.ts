import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

if (!url || !anonKey) {
  throw new Error(
    'Configuração do Supabase inválida. Garanta que VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estejam definidos em .env.local'
  );
}

export const supabase = createClient<Database>(url, anonKey);