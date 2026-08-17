import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase com a chave service_role — ignora RLS por completo.
 *
 * NUNCA importar este arquivo em Client Components ("use client") nem em
 * qualquer código que rode no navegador: o import de "server-only" faz o
 * build falhar se isso acontecer, mas o cuidado continua sendo nosso.
 *
 * Uso: apenas em Server Actions/Route Handlers que fazem operação
 * administrativa explícita (ex.: job de sincronização das tabelas-espelho,
 * geração de número legível no servidor). Se a operação pode respeitar RLS,
 * use src/lib/supabase/server.ts em vez deste arquivo.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
