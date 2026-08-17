# SISFROTA — Sistema Integrado de Gestão da Frota da Saúde
## Especificação v2 — Levantamento de Requisitos Consolidado
### SMS Marabá/PA · agosto de 2026

> **Status:** documento de levantamento. **Não é ordem de desenvolvimento.**
> Substitui e amplia `SISFROTA_SPEC.md` (v1). A v1 continua no repositório como registro
> da concepção original; tudo o que ela definiu e que continua válido está reproduzido aqui.
> As seções marcadas com 🆕 são novas nesta versão. As marcadas com ⚠️ são **críticas ou
> correções** ao desenho da v1 — leia-as antes de aceitar qualquer coisa como fechada.

---

# PARTE I — O QUE O SISTEMA PRECISA RESOLVER

## 1. Visão geral

O SISFROTA centraliza, controla e **audita** a operação e o custo da frota da Secretaria
Municipal de Saúde de Marabá: ambulâncias (suporte básico e avançado), vans de Tratamento Fora
de Domicílio (TFD), veículos de apoio administrativo, vigilância sanitária e logística de
insumos, amostras e imunobiológicos.

### 1.1 🆕 O problema real, dito sem eufemismo

Sistema de frota em órgão público não existe para "gerenciar veículos". Existe para responder,
com prova, a cinco perguntas que o Tribunal de Contas, o controle interno e o Ministério Público
fazem — e que hoje a maioria das prefeituras responde com planilha e diário de bordo em papel:

1. **Esse veículo rodou mesmo esses quilômetros?**
2. **Esse combustível entrou mesmo nesse tanque?**
3. **Essa viagem tinha finalidade pública e foi autorizada por quem tinha competência?**
4. **Esse gasto cabe no contrato/empenho vigente?**
5. **Quem é o responsável, nominalmente, por cada uma dessas afirmações?**

Todo o resto (dashboards, mapas, gráficos) é consequência. O desenho da v1 acertou o instinto —
evidência fotográfica dupla, GPS pontual, offline-first — mas parou no registro e não chegou à
**cadeia de responsabilidade** nem ao **controle orçamentário**, que é onde o dinheiro
efetivamente vaza. A v2 fecha isso.

### 1.2 ⚠️ Contexto operacional de Marabá que o desenho precisa absorver

- Município de ~15 mil km², com distritos (São Félix, Morada Nova, Vila Sororó) e ramais sem
  cobertura celular. **Sem sinal é a regra, não a exceção** — o offline-first da v1 está certo
  e deve ser tratado como requisito de primeira classe, não como "melhoria".
- TFD com deslocamentos longos (Belém ~480 km via PA-150/BR-155/BR-010, Imperatriz/MA, Araguaína/TO),
  o que traz **diárias de motorista, pernoite, ajuda de custo de paciente e acompanhante** —
  todos itens de prestação de contas regidos pela **Portaria SAS/MS nº 55/1999**.
- Frota heterogênea e com origens diferentes (própria, locada, cedida por convênio/emenda
  parlamentar do FNS). Ambulância vinda de emenda tem regra de uso e prestação de contas própria
  e **não pode ser tratada como veículo comum no relatório**.

### 1.3 🆕 Decisões e parâmetros confirmados pela SMS (15/08/2026)

Respostas do levantamento. Tudo abaixo é **premissa fechada** — o resto do documento já está
ajustado a elas.

| # | pergunta | resposta | consequência de projeto |
|---|---|---|---|
| 1 | Como o combustível é comprado? | **Requisição emitida para posto previamente credenciado.** Sem cartão de abastecimento, sem tanque próprio. | O SISFROTA **é** o emissor da requisição — ela deixa de ser papel. Não há extrato de operadora como evidência independente → a NFC-e e o **portal do posto** (§4.12) passam a ser a única contraprova. Entra o módulo de **conciliação de fatura** (§4.13). |
| 2 | Aparelho do motorista | **Celular pessoal.** | Restrição dura de projeto: consumo de dados, bateria, LGPD em dispositivo alheio, rotatividade de aparelho. Ver §8.3 reescrita e §8.4 (modo assistido). |
| 3 | Banco | **Supabase novo, separado do SisEscala.** | Não há FK para `servidores`/`unidades`. Entra **espelho de cadastro** e autenticação própria (§2.2 reescrita). |
| 4 | Tamanho da frota | **200+ veículos**: ambulâncias, carros funcionais, vans, **ônibus**, **carretas/unidades móveis especializadas** e outros. | Muda de escala e de *natureza*: entram horímetro, conjunto tracionador+implemento, CNES móvel, categorias D/E, e volumetria de storage (§4.1, §11.0). |
| 5 | Urgência | Maioria de ambulâncias próprias da SMS + **uma base do SAMU gerenciada pela SMS**. | O SAMU entra como **retaguarda de frota**, nunca como despacho — quem despacha é a regulação médica (§4.14). |

**2ª rodada (mesma data):** dono do produto = **Sr. Elizeu**, coordenador de transporte e
solicitante do sistema; patrocinadora = **Lícia**, secretária; dono técnico = coordenação de TI
(§11.2). **~60 motoristas**, incluindo zona rural (§4.1.0). Integração com o SisEscala **por API**,
com o cadastro de servidores permanecendo lá (§2.2.1). E o achado que reorienta a Fase −1:
**nunca houve levantamento sério da frota** — o controle é planilha fragmentada e ninguém sabe
dizer com exatidão o que a SMS tem (§11.0.1). Isso não é contexto: é o **problema nº 1** a resolver,
e foi um dos motivadores do pedido.

### 1.4 🆕 Volumetria estimada (dimensiona storage, custo e UX)

Com 200+ veículos, contas de ordem de grandeza que precisam entrar na decisão de infraestrutura:

| item | estimativa/mês | observação |
|---|---|---|
| Abastecimentos | 1.600–2.500 | ~2/semana/veículo |
| Diários de bordo (saída/retorno) | 4.000–8.000 | veículos de apoio rodam diariamente |
| Fotos de evidência | 5.000–10.000 | 2 por abastecimento + avarias + eventos |
| **Storage de fotos** | **~1,5–3 GB/mês** | a 300 KB/foto após compressão no cliente |
| **Storage acumulado** | **~20–35 GB/ano** | sem política de retenção; **com** retenção definida, estabiliza |

Duas conclusões: (a) **compressão no cliente não é otimização, é requisito** — sem ela o número
triplica e o motorista paga a franquia de dados dele; (b) **política de retenção precisa existir
antes do go-live**, não depois que a conta chegar.

---

## 2. ⚠️ Crítica ao desenho da v1 (leia antes de codificar)

Onze pontos. Alguns são bugs latentes, outros são lacunas de escopo que só aparecem em produção.

### 2.1 ⚠️ A stack declarada não é a stack da casa

A v1 diz "segue os mesmos padrões dos sistemas corporativos (SisEscala, SisFilaSUS, SisTEA)" e
em seguida prescreve **Shadcn/UI, Radix e Recharts**. O SisEscala em produção usa:

| v1 prescreve | SisEscala real |
|---|---|
| Shadcn/UI + Radix | **nenhum framework de componentes** — componentes próprios em Tailwind |
| Recharts | **nenhuma lib de gráfico** |
| — | Tailwind **4**, Next **15**, React **19**, `lucide-react`, `next-themes`, `clsx` + `tailwind-merge` |
| (silêncio sobre testes) | **não há framework de teste**: `npm run build` + `npx tsc --noEmit` são a verificação; `npm run lint` não roda (ESLint nunca configurado) |
| (silêncio sobre migrations) | `supabase/migrations/` com 159 migrations SQL versionadas |

**Decisão a tomar conscientemente, não por inércia:** ou o SISFROTA adota a mesma base do
SisEscala (recomendado — um dev que mantém um mantém o outro), ou adota Shadcn e assume que os
dois sistemas divergem para sempre. Recomendo **espelhar o SisEscala** e introduzir uma lib de
gráfico só quando o primeiro gráfico existir de fato.

**Recomendação adicional:** copiar do SisEscala a prática de `CLAUDE.md` + `docs/planos/` +
`docs/evolucao/`. É o que permitiu àquele projeto sobreviver a 159 migrations sem perder o fio.

### 2.2 ⚠️ Banco separado: decisão aceita, com um preço que precisa ser pago explicitamente

**Decidido: Supabase novo, exclusivo do SISFROTA.** A decisão é defensável e eu concordo com ela,
por três razões que valem ser registradas:

- **Raio de dano isolado.** O SisEscala está em produção com folha de ponto de servidor real —
  errar lá é problema jurídico. Uma migration ruim do SISFROTA não pode ter caminho até aquele banco.
- **RLS mais simples.** Dois conjuntos de políticas no mesmo banco, com papéis que quase não se
  sobrepõem, é fonte de furo de segurança.
- **Backup, restore e escala independentes.** Frota gera ordem de grandeza mais linhas e MUITO
  mais storage (§1.4) do que escala de plantão.

**O preço:** motorista da SMS *é* servidor da SMS, e `servidores`, `unidades` e `setores` vivem no
outro banco. Sem tratamento, em três meses as duas listas de unidades divergem e ninguém sabe qual
está certa. **Isso não se resolve com disciplina, se resolve com desenho:**

1. **Cadastro canônico continua no SisEscala.** O SISFROTA **não cria** servidor nem unidade —
   ele *importa*.
2. **Tabelas-espelho, marcadas como tal e somente-leitura na UI:** `frota_pessoas_espelho`,
   `frota_unidades_espelho`, `frota_setores_espelho`, guardando o UUID de origem
   (`origem_id`), `sincronizado_em` e `origem_hash`.
3. **Sincronização por pull agendado** contra uma API do SisEscala (§2.2.1), não por push — pull
   tolera o SisEscala estar fora do ar e é reexecutável sem efeito colateral.
4. **Tela de reconciliação**: registros que existem no SISFROTA e sumiram na origem (servidor
   exonerado, unidade desativada) **não são apagados** — são marcados `origem_ausente` e entram
   numa fila para decisão humana. Apagar quebraria histórico de viagens já registradas.
5. **Dado local vs dado espelhado nunca se misturam na mesma coluna.** `frota_condutores` tem
   `pessoa_espelho_id` (origem) + campos próprios (CNH, curso, aptidão). CNH é do SISFROTA;
   nome e matrícula são do SisEscala. Sem exceção — é o que evita a briga de "quem é o dono".
6. **Contingência obrigatória:** se o espelho ficar indisponível, o SISFROTA continua operando
   com o último snapshot. Ele nunca pode ficar de pé só se o outro sistema responder.

⚠️ **Consequência colateral que não pode passar batido:** a integração de **WhatsApp** que o
SisEscala já tem (`logs_webhook_whatsapp`) **não vem junto**. Ou se duplica o cliente do webhook
no SISFROTA (provavelmente o certo — é pouco código), ou o SisEscala expõe um endpoint interno de
notificação. Decidir na Fase 0, porque o motor de alertas (§4.10) depende disso.

### 2.2.1 🆕 O contrato de integração — **API de Diretório**, não "API do SisFrota"

**Decidido (15/08/2026): a comunicação será por API, com o cadastro de servidores permanecendo no
SisEscala.** Concordo. Mas há uma decisão de escopo embutida que vale tomar agora, porque ela é
barata hoje e cara depois:

> A SMS já tem **SisEscala, SisFilaSUS, SisTEA** e agora **SisFrota**. Todos precisam saber quem
> são os servidores, quais são as unidades e quais são os setores. Se essa API nascer como
> "endpoint que o SisFrota consome", em dois anos existirão quatro integrações diferentes para o
> mesmo dado. **Nasça como API de Diretório**, genérica, versionada, com token por sistema
> consumidor. O SisFrota é só o primeiro cliente.

Isso não aumenta o trabalho — é a mesma implementação com nome e contrato melhores. E segue o
padrão que o SisEscala **já usa** em `/api/rep/v1/*` (rotas versionadas, autenticação por token
de sistema), então não é convenção nova.

**Contrato sugerido** (no SisEscala, somente leitura):

```
GET /api/diretorio/v1/servidores?desde=<ISO8601>&cursor=<uuid>&limite=500
GET /api/diretorio/v1/unidades?desde=...
GET /api/diretorio/v1/setores?desde=...
GET /api/diretorio/v1/health
Authorization: Bearer <token do sistema consumidor>
```

Resposta:
```jsonc
{
  "itens": [
    { "id": "uuid", "matricula": "58534", "nome": "…", "cargo": "Motorista",
      "unidade_id": "uuid", "setor_id": "uuid",
      "situacao": "ativo",            // ativo | inativo | removido  ← tombstone
      "atualizado_em": "2026-08-15T12:00:00Z",
      "hash": "sha256:…" }
  ],
  "proximo_cursor": "uuid|null",
  "servidor_em": "2026-08-15T12:00:03Z"
}
```

**Seis detalhes que decidem se essa integração vai doer ou não:**

1. **`atualizado_em` mantido por trigger** no SisEscala. Sem isso não existe sync incremental —
   só varredura completa toda vez.
   ⚠️ **Verificado em 15/08/2026: essa coluna não existe.** Varri as 159 migrations e não há
   `updated_at`/`atualizado_em` em `servidores`, `unidades` ou `setores` — essas tabelas são
   anteriores ao baseline de migrations e só receberam `ALTER TABLE ... ADD COLUMN` pontuais
   desde então. **Criar a coluna + trigger agora**, enquanto o SisEscala já está sendo mexido,
   é muito mais barato do que fazer isso depois, no meio de produção.
2. **Tombstone obrigatório.** Registro apagado ou desativado precisa **aparecer no feed** com
   `situacao: "removido"`. Se ele simplesmente sumir da resposta, o espelho nunca fica sabendo e
   guarda um servidor exonerado para sempre. Este é o erro nº 1 em sync incremental.
3. **Idempotência e replay.** O consumidor guarda o último `atualizado_em` processado. Rodar duas
   vezes não pode causar efeito diferente, e `desde=1970-01-01` deve reconstruir tudo do zero —
   é o botão de pânico quando o espelho corromper.
4. **Minimização de dado (LGPD).** Trafegar só o necessário: `id`, matrícula, nome, `cargo_id` +
   nome do cargo, unidade, setor, situação. **CPF só se o SisFrota realmente precisar.**
   ⚠️ **Verificado em 15/08/2026, e é pior do que eu supunha:** `public.servidores` acumulou
   `cpf`, `foto_url`, **dados bancários**, `data_nascimento`, `nome_mae`, `nome_pai`, endereço
   completo, `rg_*`, `pis_pasep`, `estado_civil`, `nome_conjuge`, `escolaridade`. Um `SELECT *`
   num endpoint de integração transfere um **dossiê funcional inteiro** para um sistema de frota,
   que não precisa de nada disso. **A API projeta uma lista explícita de colunas, escrita no
   código, nunca a linha inteira** — e essa é a regra mais importante desta seção.

5. 🆕 **Boa notícia verificada: `cargo` já é entidade normalizada no SisEscala** (tabela `cargos`,
   com hierarquia via `parent_id` e unicidade por `(nome, parent_id)`), não texto livre. Isso
   significa que o SISFROTA pode mapear **cargo → condutor** de forma confiável (`cargo_id`, não
   string), e a classificação automática entre "motorista" e "condutor eventual" (§4.1.0) fica
   estável mesmo se alguém renomear o cargo. Expor `cargo_id` no feed, não só o nome.

6. 🆕 **Verificado: o SisEscala não guarda CNH** (nenhuma referência a CNH em migrations ou
   código). Não há conflito de domínio: **CNH, categoria, vencimento e cursos do art. 145 são
   dados do SISFROTA**, e devem ficar lá. Vale evitar a tentação de "aproveitar que o cadastro
   está sendo atualizado e colocar CNH no SisEscala" — dado de habilitação tem workflow de
   validade, bloqueio e alerta que só o sistema de frota exerce.
5. **Token por sistema, com log de acesso**, revogável, e escopo somente-leitura. Mesmo espírito
   do `service_role` restrito que o SisEscala já pratica.
6. **Versão no path (`/v1`)** para o SisEscala poder evoluir sem quebrar os consumidores.

**Do lado do SisFrota:** `pg_cron` a cada 15 min → Edge Function → `upsert` nas tabelas-espelho,
com cada execução registrada em `frota_sync_execucoes` (encontrados, atualizados, erros, duração).
Se a API estiver fora, o SisFrota continua com o último snapshot — **nunca** fica de pé só se o
SisEscala responder.

🔭 **Extensão futura (Fase 4+), não agora:** `GET /api/diretorio/v1/escala?data=…` — saber **quem
está de plantão hoje** transforma o SisFrota: permite validar se o motorista que abriu a viagem
estava escalado, e ligar ambulância 24h à escala real. É o tipo de coisa que só é possível porque
os dois sistemas são da mesma casa, e nenhum produto de mercado consegue fazer.

### 2.2.2 🆕 Sequenciamento: a API de Diretório é trabalho **da atualização em curso do SisEscala**

Confirmado em 15/08/2026: a atualização em andamento do SisEscala visa atender **todas** as
necessidades da SMS em escala e ponto — e, por consequência, **completar o cadastro de servidores**.
Isso é a melhor notícia possível para o SISFROTA, porque o espelho herda um cadastro completo em
vez de nascer sobre uma base parcial. Mas gera uma **decisão de sequenciamento** que precisa ser
tomada agora, não daqui a dois meses:

> As três mudanças que o SisEscala precisa fazer para servir de origem — **`atualizado_em` +
> trigger**, **tombstone (`situacao`)** e a **rota `/api/diretorio/v1/*`** — devem entrar como
> itens da onda de trabalho que já está acontecendo, **não** como tarefa futura do SISFROTA.
> Fazer agora é uma migration a mais num sistema que já está sendo mexido. Fazer depois é
> migration isolada no meio da produção da folha de ponto, com o risco que isso carrega naquele
> sistema.

⚠️ **Risco espelhado: o SISFROTA não pode virar refém do cronograma do SisEscala.** Se a
atualização do cadastro atrasar, a Fase 0 não pode parar. Duas salvaguardas:

1. **A Fase −1 (censo da frota) não depende disso** — ela é sobre veículos, não sobre pessoas.
   Pode e deve rodar **em paralelo** à atualização do cadastro. É a melhor notícia do
   cronograma: as duas frentes avançam ao mesmo tempo, sem espera.
2. **Condutor provisório sem vínculo.** `frota_condutores` aceita `pessoa_espelho_id NULL` com
   `origem_condutor = 'pendente_vinculo'` e matrícula/CPF anotados, sendo reconciliado depois
   por matrícula ou CPF quando o servidor aparecer no espelho.
   🔁 **Isso não é padrão novo** — é exatamente o que o SisEscala já faz com
   `fn_vincular_cadastros_por_cpf` para casar usuário de relógio de ponto com servidor. Mesmo
   problema, mesma solução, e vale copiar a lógica em vez de inventar outra.

### 2.3 ⚠️ Login do motorista: e-mail não vai funcionar — e agora precisa ser reimplementado

Motorista de ambulância em plantão, com luva, em pé no sol, não faz login com e-mail e senha
forte. O SisEscala já resolveu esse exato problema no portal do servidor: **login por matrícula +
PIN** (`/consultar-escala`).

Com banco separado, esse padrão **não é herdado — é reimplementado**. Recomendação:

- **Motorista:** matrícula + PIN de 6 dígitos, sessão longa (o app não pode deslogar sozinho no
  meio do plantão), PIN redefinível pela coordenação. Opcional e desejável: **QR do crachá**.
- **Servidores administrativos:** Supabase Auth padrão (e-mail + senha), como no SisEscala.
- **Posto credenciado (§4.13):** usuário próprio, escopo mínimo, sem acesso a nada além das
  requisições dirigidas a ele.

Como o PIN vive num banco novo, ele precisa de: hash (nunca texto puro), limite de tentativas,
bloqueio temporário e log de tentativa — o SisEscala tem `logs_tentativas_presenca` como
precedente do padrão a copiar.

### 2.4 ⚠️ O trigger de odômetro está errado de três maneiras

```sql
IF NEW.odometro > (SELECT odometro_atual FROM vehicles WHERE id = NEW.vehicle_id) THEN
    UPDATE vehicles SET odometro_atual = NEW.odometro ...
```

1. **Descarta silenciosamente valor menor.** Um odômetro que anda para trás é *exatamente* o
   sinal que a auditoria quer ver (erro de digitação, painel trocado, fraude, veículo rebocado).
   Descartar sem registrar apaga a evidência.
2. **Assume ordem de chegada = ordem cronológica.** Com offline-first isso é falso por construção:
   o abastecimento de terça pode sincronizar depois do checklist de quarta. O "atual" tem que ser
   o de maior `medido_em`, não o último inserido.
3. **`odometro_atual` como coluna mutável destrói a história.** Não dá para reconstruir o valor
   que o sistema tinha quando a autorização foi emitida.

**Correção (seção 6.3):** ledger append-only de leituras + coluna-cache reconstruível. É
exatamente o padrão que o SisEscala usou para marcações de ponto (evidência bruta imutável → fato
→ juízo do gestor → projeção reconstruível). Reusar padrão da casa, não inventar outro.

### 2.5 ⚠️ Relógio do celular é dado hostil

Todo registro de campo carrega hora do dispositivo. O motorista pode mudar o relógio do celular —
é o truque mais simples que existe para "provar" que abasteceu antes de viajar. **Guardar sempre
dois carimbos:** `medido_em` (dispositivo, não confiável) e `recebido_em` (servidor, `now()`), e
sinalizar divergência acima de um limite. Custa uma coluna e mata uma classe inteira de fraude.

### 2.6 ⚠️ `codigo_viagem` único gerado onde?

`VARCHAR(20) UNIQUE NOT NULL` num sistema offline-first não pode ser gerado no cliente — dois
celulares offline geram o mesmo código. **PK é UUID gerado no cliente** (para idempotência de
sync); o **número legível é gerado no servidor** no momento da recepção, por sequência.

### 2.7 ⚠️ Falta idempotência de sincronização

A v1 fala em "sincronização automática" mas não define o contrato. Sem `client_uuid UNIQUE` em
cada tabela de campo, um retry de rede vira **abastecimento duplicado** — e abastecimento
duplicado no relatório do TCE é acusação de fraude, não bug.

### 2.8 ⚠️ Fotos de ambulância contêm paciente

Foto de avaria interna, de maca, de evento assistencial pode capturar rosto de paciente. Isso é
**dado pessoal sensível de saúde** (LGPD art. 5º, II e art. 11). O bucket precisa de política de
acesso por papel, prazo de retenção definido, e o app precisa instruir o motorista. A v1 trata
foto como "URL TEXT NOT NULL" e nada mais.

Corolário: decidir explicitamente se o **EXIF é preservado** (vira evidência de GPS/hora) ou
removido (higiene de privacidade). Recomendo: extrair GPS/hora do EXIF no servidor, gravar em
colunas, **e então remover o EXIF** do arquivo armazenado.

### 2.9 ⚠️ OCR de cupom fiscal térmico é frágil — existe coisa melhor

A v1 propõe Tesseract.js sobre foto de cupom. Cupom térmico amassado, no sol, fotografado torto,
tem taxa de erro alta o bastante para gerar retrabalho.

🆕 **Alternativa muito superior: ler o QR Code da NFC-e.** Todo cupom fiscal eletrônico de posto
traz QR code com a **chave de acesso de 44 dígitos**, que codifica UF, ano/mês, **CNPJ do emitente**,
modelo, série, número e dígito verificador — e permite consulta ao portal da SEFAZ. Com isso:

- valida que o **CNPJ do emitente é de posto credenciado no contrato** (não é o posto do primo);
- valida **data/hora fiscal** contra a hora declarada pelo motorista;
- detecta **cupom reapresentado** (mesma chave usada duas vezes) — fraude clássica;
- pré-preenche valor sem OCR.

Ler QR é trivial e determinístico. **OCR vira fallback** para o hodômetro no painel (onde não há
QR), não a via principal.

### 2.10 ⚠️ Faltam módulos inteiros — e são os que custam dinheiro

A v1 cobre veículo, motorista, viagem, abastecimento, evento e checklist. Não existe no modelo:
**manutenção** (a maior rubrica depois do combustível), **pneus**, **multas**, **sinistros**,
**documentação/licenciamento**, **contratos e empenhos**, **postos credenciados**, **cotas**,
**TFD como processo**, **diárias**, **alertas** e **trilha de auditoria**. Parte II cobre todos.

### 2.11 ⚠️ Sem contrato e empenho, o sistema não responde a pergunta mais importante

"Posso autorizar esse abastecimento?" depende de: existe contrato vigente? tem saldo? o posto é
credenciado nesse contrato? o preço cobrado é o preço da ata? a unidade já estourou a cota do mês?

Sem isso, o SISFROTA vira um belo diário de bordo digital que **descobre o estouro do contrato
depois que ele aconteceu**. Com isso, ele impede o estouro. É a diferença entre relatório e controle.

### 2.12 ✅ O que a v1 acertou e deve ser preservado

Registrado para não se perder na reescrita:

- **Evidência fotográfica dupla (cupom + painel)** — é o núcleo do valor. Mantida e ampliada.
- **GPS pontual em vez de rastreamento contínuo** — decisão de privacidade *correta*, e que sai
  muito mais barata (sem hardware, sem contrato de telemetria). Formalizada na seção 9.
- **Offline-first como requisito, não enfeite** — certo para o contexto de Marabá.
- **Separação `/admin` (desktop) e `/pwa` (mobile)** — certo; são dois produtos com dois usuários.
- **Módulo assistencial (manifesto TFD, checklist de itens médicos)** — é o que diferencia um
  sistema de frota *da saúde* de um sistema de frota genérico. Nenhum produto de mercado tem isso.

---

## 3. 🆕 O que o mercado faz (e o que dele vale a pena trazer)

Pesquisa feita em agosto/2026. O mercado se divide em três famílias, e nenhuma resolve o caso
da SMS sozinha.

### 3.1 Telemática pesada — Samsara, Geotab, Verizon Connect, Cobli, Golfleet

Rastreamento contínuo por GPS/CAN, câmeras com IA, score de motorista. Preço na faixa de
**US$ 20–60/veículo/mês** com contrato mínimo (Samsara exige 3 anos). Tendência declarada para
2026: **telemetria via rede CAN** (dado direto da central eletrônica: consumo, RPM, hodômetro
real) e **manutenção preditiva**, com relatos de **25–40% de redução no custo de manutenção**.

**O que trazer:** o conceito de manutenção orientada a dado e o vocabulário de KPI. **O que não
trazer:** o modelo. Rastreamento contínuo de servidor público muda a base legal na LGPD, exige
hardware, contrato e negociação sindical. O desenho da v1 (evento pontual) é mais barato e mais
defensável. **Mas** a arquitetura deve deixar a porta aberta: uma tabela `frota_telemetria_leituras`
prevista e vazia custa nada e evita refatoração se um dia houver contrato de rastreador.

### 3.2 Manutenção e operação — Fleetio, Prolog, TOTVS Frotas, Aspec Frota, GPI

Fleetio (US$ 4–10/veículo/mês) é o mais próximo do que a SMS precisa: **ordem de serviço, plano
preventivo, peças, histórico**. A Prolog construiu a maior plataforma de **gestão de pneus** da
América Latina — sinal claro de que pneu é rubrica grande o suficiente para sustentar um produto
inteiro. Aspec e GPI são os players que já vendem para prefeitura brasileira, com cadastro de
veículo incluindo chassi, DUT, unidade e proprietário.

**O que trazer:** modelo de OS, plano preventivo por km **e** por tempo (o que vencer primeiro),
ciclo de vida de pneu com posição e recapagem. Tudo na Parte II.

### 3.3 ⚠️ Cartão de abastecimento — Ticket Log/Edenred, Neo, Abastece Aí — **não é o caso da SMS**

Substituem a requisição em papel por cartão com regras (limite, tipo de combustível, rede
credenciada) e **lançamento automático de custo**.

**A SMS não usa cartão** — usa **requisição para posto credenciado** (§1.3). Isso tem uma
consequência que muda o desenho e que precisa estar clara:

> Com cartão, o dado de abastecimento nasce numa **fonte independente do motorista** (a
> operadora). Sem cartão, **tudo o que o sistema sabe vem do motorista** — ele digita os litros,
> ele fotografa o cupom, ele informa o hodômetro. Uma única fonte não é prova, é declaração.

Por isso, no desenho da SMS, as contraprovas independentes precisam ser **construídas de
propósito**, e são três:

1. **Chave da NFC-e** (§4.4) — emitida pela SEFAZ, fora do alcance do motorista.
2. **Portal do posto credenciado** (§4.12) — o posto confirma o atendimento; segunda parte
   com interesse oposto ao do motorista.
3. **Fatura mensal do posto** (§4.13) — conciliação a três vias.

Sem esses três, o SISFROTA registra bonito e não prova nada. **Essa é a mudança de escopo mais
importante trazida pelas respostas do levantamento.**

### 3.4 O que o mercado **não** tem, e é onde o SISFROTA ganha

Nenhum produto pesquisado trata: manifesto de passageiros de TFD, ajuda de custo de paciente e
acompanhante conforme Portaria 55/99, checklist de itens médicos e de resgate (NBR 14561),
alvará sanitário do veículo para transporte de amostras e imunobiológicos, rateio de custo por
bloco de financiamento da saúde, ou relatório no formato que o Tribunal de Contas pede.

**Esse é o produto.** Não é "mais um sistema de frota" — é um sistema de **logística sanitária
municipal auditável**.

---

# PARTE II — ESCOPO FUNCIONAL v2

Legenda de fase: **F1** = MVP (o que faz o sistema valer a pena no dia 1) · **F2** = consolidação ·
**F3** = maturidade · **F4** = opcional/futuro.

## 4. Módulos

### 4.1 Cadastros e conformidade — F1

- **Veículos**: placa, RENAVAM, chassi, marca/modelo, ano fab/mod, categoria funcional
  (ambulância tipo A/B/C/D, van TFD, apoio, vigilância, motocicleta, utilitário), combustível
  principal e secundário (flex), capacidade de tanque, lotação, **propriedade** (próprio, locado,
  cedido, consorciado) e **origem do recurso** (recurso próprio, convênio FNS, emenda parlamentar
  nº X) — este último é obrigatório para prestação de contas de emenda.
- 🆕 **Documentação com vencimento**: licenciamento/CRLV, IPVA, seguro, laudo de vistoria de
  ambulância, **alvará/licença sanitária do veículo** (obrigatório para transporte de amostras e
  produtos de interesse à saúde), extintor, cronotacógrafo quando aplicável. Cada documento gera
  alerta automático (seção 4.10).
- **Condutores**: vinculados ao espelho de `servidores` (§2.2). CNH (número, categoria,
  vencimento), **cursos especializados do art. 145 do CTB** com validade própria — condutor de
  **veículo de emergência** (ambulância), **transporte coletivo de passageiros** (ônibus/van) e
  **veículo de carga/articulado** conforme o caso —, pontuação e aptidão por categoria de veículo.
  🆕 **Regra dura:** condutor sem CNH válida **na categoria exigida pelo veículo**, ou com curso
  vencido, **não recebe Ordem de Tráfego**. O sistema bloqueia; não avisa depois. Com ônibus e
  carreta na frota, isso deixa de ser detalhe: dirigir carreta com CNH "D" é infração gravíssima
  e invalida o seguro em caso de sinistro.

### 4.1.0 🆕 ~60 motoristas para 200+ veículos — o que esse número já denuncia

Estimativa informada pela SMS em 15/08/2026: **cerca de 60 motoristas**, incluindo os da zona
rural. Contra 200+ veículos, isso dá **1 motorista para cada 3,3 veículos** — e uma proporção
dessas só se explica por uma combinação de três coisas, **todas relevantes para o desenho**:

1. **Boa parte da frota está parada.** Veículo inoperante, sucateado, cedido, baixado ou "sumido"
   engorda a contagem sem consumir motorista. Se for esse o caso, o SISFROTA vai descobrir isso
   na Fase −1 (§11.0) e essa descoberta, sozinha, já paga o projeto.
2. **Servidores que não são motoristas dirigem veículo oficial** — enfermeiro que leva vacina,
   agente de vigilância, técnico que vai ao distrito. É rotina em secretaria de saúde e é
   perfeitamente legítimo, **desde que exista autorização formal para dirigir veículo oficial**,
   CNH válida e cobertura de seguro. Se não existir, há exposição jurídica real em caso de
   sinistro — e ninguém descobre isso até o acidente acontecer.
   ✅ **Confirmado em 15/08/2026:** a própria Coordenação de TI dirige o veículo destinado ao
   setor. O "condutor eventual" **não é hipótese de modelagem — é caso real e corrente**, e
   provavelmente numeroso. E, também confirmado: **não existe hoje nenhuma definição legal ou ato
   formal autorizando esses servidores a dirigir** — é prática consolidada por falta de servidores
   motoristas e ausência de planejamento, não por decisão.

   ⚠️ **Isso precisa ser dito com clareza, porque é a maior exposição jurídica identificada até
   aqui — e ela existe hoje, com ou sem o SISFROTA.** Servidor sem ato de autorização dirigindo
   veículo oficial, em caso de sinistro com vítima ou dano a terceiro, cria três problemas
   simultâneos: possível recusa de cobertura pela seguradora, responsabilização pessoal do
   servidor (que hoje dirige achando que está coberto pelo serviço) e responsabilização do gestor
   por omissão. Nada disso aparece enquanto não acontece um acidente — e então aparece tudo junto.

   🆕 **Oportunidade: transformar a lacuna em funcionalidade.** Em vez de apenas *apontar* o
   problema, o SISFROTA pode ser o instrumento que o resolve — emitindo o **Termo de Autorização
   para Condução de Veículo Oficial**: o sistema já tem CNH, categoria, validade e vínculo do
   servidor; gera o termo, colhe a assinatura eletrônica (Lei 14.063/2020), controla a vigência e
   **bloqueia a OT quando vence**. A SMS sai de "ninguém tem autorização" para "todo condutor tem
   autorização rastreável" sem criar processo manual novo. Isso entra na Fase 1 (é barato: é um
   PDF, uma assinatura e uma data de validade) e deve ser citado nominalmente na Instrução
   Normativa (§11.2.1), que é o ato que dá base para o termo existir.
3. **Um motorista opera vários veículos** ao longo da semana, o que é normal e já está contemplado.

⚠️ **Consequência de modelo:** `frota_condutores` **não pode ser só "quem tem cargo de motorista"**.
Precisa de três origens distintas, com o mesmo tratamento de CNH e curso, mas vínculos diferentes:

| tipo de condutor | vínculo | vem do espelho? |
|---|---|---|
| **Motorista** (cargo) | servidor efetivo/contratado | sim |
| 🆕 **Condutor eventual** (servidor autorizado a dirigir) | servidor de outro cargo + **ato de autorização** com validade | sim |
| 🆕 **Condutor externo** (terceirizado, cedido, locação com motorista) | contrato, **não é servidor** | **não** — cadastro local |

O terceiro caso é o que quebra a premissa de "todo condutor é servidor": motorista de empresa
contratada **nunca vai existir no SisEscala**. Se o modelo exigir `pessoa_espelho_id NOT NULL`,
esse condutor não entra no sistema — e ele dirige veículo da SMS do mesmo jeito. Portanto:
`pessoa_espelho_id` **nullable**, com `origem_condutor` obrigatório e dados locais quando externo.

**Pergunta a levar para o seu Elizeu:** dos ~60, quantos são efetivos, quantos contratados e
quantos de empresa terceirizada? A resposta muda o cadastro e, principalmente, muda quem responde
por infração de trânsito (§4.8).

### 4.1.1 🆕 O que 200+ veículos heterogêneos exigem do modelo (e a v1 não previa)

Ônibus e carretas especializadas quebram três premissas do modelo original:

- **Nem todo ativo tem odômetro.** Reboque, semirreboque e carreta têm **placa e RENAVAM
  próprios**, mas não têm hodômetro. O modelo precisa de **conjunto**: unidade tratora +
  implemento como ativos separados, vinculados por período. O km do conjunto é o da tratora; o
  custo (pneus, manutenção, licenciamento) é do implemento. Sem isso, o custo do implemento vira
  órfão ou é lançado errado na tratora.
- 🆕 **Horímetro é uma segunda grandeza, não um substituto.** Unidade móvel de saúde tem
  **gerador**; ambulância avançada tem equipamento com hora de uso; carreta tem climatização. A
  manutenção desses itens é por **hora**, não por km. O ledger (§6.3) precisa aceitar
  `grandeza = 'odometro' | 'horimetro'` — mudança barata agora, refatoração cara depois.
- 🆕 **Unidade móvel especializada é um estabelecimento de saúde que anda.** Carreta da saúde da
  mulher, odontomóvel, oftalmomóvel: podem ter **CNES próprio**, licença sanitária, agenda de
  itinerância por distrito e equipe alocada. O SISFROTA deve guardar `cnes` no veículo e o
  **calendário de itinerância** — porque o "destino" dela não é uma viagem, é uma temporada.

**Consequência de escala:** com 200+ veículos em ~8 categorias funcionais, cadastro genérico não
serve. Cada categoria precisa de seu **checklist versionado** (§6.4), seu **plano de manutenção**
(§4.6) e sua **exigência de habilitação**. Isso reforça a decisão de tratar categoria como
**tabela de domínio**, nunca enum.

### 4.2 🆕 Contratos, empenhos e cotas — F1

O módulo que a v1 não tinha e que sustenta todo o controle:

- **Contratos** por tipo: combustível (ata de registro de preços ou cartão), manutenção, locação,
  seguro, pneus. Com vigência, valor total, saldo, nº do processo e empenhos vinculados.
- **Tabela de preços contratados** por item/combustível → permite detectar **sobrepreço** (posto
  cobrando acima da ata é a fraude mais comum e a mais fácil de provar).
- **Postos credenciados** como entidade: CNPJ, endereço, **coordenada + raio de geofence**,
  horário de funcionamento, contrato ao qual pertence.
- **Cotas** mensais por unidade / por veículo, em litros **e** em R$, com alerta em 80% e bloqueio
  configurável em 100%.

### 4.3 Solicitação, Ordem de Tráfego e diário de bordo — F1

- **Solicitação** (gestor de unidade): tipo, prioridade, janela de tempo, destino, nº de
  passageiros, justificativa.
- 🆕 **Ordem de Tráfego consolidada**: uma OT pode atender **N solicitações**. Isso permite a
  inovação de maior retorno financeiro imediato: **juntar pacientes de TFD com o mesmo destino
  na mesma van** em vez de mandar três carros para Belém na mesma semana. O despachante vê a fila
  por destino e data e consolida com um clique.
- **Roteiro com paradas** ordenadas (origem → paradas → destino → retorno).
- **Diário de bordo eletrônico**: saída/retorno com odômetro, horário e assinatura eletrônica do
  condutor. Amparo legal: Lei 14.063/2020 (assinatura eletrônica simples com trilha de auditoria
  é válida para documento interno da administração) e Decreto 10.278/2020. **Isso elimina o
  caderno de papel** — que é literalmente o que o TCE manda padronizar.

### 4.4 Abastecimento com evidência tripla — F1

Fluxo: pré-autorização (despachante) → abastecimento com evidência (motorista, no PWA) →
conciliação (sistema) → auditoria por exceção (coordenação).

Evidências, em ordem de força probatória:
1. 🆕 **Chave de acesso da NFC-e** lida do QR code (44 dígitos) — CNPJ do emitente, data, valor.
2. **Foto do cupom** (v1) — leitura humana e fallback de OCR.
3. **Foto do painel** com hodômetro e luzes-espia (v1) — OCR do hodômetro como pré-preenchimento.
4. 🆕 **Extrato do cartão de abastecimento**, se houver contrato — fonte independente do motorista.
5. **Geolocalização** no momento do registro, comparada ao geofence do posto.

🆕 **Fluxo de exceção obrigatório:** abastecimento emergencial na estrada, sem autorização prévia.
A v1 modelou `authorization_id UNIQUE` como se todo abastecimento tivesse autorização. Não tem —
e negar o registro faz o motorista abastecer e não registrar, que é o pior resultado possível.
Deve existir: registro sem autorização + justificativa obrigatória + **ratificação posterior**
pelo gestor, com destaque na auditoria.

### 4.5 🆕 Motor de detecção de anomalias — F2

O auditor humano não olha 400 abastecimentos por mês. Ele olha os 12 que o sistema marcou.
Regras iniciais, cada uma gerando registro em `frota_anomalias` com severidade:

| # | regra | severidade |
|---|---|---|
| 1 | litros abastecidos > capacidade do tanque | alta |
| 2 | consumo (km/l) fora da faixa estatística do modelo (±2σ) | média |
| 3 | odômetro menor que a última leitura confiável | alta |
| 4 | km rodado desde o último abastecimento incompatível com o tempo decorrido | média |
| 5 | GPS do registro fora do geofence do posto declarado | alta |
| 6 | chave de NFC-e repetida | **crítica** |
| 7 | CNPJ do cupom ≠ posto credenciado no contrato | **crítica** |
| 8 | preço/litro acima do preço contratado | alta |
| 9 | divergência entre hora do dispositivo e hora do servidor > limite | média |
| 10 | dois abastecimentos do mesmo veículo em janela curta | média |
| 11 | abastecimento fora do horário de funcionamento do posto | média |
| 12 | veículo abastecendo enquanto sem OT aberta | baixa |
| 13 | viagem encerrada sem odômetro de retorno | baixa |
| 14 | veículo sem nenhum registro há N dias (frota fantasma) | média |

Saída: **fila de auditoria** priorizada por severidade, com parecer do auditor registrado e
imutável. Score de risco agregado por veículo e por condutor — usado para direcionar fiscalização,
**nunca** para punição automática.

### 4.6 🆕 Manutenção — F2

- **Ordem de Serviço**: preventiva, corretiva, sinistro, revisão de garantia. Sintoma → diagnóstico
  → orçamento → aprovação → execução → baixa, com custo de peças e serviços separados, oficina
  (própria ou credenciada), odômetro na abertura e na baixa, e **tempo de veículo parado** (que
  alimenta o KPI de disponibilidade).
- **Planos preventivos** por modelo: item, intervalo em km **e** em dias — vence o que chegar
  primeiro. Gera pendência automática quando o odômetro projetado se aproxima.
- 🆕 **Integração com o checklist**: item crítico reprovado na vistoria **abre OS automaticamente**
  e coloca o veículo em `inoperante`. Sem essa ligação, o checklist vira teatro — o motorista
  marca "sirene não funciona" e nada acontece.
- **Garantia**: peça trocada tem prazo/km de garantia; nova falha no mesmo item dentro do prazo
  é sinalizada (evita pagar duas vezes pelo mesmo serviço).

#### 4.6.1 🆕 Manutenção por credenciamento — confirmado em 15/08/2026

A SMS terceiriza manutenção por **credenciamento** (várias oficinas habilitadas, não uma vencedora
única), e a liberação é do Sr. Elizeu. Isso é bom para o desenho — significa que já existe uma
rede formal com tabela de preços — e traz requisitos específicos:

- **Oficinas credenciadas como entidade**, com CNPJ, especialidade (mecânica, elétrica, funilaria,
  ar-condicionado, tacógrafo, socorro), situação do credenciamento e vigência. Credenciamento
  vencido **bloqueia** nova OS.
- **Tabela de preços/serviços credenciada** — o análogo do preço de ata no combustível. Permite a
  mesma detecção de sobrepreço, item a item, e é o que dá dente à fiscalização do contrato.
- 🆕 **Fluxo de orçamento com o mesmo espírito do portal do posto (§4.12):** a oficina lança o
  orçamento no sistema (peças + serviços + prazo), o Elizeu aprova ou recusa **dentro do sistema**,
  e a aprovação fica registrada com data, valor e responsável. Hoje isso circula por WhatsApp e
  papel, e some.
- 🆕 **Distribuição entre credenciadas.** Com vários habilitados, "quem recebe o serviço" é uma
  decisão discricionária recorrente — e é onde credenciamento costuma ser questionado. O sistema
  deve **registrar o critério** (proximidade, especialidade, prazo, rodízio) e produzir um
  **relatório de distribuição por oficina**: se 80% das OS vão para uma única credenciada, isso
  precisa aparecer sozinho, sem ninguém ter que procurar.
- 🆕 **Three-way match da manutenção**, análogo ao do combustível (§4.13):
  **OS autorizada × serviço executado e recebido × nota fiscal da oficina.** Inclui conferência de
  **peça trocada** (a antiga voltou? foi descartada?) — peça que sai da oficina "trocada" mas nunca
  foi trocada é a fraude clássica de manutenção terceirizada, e a foto da peça removida, anexada
  à OS, resolve boa parte disso.
- **Recebimento formal**: quem atesta que o serviço foi entregue não deveria ser quem autorizou —
  mesma lógica de segregação da §11.2.

### 4.7 🆕 Pneus — F3

Rubrica grande o bastante para ter produto próprio no mercado. Modelo mínimo: pneu como **ativo
individual** (número de fogo/DOT, marca, medida, vida: novo → recapagem 1 → 2 → descarte),
movimentações (montagem, posição no veículo, desmontagem, sulco medido, motivo), custo por km
de pneu e alerta de rodízio.

### 4.8 🆕 Multas, sinistros e responsabilização — F2

- **Infrações**: AIT, data/local, órgão autuador, valor, e — crítico — **prazo de indicação do
  condutor**. Pelo SNE (Sistema de Notificação Eletrônica da Senatran), o órgão recebe a
  notificação digitalmente e a indicação do condutor é **obrigação legal**; perder o prazo
  transfere a multa (e a pontuação) para o órgão. Além disso, o SNE dá **40% de desconto** no
  pagamento sem defesa. Um alerta de prazo bem feito **se paga sozinho**.
  O SISFROTA cruza data/hora/local do AIT com a OT vigente e **sugere o condutor** automaticamente.
- **Sinistros**: BO, terceiros, franquia, laudo, fotos, situação do seguro, veículo indisponível.

### 4.9 🆕 Módulo Assistencial e TFD — F2 (o diferencial)

- **Processo TFD** por paciente: laudo médico, destino, unidade executante, acompanhante
  autorizado (Portaria 55/99 condiciona acompanhante a laudo), periodicidade do tratamento.
- **Manifesto de embarque**: quem embarcou, onde, a que horas, com CNS. Dado pessoal sensível —
  acesso restrito e retenção definida.
- 🆕 **Comprovante de comparecimento**: foto/assinatura da unidade de destino confirmando que o
  paciente compareceu. É a peça que fecha a prestação de contas do TFD e hoje se perde em papel.
- 🆕 **Ajuda de custo e diárias**: do paciente/acompanhante (Portaria 55/99: retorno no mesmo dia
  → só passagem e alimentação) e do motorista (saída/entrada do município, já modelada na v1 como
  evento de GPS — agora ligada ao cálculo).
- **Checklist de itens médicos** por tipo de ambulância, alinhado à **ABNT NBR 14561** (oxigênio,
  maca articulada, sinalização óptica/acústica, oxímetro, monitor com bateria, etc.).
- 🆕 **Logística fria**: para transporte de imunobiológicos e amostras, registro de temperatura
  na saída e na chegada, e vínculo com a licença sanitária do veículo.

### 4.10 🆕 Motor de alertas unificado — F1

Uma tabela, uma tela, um mecanismo de notificação — não cinco lógicas espalhadas. Alertas de:
CNH/curso vencendo, documento do veículo vencendo, manutenção preventiva vencida, cota em 80%,
contrato acabando, prazo de indicação de condutor, viagem sem retorno registrado, veículo parado
há N dias, registro pendente de sincronização há N dias.

🆕 **Canal:** reusar o webhook de **WhatsApp** que o SisEscala já tem. Motorista não abre e-mail;
abre WhatsApp. Zero infraestrutura nova.

### 4.11 🆕 Portal de transparência público — F3

Página pública, sem login, com consumo agregado da frota da saúde: veículos por categoria, km
rodado, litros, custo por unidade. É o que o Tribunal de Contas quer ver, custa pouco (uma view
materializada e uma rota), e transforma um sistema de controle interno em ativo político para a
Secretaria. **Nenhum dado pessoal, nenhuma placa vinculada a paciente.**

### 4.12 🆕 Portal do Posto Credenciado — F2 (novo perfil, alto impacto)

Como a SMS opera por **requisição**, a requisição em papel é hoje o ponto mais frágil da cadeia:
talão que some, requisição em branco já assinada, valor alterado depois de emitida, requisição
usada duas vezes. Digitalizar a requisição sem envolver o posto resolve metade do problema.

**Proposta:** requisição digital com **código verificador + QR**, e uma tela mínima para o posto:

1. Despachante emite a requisição no SISFROTA → gera código (ex.: `REQ-2026-08-004312`) + QR.
2. Motorista chega ao posto e mostra o QR na tela do celular (**ou lê o número em voz alta** — o
   fluxo tem que funcionar com celular sem bateria, ver §8.4).
3. O frentista/caixa abre o portal do posto, consulta o código e vê: veículo, placa, combustível
   autorizado, **limite em litros e R$**, validade. Não vê mais nada da frota.
4. Ao concluir, o posto **baixa a requisição** informando litros, valor e número do cupom.
5. Essa baixa é gravada com carimbo do servidor e **é independente do registro do motorista**.

Ganhos: acaba a requisição reutilizada (o sistema baixa e fecha), acaba o valor adulterado,
e o gestor sabe **no mesmo dia** o que foi consumido — não no fim do mês.

⚠️ **Requisito de realidade:** posto sem internet, sem interesse ou sem gente treinada é
cenário provável, e o sistema não pode travar por isso. Portanto o portal é **camada de reforço,
não dependência**: se o posto não baixar, o fluxo segue pelo cupom + foto, e a requisição fica
`aguardando_baixa_posto`, o que **por si só é um indicador** — posto que nunca baixa merece
atenção da fiscalização do contrato.

### 4.13 🆕 Conciliação da fatura do posto (three-way match) — F3

Controle clássico de compras públicas, hoje quase sempre feito à mão sobre pilha de papel.
Três vias que precisam bater:

| via | origem | o que afirma |
|---|---|---|
| **1. Requisição autorizada** | SISFROTA / despachante | o que a SMS *autorizou* gastar |
| **2. Abastecimento registrado** | motorista (PWA) + baixa do posto + NFC-e | o que *aconteceu* na bomba |
| **3. Item da fatura mensal** | nota fiscal do posto para pagamento | o que o posto está *cobrando* |

O sistema importa a fatura (CSV/XML da NF-e, ou digitação assistida), casa item a item pela chave
da NFC-e e devolve **apenas as divergências**:

- item faturado **sem** requisição correspondente → cobrança indevida;
- requisição baixada **sem** item na fatura → abastecimento não cobrado (ou registro falso);
- valor/litros divergentes entre as três vias;
- preço acima do contratado;
- item faturado **fora da vigência** do contrato ou **sem saldo de empenho**.

O produto final é um **parecer de conformidade da fatura**, com anexo de evidências, que o
ordenador de despesa assina antes do pagamento. É provavelmente o entregável de maior valor
percebido pelo controle interno em todo o sistema — porque é o único ponto onde o sistema
**impede** um pagamento errado, em vez de documentá-lo.

### 4.14 🆕 SAMU e urgência — escopo deliberadamente limitado — F4

A SMS gerencia uma base do SAMU. **O SISFROTA não deve tocar no despacho de urgência.** Quem
decide qual ambulância sai é o **médico regulador** da Central de Regulação das Urgências, com
sistema e protocolo próprios. Tentar duplicar isso cria conflito operacional, risco assistencial e
um sistema que ninguém usa.

**O que o SISFROTA cobre para o SAMU (retaguarda de frota):**
abastecimento, manutenção, pneus, documentação, km rodado por plantão, checklist de troca de
plantão, custo por veículo e conformidade do condutor socorrista.

**O que fica de fora:** acionamento, regulação, ocorrência, dado clínico do paciente.

⚠️ **Três adaptações que a urgência impõe e que quebram regras gerais do sistema:**

1. **Checklist é por plantão, não por viagem.** Ambulância de urgência faz 8 saídas num turno;
   ninguém preenche checklist 8 vezes. O modelo precisa de `escopo = 'viagem' | 'plantao' | 'diario'`.
2. **Requisição prévia de abastecimento é inviável na urgência.** A ambulância sai correndo. Para
   veículos marcados como `regime_urgencia`, o fluxo de exceção (§4.4) **é o fluxo normal**:
   autorização permanente com cota por plantão e ratificação posterior — nunca bloqueio.
3. **Checklist reprovado não pode travar saída de urgência.** Item crítico reprovado abre OS e
   sinaliza, mas o condutor precisa de **override com justificativa registrada**. Segurança do
   paciente vence controle patrimonial — e o registro do override é justamente o que protege o
   servidor depois.

### 4.15 🆕 Telemetria plugável — F4, opcional

Tabela prevista, integração adiada. Se um dia houver contrato de rastreador/OBD-II, o odômetro
passa a ter uma fonte automática e a manutenção preditiva fica possível. **Não comprar hardware
na v1.** Só garantir que o ledger de odômetro (seção 6.3) já aceite `fonte = 'telemetria'`.

---

## 5. 🆕 O mecanismo que faz o sistema ser alimentado

O maior risco do SISFROTA não é técnico. É o motorista não registrar e o sistema virar uma base
vazia e bonita. A resposta não é treinamento — é **acoplar o registro a algo que o motorista quer**:

> **Nenhuma autorização de abastecimento é emitida para veículo com diário de bordo em atraso.**

O combustível é o incentivo. Quem não registra, não abastece. Simples, automático e verificável.
Esse gate deve ser configurável (com prazo de tolerância e exceção de emergência registrada), mas
deve existir desde a F1 — é ele que garante a qualidade do dado que sustenta todo o resto.

Segundo mecanismo, para o gestor de unidade: **relatório de custo por unidade**. No momento em que
o custo do transporte aparece rateado por UBS, o gestor passa a se importar com o dado.

---

# PARTE III — ARQUITETURA E MODELO DE DADOS

## 6. Modelo de dados v2

### 6.1 Princípios

1. **Prefixo `frota_`** em todas as tabelas (ou schema `frota`, se opção A da seção 2.2).
2. **Não recriar pessoas e lugares**: `servidores`, `unidades`, `setores`, `profiles` vêm do núcleo.
3. **Evidência é append-only.** Nada que serve de prova pode sofrer UPDATE/DELETE.
4. **Três camadas, padrão SisEscala**: evidência bruta imutável → fato → juízo do gestor →
   projeção (cache reconstruível). Se a projeção diverge, ela é recalculada; a evidência nunca muda.
5. **Enum só para status curto e estável.** Tipo de evento, categoria de veículo e motivo de
   anomalia vão para **tabela de domínio** — a coordenação vai querer criar valores novos sem
   migration (`ALTER TYPE` em Postgres é dolorido e irreversível).
6. **Toda tabela de campo tem `client_uuid UNIQUE`**, `medido_em`, `recebido_em`.

### 6.2 Mapa de entidades

```
ESPELHO (import)    frota_pessoas_espelho · frota_unidades_espelho · frota_setores_espelho
   (§2.2 — origem no SisEscala, somente leitura, nunca editado aqui)

CADASTRO            frota_veiculos · frota_veiculo_conjuntos · frota_veiculo_documentos
                    frota_condutores · frota_condutor_habilitacoes
                    frota_oficinas · frota_postos · frota_posto_usuarios

CONTRATO            frota_contratos · frota_contrato_itens_preco · frota_empenhos
                    frota_cotas · frota_faturas · frota_fatura_itens · frota_conciliacoes

OPERAÇÃO            frota_solicitacoes · frota_ordens_trafego · frota_ot_solicitacoes
                    frota_ot_paradas · frota_diario_bordo

CAMPO (PWA)         frota_odometro_leituras · frota_abastecimento_autorizacoes
                    frota_abastecimentos · frota_evidencias · frota_eventos_operacionais
                    frota_checklist_modelos · frota_checklist_itens
                    frota_checklists · frota_checklist_respostas

MANUTENÇÃO          frota_planos_manutencao · frota_manutencao_pendencias
                    frota_os · frota_os_itens · frota_pneus · frota_pneu_movimentacoes

CONFORMIDADE        frota_infracoes · frota_sinistros · frota_alertas
                    frota_anomalias · frota_auditoria_log

ASSISTENCIAL        frota_tfd_processos · frota_passageiros · frota_diarias
                    frota_cadeia_fria · frota_itinerancias   (unidades móveis, §4.1.1)

FUTURO              frota_telemetria_leituras · frota_tanque_estoque
```

⚠️ Note que **não há `servidores` nem `unidades` próprias** — e também **não há FK do banco** para
elas, porque estão em outro Supabase. As tabelas `*_espelho` guardam `origem_id UUID` (o UUID no
SisEscala) e a integridade é mantida por processo de sincronização + tela de reconciliação, não
por constraint. Esse é o custo explícito da decisão de bancos separados (§2.2), e ele deve ficar
visível no schema para ninguém supor garantia que não existe.

### 6.3 🆕 DDL das peças novas e críticas

Só as que mudam o desenho. As demais seguem o padrão da v1, com os ajustes de `client_uuid`,
`medido_em`/`recebido_em` e FK para `servidores`/`unidades`.

```sql
-- ─────────────────────────────────────────────────────────────
-- ESPELHO DE CADASTRO  (§2.2 — origem: SisEscala, outro Supabase)
-- Somente escrito pelo job de sincronização. Nunca editado na UI.
-- ─────────────────────────────────────────────────────────────
CREATE TYPE espelho_situacao AS ENUM ('ativo', 'inativo', 'origem_ausente');

CREATE TABLE frota_pessoas_espelho (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    origem_id       UUID UNIQUE NOT NULL,      -- UUID do servidor no SisEscala
    matricula       VARCHAR(20),
    nome            VARCHAR(150) NOT NULL,
    cpf             VARCHAR(14),
    unidade_origem_id UUID,                    -- referência lógica, não FK
    situacao        espelho_situacao NOT NULL DEFAULT 'ativo',
    origem_hash     TEXT,                      -- detecta mudança sem comparar campo a campo
    sincronizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE frota_unidades_espelho (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    origem_id       UUID UNIQUE NOT NULL,
    nome            VARCHAR(150) NOT NULL,
    tipo            VARCHAR(50),               -- UBS, hospital, CAPS, vigilância, ...
    cnes            VARCHAR(10),
    situacao        espelho_situacao NOT NULL DEFAULT 'ativo',
    origem_hash     TEXT,
    sincronizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- frota_setores_espelho: mesmo formato.
-- Registro que some na origem vira 'origem_ausente' — NUNCA é deletado,
-- porque viagens e abastecimentos históricos apontam para ele.

-- ─────────────────────────────────────────────────────────────
-- LEDGER DE MEDIDORES  (substitui o trigger frágil da v1)
-- Odômetro E horímetro no mesmo ledger — §4.1.1 (geradores de
-- unidade móvel, equipamento de ambulância, climatização de carreta)
-- ─────────────────────────────────────────────────────────────
CREATE TYPE medidor_grandeza AS ENUM ('odometro_km', 'horimetro_h');

CREATE TYPE medidor_fonte AS ENUM (
    'checklist', 'abastecimento', 'evento', 'diario_bordo',
    'ordem_servico', 'ajuste_manual', 'assistido', 'telemetria'
);

CREATE TABLE frota_medidor_leituras (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_uuid     UUID UNIQUE,                    -- idempotência do sync offline
    veiculo_id      UUID NOT NULL REFERENCES frota_veiculos(id),
    grandeza        medidor_grandeza NOT NULL DEFAULT 'odometro_km',
    valor           NUMERIC(12,2) NOT NULL CHECK (valor >= 0),
    fonte           medidor_fonte NOT NULL,
    origem_tabela   TEXT,                           -- de onde veio
    origem_id       UUID,
    medido_em       TIMESTAMPTZ NOT NULL,           -- relógio do DISPOSITIVO (não confiável)
    recebido_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
    registrado_por  UUID REFERENCES frota_pessoas_espelho(id),
    digitado_por    UUID REFERENCES frota_pessoas_espelho(id),  -- ≠ registrado_por quando assistido
    -- juízo do sistema/gestor sobre a leitura — NUNCA apaga a leitura
    confiavel       BOOLEAN NOT NULL DEFAULT TRUE,
    anomalia        TEXT,                           -- 'regressao', 'salto_improvavel', ...
    parecer_gestor  TEXT,
    parecer_por     UUID REFERENCES frota_pessoas_espelho(id),
    parecer_em      TIMESTAMPTZ
);

CREATE INDEX ON frota_medidor_leituras (veiculo_id, grandeza, medido_em DESC);

-- append-only: bloqueia DELETE e restringe UPDATE às colunas de parecer
CREATE OR REPLACE FUNCTION fn_medidor_imutavel() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'frota_medidor_leituras é append-only';
    END IF;
    IF NEW.valor IS DISTINCT FROM OLD.valor
       OR NEW.grandeza IS DISTINCT FROM OLD.grandeza
       OR NEW.medido_em IS DISTINCT FROM OLD.medido_em
       OR NEW.veiculo_id IS DISTINCT FROM OLD.veiculo_id THEN
        RAISE EXCEPTION 'leitura não pode ser alterada; registre nova leitura';
    END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_medidor_imutavel
BEFORE UPDATE OR DELETE ON frota_medidor_leituras
FOR EACH ROW EXECUTE FUNCTION fn_medidor_imutavel();

-- troca de painel/hodômetro: offset em vez de reescrever história
CREATE TABLE frota_hodometro_trocas (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    veiculo_id    UUID NOT NULL REFERENCES frota_veiculos(id),
    trocado_em    TIMESTAMPTZ NOT NULL,
    km_antes      INT NOT NULL,   -- última leitura do painel antigo
    km_depois     INT NOT NULL,   -- primeira leitura do painel novo
    offset_km     INT GENERATED ALWAYS AS (km_antes - km_depois) STORED,
    documento_url TEXT,           -- nota da oficina
    registrado_por UUID REFERENCES frota_pessoas_espelho(id)
);

-- odômetro "atual" = maior medido_em confiável, corrigido por offset.
-- É uma FUNÇÃO, não uma coluna mutável. A coluna em frota_veiculos é cache.
CREATE OR REPLACE FUNCTION fn_odometro_atual(p_veiculo UUID)
RETURNS NUMERIC LANGUAGE sql STABLE AS $$
    SELECT l.valor + COALESCE((
        SELECT SUM(t.offset_km) FROM frota_hodometro_trocas t
        WHERE t.veiculo_id = p_veiculo AND t.trocado_em <= l.medido_em), 0)
    FROM frota_medidor_leituras l
    WHERE l.veiculo_id = p_veiculo
      AND l.grandeza = 'odometro_km'
      AND l.confiavel
    ORDER BY l.medido_em DESC, l.recebido_em DESC
    LIMIT 1;
$$;

-- ─────────────────────────────────────────────────────────────
-- ABASTECIMENTO  (o fato) + EVIDÊNCIAS (n fotos/documentos tipados)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE frota_abastecimentos (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_uuid         UUID UNIQUE NOT NULL,          -- idempotência
    autorizacao_id      UUID REFERENCES frota_abastecimento_autorizacoes(id), -- NULLABLE: emergência
    sem_autorizacao_justificativa TEXT,
    ratificado_por      UUID REFERENCES frota_pessoas_espelho(id),
    ratificado_em       TIMESTAMPTZ,

    veiculo_id          UUID NOT NULL REFERENCES frota_veiculos(id),
    condutor_id         UUID NOT NULL REFERENCES frota_condutores(id),
    posto_id            UUID REFERENCES frota_postos(id),
    contrato_id         UUID REFERENCES frota_contratos(id),

    odometro_km         INT NOT NULL,
    litros              NUMERIC(7,3) NOT NULL CHECK (litros > 0),
    preco_litro         NUMERIC(8,3) NOT NULL,
    valor_total         NUMERIC(10,2) NOT NULL,
    tanque_cheio        BOOLEAN NOT NULL DEFAULT TRUE,  -- consumo só é calculável entre tanques cheios

    nfce_chave          VARCHAR(44),                    -- QR code do cupom
    nfce_validada_em    TIMESTAMPTZ,
    nfce_cnpj_emitente  VARCHAR(14),

    latitude            NUMERIC(10,7),
    longitude           NUMERIC(10,7),
    precisao_gps_m      NUMERIC(6,1),

    medido_em           TIMESTAMPTZ NOT NULL,           -- relógio do dispositivo
    recebido_em         TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- projeção (cache) — recalculável, nunca fonte de verdade
    km_desde_anterior   INT,
    consumo_kml         NUMERIC(6,2),

    UNIQUE (nfce_chave)                                  -- cupom não se usa duas vezes
);

CREATE TABLE frota_evidencias (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_uuid   UUID UNIQUE,
    entidade      TEXT NOT NULL,      -- 'abastecimento' | 'checklist' | 'evento' | 'os' | 'sinistro'
    entidade_id   UUID NOT NULL,
    tipo          TEXT NOT NULL,      -- 'cupom' | 'painel' | 'avaria' | 'comprovante' | 'nota'
    storage_path  TEXT NOT NULL,
    sha256        TEXT NOT NULL,      -- integridade: a foto no bucket é a foto enviada
    exif_lat      NUMERIC(10,7),      -- extraído no servidor...
    exif_lng      NUMERIC(10,7),
    exif_datahora TIMESTAMPTZ,        -- ...e então o EXIF é removido do arquivo
    contem_dado_sensivel BOOLEAN DEFAULT FALSE,  -- LGPD: foto que pode conter paciente
    enviado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- CONTRATO / COTA — o freio orçamentário
-- ─────────────────────────────────────────────────────────────
CREATE TABLE frota_cotas (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competencia   DATE NOT NULL,                   -- 1º dia do mês
    unidade_id    UUID REFERENCES frota_unidades_espelho(id),
    veiculo_id    UUID REFERENCES frota_veiculos(id),
    contrato_id   UUID REFERENCES frota_contratos(id),
    litros_cota   NUMERIC(10,2),
    valor_cota    NUMERIC(12,2),
    alerta_pct    INT NOT NULL DEFAULT 80,
    bloqueia_em_100 BOOLEAN NOT NULL DEFAULT FALSE,
    CHECK (unidade_id IS NOT NULL OR veiculo_id IS NOT NULL)
);

-- ─────────────────────────────────────────────────────────────
-- REQUISIÇÃO DIGITAL + BAIXA PELO POSTO (§4.12)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE frota_abastecimento_autorizacoes
    ADD COLUMN codigo_verificador VARCHAR(24) UNIQUE NOT NULL,  -- vai no QR e é legível em voz alta
    ADD COLUMN valido_ate         TIMESTAMPTZ NOT NULL,
    ADD COLUMN baixado_pelo_posto_em TIMESTAMPTZ,
    ADD COLUMN baixa_posto_usuario_id UUID REFERENCES frota_posto_usuarios(id),
    ADD COLUMN baixa_litros       NUMERIC(7,3),
    ADD COLUMN baixa_valor        NUMERIC(10,2),
    ADD COLUMN baixa_cupom_numero VARCHAR(30);
-- Requisição sem baixa após o vencimento fica 'aguardando_baixa_posto':
-- é indicador de fiscalização do contrato, não erro do sistema (§4.12).

-- ─────────────────────────────────────────────────────────────
-- CONCILIAÇÃO DE FATURA — three-way match (§4.13)
-- ─────────────────────────────────────────────────────────────
CREATE TYPE conciliacao_resultado AS ENUM (
    'conforme',
    'faturado_sem_requisicao',
    'requisicao_sem_faturamento',
    'divergencia_valor',
    'divergencia_litros',
    'preco_acima_contrato',
    'fora_vigencia_contrato',
    'sem_saldo_empenho'
);

CREATE TABLE frota_faturas (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    posto_id      UUID NOT NULL REFERENCES frota_postos(id),
    contrato_id   UUID NOT NULL REFERENCES frota_contratos(id),
    competencia   DATE NOT NULL,
    nfe_chave     VARCHAR(44),
    valor_total   NUMERIC(12,2) NOT NULL,
    arquivo_path  TEXT,
    importada_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
    parecer       TEXT,
    parecer_por   UUID REFERENCES frota_pessoas_espelho(id),
    parecer_em    TIMESTAMPTZ,
    UNIQUE (posto_id, competencia)
);

CREATE TABLE frota_fatura_itens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fatura_id       UUID NOT NULL REFERENCES frota_faturas(id) ON DELETE CASCADE,
    nfce_chave      VARCHAR(44),
    placa_declarada VARCHAR(10),
    data_declarada  TIMESTAMPTZ,
    litros          NUMERIC(7,3),
    preco_litro     NUMERIC(8,3),
    valor           NUMERIC(10,2) NOT NULL,
    -- resultado do casamento a três vias
    abastecimento_id UUID REFERENCES frota_abastecimentos(id),
    autorizacao_id   UUID REFERENCES frota_abastecimento_autorizacoes(id),
    resultado        conciliacao_resultado,
    diferenca_valor  NUMERIC(10,2)
);

-- ─────────────────────────────────────────────────────────────
-- ANOMALIAS — fila de auditoria por exceção
-- ─────────────────────────────────────────────────────────────
CREATE TYPE anomalia_severidade AS ENUM ('baixa','media','alta','critica');
CREATE TYPE anomalia_status     AS ENUM ('aberta','em_analise','justificada','confirmada','descartada');

CREATE TABLE frota_anomalias (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    regra         TEXT NOT NULL,                   -- 'litros_acima_tanque', 'nfce_duplicada', ...
    severidade    anomalia_severidade NOT NULL,
    entidade      TEXT NOT NULL,
    entidade_id   UUID NOT NULL,
    veiculo_id    UUID REFERENCES frota_veiculos(id),
    condutor_id   UUID REFERENCES frota_condutores(id),
    detalhe       JSONB NOT NULL,                  -- valores que dispararam a regra
    status        anomalia_status NOT NULL DEFAULT 'aberta',
    parecer       TEXT,
    parecer_por   UUID REFERENCES frota_pessoas_espelho(id),
    parecer_em    TIMESTAMPTZ,
    detectada_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- TRILHA DE AUDITORIA — append-only com encadeamento de hash
-- (mesmo espírito de rep_afd_registros no SisEscala)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE frota_auditoria_log (
    id            BIGSERIAL PRIMARY KEY,
    ocorrido_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
    ator_id       UUID REFERENCES frota_pessoas_espelho(id),
    ator_papel    TEXT,
    acao          TEXT NOT NULL,        -- 'autorizou_abastecimento', 'aprovou_os', ...
    entidade      TEXT NOT NULL,
    entidade_id   UUID,
    dados_antes   JSONB,
    dados_depois  JSONB,
    ip            INET,
    hash_anterior TEXT,
    hash_atual    TEXT NOT NULL
);
```

### 6.4 Checklist versionado — correção do JSONB livre da v1

`itens_conformes JSONB` sem esquema torna relatório histórico impossível (o formulário muda e o
dado antigo perde sentido). Modelo correto: `frota_checklist_modelos` (por categoria de veículo,
**versionado**) → `frota_checklist_itens` (rótulo, tipo de resposta, **crítico sim/não**) →
`frota_checklists` (execução, referenciando `modelo_versao`) → `frota_checklist_respostas`.

Item **crítico** reprovado ⇒ veículo vai a `inoperante` e abre OS automaticamente.

---

## 7. Perfis, RBAC e RLS

### 7.1 Matriz de permissão

| Recurso | admin_frota | despachante | gestor_unidade | motorista | oficina | auditor 🆕 | posto 🆕 |
|---|---|---|---|---|---|---|---|
| Cadastros (veículo/condutor) | CRUD | leitura | leitura | — | leitura | leitura | — |
| Contratos, cotas, faturas | CRUD | leitura | leitura da sua | — | — | leitura | — |
| Solicitação de veículo | CRUD | CRUD | CRUD (sua unidade) | — | — | leitura | — |
| Ordem de Tráfego | CRUD | CRUD | leitura da sua | leitura das suas | — | leitura | — |
| Autorização de abastecimento | CRUD | criar | — | leitura da sua | — | leitura | **consultar por código + baixar** |
| Registro de abastecimento | leitura | leitura | — | **criar (só a sua)** | — | leitura | — |
| Checklist / eventos | leitura | leitura | leitura da sua | **criar (só o seu)** | leitura | leitura | — |
| Lançamento assistido (§8.4) | criar | **criar** | criar (sua unidade) | — | — | leitura | — |
| Ordem de Serviço | CRUD | leitura | leitura | leitura | CRUD (a sua oficina) | leitura | — |
| Fila de anomalias | CRUD | leitura | — | — | — | **CRUD** | — |
| Trilha de auditoria | leitura | — | — | — | — | leitura | — |
| Dados de passageiro/TFD | restrito | restrito | sua unidade | manifesto da sua viagem | — | restrito | — |

🆕 **Papel `posto_credenciado`** (§4.12) é o mais sensível do sistema, porque é **externo à
prefeitura**. Escopo mínimo absoluto: consulta **por código verificador** (nunca listagem de
requisições), só do próprio CNPJ, só dentro da validade, e baixa apenas da requisição consultada.
Rate limit obrigatório — sem ele, o campo `codigo_verificador` vira alvo de força bruta. Nenhum
acesso a placa fora da requisição, a motorista, a paciente ou a qualquer dado da frota.

🆕 **Papel `auditor`**: separado de `admin_frota`. Segregação de funções é exigência explícita
dos Tribunais de Contas — quem opera não pode ser quem audita. Auditor tem leitura ampla e
escrita **apenas** em parecer de anomalia.

⚠️ **`oficina_mecanica` pode ser usuário externo à prefeitura.** RLS restritiva e obrigatória:
enxerga só as OS da própria oficina, nunca a frota inteira, nunca dado de paciente.

### 7.2 Regras de RLS

- Toda tabela com RLS habilitada e **política default DENY**.
- `motorista`: linhas onde `condutor_id` = seu próprio; INSERT apenas com `condutor_id` = si mesmo.
- `gestor_unidade`: linhas cuja `unidade_id` esteja na sua lotação (reusar a lógica de escopo por
  unidade que o SisEscala já tem).
- Tabelas de evidência e auditoria: **nenhum papel** tem UPDATE/DELETE via API; só `service_role`
  em rotinas específicas — mesmo padrão de `fn_ingerir_afd` no SisEscala, que é `GRANT`ada
  exclusivamente a `service_role`.
- Dados de passageiro (`frota_passageiros`, `frota_tfd_processos`): política adicional, log de
  acesso em `frota_auditoria_log` inclusive para leitura.

---

## 8. 🆕 Arquitetura offline-first — o contrato de sincronização

A v1 disse "IndexedDB com sincronização automática". Isso não é especificação. O que precisa
estar definido antes de escrever a primeira linha:

### 8.1 Regras

1. **Toda entidade de campo nasce com UUID no cliente.** O servidor aceita ou rejeita, nunca
   renumera. `client_uuid UNIQUE` faz o retry ser inofensivo.
2. **Fila persistente com backoff**, sobrevivendo a fechar o app e reiniciar o telefone.
3. **Foto vai separada do registro**, comprimida no cliente (alvo ≤ 300 KB, lado maior 1600 px) e
   enviada em upload retomável. Registro sem foto sincronizada fica `pendente_evidencia` — visível
   para o motorista, não para o relatório.
4. **Dois carimbos de tempo sempre** (`medido_em` / `recebido_em`), e divergência vira anomalia.
5. **Resolução de conflito: o servidor não perde dado.** Registro duplicado por `client_uuid` é
   ignorado; registro conflitante (mesmo veículo, mesmo minuto, motoristas diferentes) vira
   anomalia para humano decidir. **Nunca "último a chegar vence".**
6. **Indicador permanente de pendências** no PWA: "3 registros aguardando envio". O motorista tem
   que saber que o dado ainda não chegou.

### 8.2 ⚠️ Armadilha do iOS que precisa estar no plano

- Safari/iOS **descarta IndexedDB de PWA após ~7 dias sem uso** do site. Um abastecimento
  registrado offline na sexta pode não existir mais depois de férias.
- **Background Sync API não existe no iOS.** Sincronização "em segundo plano" no iPhone é ficção:
  só sincroniza com o app aberto.
- Notificação push em PWA no iOS só a partir do 16.4 e **apenas se instalado na tela de início**.

**Mitigações:** sincronizar de forma agressiva a cada abertura; badge visível de pendências;
alerta ativo (WhatsApp) quando um registro passar de N horas pendente; e, para iPhone,
**tratar o registro como não confiável enquanto não sincronizar** — nunca prometer ao motorista
que o dado está "salvo".

### 8.3 ⚠️ Celular pessoal — a restrição mais séria do projeto

**Confirmado: o aparelho é do motorista.** Isso não é um detalhe de infraestrutura, é uma
restrição de produto que atravessa técnica, jurídico e relação de trabalho. O que ela implica:

**Técnico**
- **Dados móveis são pagos pelo servidor.** Foto sem compressão é dinheiro do bolso dele. Alvo:
  ≤ 300 KB/foto, ≤ 5 MB/dia por motorista. Opção "enviar fotos só no Wi-Fi" **ligada por padrão**,
  com botão explícito de "enviar agora pelos dados" — e o registro textual (que é leve) sempre
  sincronizando na hora.
- **Aparelho fraco e cheio é o caso comum**, não a exceção. O PWA precisa caber em pouca RAM,
  pouco storage e Android antigo. Sem WebGL, sem mapa pesado no PWA, sem OCR local rodando em
  imagem grande (fazer OCR no servidor).
- **Bateria**: nada de GPS contínuo (a v1 já acertou aqui), nada de service worker acordando o
  tempo todo.
- **Aparelho pode ser trocado, formatado, perdido ou vendido a qualquer momento.** Portanto:
  **nunca** deixar registro só no dispositivo por mais de um turno, e limpar foto do cache local
  logo após confirmação de upload.

**Jurídico e LGPD**
- Dado da SMS (inclusive foto que pode conter **paciente**) passa a residir em dispositivo
  particular. Isso exige: **termo de uso e ciência assinado** pelo motorista, retenção local
  mínima, e limpeza automática. Convém uma consulta ao jurídico/procuradoria antes do go-live —
  registrar isso como pendência formal, não como detalhe.
- Exigir instalação de app da prefeitura em telefone pessoal, sem ressarcimento, é ponto passível
  de questionamento sindical. O fato de ser **PWA** (não app de loja, sem acesso a contatos, sem
  rastreamento em background) reduz muito a fricção — vale ser dito explicitamente ao motorista.

**Recomendação que mantenho, mesmo com a decisão tomada:** não são necessários 200 aparelhos.
Um **tablet ou celular funcional por base/garagem/plantão** (talvez 10–20 aparelhos) cobre o modo
assistido (§8.4) e serve de rede de segurança para quem não tem smartphone adequado, se recusa a
usar o próprio, ou está com o aparelho quebrado. É um custo pequeno que elimina a dependência
total do dispositivo pessoal — e sem essa rede de segurança, o motorista sem celular
simplesmente não registra, e ele é justamente o caso que mais interessa auditar.

### 8.4 🆕 Modo assistido e degradação graciosa — F1, obrigatório

Como o aparelho é pessoal, **todo fluxo do PWA precisa de um caminho alternativo** operado por
outra pessoa. Sem isso, o sistema tem cobertura de 80% e um buraco permanente:

| situação | caminho alternativo |
|---|---|
| Motorista sem smartphone / bateria acabada | **Lançamento assistido** pelo despachante ou controlador de portaria no desktop, com o registro marcado `origem = 'assistido'` e o servidor que digitou identificado |
| Celular sem câmera boa / foto ilegível | Evidência pendente com prazo; requisição seguinte bloqueada até regularizar |
| Sem sinal na volta da viagem | Fila offline (§8.1); se passar de N horas, alerta ao gestor |
| Aparelho não instala PWA (iOS antigo, Android 6) | Página web simples, sem offline, para uso na base com Wi-Fi |
| QR da requisição não abre no posto | Código alfanumérico legível em voz alta (§4.12) |

⚠️ **Registro assistido é sempre marcado como tal e entra na estatística.** Uma unidade com 90%
de lançamento assistido não está usando o sistema — está usando o despachante como digitador, e
o dado perde a qualidade de evidência (não foi quem estava no posto que registrou). Esse
percentual deve ser um **KPI de adoção** (§10.1), não um detalhe escondido.

---

## 9. 🆕 LGPD e conformidade

O SISFROTA trata três categorias de dado pessoal, com regimes diferentes:

| categoria | exemplos | base legal | cuidado |
|---|---|---|---|
| Servidor/condutor | CPF, CNH, geolocalização de evento, foto | execução de política pública / obrigação legal (LGPD art. 7º, II e III; art. 23 para o poder público) | finalidade declarada, aviso ao titular, **sem rastreamento contínuo** |
| Paciente TFD | nome, CNS, condição de saúde implícita, destino | **dado sensível de saúde** (art. 11) — tutela da saúde | acesso mínimo, retenção definida, log de acesso |
| Terceiros em fotos | rosto em foto de avaria/sinistro | legítimo interesse com minimização | orientação ao motorista; borrar quando possível |

**Pontos de ação:**
- **RIPD** (Relatório de Impacto) antes do go-live — praticamente obrigatório pela combinação
  "poder público + dado de saúde + geolocalização".
- **Política de retenção explícita** por tabela. Evidência de abastecimento acompanha o prazo de
  guarda de documento de prestação de contas (checar com o controle interno; costuma ser 5–10
  anos). Foto com paciente deve ter prazo **menor**.
- **Aviso de privacidade dentro do PWA**, na primeira execução, dizendo exatamente o que é
  coletado: "sua localização é registrada apenas quando você toca em registrar um evento".
  A escolha da v1 (evento pontual) torna esse aviso honesto e curto — vantagem real.
- Se um dia entrar telemetria contínua, **a base legal muda** e o RIPD precisa ser refeito.

---

## 10. 🆕 Indicadores e relatórios

### 10.1 KPIs (fase 2, quando houver 3 meses de dado)

| indicador | fórmula | meta de referência |
|---|---|---|
| **CPK** — custo por km | (combustível + manutenção + pneus + seguro + depreciação) ÷ km | por categoria |
| **Consumo** km/l | km entre tanques cheios ÷ litros | faixa ±2σ por modelo |
| **Disponibilidade** | veículos aptos ÷ frota total | > 90% |
| **% preventiva** | OS preventivas ÷ total de OS | > 70% |
| **MTBF** | horas/km operados ÷ nº de falhas | crescente |
| **TCO** por veículo | custo acumulado + depreciação | decisão de renovação |
| 🆕 **Custo por paciente transportado (TFD)** | custo da viagem ÷ passageiros | ↓ com consolidação |
| 🆕 **Taxa de ocupação da van TFD** | passageiros ÷ lugares | > 70% |
| 🆕 **Cobertura de registro** | viagens com diário completo ÷ viagens | > 95% (adoção) |
| 🆕 **% de lançamento assistido** | registros `origem='assistido'` ÷ total | < 20% (§8.4) |
| 🆕 **% de requisições baixadas pelo posto** | baixas ÷ requisições emitidas | > 80% (§4.12) |
| 🆕 **Divergência de fatura** | valor divergente ÷ valor faturado | ↓ (§4.13) |
| 🆕 **Tempo até resposta** | solicitação → OT emitida | por prioridade |

O "custo por paciente transportado" é o indicador que traduz frota em **linguagem de saúde
pública** — é ele que sustenta o orçamento numa reunião de conselho municipal.

### 10.2 Relatórios de prestação de contas

Exportáveis em PDF e CSV, com filtro por competência:
diário de bordo por veículo · relatório de abastecimento (o item que o TCE cita nominalmente) ·
**relação de veículos próprios, locados e cedidos** (idem) · custo por veículo, por unidade e por
categoria · manutenções e disponibilidade · infrações e responsabilização · prestação de contas
de TFD · consumo de veículo de emenda parlamentar (relatório separado, exigido pelo FNS).

---

# PARTE IV — EXECUÇÃO

## 11. 🆕 Roadmap faseado

Cada fase entrega valor sozinha. **Nenhuma fase avança sem critério de saída medido** — prática
copiada do SisEscala, onde as fases têm portão explícito e piloto real.

### 11.0 🆕 Fase −1: o censo da frota (antes de qualquer código de produto)

Com **200+ veículos**, o cadastro deixa de ser tela e vira **projeto**. Quase certamente a base
atual é planilha com dados sujos: veículos baixados ainda listados, placas repetidas, RENAVAM
faltando, veículo que trocou de secretaria, locado que venceu o contrato, implemento sem tratora.
Começar a construir sobre esse dado é garantir retrabalho.

Entregas da fase: importador CSV com validação (placa, RENAVAM, chassi), tela de conciliação de
divergências, **inventário físico** (alguém vê o veículo, fotografa, confere odômetro e cola o
**QR de identificação**), e classificação por categoria funcional / propriedade / origem de recurso.

**Critério de saída:** 100% da frota com placa, RENAVAM, categoria, propriedade, unidade de
lotação e odômetro inicial conferidos **fisicamente**, e a lista batendo com o patrimônio.
Esse número é o marco zero de tudo que o sistema vai afirmar depois.

| Fase | Entrega | Critério de saída |
|---|---|---|
| **−1. Censo da frota** ⏩ *roda em paralelo à atualização do SisEscala* | importador, conciliação, inventário físico, QR nos veículos | 200+ veículos conferidos fisicamente, batendo com patrimônio |
| **0.a No SisEscala** 🆕 | `atualizado_em` + trigger, tombstone (`situacao`), rota `/api/diretorio/v1/*` — **dentro da onda de atualização já em curso** (§2.2.2) | API respondendo com token e paginação; cadastro de servidores da SMS completo |
| **0.b Fundação do SisFrota** | schema base, **espelho de cadastro** (§2.2), auth própria (matrícula+PIN), RLS, layout | espelho sincronizando sozinho por 7 dias sem divergência; operador do dado nomeado no setor de transporte |
| **1. Diário de bordo digital** | PWA offline, solicitação → OT → saída/retorno, checklist versionado, ledger de medidores, **modo assistido (§8.4)** | 1 unidade-piloto rodando **em paralelo com o papel** por 30 dias, cobertura > 90%, assistido < 30% |
| **2. Abastecimento controlado** | requisição digital com QR, evidência (NFC-e + fotos), postos, contratos, cotas, **portal do posto (§4.12)**, gate "sem diário não abastece" | 100% dos abastecimentos da unidade-piloto no sistema, 0 duplicidade, ≥ 1 posto baixando requisição |
| **3. Auditoria por exceção** | motor de anomalias, fila de auditoria, papel auditor, trilha de hash, **conciliação de fatura (§4.13)**, relatórios TCE | auditor fecha o mês olhando só a fila; primeira fatura conciliada antes do pagamento |
| **4. Manutenção e conformidade** | OS, planos preventivos, oficinas, documentos, alertas, WhatsApp | preventiva > 50% |
| **5. Assistencial e TFD** | processos TFD, manifesto, comprovante de comparecimento, ajuda de custo, consolidação de viagens | primeira viagem consolidada com economia medida |
| **6. Maturidade** | KPIs, portal de transparência, pneus, sinistros, **SAMU como retaguarda (§4.14)** | painel usado na reunião mensal da SMS |
| **7. Opcional** | telemetria, tanque próprio, itinerância de unidades móveis | só com contrato/demanda existente |

### 11.0.1 🆕 Como fazer o censo (método, não intenção)

Confirmado pela SMS: **nunca houve levantamento sério da frota**; o controle é planilha
fragmentada e mal estruturada, e ninguém sabe dizer exatamente o que existe. Isso foi, inclusive,
um dos motivadores do pedido do sistema. Então o censo deixa de ser pré-requisito chato e vira
**a primeira entrega de valor visível** — antes de qualquer tela de operação.

**Passo 1 — juntar as fontes de papel** (uma semana, sem código):
planilhas do setor de transporte · **relação patrimonial da prefeitura** (setor de patrimônio) ·
contratos de locação vigentes · apólices de seguro · termos de cessão/convênio e emendas ·
consulta RENAVAM/DETRAN-PA por CPF/CNPJ do órgão · notas de abastecimento dos últimos 3 meses
(veículo que abastece existe e roda — é a melhor prova de vida da frota).

**Passo 2 — cruzar e listar divergências.** As categorias que vão aparecer, e é bom já esperar
por elas: veículo na planilha e não no patrimônio · no patrimônio e não na planilha · placa
duplicada ou com dígito errado · veículo de outra secretaria rodando pela saúde (e vice-versa) ·
locado com contrato vencido · cedido que nunca foi devolvido · sucata ocupando pátio sem baixa
formal · veículo que ninguém sabe onde está.

**Passo 3 — inventário físico.** Uma dupla percorre garagens, unidades e distritos com um
formulário mobile simples: foto do veículo, foto do painel (odômetro/horímetro inicial), placa,
chassi visível, estado geral, **e cola o QR de identificação**. Rural exige planejamento à parte
— o veículo do distrito não vem até a sede só para ser fotografado.

**Passo 4 — relatório assinado de inventário da frota**, com o número final e a lista de
pendências (o que precisa de baixa, de regularização de cessão, de devolução).

⚠️ **Este relatório é o entregável mais importante da Fase −1 — e talvez do primeiro semestre.**
É o documento que a secretária pode levar para o Tribunal de Contas, para o Conselho Municipal de
Saúde e para a negociação de orçamento. Um sistema que ainda não tem nenhuma tela de operação já
terá respondido a pergunta que a SMS hoje não sabe responder: **quantos veículos nós temos, onde
estão, e quais estão vivos.** Nada no roadmap tem retorno político e institucional maior do que
isso, e é por isso que ele vem antes.

### 11.1 Piloto — a lição mais cara do SisEscala

Aquele projeto aprendeu que **"o mês só começa quando a coleta estiver contínua"**: fase marcada
como iniciada com 2 registros reais não é fase iniciada. O mesmo vale aqui. O piloto do SISFROTA
deve ter: unidade definida, veículos definidos, **papel e sistema em paralelo**, e um par de
controle por evento (o mesmo abastecimento registrado nos dois) para medir divergência.
Recomendo começar pelas **vans de TFD** — volume alto, rota previsível, gestor motivado — e só
depois ir para ambulância de urgência, onde o motorista está sob pressão clínica.

### 11.2 🆕 Governança: quem é o dono

Quando eu disse "sem dono nomeado o sistema morre", não me referia a quem manda na secretaria.
**Dono é quem sente dor quando o número está errado** — quem cobra, quem decide trade-off e quem
tem autoridade para mudar o *processo*, não só o software. Com os nomes que a SMS tem hoje, os
papéis se distribuem assim:

| papel | quem | o que faz de fato |
|---|---|---|
| **Patrocinadora institucional** | **Lícia** (Secretária de Saúde) | assina o ato normativo (§11.2.1), banca a decisão quando alguém reclamar do controle, e é quem colhe o resultado político do inventário (§11.0.1) |
| **Dono do produto** ⭐ | **Sr. Elizeu** (Coordenador de Transporte) | **é o dono.** Prioriza, valida regra, define exceção, aprova o piloto, responde "isso está certo?" |
| **Dono técnico** | **você** (Coordenação de TI) | arquitetura, código, integração, prazo, dívida técnica |
| **Curador do cadastro** | **você** (Coordenação de TI) | mantém servidores, unidades e setores corretos **na origem** (SisEscala) — é o que faz o espelho (§2.2.1) valer alguma coisa |
| **Operador do dado de frota** | despachante / chefe de garagem — **a definir** | emite requisição, cobra registro atrasado, faz lançamento assistido. É quem usa o sistema 8h/dia, dentro do setor de transporte |
| **Contraparte de controle** | controle interno da prefeitura | consome auditoria e conciliação; não decide requisito, mas valida se serve |

⚠️ **São dois papéis diferentes, e a distinção importa** (o termo "guardião do dado" usado antes
era ambíguo e foi trocado por estes dois):

- **Curador do cadastro** cuida de *quem são as pessoas e os lugares*. Esse é da TI, é seu, e já é
  seu em todos os outros sistemas da casa. Continua sendo — inclusive porque a qualidade do
  espelho do SISFROTA depende inteiramente da qualidade da origem.
- **Operador do dado de frota** cuida de *o que aconteceu com os veículos hoje*. Esse **não pode
  ser da TI** — e não por hierarquia, por três razões práticas: (a) quem está na garagem sabe qual
  veículo saiu, a TI não; (b) quem cobra o motorista atrasado precisa ter relação de trabalho
  diária com ele; (c) se a TI vira digitadora do dado de frota, o registro deixa de ser feito por
  quem presenciou o fato — e **um dado lançado por quem não estava lá não é evidência**, é
  transcrição. Toda a §4.4 (evidência) e §8.4 (lançamento assistido) desmoronam nesse caso.

Se ninguém do setor de transporte assumir esse papel, o desfecho conhecido é: a TI mantém o
sistema vivo sozinha, o dado degrada, e em seis meses o sistema é "aquele sistema que a TI fez".

**Sr. Elizeu é o dono, e por um motivo que vale mais do que o cargo: foi ele quem pediu o
sistema.** Demanda que nasce de quem sofre o problema é o melhor indicador que existe de que o
sistema será usado. Sistema de controle que nasce da TI ou de cima morre; o que nasce de quem
apanha do problema tem chance real.

⚠️ **Três armadilhas nessa configuração, ditas sem rodeio:**

1. ✅ **Autoridade: confirmada em 15/08/2026.** O Sr. Elizeu tem **controle integral da operação —
   é ele quem libera as requisições de abastecimento e as manutenções** (estas últimas
   terceirizadas por **credenciamento**). Ou seja, o gate do §5 tem respaldo real de quem opera,
   e não é uma regra que o sistema inventa sozinha. Isso destrava a Fase 2.
   ⚠️ **Mas cria o problema oposto, e é preciso dizê-lo:** a mesma pessoa autoriza **combustível
   e manutenção**, os dois maiores centros de custo da frota, sem segunda assinatura. Isso é
   concentração de alçada, e Tribunais de Contas apontam exatamente esse arranjo — não por
   suspeita de ninguém, mas porque *controle não pode depender da honestidade de uma pessoa só*.
   **A leitura correta aqui é que isso é um risco para ele**, não contra ele: quem assina tudo
   sozinho vira o alvo natural de qualquer denúncia, e hoje não tem como provar o próprio zelo.
   Mitigação embutida no sistema, sem tirar poder dele: **alçada por valor** (acima de X exige
   segunda aprovação — coordenação ou ordenador de despesa), **papel `auditor` separado** (§7.1),
   e **trilha imutável** de tudo que ele autorizou (§6.3). O log é o que o defende depois.
2. **Você acumula dois papéis que idealmente se separam.** Ser coordenador de TI e principal
   desenvolvedor significa que, quando faltar tempo, o que cede é a validação — e aí o sistema
   passa a refletir o que *você* acha do processo de frota, não o que o Elizeu sabe. Contramedida
   barata: **ritmo fixo de validação** (30 min por semana com ele, olhando tela real, não
   documento) e a regra de que **regra de negócio nova é decisão dele**, registrada em
   `docs/decisoes/`, não escolha de implementação.
3. **Secretária muda com a gestão; o sistema não pode depender disso.** É o risco mais concreto
   de todos, e tem uma resposta conhecida: institucionalizar.

### 11.2.1 🆕 O ato normativo — o "requisito" que não é software

Recomendação forte, e provavelmente a de melhor custo-benefício de todo o projeto:

> Antes da Fase 2, a SMS deve publicar uma **Instrução Normativa de uso da frota** — ato interno,
> assinado pela secretária, regulamentando: diário de bordo eletrônico como registro oficial
> (substituindo o papel), obrigatoriedade de requisição prévia e suas exceções, prazo de
> regularização, autorização formal para servidor não-motorista dirigir (§4.1.0), e as
> consequências administrativas do não registro.

Por quê: hoje o gate de abastecimento é **regra de um sistema** — negociável, contornável,
"exceção só dessa vez". Com a IN, ele passa a ser **norma da secretaria**, e o sistema apenas a
executa. Isso muda quem carrega o ônus político da recusa: sai do Elizeu e do sistema, vai para a
norma. É também exatamente o que os Tribunais de Contas cobram — *padronizar diários de bordo e
registros de abastecimento e instituir controle formal* — e transforma um apontamento futuro de
auditoria em prova de que a SMS agiu antes.

Vale escrever a minuta **junto** com o desenho do sistema, para que norma e software digam a
mesma coisa. Se divergirem, o sistema perde.

### 11.3 🆕 O que é preciso para começar

Dividido pelo que **bloqueia** e pelo que só precisa estar pronto quando a fase chegar.

**A. Decisões técnicas (você, esta semana — nenhuma depende de terceiros)**
1. Alinhar a stack com o SisEscala (§2.1): Next 15 + React 19 + Tailwind 4, componentes próprios,
   sem Shadcn. Decidido e escrito no `CLAUDE.md`.
2. Criar o repositório com `CLAUDE.md`, `docs/planos/`, `docs/evolucao/`, `docs/decisoes/`,
   ESLint e CI (`tsc --noEmit` + `build`) desde o primeiro commit (§14.2).
3. Novo projeto Supabase + bucket privado + política de retenção inicial.
4. Coolify: app, subdomínio (`sisfrota.maraba.pa.gov.br`), deploy por push.

**B. Pessoas (Elizeu / SMS — pedir agora, é o que tem prazo de resposta mais longo)**
5. **Nome do operador do dado de frota** no setor de transporte (§11.2).
6. **Dupla de campo para o censo**: 2 pessoas por ~3 semanas, com veículo e acesso às garagens,
   unidades e distritos. Não precisam ser da TI — precisam saber onde os veículos estão.
7. **Agenda fixa de validação com o Elizeu**: 30 min/semana, olhando tela.

**C. Insumos para o censo (§11.0.1) — pedir junto com B**
8. Todas as planilhas atuais de frota, mesmo as ruins e desencontradas.
9. Relação patrimonial da prefeitura (setor de patrimônio) filtrada pela saúde.
10. Contratos vigentes: combustível, credenciamento de oficinas, locação de veículos, seguros.
11. Termos de cessão/convênio e emendas parlamentares que originaram veículos.
12. Notas/relação de abastecimento dos últimos 3 meses (prova de vida da frota).
13. Lista dos postos credenciados (CNPJ e endereço) e das oficinas credenciadas.

**D. Normativo (paralelo, sem bloquear código)**
14. Minuta da **Instrução Normativa de uso da frota** (§11.2.1), incluindo o **Termo de
    Autorização para Condução de Veículo Oficial** (§4.1.0).

**E. A definir antes da Fase 2, não agora**
15. Unidade-piloto (recomendo as vans de TFD — §11.1).
16. Alçada de valor para segunda aprovação (§11.2).
17. Se haverá 10–20 aparelhos de base como rede de segurança (§8.3).

### 11.4 🆕 Cronograma de implantação

⚠️ **Premissas explícitas — se qualquer uma mudar, o cronograma muda** (atualizadas em 15/08/2026):
(a) **time de três**: coordenação de TI a **~50%** (o restante em SisEscala, que segue exigindo
trabalho fino, embora em fase avançada), **Hugo** e **Matheus** (entrando) — capacidade efetiva
estimada em **~2 a 2,5 desenvolvedores**; (b) desenvolvimento assistido por IA, já em uso;
(c) trabalho de campo do censo feito pelo setor de transporte, não pela TI; (d) a onda de
atualização do SisEscala não é interrompida.

🆕 **O que o time de três muda — e o que ele não muda.** As fases limitadas por *código* encurtam
cerca de 35%. As limitadas por *calendário e realidade* **não encurtam**: o censo depende de
percorrer garagens e distritos, e o piloto precisa de 30 dias de operação real em paralelo com o
papel. Nenhum time acelera isso. Portanto o ganho aparece de M2 em diante, não em M1.

⚠️ Duas contrapartidas honestas: **Matheus entrando tem curva de aprendizado** (o ganho real dele
começa depois de algumas semanas), e **três pessoas no mesmo código exigem convenção** — é
exatamente por isso que `CLAUDE.md`, ESLint e CI (§14.2) deixam de ser higiene e viram
pré-requisito. Divisão natural que o projeto permite: **PWA do motorista**, **painel
administrativo** e **integrações/banco** são três frentes com pouca sobreposição.

#### Cenário recomendado (time de três)

| Onda | Período | Entrega | O que o gestor vê |
|---|---|---|---|
| **M0. Partida** | ago/26 · 2 sem | repo, CI, Supabase, Coolify, schema de veículos, importador CSV, formulário mobile de inventário | — (infra) |
| **M1. Censo da frota** ⭐ | set/26 · 4–5 sem | Fase −1 executada | **"Quantos veículos a SMS tem, onde estão e quais estão vivos"** — relatório de inventário assinado |
| **M1b. Origem** (paralelo) | set/26 · ~1 sem | Fase 0.a no SisEscala: `atualizado_em`, tombstone, `/api/diretorio/v1/*` | — |
| **M2. Fundação + Diário** | out/26 · 5 sem | Fase 0.b + Fase 1: cadastros, condutores (incl. eventual + termo de autorização), PWA offline, checklist, modo assistido | primeiras telas em produção |
| **M3. Piloto** | nov/26 · 4 sem | piloto nas vans de TFD, em paralelo com o papel | cobertura > 90% numa unidade real |
| **M4. Abastecimento** ⭐ | dez/26–jan/27 · 6 sem | Fase 2: requisição digital com QR, evidência NFC-e, cotas, contratos, portal do posto, gate "sem diário não abastece" | **fim do talão de papel** |
| **M5. Auditoria** ⭐ | fev/27 · 4 sem | Fase 3: anomalias, fila de auditoria, conciliação de fatura, relatórios TCE | **controle efetivo do combustível** |
| **M6. Manutenção** | mar–abr/27 · 6 sem | Fase 4: OS, credenciamento, orçamento no sistema, planos preventivos, alertas | custo de manutenção por veículo |
| **M7. TFD + Maturidade** | mai–jun/27 · 6 sem | Fases 5 e 6: TFD, manifesto, consolidação de viagens, KPIs, transparência | custo por paciente transportado |

**Marcos de resposta à pergunta "quando teremos controle da frota?"**
- **~6 semanas (set/26)** → a SMS sabe o que tem (M1). Nenhum sistema de mercado entrega isso
  nesse prazo, porque não é software: é levantamento.
- **~3 meses (nov/26)** → primeira unidade registrando toda viagem em produção (M3).
- **~6 meses (fev/27)** → **controle efetivo de combustível, com auditoria e conciliação** (M5).
  Esta é a resposta honesta para "atende as necessidades do controle da frota".
- **~10 meses (jun/27)** → escopo completo desta spec (M7).

#### Cenário comprimido (se a pressão política não permitir esperar)

Existe um caminho de **~90 dias até produção**, e ele é legítimo — desde que o que fica de fora
seja dito em voz alta, por escrito, para quem está pressionando:

| até | entrega |
|---|---|
| **set/26** | censo (não dá para pular — sem ele o sistema afirma número errado) |
| **out/26** | cadastro de veículos e condutores + **diário de bordo** (saída/retorno, odômetro, checklist) |
| **nov/26** | **requisição de abastecimento digital** (emissão, código, registro com foto) |

**O que fica de fora nesse caminho, e precisa estar explícito:** portal do posto, leitura de NFC-e,
motor de anomalias, conciliação de fatura, cotas e contratos, manutenção, TFD, KPIs. Ou seja: o
sistema **registra e organiza**, mas ainda **não audita nem impede** — o controle de verdade
continua chegando em mar–abr/27.

⚠️ **Três coisas que não devem ser sacrificadas pela pressa, em nenhum cenário:**
1. **O censo.** Sistema alimentado com cadastro errado produz relatório errado com aparência de
   precisão — que é pior que planilha, porque ninguém desconfia.
2. **O piloto em paralelo com o papel.** Trocar 200 veículos de uma vez, sem rede, é como o
   projeto morre — e a segunda tentativa é sempre muito mais difícil que a primeira.
3. **O modo assistido (§8.4).** Com celular pessoal, sem ele a cobertura trava em ~80%.

💡 **Como usar a pressão a favor:** o pedido nasceu da falta de controle, então **entregue
primeiro o que expõe a falta de controle** — o relatório de inventário (M1). Ele custa 6 semanas,
não exige quase nenhum software, e dá ao gestor um número que ele não tem hoje. Isso compra
paciência para as fases que realmente demoram, e prova que a rota está certa. Prometer o sistema
completo para dezembro compra três meses de trégua e depois um ano de descrédito.

---

## 12. Perguntas do levantamento

### 12.1 ✅ Respondidas em 15/08/2026

As cinco de maior impacto estão fechadas e já refletidas no documento — ver **§1.3**.

### 12.2 🆕 Ainda abertas (bloqueiam fases específicas, não a Fase −1)

✅ Respondidas em 15/08/2026 (2ª rodada), já refletidas no texto:
**dono** → Sr. Elizeu como dono do produto, Lícia como patrocinadora (§11.2) ·
**motoristas** → ~60, incluindo zona rural (§4.1.0) ·
**integração** → API, cadastro permanece no SisEscala (§2.2.1) ·
**estado do controle atual** → planilhas fragmentadas, nunca houve levantamento sério (§11.0.1).

**Bloqueiam a Fase 0**
1. 🆕 **Quem é o operador do dado de frota, dentro do setor de transporte?** Despachante ou chefe
   de garagem, nominalmente — quem opera o sistema 8h/dia e faz o lançamento assistido (§8.4).
   Ainda sem nome. (O **curador do cadastro** já está definido: Coordenação de TI — §11.2.)
2. ✅ **Autoridade do dono: confirmada** — Elizeu libera requisições e manutenções (§11.2).
   Pendência derivada: **definir a alçada** — acima de qual valor uma OS ou requisição exige
   segunda aprovação? E quem é o segundo aprovador?
3. 🆕 **Cabe publicar a Instrução Normativa de uso da frota** (§11.2.1)? Quem redige — procuradoria,
   controle interno, ou a própria SMS?
4. ✅ **Cadastro de origem: resolvido.** Lotação e cargo dos já cadastrados estão corretos, e a
   atualização em curso do SisEscala vai completar o cadastro de servidores da SMS (§2.2.2).
   Pendências derivadas: **quando** essa onda termina (define o início da Fase 0), e se as três
   mudanças de origem (`atualizado_em`, tombstone, API) entram nela.
5. 🆕 **Dos ~60 motoristas, quantos são efetivos, contratados e terceirizados?** Muda o cadastro
   de condutor e muda quem responde por infração (§4.1.0, §4.8).
6. ✅ **Autorização para servidor não-motorista dirigir: não existe** (confirmado 15/08/2026).
   Deixa de ser pergunta e vira **requisito**: o SISFROTA emite o Termo de Autorização para
   Condução de Veículo Oficial na Fase 1, e a Instrução Normativa lhe dá base (§4.1.0, §11.2.1).
7. 🆕 **Qual a capacidade real de desenvolvimento?** O cronograma (§11.4) assume 1 dev a ~50% do
   tempo. Se houver mais alguém, ou se a onda do SisEscala liberar mais horas, as datas mudam —
   é a variável que mais afeta o prazo.
8. 🆕 **Quando termina a onda de atualização do SisEscala?** Define o início realista da Fase 0.b.

**Bloqueiam a Fase 2 (abastecimento)**
7. **Quantos postos credenciados, e onde ficam?** Precisa de CNPJ, endereço e coordenada para
   o geofence e para o portal do posto.
8. **Como é o contrato de combustível hoje** — ata de registro de preços com preço fixo, ou
   preço variável indexado? → define a regra de detecção de sobrepreço.
9. **Como é a fatura do posto hoje**: NF-e com XML, planilha, ou papel com relação de
   requisições? → define o importador da conciliação (§4.13).
10. **Os postos toparão usar o portal?** Vale checar se o contrato/edital vigente permite exigir
    isso — se não, entra como cláusula na próxima licitação.
11. **Qual a numeração/talonário atual da requisição?** Convém manter continuidade para o
    controle interno não perder o fio na transição.

**Bloqueiam a Fase 4+**
12. ✅ **Manutenção: credenciamento** (§4.6.1). Pendências derivadas: quantas oficinas credenciadas,
    quais especialidades, existe tabela de preços do credenciamento, e qual o critério atual de
    distribuição de serviço entre elas?
13. Quais veículos vêm de **emenda parlamentar / convênio FNS**, e qual a regra de prestação de contas?
14. Volume mensal de TFD e destinos mais frequentes (dimensiona a consolidação de viagens).
15. O controle interno / **TCM-PA** exige layout específico de arquivo na prestação de contas?
16. **Já houve apontamento de auditoria sobre a frota da SMS?** Quais? São os requisitos mais
    valiosos que existem — já vêm priorizados por quem fiscaliza.
17. Há intenção de contratar rastreamento? → muda a base legal na LGPD e adianta a Fase 7.
18. Jurídico/procuradoria: há parecer sobre uso de **dispositivo pessoal** para serviço (§8.3)?

## 13. 🆕 Riscos

| risco | impacto | mitigação |
|---|---|---|
| **Motorista não registra** | sistema vazio | gate "sem diário não abastece" (§5); piloto em paralelo; PWA de 3 toques; modo assistido (§8.4) |
| 🆕 **Celular pessoal vira barreira** (sem aparelho, sem dados, recusa) | buraco permanente de cobertura | modo assistido obrigatório desde a F1; 10–20 aparelhos de base como rede de segurança; termo de uso e ciência (§8.3) |
| **Perda de registro offline (iOS)** | perda de evidência | sync agressivo, badge de pendência, alerta por WhatsApp, registro não confirmado nunca contado como "salvo" |
| 🆕 **Divergência entre bancos** (unidade/servidor) | relatório errado, FK lógica quebrada | espelho com `origem_hash`, tela de reconciliação, nunca deletar registro ausente (§2.2) |
| 🆕 **Posto não adere ao portal** | perde-se a contraprova independente | portal é reforço, não dependência; % de baixa vira indicador de fiscalização do contrato (§4.12) |
| 🆕 **Cadastro inicial sujo (200+ veículos)** | sistema nasce afirmando dado errado | Fase −1 com inventário físico e critério de saída explícito (§11.0) |
| **Dado de paciente vazado** | incidente LGPD grave | RLS restritiva, retenção curta, log de acesso, orientação de foto, limpeza do cache no dispositivo pessoal |
| 🆕 **Perfil externo (posto) explorado** | acesso indevido a dado da frota | consulta só por código, rate limit, escopo de CNPJ, sem listagem (§7.1) |
| **Sem dono na secretaria** | abandono pós-entrega | ✅ resolvido: Sr. Elizeu (produto) + Lícia (patrocínio) — §11.2. Falta nomear o operador do dado no transporte |
| 🆕 **TI vira digitadora do dado de frota** | registro deixa de ser evidência (quem lançou não presenciou); dado degrada | operador do dado obrigatoriamente dentro do setor de transporte; % de lançamento assistido como KPI (§10.1) |
| 🆕 **Dono sem autoridade para negar** | gate de abastecimento furado na 1ª pressão política | confirmar autoridade antes da F2; **Instrução Normativa** transfere o ônus da recusa para a norma (§11.2.1) |
| 🆕 **Troca de gestão / secretária** | sistema perde patrocínio no meio | institucionalizar via ato normativo e entregar valor cedo (inventário na Fase −1) |
| 🆕 **Dono técnico acumulando papéis** | requisito vira opinião da TI | ritmo fixo de validação com o dono; regra de negócio registrada em `docs/decisoes/` (§11.2) |
| 🆕 **Condutor terceirizado fora do modelo** | motorista real que não existe no sistema | `pessoa_espelho_id` nullable + `origem_condutor` (§4.1.0) |
| 🆕 **`SELECT *` na API de diretório** | vaza CPF/foto/dados bancários do SisEscala para o SisFrota | projeção explícita de colunas no código da API (§2.2.1) |
| **Escopo grande demais** | nada entra em produção | fases com portão; F1 é só diário de bordo |
| **Divergência de stack com SisEscala** | custo de manutenção dobrado | decidir em §2.1 e §14 antes de codificar |
| **Resistência à fiscalização** | sabotagem passiva | anomalia gera *análise*, nunca punição automática; auditor separado; comunicação clara |
| 🆕 **SAMU tratado como despacho** | conflito com regulação médica, risco assistencial | escopo limitado a retaguarda, por escrito (§4.14) |

---

## 14. 🆕 Arquitetura: o que herdar do SisEscala e o que fazer diferente

Basear o SISFROTA no SisEscala é uma boa decisão — familiaridade do time é um fator técnico
legítimo, não uma preferência preguiçosa, e aquele sistema **está em produção com dado real e
sobreviveu a 159 migrations**. Isso é evidência forte. Mas "basear-se em" não é "copiar tudo":
o próprio `CLAUDE.md` do SisEscala documenta com honestidade rara as cicatrizes do projeto, e
elas são o mapa do que não repetir.

### 14.1 ✅ Herdar sem pensar duas vezes

| prática | por que funcionou |
|---|---|
| **Migrations SQL versionadas** em `supabase/migrations/` | histórico auditável do schema; é o que permite reconstruir o banco |
| **Lógica crítica no Postgres**, não no frontend | garante que a regra vale mesmo se alguém chamar a API direto; casa com RLS |
| **Evidência bruta imutável → fato → juízo → projeção** | o modelo de `rep_afd_registros`/`marcacoes_ponto` é *exatamente* o que auditoria de frota precisa (§6.1) |
| **`CLAUDE.md` + `docs/planos/` + `docs/evolucao/`** | é o que deu continuidade entre sessões e entre pessoas. Adotar no dia 1 |
| **Fases com portão explícito e piloto real** | "o mês só começa quando a coleta for contínua" é a melhor frase de gestão de projeto do repositório |
| **Deploy Coolify + webhook no push** | já funciona, o time já sabe operar |
| **RPCs sensíveis `GRANT`adas só a `service_role`** | padrão correto (`fn_ingerir_afd`); replicar para ingestão de fatura e sync do espelho |

### 14.2 ⚠️ Não repetir — sete pontos, todos documentados no próprio SisEscala

1. **Ausência total de testes automatizados.** Lá, a verificação é `npm run build` + `tsc --noEmit`,
   e foi preciso inventar `fn_conferir_reconciliacao` como *substituto* de framework de teste.
   No SISFROTA isso é mais grave, porque as regras que importam são **numéricas e determinísticas**
   (consumo, cota, sobrepreço, three-way match) — o tipo de coisa mais barata de testar que existe.
   **Recomendação:** `pgTAP` (ou funções de asserção SQL simples) para as regras no banco +
   **Vitest** para as puras em TS. Um caso por regra de anomalia (§4.5): dado o cenário, espera-se
   a anomalia X. São ~14 testes que valem por um ano de depuração em produção.
2. **ESLint nunca configurado** (o comando `lint` sequer roda). Configurar na primeira semana;
   custa 20 minutos e nunca mais é feito depois.
3. **Sem CI.** Um workflow que roda `tsc --noEmit` + `build` + testes antes do deploy custa uma
   tarde e impede que o Coolify publique código quebrado num sistema que a auditoria vai usar.
4. **Arquivos monolíticos.** `ScaleGrid.tsx` tem ~5.000 linhas e `fn_confirmar_presenca` ~1.030.
   Estabelecer convenção **agora**: componente acima de ~400 linhas vira pasta; função PL/pgSQL
   acima de ~200 linhas é sinal de que a regra precisa de decomposição.
5. **Lógica duplicada mantida por script gerador** (`fn_blocos_previstos_dia` é cópia mecânica de
   um trecho de outra função, regerada por `gen_blocos.js`). É engenhoso e é um sintoma: a lógica
   no banco cresceu além do gerenciável. **Regra para o SISFROTA:** vai para o Postgres só o que
   precisa de **atomicidade, RLS ou trigger** (ledger, cota/saldo, imutabilidade, anomalia na
   ingestão). Cálculo derivado e puro (consumo, CPK, projeção de manutenção) fica em **TypeScript
   testável**, numa camada `core/` compartilhada por UI e Edge Function.
6. **Binário compilado commitado no repositório** com dança manual de versões (`coletor-rep-tray.exe`,
   `dist/VERSION`, `ciclo.Versao` — e a armadilha do `-H=windowsgui` que já derrubou produção).
   O SISFROTA não deveria ter nenhum artefato binário no repo. Se um dia precisar, use release
   do GitHub, não a árvore de código.
7. **Documentação que afirmou o que não foi verificado** (o `CLAUDE.md` registra que uma nota
   antiga dizia "Vercel" quando o deploy é Coolify, e que isso levou a afirmar um deploy sem ter
   como verificar). A lição vale para a spec também: **marcar explicitamente o que é decidido, o
   que é hipótese e o que é pendência** — é o que este documento tenta fazer com 🆕 / ⚠️ / ✅.

### 14.3 🆕 Ajustes de arquitetura específicos do SISFROTA

Coisas que o SisEscala não precisou e o SISFROTA precisa:

- **Camada `src/core/`** — regras puras, sem I/O: cálculo de consumo entre tanques cheios, avaliação
  das 14 regras de anomalia, saldo de cota, casamento a três vias. Testável sem banco e sem
  navegador. É a mudança de arquitetura de maior retorno em relação ao SisEscala.
- **Versionamento de payload do PWA.** Com offline-first e celular pessoal, um aparelho pode
  passar dias com versão antiga do app. O servidor **precisa aceitar payload de versão anterior**
  (campo `app_version` em todo envio, com política de compatibilidade e aviso de atualização).
  Sem isso, um deploy no meio da semana descarta o trabalho de campo de quem não atualizou.
- **`pg_cron` para os jobs** (sync do espelho, varredura de anomalias, alertas de vencimento,
  recálculo de projeções). Evita depender de cron externo ou de máquina ligada.
- **Storage com disciplina desde o dia 1**: bucket privado, acesso só por signed URL de curta
  duração, caminho `veiculo/{ano}/{mes}/{id}`, `sha256` gravado na tabela (§6.3), e **política de
  ciclo de vida** — com 1,5–3 GB/mês (§1.4), storage sem regra vira custo silencioso e crescente.
- **Observabilidade mínima**: tabela de falhas de sincronização + uma tela de saúde (pendências
  antigas, dispositivos sem sincronizar, jobs falhando). Num sistema offline-first, **o silêncio
  é ambíguo** — pode ser "nada aconteceu" ou "parou de chegar", e essas duas coisas não podem ser
  indistinguíveis.
- **Feature flags simples por unidade** (uma tabela de configuração). Com 200+ veículos e piloto
  por unidade, ligar/desligar o gate de abastecimento por unidade é operação de rotina, não deploy.

### 14.4 Estrutura de diretórios sugerida (revisão da §6 da v1)

```
sisfrota/
├── src/
│   ├── app/
│   │   ├── (auth)/                login servidor · login motorista (matrícula+PIN)
│   │   ├── (dashboard)/           PAINEL DESKTOP
│   │   │   ├── veiculos/ condutores/ solicitacoes/ ordens-trafego/
│   │   │   ├── abastecimentos/    requisicoes · registros · conciliacao · auditoria
│   │   │   ├── manutencao/ pneus/ infracoes/ sinistros/
│   │   │   ├── contratos/ cotas/ faturas/
│   │   │   ├── tfd/ itinerancias/
│   │   │   ├── anomalias/ alertas/ relatorios/
│   │   │   └── cadastro-espelho/  reconciliação com o SisEscala (§2.2)
│   │   ├── motorista/             PWA MOBILE-FIRST (offline)
│   │   ├── posto/                 PORTAL DO POSTO CREDENCIADO (§4.12) — escopo mínimo
│   │   ├── transparencia/         portal público (§4.11)
│   │   └── api/
│   ├── core/                      🆕 regras puras testáveis (sem I/O)
│   │   ├── anomalias/ consumo/ cotas/ conciliacao/
│   ├── components/                ui/ · desktop/ · pwa/ · shared/
│   ├── lib/                       supabase/ · offline/ (fila, idb) · storage/ · espelho/
│   └── types/
├── supabase/
│   ├── migrations/
│   └── tests/                     🆕 pgTAP
├── docs/                          planos/ · evolucao/ · decisoes/
├── CLAUDE.md
└── Dockerfile                     Coolify
```

⚠️ Duas mudanças em relação à v1: `/admin` virou `(dashboard)` **para casar com a convenção que o
SisEscala já usa** (era incoerente prescrever "mesmos padrões" e inventar outra rota), e `/pwa`
virou `/motorista` — rota nomeada pelo usuário, não pela tecnologia. Se um dia o mecânico ganhar
tela mobile, ela não vai caber embaixo de "pwa".

---

## 15. Referências consultadas

**Órgãos de controle e normas**
- [TCE-PI — Cartilha da Gestão da Frota de Veículos](https://www.tcepi.tc.br/wp-content/uploads/2024/09/Cartilha_da_Gestao_da_Frota_Versao_Final.pdf)
- [TCE-MT — Avaliação de Controles Internos: Gestão de Frotas](https://www.tce.mt.gov.br/conteudo/download/avaliacao-de-controles-internos-gestao-de-frotas/72700)
- [TCE-MG — Processo 1095572, auditoria de frota e combustível](https://tcjuris.tce.mg.gov.br/Home/BaixarArquivoArq?arquivo=2585259)
- [Portaria SAS/MS nº 55/1999 — TFD](https://bvsms.saude.gov.br/bvs/saudelegis/sas/1999/prt0055_24_02_1999.html)
- [Manual de Normatização do TFD (MP-BA)](https://www.mpba.mp.br/sites/default/files/biblioteca/tfd_-_tratamento_fora_de_domicilio/manual_do_tfd_ba.pdf)
- [CONASS — O SISREG](https://www.conass.org.br/guiainformacao/o-sisreg/)
- [ABNT NBR 14561 — veículos para atendimento a emergências médicas e resgate](https://www.normas.com.br/visualizar/abnt-nbr-nm/20560/abnt-nbr14561-veiculos-para-atendimento-a-emergencias-medicas-e-resgate)
- [Senatran/PRF — Sistema de Notificação Eletrônica (SNE)](https://www.gov.br/prf/pt-br/assuntos/sistema-de-notificacao-eletronica-sne)
- [ABLA — o SNE nas frotas](https://www.abla.com.br/artigo/o-sistema-de-notificacao-eletronica-sne-nas-frotas)
- [Lei 14.063/2020 e validade da assinatura eletrônica](https://www.migalhas.com.br/depeso/435882/a-validade-juridica-da-assinatura-eletronica-no-cenario-juridico)
- [LGPD e geolocalização de motoristas](https://www.jusbrasil.com.br/artigos/o-monitoramento-de-motoristas-por-geolocalizacao-e-a-lei-geral-de-protecao-de-dados/1381930259)

**Mercado e tendências**
- [Geotab — Tendências de telemática 2026](https://www.geotab.com/pt-br/blog/gestao-de-frotas-tendencias-telematica-2026/)
- [Cobli — Tendências para gestão de frota](https://www.cobli.co/blog/tendencias-gestao-frota/)
- [Infratrack — telemetria, compliance e custos 2026](https://infratrack.com.br/blog/gestores-frotas-telemetria-compliance)
- [Fleet Software Comparison 2026 (Fleetistics)](https://fleetistics.com/fleet-management-software-comparison-2026/)
- [Best Fleet Management Software — comparativo 2026 (Tech.co)](https://tech.co/fleet-management/best-fleet-management-software-comparison)
- [Prolog — sistemas de gestão de frotas](https://prologapp.com/blog/melhores-sistemas-para-gestao-de-frotas/)
- [TOTVS Gestão de Frotas](https://www.totvs.com/totvs-gestao-de-frotas/)
- [Aspec Frota — solução para setor público](https://aspec.com.br/produtos/aspec-frota/)
- [GestCombustível — gestão de frotas para o setor público](https://gestcombustivel.com.br/)
- [Ticket Log / Edenred — gestão de abastecimento](https://www.edenredmobilidade.com.br/gestao-abastecimento/)
- [Geotab — KPIs de manutenção de frota](https://www.geotab.com/pt-br/blog/kpis-manutencao-de-frota-essenciais/)
- [Edenred — 12 KPIs para gestão de frota](https://blog.edenredmobilidade.com.br/gestao-de-frotas/indicadores-para-gestao-de-frota-melhore-sua-eficiencia/)

**Interno**
- `SISFROTA_SPEC.md` (v1) · `C:\Users\Cliente\Projetos\SisEscala\CLAUDE.md` e
  `supabase/migrations/` (padrões de arquitetura, modelo de evidência imutável, RLS, coletor).
