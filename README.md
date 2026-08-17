# SisFrota

Sistema de gestão da frota da **Secretaria Municipal de Saúde de Marabá/PA**. Irmão do
[SisEscala](https://github.com/fmarculino/SisEscala) (escalas e ponto), SisFilaSUS e SisTEA.

> **Status: em desenvolvimento — fase M0 (partida).** Nada em produção, nenhum dado real ainda.
> Existe apenas uma página de apresentação publicada em
> [sisfrota.vps.atb.app.br](https://sisfrota.vps.atb.app.br).

## O que é

O SisFrota vai registrar abastecimentos, leituras de odômetro e o uso dos veículos da
secretaria, gerando um histórico auditável. **Este sistema produz prova**: um abastecimento
registrado aqui pode virar peça de prestação de contas ao Tribunal de Contas — por isso registro
errado não é bug de tela, é informação falsa num processo administrativo.

## Documentação

| Documento | Conteúdo |
|---|---|
| [`SISFROTA_SPEC_V2.md`](SISFROTA_SPEC_V2.md) | Especificação completa — fonte de verdade do escopo |
| [`docs/decisoes/`](docs/decisoes/) | Decisões fundacionais já fechadas (não rediscutir) |
| [`docs/planos/`](docs/planos/) | Plano detalhado de cada fase |
| [`CLAUDE.md`](CLAUDE.md) | Guia para quem (ou o que) for desenvolver aqui |
| [`apresentacao/`](apresentacao/) | Apresentação institucional do projeto |
| [`CHANGELOG.md`](CHANGELOG.md) | Histórico de mudanças |

`SISFROTA_SPEC.md` (v1) é histórica e não deve ser usada como referência — foi substituída
pela v2.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind 4 · Supabase (Postgres + RLS + Auth +
Storage) · ESLint

Sem Shadcn/UI, sem Radix, sem biblioteca de componentes — componentes próprios, espelhando a
decisão tomada no SisEscala (ver [D3 em `docs/decisoes/`](docs/decisoes/0001-decisoes-fundacionais.md)).

## Como rodar localmente

```bash
git clone https://github.com/fmarculino/sisfrota.git
cd sisfrota
npm install
npm run dev
```

Abre em `http://localhost:3000`.

### Scripts

```bash
npm run dev     # ambiente de desenvolvimento
npm run build   # build de produção
npm run start   # sobe o build de produção
npm run lint    # ESLint
```

Antes de abrir PR, rodar também:

```bash
npx tsc --noEmit   # checagem de tipos
```

## Deploy

Coolify na VPS (não Vercel), publicado em `sisfrota.maraba.pa.gov.br` quando sair da fase de
placeholder. Banco de dados em projeto Supabase próprio, separado do SisEscala.

## Licença

[Apache License 2.0](LICENSE).
