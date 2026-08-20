-- Desiberne Studio — Fase 3: Banco de Ideias, Componentes, Templates
-- Roda no SQL Editor DEPOIS de schema.sql e migration_002_permissoes.sql

create table if not exists sh_ideias (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  origem_projeto_id uuid references sh_projetos(id) on delete set null,
  status text not null default 'nova' check (status in ('nova','avaliando','aprovada','descartada')),
  created_at timestamptz default now()
);

create table if not exists sh_componentes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria text,
  codigo_ou_preview text,
  tags text[],
  projeto_origem_id uuid references sh_projetos(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists sh_templates (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  segmento text,
  descricao text,
  funcionalidades_padrao jsonb default '{}'::jsonb,
  discovery_padrao jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- FK que faltou no schema.sql original (projetos->templates)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sh_projetos_template_origem_fk') then
    alter table sh_projetos
      add constraint sh_projetos_template_origem_fk
      foreign key (template_origem_id) references sh_templates(id) on delete set null;
  end if;
end $$;

alter table sh_ideias enable row level security;
alter table sh_componentes enable row level security;
alter table sh_templates enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['sh_ideias','sh_componentes','sh_templates']
  loop
    execute format('drop policy if exists "sh_read_authenticated" on %I', t);
    execute format('drop policy if exists "sh_write_admin_gestor" on %I', t);
    execute format('drop policy if exists "sh_update_admin_gestor" on %I', t);
    execute format('drop policy if exists "sh_delete_admin_gestor" on %I', t);
    execute format('create policy "sh_read_authenticated" on %I for select using (auth.uid() is not null)', t);
    execute format('create policy "sh_write_admin_gestor" on %I for insert with check (sh_papel_atual() in (''sh_admin'',''sh_gestor''))', t);
    execute format('create policy "sh_update_admin_gestor" on %I for update using (sh_papel_atual() in (''sh_admin'',''sh_gestor''))', t);
    execute format('create policy "sh_delete_admin_gestor" on %I for delete using (sh_papel_atual() in (''sh_admin'',''sh_gestor''))', t);
  end loop;
end $$;
