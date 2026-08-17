import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Client Supabase para uso em Server Components, Server Actions e Route Handlers.
 * Usa a chave anônima (pública) — a RLS do banco é quem decide o que cada
 * usuário pode ver ou alterar. Nunca usar a service_role aqui.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options?: CookieOptions }[],
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Chamado a partir de um Server Component sem middleware de refresh
            // de sessão — pode ser ignorado se houver middleware cuidando disso.
          }
        },
      },
    },
  );
}
