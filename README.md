# Desiberne Studio

App de gestão de projetos de desenvolvimento da Desiberne — clientes, discovery, documentação e acompanhamento técnico de cada projeto de software. Separado do [desiberne-crm](https://github.com/desiberneia-netizen/desiberne-crm) (CRM comercial de leads) de propósito: são domínios de negócio diferentes.

Especificação completa: PRD "Módulo Software House" (Fases 0–4, modelo de dados, wizard de discovery, regras de negócio, permissões).

## Stack

- Vite + React
- Supabase (mesmo projeto do desiberne-crm, tabelas com prefixo `sh_`, RLS restrita — nunca `USING (true)`)

## Setup

```
npm install
cp .env.example .env   # preencher VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev
```

Schema do banco em [`supabase/schema.sql`](supabase/schema.sql) — rodar no SQL Editor do mesmo projeto Supabase do desiberne-crm.

## Status

Fase 0 (fundação) — scaffold do projeto e schema inicial (`sh_clientes`, `sh_projetos`, `sh_discovery_snapshots`, `sh_documentos_gerados`, `sh_backlog_itens`, `sh_timeline_eventos`, `sh_tecnico`). UI ainda não implementada.
