# Changelog

Todas as mudanças notáveis deste projeto são documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), e este
projeto segue [Versionamento Semântico](https://semver.org/lang/pt-BR/). Enquanto o SisFrota
estiver na fase M0 (nenhum dado real em produção), as mudanças ficam em **Não lançado** — o
primeiro número de versão sai quando a fase M0 for concluída.

## [Não lançado]

### Adicionado

- Página de apresentação institucional (Next.js 15 + React 19 + TypeScript + Tailwind 4),
  publicada em `sisfrota.vps.atb.app.br`, sinalizando que o sistema está em desenvolvimento.
- Scaffold do projeto: ESLint configurado, `package.json`, `tsconfig.json`, estrutura
  `src/app/`.
- `README.md` e este `CHANGELOG.md`.
- `docs/planos/2026-08-17-m0-partida.md` — plano da fase de partida (M0).
- `docs/decisoes/0001-decisoes-fundacionais.md` — decisões fundacionais fechadas com a SMS
  (banco de dados próprio, consumo do cadastro do SisEscala via API de Diretório, stack
  espelhando o SisEscala, entre outras).
- `SISFROTA_SPEC_V2.md` — especificação completa do sistema (fonte de verdade do escopo).
- `SISFROTA_SPEC.md` — especificação v1, mantida como histórico.
- Apresentação institucional do projeto (`apresentacao/`).
- `LICENSE` (Apache License 2.0).
- `CLAUDE.md` — guia de convenções e regras de negócio para quem desenvolve no projeto.
