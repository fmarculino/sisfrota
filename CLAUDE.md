# SISFROTA — guia para agentes

Sistema de gestão da frota da **Secretaria Municipal de Saúde de Marabá/PA**.
Irmão do **SisEscala** (escalas e ponto), **SisFilaSUS** e **SisTEA**.

**Este sistema produz prova.** Um abastecimento registrado aqui vira peça de prestação de contas
ao Tribunal de Contas. Registro errado não é bug de tela — é informação falsa num processo
administrativo. Na dúvida, investigue demais.

> Especificação completa: [`SISFROTA_SPEC_V2.md`](SISFROTA_SPEC_V2.md) — é a fonte de verdade do
> escopo. A v1 (`SISFROTA_SPEC.md`) é histórica; não usar como referência.
> Decisões fechadas: [`docs/decisoes/`](docs/decisoes/). Planos por fase: [`docs/planos/`](docs/planos/).

## Estado atual

**Fase M0 (partida).** Nada em produção. Nenhum dado real ainda.
Ver [`docs/planos/2026-08-17-m0-partida.md`](docs/planos/2026-08-17-m0-partida.md).

## Stack — espelha o SisEscala por decisão, não por acaso

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind 4 · Supabase (Postgres + RLS + Auth + Storage)
`lucide-react` · `clsx` + `tailwind-merge` · `next-themes`

**Sem Shadcn/UI, sem Radix, sem biblioteca de componentes.** Componentes próprios, como no
SisEscala — um dev que mantém um mantém o outro. A spec v1 prescrevia Shadcn e foi corrigida
(§2.1 da spec v2). Biblioteca de gráfico só entra quando o primeiro gráfico existir de fato.

**Deploy:** Coolify na VPS (não Vercel), `sisfrota.maraba.pa.gov.br`.
**Banco:** projeto Supabase **próprio**, separado do SisEscala (§2.2 da spec).

### O que fazemos diferente do SisEscala — e por quê

O SisEscala funciona, mas documenta as próprias cicatrizes. Aqui elas são evitadas de saída:

| aqui | lá | motivo |
|---|---|---|
| ESLint configurado no dia 1 | nunca configurado | custa 20 min e nunca mais é feito |
| CI (`tsc --noEmit` + `build` + testes) antes do deploy | não existe | impede publicar código quebrado |
| **pgTAP + Vitest** | nenhum teste | as regras daqui são numéricas e determinísticas — o tipo mais barato de testar |
| `src/core/` com regras puras | lógica no banco e na tela | testável sem banco e sem navegador |
| componente > ~400 linhas vira pasta | `ScaleGrid.tsx` ~5.000 linhas | — |
| função PL/pgSQL > ~200 linhas é sinal de decomposição | `fn_confirmar_presenca` ~1.030 linhas | — |
| nenhum binário no repositório | `.exe` commitado com bump manual de versão | — |

## Regras que não podem ser quebradas

1. **Evidência é append-only.** `frota_medidor_leituras`, `frota_abastecimentos`,
   `frota_evidencias` e `frota_auditoria_log` não sofrem UPDATE de conteúdo nem DELETE. Juízo do
   gestor entra em coluna de parecer; **nunca** apagando ou corrigindo o dado original.
2. **Nunca descartar leitura silenciosamente.** Odômetro que anda para trás é o sinal que a
   auditoria quer ver. Marca-se `confiavel = false` + anomalia; não se ignora.
3. **Dois carimbos de tempo em todo registro de campo.** `medido_em` (relógio do dispositivo,
   **não confiável**) e `recebido_em` (servidor). Divergência grande vira anomalia.
4. **`client_uuid UNIQUE` em toda tabela de campo.** Sem isso, retry de rede vira abastecimento
   duplicado — e duplicidade em relatório de TCE é acusação, não bug.
5. **Nada de identificador legível gerado no cliente.** PK é UUID do cliente (idempotência);
   número legível é gerado no servidor, por sequência, na recepção.
6. **A API de Diretório do SisEscala nunca faz `SELECT *`.** Aquela tabela tem CPF, foto,
   dados bancários, nome da mãe, endereço. Lista explícita de colunas, escrita no código.
7. **Tabelas `*_espelho` são somente-leitura na UI.** Escritas apenas pelo job de sincronização.
   Registro que some na origem vira `origem_ausente` — **nunca** é deletado (há viagens
   históricas apontando para ele).
8. **Foto pode conter paciente.** Bucket privado, signed URL curta, EXIF extraído e removido,
   retenção definida. Ver §9 da spec.
9. **Regra de negócio nova é decisão do dono do produto** (Coordenação de Transporte), registrada
   em `docs/decisoes/` — não é escolha de implementação.

## Convenções

- **Migrations** em `supabase/migrations/`, com timestamp no nome. Nunca editar migration aplicada.
- **Tabelas** com prefixo `frota_`. Enum só para status curto e estável; tipo de evento,
  categoria de veículo e motivo de anomalia são **tabela de domínio** (a coordenação cria valores
  sem migration).
- **RLS habilitada com política default DENY** em toda tabela. RPC sensível só a `service_role`.
- **`src/core/`** = regras puras, sem I/O (consumo, anomalias, cotas, conciliação). Vai ao
  Postgres apenas o que precisa de atomicidade, RLS ou trigger.
- **Rotas** nomeadas pelo usuário, não pela tecnologia: `/motorista`, não `/pwa`.
  Painel administrativo em `(dashboard)`, como no SisEscala.
- **Documentação**: plano antes de fase grande (`docs/planos/`), registro depois
  (`docs/evolucao/`), decisão que muda rumo (`docs/decisoes/`).
- **Nunca afirmar o que não foi verificado.** Se não deu para conferir, escrever que não deu.

## Verificação

```bash
npm run lint         # ESLint — configurado, roda
npx tsc --noEmit     # tipos
npm run build        # build de produção
npm run test         # Vitest — regras puras de src/core/
supabase test db     # pgTAP — regras no banco
```

Nenhum desses passos é opcional antes de abrir PR.
