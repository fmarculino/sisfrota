# 0001 — Decisões fundacionais do SISFROTA

**Data:** 15/08/2026 · **Status:** aceitas · **Origem:** levantamento com a SMS (Coordenação de
Transporte e Coordenação de TI), registrado em `SISFROTA_SPEC_V2.md`.

Registro do que já está decidido, para não ser rediscutido a cada sessão. Decisão que mudar vira
um novo arquivo aqui, referenciando este — **não** se edita a decisão antiga.

---

## D1 — Banco de dados próprio, separado do SisEscala

**Decisão:** projeto Supabase exclusivo do SISFROTA.

**Por quê:** o SisEscala está em produção com folha de ponto de servidor real; uma migration ruim
lá é problema jurídico, e o SISFROTA não pode ter caminho até aquele banco. Também simplifica RLS
e permite backup e escala independentes (frota gera muito mais storage).

**Preço aceito:** não há FK para `servidores`/`unidades`. Resolvido por tabelas-espelho +
sincronização + tela de reconciliação (D2). *Não* por disciplina.

## D2 — Cadastro canônico continua no SisEscala, consumido por API de Diretório

**Decisão:** o SISFROTA **não cria** servidor, unidade ou setor — importa. A API nasce genérica
(`/api/diretorio/v1/*` no SisEscala), não como endpoint específico do SISFROTA, porque
SisFilaSUS e SisTEA precisarão do mesmo dado.

**Requisitos no SisEscala** (entram na onda de atualização já em curso, não depois):
`atualizado_em` + trigger · `situacao` com tombstone (`removido` aparece no feed) ·
paginação por cursor · token por sistema consumidor · projeção explícita de colunas.

**Verificado em 15/08/2026:** `atualizado_em` **não existe** hoje nas tabelas de origem;
`cargos` **já é** entidade normalizada (usar `cargo_id`, não string); o SisEscala **não guarda
CNH** — logo CNH, categoria e cursos do art. 145 são dados do SISFROTA.

## D3 — Stack espelha o SisEscala

**Decisão:** Next 15 · React 19 · TypeScript · Tailwind 4 · Supabase · componentes próprios.
**Sem Shadcn/UI, sem Radix.** A spec v1 prescrevia Shadcn "seguindo o padrão da casa", o que era
contraditório — o SisEscala não usa.

**Por quê:** um desenvolvedor que mantém um sistema mantém o outro. Divergir dobra o custo de
manutenção de uma equipe de três pessoas.

## D4 — Odômetro é ledger append-only, não coluna mutável

**Decisão:** `frota_medidor_leituras` (append-only, com `grandeza` = odômetro **ou horímetro**)
+ `fn_odometro_atual()` + tabela de troca de painel com offset. A coluna em `frota_veiculos` é
cache reconstruível.

**Por quê:** o trigger da spec v1 descartava silenciosamente leitura menor, assumia ordem de
chegada como ordem cronológica (falso num sistema offline) e destruía o histórico. Horímetro
entrou porque a frota tem unidades móveis com gerador, cuja manutenção é por hora, não por km.

## D5 — Sem cartão de abastecimento: a prova precisa ser construída

**Decisão:** a SMS opera por **requisição para posto credenciado**. Como não há operadora de
cartão como fonte independente, o sistema constrói três contraprovas: chave da **NFC-e** (QR do
cupom), **portal do posto** (baixa da requisição) e **conciliação da fatura mensal** (three-way
match).

**Por quê:** sem isso, tudo o que o sistema sabe vem do motorista — o que é declaração, não prova.

## D6 — Celular do motorista é pessoal

**Consequência aceita:** compressão de imagem é requisito (não otimização), Wi-Fi por padrão para
fotos, limpeza do cache local após upload, termo de ciência, e **modo assistido obrigatório desde
a Fase 1** (lançamento pelo setor, marcado como `origem = 'assistido'` e contabilizado como KPI).

**Recomendação pendente de decisão da SMS:** 10 a 20 aparelhos de base como rede de segurança.

## D7 — SAMU entra como retaguarda de frota, nunca como despacho

**Decisão:** o SISFROTA cobre abastecimento, manutenção, km, checklist e conformidade do condutor.
**Não** cobre acionamento, regulação ou dado clínico — quem despacha é o médico regulador.

**Adaptações que a urgência impõe:** checklist por plantão (não por viagem), autorização
permanente de abastecimento com ratificação posterior, e override de checklist reprovado com
justificativa registrada (segurança do paciente vence controle patrimonial).

## D8 — Governança

**Dono do produto:** Coordenação de Transporte (Sr. Elizeu) — solicitante do sistema, controla
requisições e liberação de manutenções.
**Patrocinadora:** Secretaria Municipal de Saúde.
**Dono técnico e curador do cadastro:** Coordenação de TI.
**Operador do dado de frota:** a definir, dentro do setor de transporte — **não pode ser a TI**
(dado lançado por quem não presenciou o fato é transcrição, não evidência).

**Pendências ligadas:** alçada de valor para segunda aprovação; Instrução Normativa de uso da
frota; termo de autorização para servidor não-motorista conduzir veículo oficial (hoje inexistente).

## D9 — O censo da frota vem antes do software

**Decisão:** a Fase −1 (inventário físico, cruzando planilhas, patrimônio, contratos, apólices e
notas de abastecimento) é a primeira entrega, e produz um **relatório de inventário assinado**.

**Por quê:** nunca houve levantamento formal; o controle é planilha fragmentada. Sistema
alimentado com cadastro errado produz relatório errado **com aparência de precisão** — pior que
planilha, porque ninguém desconfia.
