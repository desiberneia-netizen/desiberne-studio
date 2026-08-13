-- Desiberne Studio — schema inicial (Fase 0 / Fase 1 MVP)
-- Roda no MESMO projeto Supabase do desiberne-crm (schema public, prefixo sh_)
-- Ver PRD: seção 04 (modelo de dados) e seção 11 (permissões)

create extension if not exists "pgcrypto";

-- ============================================================
-- CLIENTES
-- ============================================================
create table if not exists sh_clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  empresa text,
  segmento text,
  responsavel text,
  contatos jsonb default '[]'::jsonb,
  cnpj text,
  site text,
  redes_sociais jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- ============================================================
-- PROJETOS
-- ============================================================
create table if not exists sh_projetos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references sh_clientes(id) on delete restrict,
  codigo text unique not null,
  nome text not null,
  status text not null default 'discovery'
    check (status in ('discovery','documentado','em_desenvolvimento','em_homologacao','entregue','pausado')),
  responsavel text,
  prazo date,
  prioridade text default 'media' check (prioridade in ('baixa','media','alta')),
  template_origem_id uuid,
  discovery_confirmado boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- gera o código DSB-{ano}-{sequencial} automaticamente
create sequence if not exists sh_projetos_seq;
create or replace function sh_gerar_codigo_projeto()
returns trigger as $$
begin
  if new.codigo is null then
    new.codigo := 'DSB-' || extract(year from now()) || '-' || lpad(nextval('sh_projetos_seq')::text, 3, '0');
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sh_projetos_codigo on sh_projetos;
create trigger trg_sh_projetos_codigo
  before insert on sh_projetos
  for each row execute function sh_gerar_codigo_projeto();

-- ============================================================
-- DISCOVERY — snapshots versionados, append-only (nunca UPDATE)
-- ============================================================
create table if not exists sh_discovery_snapshots (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references sh_projetos(id) on delete cascade,
  versao int not null,
  etapa1_empresa jsonb default '{}'::jsonb,
  etapa2_objetivos jsonb default '{}'::jsonb,
  etapa3_fluxo jsonb default '{}'::jsonb,
  etapa4_funcionalidades jsonb default '{}'::jsonb,
  etapa5_usuarios jsonb default '{}'::jsonb,
  etapa6_integracoes jsonb default '{}'::jsonb,
  etapa7_identidade jsonb default '{}'::jsonb,
  etapa8_requisitos_especiais text,
  criado_por uuid,
  created_at timestamptz default now(),
  unique(projeto_id, versao)
);

-- ============================================================
-- DOCUMENTOS GERADOS
-- ============================================================
create table if not exists sh_documentos_gerados (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references sh_projetos(id) on delete cascade,
  discovery_snapshot_id uuid not null references sh_discovery_snapshots(id) on delete cascade,
  tipo text not null check (tipo in ('documento_tecnico','escopo_funcional','backlog','roadmap','prompt_claude_code')),
  conteudo text,
  versao int not null default 1,
  created_at timestamptz default now()
);

-- ============================================================
-- BACKLOG
-- ============================================================
create table if not exists sh_backlog_itens (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references sh_projetos(id) on delete cascade,
  titulo text not null,
  descricao text,
  fase text default 'mvp' check (fase in ('mvp','v2','v3','futuro')),
  status text default 'pendente' check (status in ('pendente','em_andamento','concluido')),
  prioridade int default 0,
  created_at timestamptz default now()
);

-- ============================================================
-- TIMELINE — trilha de auditoria por projeto, append-only
-- ============================================================
create table if not exists sh_timeline_eventos (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references sh_projetos(id) on delete cascade,
  tipo_evento text not null,
  descricao text,
  autor uuid,
  created_at timestamptz default now()
);

-- ============================================================
-- DADOS TÉCNICOS — nunca guardar segredos aqui, só referências (ver PRD 04)
-- ============================================================
create table if not exists sh_tecnico (
  projeto_id uuid primary key references sh_projetos(id) on delete cascade,
  repo_url text,
  supabase_project_ref text,
  vercel_project text,
  dominio text,
  onde_estao_as_credenciais text,
  status_deploy text default 'nao_iniciado'
);

-- ============================================================
-- RLS — restrita por papel, NUNCA "USING (true)" (ver PRD seção 1.5 / 11)
-- Papéis de acesso (tabela sh_usuarios_papel) entram junto com a Fase 2.
-- Por ora: bloqueado por padrão até a política de papéis existir.
-- ============================================================
alter table sh_clientes enable row level security;
alter table sh_projetos enable row level security;
alter table sh_discovery_snapshots enable row level security;
alter table sh_documentos_gerados enable row level security;
alter table sh_backlog_itens enable row level security;
alter table sh_timeline_eventos enable row level security;
alter table sh_tecnico enable row level security;

-- Política mínima temporária: qualquer usuário autenticado (auth.uid() não nulo) lê/escreve.
-- Isso ainda é mais restrito que "Allow all" (bloqueia acesso anônimo/chave pública sem login)
-- e deve ser substituída por políticas por papel na Fase 2.
create policy "sh_authenticated_only" on sh_clientes for all using (auth.uid() is not null);
create policy "sh_authenticated_only" on sh_projetos for all using (auth.uid() is not null);
create policy "sh_authenticated_only" on sh_discovery_snapshots for all using (auth.uid() is not null);
create policy "sh_authenticated_only" on sh_documentos_gerados for all using (auth.uid() is not null);
create policy "sh_authenticated_only" on sh_backlog_itens for all using (auth.uid() is not null);
create policy "sh_authenticated_only" on sh_timeline_eventos for all using (auth.uid() is not null);
create policy "sh_authenticated_only" on sh_tecnico for all using (auth.uid() is not null);
