-- Desiberne Studio — Biblioteca de Referências (por departamento/segmento)
-- Roda no SQL Editor DEPOIS de todas as migrations anteriores

create table if not exists sh_referencias (
  id uuid primary key default gen_random_uuid(),
  departamento text not null,
  url text not null,
  motivo text,
  criado_por uuid,
  created_at timestamptz default now()
);

alter table sh_referencias enable row level security;
drop policy if exists "sh_read_authenticated" on sh_referencias;
drop policy if exists "sh_write_admin_gestor" on sh_referencias;
drop policy if exists "sh_update_admin_gestor" on sh_referencias;
drop policy if exists "sh_delete_admin_gestor" on sh_referencias;
create policy "sh_read_authenticated" on sh_referencias for select using (auth.uid() is not null);
create policy "sh_write_admin_gestor" on sh_referencias for insert with check (sh_papel_atual() in ('sh_admin','sh_gestor'));
create policy "sh_update_admin_gestor" on sh_referencias for update using (sh_papel_atual() in ('sh_admin','sh_gestor'));
create policy "sh_delete_admin_gestor" on sh_referencias for delete using (sh_papel_atual() in ('sh_admin','sh_gestor'));
