-- Desiberne Studio — Fase 4: dados técnicos + cobrança por projeto
-- Roda no SQL Editor DEPOIS das migrations anteriores

alter table sh_tecnico add column if not exists valor_implementacao numeric;
alter table sh_tecnico add column if not exists valor_mensalidade numeric;
alter table sh_tecnico add column if not exists status_pagamento text default 'pendente'
  check (status_pagamento in ('pendente','implementacao_paga','mensalidade_ativa','inadimplente','cancelado'));
alter table sh_tecnico add column if not exists data_inicio_mensalidade date;
