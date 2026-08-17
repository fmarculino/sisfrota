# SISTEMA INTEGRADO DE GESTÃO DE FROTAS DA SAÚDE (SISFROTA - SMS MARABÁ)
## Documento de Especificação Técnica, Arquitetura e Prompt Inicial de Desenvolvimento

---

## 1. VISÃO GERAL E OBJETIVO DO PROJETO

O **SISFROTA** é uma plataforma desenvolvida sob medida para a **Secretaria Municipal de Saúde (SMS) de Marabá/PA**. O sistema tem como propósito centralizar, gerenciar, monitorar e auditar 100% da operação e dos custos da frota pública municipal de saúde (ambulâncias de suporte básico/UTI, vans de Tratamento Fora de Domicílio - TFD, veículos de apoio administrativo, fiscalização sanitária e logística de exames/insumos).

O projeto segue os mesmos padrões de arquitetura, qualidade de código e interface já adotados nos sistemas corporativos da secretaria (**SisEscala**, **SisFilaSUS**, **SisTEA**).

---

## 2. STACK TECNOLÓGICA E INFRAESTRUTURA

- **Ambiente de Hospedagem:** VPS Dedicada gerenciada via **Coolify** (Deploy contínuo via Git/Docker).
- **Backend & Banco de Dados:** **Supabase** (PostgreSQL 15+, Row Level Security - RLS, Storage Buckets com políticas de acesso, Triggers e Edge Functions).
- **Frontend Web & Mobile (Monorepo Next.js):**
  - **Painel Administrativo Desktop:** Next.js (App Router), TypeScript, Tailwind CSS, Shadcn/UI, Lucide Icons, Recharts.
  - **Módulo do Motorista (PWA Mobile-First):** Progressive Web App instalável, otimizado para smartphone, suporte a câmera nativa, captura de geolocalização pontual e arquitetura **Offline-First** via IndexedDB (`idb` / `dexie.js`) com sincronização automática em segundo plano.

---

## 3. DIFERENCIAIS EXCLUSIVOS E INOVAÇÕES

1. **Evidência Fotográfica Dupla em Abastecimentos:**
   - Exige foto obrigatória do **Cupom Fiscal / Nota** emitido pelo posto.
   - Exige foto obrigatória do **Painel do Veículo** mostrando hodômetro ligado e luzes-espia de anomalia.
   - Leitura assistida por OCR (Tesseract.js / API) para pré-preenchimento e validação anti-fraude.
2. **Registro de Eventos Pontuais com Geolocalização (Diário de Bordo sem Rastreio Invasivo):**
   - Check-in de marcos com GPS e foto: Saída/Entrada do Município (comprovação de diárias e TFD), Troca de Pneu em Borracharia, Socorro Mecânico e Entrega de Malotes/Amostras.
3. **Módulo Assistencial & Logística SUS:**
   - Manifesto de Passageiros para vans de TFD (controle de vagas/acompanhantes).
   - Checklist de Itens Médicos e de Resgate em Ambulâncias (oxigênio, sirene, giroflex, maca).
4. **Resiliência Offline-First:**
   - Funcionamento garantido em estradas, vicinais e zonas rurais sem sinal de internet, com sincronização automática ao restabelecer conexão.

---

## 4. PERFIS DE ACESSO (RBAC)

1. **`admin_frota` / Coordenação:** Acesso irrestrito a configurações, auditoria, relatórios, cadastros de veículos/postos e aprovação de cotas.
2. **`despachante_trafego` / Operador:** Emissão de Ordens de Tráfego (OT), alocação de motoristas/veículos e emissão de Pré-Autorizações de Abastecimento.
3. **`gestor_unidade` / Solicitante:** Solicitação de veículos para demandas específicas de setores, UBS ou hospitais.
4. **`motorista` / Condutor:** Acesso restrito ao PWA Mobile: aceitar viagens, preencher checklist diário, lançar abastecimentos e registrar eventos de campo.
5. **`oficina_mecanica` / Manutenção:** Abertura, diagnóstico e baixa em Ordens de Serviço (preventivas e corretivas).

---

## 5. MODELO DE BANCO DE DADOS (SUPABASE / POSTGRESQL)

```sql
-- 1. EXTENSÕES & ENUMS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE vehicle_status AS ENUM ('disponivel', 'em_viagem', 'manutencao', 'inoperante');
CREATE TYPE fuel_type AS ENUM ('gasolina', 'etanol', 'diesel_s10', 'diesel_s500', 'gnv');
CREATE TYPE trip_status AS ENUM ('solicitada', 'aprovada', 'em_andamento', 'concluida', 'cancelada');
CREATE TYPE fuel_req_status AS ENUM ('pendente', 'autorizada', 'abastecida', 'cancelada');
CREATE TYPE event_type AS ENUM (
    'abastecimento', 
    'troca_pneu_borracharia', 
    'saida_municipio', 
    'entrada_municipio', 
    'manutencao_emergencial', 
    'parada_assistencial', 
    'entrega_insumos',
    'outro'
);

-- 2. TABELA DE VEÍCULOS
CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    placa VARCHAR(10) UNIQUE NOT NULL,
    modelo VARCHAR(100) NOT NULL,
    marca VARCHAR(50) NOT NULL,
    ano_fabricacao INT,
    tipo VARCHAR(50) NOT NULL, -- Ambulancia UTI, Ambulancia Suporte Basico, Apoio, Van TFD, etc.
    tipo_combustivel fuel_type NOT NULL,
    capacidade_tanque_litros NUMERIC(6,2),
    odometro_atual INT NOT NULL DEFAULT 0,
    status vehicle_status NOT NULL DEFAULT 'disponivel',
    setor_alocado VARCHAR(100),
    propriedade VARCHAR(30) DEFAULT 'proprio', -- proprio, locado, cedido
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. TABELA DE CONDUTORES (MOTORISTAS)
CREATE TABLE drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    nome VARCHAR(150) NOT NULL,
    cpf VARCHAR(14) UNIQUE NOT NULL,
    cnh_numero VARCHAR(20) NOT NULL,
    cnh_categoria VARCHAR(5) NOT NULL,
    cnh_vencimento DATE NOT NULL,
    curso_emergencia BOOLEAN DEFAULT FALSE,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. ORDENS DE TRÁFEGO / VIAGENS
CREATE TABLE trip_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_viagem VARCHAR(20) UNIQUE NOT NULL,
    vehicle_id UUID REFERENCES vehicles(id),
    driver_id UUID REFERENCES drivers(id),
    solicitante_id UUID REFERENCES auth.users(id),
    setor_solicitante VARCHAR(100) NOT NULL,
    origem VARCHAR(150) NOT NULL,
    destino VARCHAR(150) NOT NULL,
    finalidade TEXT NOT NULL,
    status trip_status DEFAULT 'solicitada',
    data_saida_prevista TIMESTAMPTZ,
    data_retorno_prevista TIMESTAMPTZ,
    odometro_saida INT,
    odometro_retorno INT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. REQUISIÇÕES PRÉVIAS DE ABASTECIMENTO
CREATE TABLE fuel_authorizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_requisicao VARCHAR(25) UNIQUE NOT NULL,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id),
    driver_id UUID NOT NULL REFERENCES drivers(id),
    posto_credenciado VARCHAR(150) NOT NULL,
    tipo_combustivel fuel_type NOT NULL,
    litros_autorizados NUMERIC(6,2),
    valor_maximo_autorizado NUMERIC(8,2),
    status fuel_req_status NOT NULL DEFAULT 'pendente',
    autorizado_por UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. REGISTROS EFETIVOS DE ABASTECIMENTO (LANÇADO PELO PWA)
CREATE TABLE fuel_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    authorization_id UUID UNIQUE REFERENCES fuel_authorizations(id),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id),
    driver_id UUID NOT NULL REFERENCES drivers(id),
    odometro INT NOT NULL,
    litros_abastecidos NUMERIC(6,2) NOT NULL,
    valor_total NUMERIC(8,2) NOT NULL,
    km_rodado_desde_ultimo INT,
    consumo_medio_kml NUMERIC(6,2),
    foto_cupom_url TEXT NOT NULL,
    foto_painel_url TEXT NOT NULL,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    divergencia_detectada BOOLEAN DEFAULT FALSE,
    abastecido_em TIMESTAMPTZ DEFAULT now()
);

-- 7. EVENTOS DE CAMPO E CHECK-INS PONTUAIS (PWA)
CREATE TABLE operational_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id),
    driver_id UUID NOT NULL REFERENCES drivers(id),
    trip_id UUID REFERENCES trip_requests(id),
    tipo_evento event_type NOT NULL,
    odometro INT,
    descricao TEXT,
    foto_evidencia_url TEXT,
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    registrado_em TIMESTAMPTZ DEFAULT now()
);

-- 8. CHECKLISTS DE VISTORIA
CREATE TABLE vehicle_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id),
    driver_id UUID NOT NULL REFERENCES drivers(id),
    tipo_vistoria VARCHAR(20) NOT NULL, -- 'saida' ou 'retorno'
    itens_conformes JSONB NOT NULL, -- { "pneus": true, "oleo": true, "sirene": true, ... }
    observacoes TEXT,
    fotos_avarias TEXT[],
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. TRIGGER PARA ATUALIZAÇÃO AUTOMÁTICA DO ODÔMETRO DO VEÍCULO
CREATE OR REPLACE FUNCTION update_vehicle_odometer()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.odometro > (SELECT odometro_atual FROM vehicles WHERE id = NEW.vehicle_id) THEN
        UPDATE vehicles 
        SET odometro_atual = NEW.odometro
        WHERE id = NEW.vehicle_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_odo_fuel
AFTER INSERT ON fuel_logs
FOR EACH ROW EXECUTE FUNCTION update_vehicle_odometer();

CREATE TRIGGER trigger_update_odo_event
AFTER INSERT ON operational_events
FOR EACH ROW EXECUTE FUNCTION update_vehicle_odometer();
```

---

## 6. ESTRUTURA DE DIRETÓRIOS DO PROJETO (NEXT.JS APP ROUTER)

```
sisfrota/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── layout.tsx
│   │   ├── admin/                # PAINEL DESKTOP (GESTÃO)
│   │   │   ├── dashboard/
│   │   │   ├── veiculos/
│   │   │   ├── motoristas/
│   │   │   ├── viagens/
│   │   │   ├── abastecimentos/
│   │   │   │   ├── requisicoes/
│   │   │   │   └── auditoria/
│   │   │   ├── manutencoes/
│   │   │   ├── eventos-mapa/
│   │   │   └── layout.tsx
│   │   ├── pwa/                  # APLICATIVO DO MOTORISTA (MOBILE-FIRST)
│   │   │   ├── inicio/
│   │   │   ├── viagens/
│   │   │   ├── abastecer/
│   │   │   ├── eventos/
│   │   │   ├── checklist/
│   │   │   └── layout.tsx
│   │   ├── api/                  # ROUTE HANDLERS & WEBHOOKS
│   │   ├── layout.tsx
│   │   └── manifest.json         # CONFIGURAÇÃO PWA
│   ├── components/
│   │   ├── ui/                   # Componentes Radix / Shadcn
│   │   ├── admin/                # Componentes exclusivos do desktop
│   │   ├── pwa/                  # Componentes mobile (CameraCapture, GeoButton, etc.)
│   │   └── shared/
│   ├── hooks/
│   │   ├── use-geolocation.ts
│   │   ├── use-offline-sync.ts
│   │   └── use-camera.ts
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   └── middleware.ts
│   │   ├── db/indexed-db.ts      # Armazenamento offline de fotos e logs
│   │   └── utils.ts
│   └── types/
│       └── database.types.ts
├── public/
│   ├── icons/                    # Ícones PWA (192x192, 512x512)
│   └── sw.js                     # Service Worker customizado
├── Dockerfile                    # Pronto para deploy no Coolify
├── next.config.mjs
└── package.json
```

---

## 7. PROMPT MESTRE PARA INICIALIZAÇÃO NO ANTIGRAVITY

```markdown
Você é o Engenheiro Chefe e Arquiteto de Software responsável por codificar o SISFROTA (Sistema Integrado de Gestão de Frotas da Secretaria Municipal de Saúde de Marabá - SMS).

Siga rigorosamente as diretrizes deste documento de especificação:
- Stack: Next.js (App Router), TypeScript, Tailwind CSS, Supabase (PostgreSQL, Storage, RLS), PWA Mobile-First, deploy em Docker/Coolify.
- Separação clara de interfaces: `/admin` (desktop para gestão) e `/pwa` (mobile-first para motoristas).
- Implementação dos módulos essenciais: Gestão de Veículos, Motoristas, Viagens, Abastecimento com Pré-Autorização e Dupla Evidência Fotográfica, Eventos de Campo com GPS pontual e Checklist Digital.
- Suporte a funcionamento Offline-First no módulo PWA via IndexedDB com sincronização automática para o Supabase.

EXECUTE O PLANO DE DESENVOLVIMENTO EM ETAPAS:
1. Configuração do ambiente base, Tailwind, layout geral e autenticação Supabase RBAC.
2. Criação das rotas e componentes do Painel Administrativo (/admin).
3. Criação da interface PWA do Motorista (/pwa) com componentes de Câmera, Geolocalização e Formulários de Abastecimento/Eventos.
4. Implementação dos hooks de persistência offline e sincronização em segundo plano.
```
