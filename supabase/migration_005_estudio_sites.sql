-- Desiberne Studio — Estúdio de Sites & Landing Pages
-- Roda no SQL Editor DEPOIS de todas as migrations anteriores

-- ============================================================
-- TIPO DE PROJETO
-- ============================================================
alter table sh_projetos add column if not exists tipo_projeto text not null default 'crm'
  check (tipo_projeto in ('crm', 'site'));

-- ============================================================
-- BRIEFING DE SITE — equivalente ao discovery, mas mais enxuto
-- Append-only, mesma logica de versionamento do discovery de CRM
-- ============================================================
create table if not exists sh_briefing_sites (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references sh_projetos(id) on delete cascade,
  versao int not null,
  etapa1_negocio jsonb default '{}'::jsonb,
  etapa2_midia jsonb default '{}'::jsonb,
  etapa3_referencias jsonb default '{}'::jsonb,
  etapa4_estrutura jsonb default '{}'::jsonb,
  etapa5_requisitos_especiais text,
  criado_por uuid,
  created_at timestamptz default now(),
  unique(projeto_id, versao)
);

alter table sh_briefing_sites enable row level security;
drop policy if exists "sh_read_authenticated" on sh_briefing_sites;
drop policy if exists "sh_write_admin_gestor" on sh_briefing_sites;
drop policy if exists "sh_update_admin_gestor" on sh_briefing_sites;
drop policy if exists "sh_delete_admin_gestor" on sh_briefing_sites;
create policy "sh_read_authenticated" on sh_briefing_sites for select using (auth.uid() is not null);
create policy "sh_write_admin_gestor" on sh_briefing_sites for insert with check (sh_papel_atual() in ('sh_admin','sh_gestor'));
create policy "sh_update_admin_gestor" on sh_briefing_sites for update using (sh_papel_atual() in ('sh_admin','sh_gestor'));
create policy "sh_delete_admin_gestor" on sh_briefing_sites for delete using (sh_papel_atual() in ('sh_admin','sh_gestor'));

-- ============================================================
-- sh_documentos_gerados — abrir pra aceitar documentos de site
-- (tipos novos + vinculo opcional a briefing de site em vez de discovery de CRM)
-- ============================================================
alter table sh_documentos_gerados alter column discovery_snapshot_id drop not null;
alter table sh_documentos_gerados add column if not exists briefing_site_id uuid references sh_briefing_sites(id) on delete cascade;

alter table sh_documentos_gerados drop constraint if exists sh_documentos_gerados_tipo_check;
alter table sh_documentos_gerados add constraint sh_documentos_gerados_tipo_check
  check (tipo in ('documento_tecnico','escopo_funcional','backlog','roadmap','prompt_claude_code','brief_resumido','prompt_site_claude_code'));

-- ============================================================
-- DOMÍNIO — quem administra, custo anual (PRD secao 9.1)
-- ============================================================
alter table sh_tecnico add column if not exists dominio_proprietario text
  check (dominio_proprietario in ('cliente', 'desiberne'));
alter table sh_tecnico add column if not exists custo_dominio_anual numeric;

-- ============================================================
-- STORAGE — bucket pra fotos do briefing (logo, fachada, produtos, equipe)
-- Publico pra leitura (material de marketing, nao sensivel), upload so autenticado
-- ============================================================
insert into storage.buckets (id, name, public)
values ('briefing-sites', 'briefing-sites', true)
on conflict (id) do nothing;

drop policy if exists "briefing_sites_read" on storage.objects;
drop policy if exists "briefing_sites_write" on storage.objects;
drop policy if exists "briefing_sites_delete" on storage.objects;
create policy "briefing_sites_read" on storage.objects for select using (bucket_id = 'briefing-sites');
create policy "briefing_sites_write" on storage.objects for insert with check (bucket_id = 'briefing-sites' and auth.uid() is not null);
create policy "briefing_sites_delete" on storage.objects for delete using (bucket_id = 'briefing-sites' and auth.uid() is not null);
