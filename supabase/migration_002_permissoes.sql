-- Desiberne Studio — Fase 2: permissões por papel (PRD seção 11)
-- Roda no SQL Editor do mesmo projeto Supabase, DEPOIS do schema.sql

-- ============================================================
-- TABELA DE PAPÉIS
-- ============================================================
create table if not exists sh_usuarios (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid unique references auth.users(id) on delete cascade,
  email text unique not null,
  nome text,
  papel text not null default 'sh_operacional' check (papel in ('sh_admin', 'sh_gestor', 'sh_operacional')),
  created_at timestamptz default now()
);

alter table sh_usuarios enable row level security;

-- Função auxiliar (security definer) — le o papel do usuario logado sem recursao de RLS
create or replace function sh_papel_atual()
returns text
language sql
security definer
stable
as $$
  select papel from sh_usuarios where auth_id = auth.uid() limit 1;
$$;

-- Todo autenticado pode ver o roster (necessario pra tela de Usuarios e pra checar o proprio papel)
create policy "sh_usuarios_select" on sh_usuarios for select using (auth.uid() is not null);
-- Só sh_admin gerencia papéis
create policy "sh_usuarios_write" on sh_usuarios for insert with check (sh_papel_atual() = 'sh_admin');
create policy "sh_usuarios_update" on sh_usuarios for update using (sh_papel_atual() = 'sh_admin');
-- Auto-vínculo: usuário loga pela 1a vez e liga a própria linha pré-cadastrada (auth_id ainda null) ao seu auth.uid()
create policy "sh_usuarios_self_link" on sh_usuarios for update
  using (auth_id is null and email = auth.email())
  with check (auth_id = auth.uid() and email = auth.email());
create policy "sh_usuarios_delete" on sh_usuarios for delete using (sh_papel_atual() = 'sh_admin');

-- Primeiro admin (ajuste o e-mail se necessário antes de rodar)
insert into sh_usuarios (auth_id, email, nome, papel)
select id, email, 'Admin', 'sh_admin'
from auth.users
where email = 'marketing@desiberneia.com.br'
on conflict (email) do nothing;

-- ============================================================
-- SUBSTITUI a política genérica "sh_authenticated_only" por regras por papel
-- Leitura: qualquer autenticado. Escrita: sh_admin / sh_gestor.
-- ============================================================
do $$
declare
  t text;
begin
  foreach t in array array['sh_clientes','sh_projetos','sh_discovery_snapshots','sh_documentos_gerados','sh_timeline_eventos','sh_tecnico']
  loop
    execute format('drop policy if exists "sh_authenticated_only" on %I', t);
    execute format('create policy "sh_read_authenticated" on %I for select using (auth.uid() is not null)', t);
    execute format('create policy "sh_write_admin_gestor" on %I for insert with check (sh_papel_atual() in (''sh_admin'',''sh_gestor''))', t);
    execute format('create policy "sh_update_admin_gestor" on %I for update using (sh_papel_atual() in (''sh_admin'',''sh_gestor''))', t);
    execute format('create policy "sh_delete_admin_gestor" on %I for delete using (sh_papel_atual() in (''sh_admin'',''sh_gestor''))', t);
  end loop;
end $$;

-- sh_backlog_itens: operacional também pode mexer (mover status), não só admin/gestor
drop policy if exists "sh_authenticated_only" on sh_backlog_itens;
create policy "sh_backlog_read" on sh_backlog_itens for select using (auth.uid() is not null);
create policy "sh_backlog_insert" on sh_backlog_itens for insert with check (sh_papel_atual() in ('sh_admin','sh_gestor'));
create policy "sh_backlog_update" on sh_backlog_itens for update using (sh_papel_atual() in ('sh_admin','sh_gestor','sh_operacional'));
create policy "sh_backlog_delete" on sh_backlog_itens for delete using (sh_papel_atual() in ('sh_admin','sh_gestor'));
