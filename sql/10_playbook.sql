-- =============================================================================
-- 10 — Playbook 2026 (schema, RLS de 3 níveis, storage)
-- =============================================================================
-- Porta o "Playbook 2026" (antes um HTML+localStorage) para tabelas no Postgres.
--
-- 3 NÍVEIS DE ACESSO (aplicados via RLS, não só na UI):
--   • Público (anon)        -> lê o conteúdo básico de todas as seções
--   • Logado (authenticated) -> lê TUDO, inclusive dados sensíveis
--                               (login/senha do Portal + leads pessoais/PII)
--   • Editor (playbook_editores + is_playbook_editor()) -> escreve
--
-- O playbook é uma instância GLOBAL única (não é multi-projeto), então não há
-- projeto_id/membros_projeto aqui — o controle é por is_playbook_editor().
--
-- Reaproveita do projeto: gen_random_uuid(), trigger set_atualizado_em()
-- (definido em 01_schema_inicial.sql), anexos via Storage (nunca base64).
--
-- IDEMPOTÊNCIA: o bloco de TEARDOWN abaixo dropa tudo do playbook antes de
-- recriar, então este script pode ser reaplicado com segurança durante o setup.
-- ATENÇÃO: o teardown APAGA os dados do playbook. Use só em setup/reset.
-- Não afeta nenhuma tabela do gestor de tarefas (objetos isolados).
-- =============================================================================


-- ----------------------------------------------------------------------------
-- TEARDOWN (reset seguro — só objetos do playbook)
-- ----------------------------------------------------------------------------
drop table if exists
  playbook_workshop_produtos, playbook_workshops,
  playbook_stand_docs, playbook_stands2027,
  playbook_brinde_usos, playbook_brindes,
  playbook_prospeccao_eventos, playbook_prospeccao_setores,
  playbook_associacao_beneficios, playbook_associacoes,
  playbook_portais, playbook_leads_manuais, playbook_leads,
  playbook_custos, playbook_logistica_docs, playbook_logistica,
  playbook_checklist_marcacoes, playbook_itens, playbook_categorias, playbook_setores,
  playbook_catalogo_consumo, playbook_catalogos, playbook_eventos_catalogo,
  playbook_eventos,
  playbook_editores
  cascade;

drop function if exists is_playbook_editor() cascade;

drop type if exists
  playbook_tipo_evento, playbook_status_evento, playbook_grupo_catalogo,
  playbook_doc_slot, playbook_lead_origem, playbook_participacao,
  playbook_stand_status, playbook_stand_doc_slot
  cascade;


-- ----------------------------------------------------------------------------
-- Tipos enumerados
-- ----------------------------------------------------------------------------
create type playbook_tipo_evento   as enum ('nacional', 'internacional');
create type playbook_status_evento as enum ('NÃO INICIADO', 'EM ANDAMENTO', 'CONCLUÍDO');
create type playbook_grupo_catalogo as enum ('gerais', 'powerpoxi');
create type playbook_doc_slot      as enum ('stand', 'buffet', 'organizacao', 'planta', 'outro');
create type playbook_lead_origem   as enum ('Cartão de visita', 'Aplicativo', 'Outro');
create type playbook_participacao  as enum ('A avaliar', 'Stand', 'Presença de equipe', 'Stand + equipe');
create type playbook_stand_status  as enum ('A avaliar', 'Orçamento solicitado', 'Reservado', 'Confirmado / Pago');
create type playbook_stand_doc_slot as enum ('planta', 'projeto');


-- ----------------------------------------------------------------------------
-- Editores do playbook + helper de autorização
-- ----------------------------------------------------------------------------
create table playbook_editores (
  usuario_id     uuid primary key references auth.users(id) on delete cascade,
  adicionado_em  timestamptz default now(),
  adicionado_por uuid references auth.users(id)
);

-- Espelha is_admin/is_editor_ou_admin (security definer stable) de 01_schema_inicial.
create or replace function is_playbook_editor()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(
    select 1 from playbook_editores where usuario_id = auth.uid()
  );
$$;


-- ============================================================================
-- SEÇÃO 01 — Eventos
-- ============================================================================
create table playbook_eventos (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique,
  nome           text not null,
  local          text,
  data           text not null default 'A definir',
  tipo           playbook_tipo_evento not null default 'nacional',
  status         playbook_status_evento not null default 'NÃO INICIADO',
  obs            text default '',
  is_custom      boolean not null default false,
  ordem          int not null default 0,
  atualizado_por uuid references auth.users(id),
  criado_em      timestamptz default now(),
  atualizado_em  timestamptz default now()
);


-- ============================================================================
-- SEÇÃO 02 — Catálogos
-- ============================================================================
create table playbook_eventos_catalogo (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  data           text,
  ordem          int not null default 0,
  atualizado_por uuid references auth.users(id),
  criado_em      timestamptz default now(),
  atualizado_em  timestamptz default now()
);

create table playbook_catalogos (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  grupo          playbook_grupo_catalogo not null default 'gerais',
  estoque        int not null default 0 check (estoque >= 0),
  consumo_anual  int not null default 0 check (consumo_anual >= 0),
  is_custom      boolean not null default false,
  ordem          int not null default 0,
  atualizado_por uuid references auth.users(id),
  criado_em      timestamptz default now(),
  atualizado_em  timestamptz default now()
);

create table playbook_catalogo_consumo (
  catalogo_id         uuid not null references playbook_catalogos(id) on delete cascade,
  evento_catalogo_id  uuid not null references playbook_eventos_catalogo(id) on delete cascade,
  qtd                 int not null default 0 check (qtd >= 0),
  primary key (catalogo_id, evento_catalogo_id)
);


-- ============================================================================
-- SEÇÃO 03 — Checklist / Página da Feira
-- ============================================================================
create table playbook_setores (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  ordem          int not null default 0,
  atualizado_por uuid references auth.users(id),
  criado_em      timestamptz default now(),
  atualizado_em  timestamptz default now()
);

create table playbook_categorias (
  id             uuid primary key default gen_random_uuid(),
  slug           text,
  nome           text not null,
  setor_id       uuid references playbook_setores(id) on delete set null,
  ordem          int not null default 0,
  atualizado_por uuid references auth.users(id),
  criado_em      timestamptz default now(),
  atualizado_em  timestamptz default now()
);

create table playbook_itens (
  id             uuid primary key default gen_random_uuid(),
  categoria_id   uuid not null references playbook_categorias(id) on delete cascade,
  slug           text,
  nome           text not null,
  ordem          int not null default 0,
  atualizado_por uuid references auth.users(id),
  criado_em      timestamptz default now(),
  atualizado_em  timestamptz default now()
);

-- checklists[eventoId][itemId] + quantidades[eventoId][itemId] consolidados
create table playbook_checklist_marcacoes (
  evento_id      uuid not null references playbook_eventos(id) on delete cascade,
  item_id        uuid not null references playbook_itens(id) on delete cascade,
  marcado        boolean not null default false,
  qtd            int check (qtd >= 0),
  atualizado_por uuid references auth.users(id),
  atualizado_em  timestamptz default now(),
  primary key (evento_id, item_id)
);

create table playbook_logistica (
  id             uuid primary key default gen_random_uuid(),
  evento_id      uuid not null unique references playbook_eventos(id) on delete cascade,
  hotel          text,
  transporte     text,
  obs            text,
  colaboradores  text[] not null default '{}',
  atualizado_por uuid references auth.users(id),
  criado_em      timestamptz default now(),
  atualizado_em  timestamptz default now()
);

create table playbook_logistica_docs (
  id             uuid primary key default gen_random_uuid(),
  logistica_id   uuid not null references playbook_logistica(id) on delete cascade,
  slot           playbook_doc_slot not null default 'outro',
  titulo         text,
  nome_arquivo   text,
  storage_path   text,
  link           text,
  ordem          int not null default 0,
  atualizado_por uuid references auth.users(id),
  criado_em      timestamptz default now(),
  atualizado_em  timestamptz default now()
);

create table playbook_custos (
  id             uuid primary key default gen_random_uuid(),
  logistica_id   uuid not null references playbook_logistica(id) on delete cascade,
  descricao      text not null default '',
  valor          numeric(12,2) not null default 0 check (valor >= 0),
  ordem          int not null default 0,
  criado_em      timestamptz default now(),
  atualizado_em  timestamptz default now()
);

create table playbook_leads (
  id                            uuid primary key default gen_random_uuid(),
  evento_id                     uuid not null unique references playbook_eventos(id) on delete cascade,
  planilha_nome                 text,
  planilha_storage_path         text,
  planilha_link                 text,
  manual_planilha_nome          text,
  manual_planilha_storage_path  text,
  manual_planilha_link          text,
  atualizado_por                uuid references auth.users(id),
  criado_em                     timestamptz default now(),
  atualizado_em                 timestamptz default now()
);

-- Contém dados pessoais (LGPD) -> SELECT só-autenticado (ver bloco de RLS)
create table playbook_leads_manuais (
  id             uuid primary key default gen_random_uuid(),
  leads_id       uuid not null references playbook_leads(id) on delete cascade,
  nome           text,
  empresa        text,
  cargo          text,
  email          text,
  telefone       text,
  origem         playbook_lead_origem not null default 'Cartão de visita',
  obs            text,
  ordem          int not null default 0,
  atualizado_por uuid references auth.users(id),
  criado_em      timestamptz default now(),
  atualizado_em  timestamptz default now()
);

-- Credenciais (login/senha) -> SELECT só-autenticado (ver bloco de RLS)
create table playbook_portais (
  id             uuid primary key default gen_random_uuid(),
  evento_id      uuid not null unique references playbook_eventos(id) on delete cascade,
  link           text,
  login          text,
  senha          text,
  atualizado_por uuid references auth.users(id),
  criado_em      timestamptz default now(),
  atualizado_em  timestamptz default now()
);


-- ============================================================================
-- SEÇÃO 04 — Associações
-- ============================================================================
create table playbook_associacoes (
  id             uuid primary key default gen_random_uuid(),
  slug           text,
  nome           text not null,
  desconto       numeric(5,2) check (desconto >= 0 and desconto <= 100),
  ordem          int not null default 0,
  atualizado_por uuid references auth.users(id),
  criado_em      timestamptz default now(),
  atualizado_em  timestamptz default now()
);

create table playbook_associacao_beneficios (
  id             uuid primary key default gen_random_uuid(),
  associacao_id  uuid not null references playbook_associacoes(id) on delete cascade,
  texto          text not null,
  ordem          int not null default 0,
  criado_em      timestamptz default now(),
  atualizado_em  timestamptz default now()
);


-- ============================================================================
-- SEÇÃO 05 — Prospecção / Sugerir novos eventos
-- ============================================================================
create table playbook_prospeccao_setores (
  id             uuid primary key default gen_random_uuid(),
  slug           text,
  nome           text not null,
  ordem          int not null default 0,
  atualizado_por uuid references auth.users(id),
  criado_em      timestamptz default now(),
  atualizado_em  timestamptz default now()
);

create table playbook_prospeccao_eventos (
  id             uuid primary key default gen_random_uuid(),
  setor_id       uuid not null references playbook_prospeccao_setores(id) on delete cascade,
  nome           text not null,
  link           text,
  participacao   playbook_participacao not null default 'A avaliar',
  obs            text default '',
  ordem          int not null default 0,
  atualizado_por uuid references auth.users(id),
  criado_em      timestamptz default now(),
  atualizado_em  timestamptz default now()
);


-- ============================================================================
-- SEÇÃO 06 — Brindes
-- ============================================================================
create table playbook_brindes (
  id              uuid primary key default gen_random_uuid(),
  slug            text,
  nome            text not null,
  estoque_inicial int check (estoque_inicial >= 0),
  ordem           int not null default 0,
  atualizado_por  uuid references auth.users(id),
  criado_em       timestamptz default now(),
  atualizado_em   timestamptz default now()
);

create table playbook_brinde_usos (
  id          uuid primary key default gen_random_uuid(),
  brinde_id   uuid not null references playbook_brindes(id) on delete cascade,
  motivo      text,
  qtd         int not null default 0 check (qtd >= 0),
  ordem       int not null default 0,
  criado_em   timestamptz default now(),
  atualizado_em timestamptz default now()
);


-- ============================================================================
-- SEÇÃO 07 — Stands 2027
-- ============================================================================
create table playbook_stands2027 (
  id             uuid primary key default gen_random_uuid(),
  nome           text,
  local          text,
  data           text,
  data_limite    text,
  status         playbook_stand_status not null default 'A avaliar',
  valor          numeric(12,2) check (valor >= 0),
  obs            text,
  ordem          int not null default 0,
  atualizado_por uuid references auth.users(id),
  criado_em      timestamptz default now(),
  atualizado_em  timestamptz default now()
);

create table playbook_stand_docs (
  id             uuid primary key default gen_random_uuid(),
  stand_id       uuid not null references playbook_stands2027(id) on delete cascade,
  slot           playbook_stand_doc_slot not null,
  nome_arquivo   text,
  storage_path   text,
  link           text,
  criado_em      timestamptz default now(),
  atualizado_em  timestamptz default now(),
  unique (stand_id, slot)
);


-- ============================================================================
-- SEÇÃO 08 — Workshops
-- ============================================================================
create table playbook_workshops (
  id             uuid primary key default gen_random_uuid(),
  tema           text default '',
  organizador    text,
  local          text,
  data           text,
  obs            text,
  ordem          int not null default 0,
  atualizado_por uuid references auth.users(id),
  criado_em      timestamptz default now(),
  atualizado_em  timestamptz default now()
);

create table playbook_workshop_produtos (
  id           uuid primary key default gen_random_uuid(),
  workshop_id  uuid not null references playbook_workshops(id) on delete cascade,
  texto        text not null,
  ordem        int not null default 0,
  criado_em    timestamptz default now(),
  atualizado_em timestamptz default now()
);


-- ----------------------------------------------------------------------------
-- Índices de FK (joins por evento/categoria/etc.)
-- ----------------------------------------------------------------------------
create index idx_pb_catalogo_consumo_evento on playbook_catalogo_consumo(evento_catalogo_id);
create index idx_pb_categorias_setor        on playbook_categorias(setor_id);
create index idx_pb_itens_categoria         on playbook_itens(categoria_id);
create index idx_pb_marcacoes_item          on playbook_checklist_marcacoes(item_id);
create index idx_pb_logistica_docs_log      on playbook_logistica_docs(logistica_id);
create index idx_pb_custos_log              on playbook_custos(logistica_id);
create index idx_pb_leads_manuais_leads     on playbook_leads_manuais(leads_id);
create index idx_pb_assoc_benef_assoc       on playbook_associacao_beneficios(associacao_id);
create index idx_pb_prosp_eventos_setor     on playbook_prospeccao_eventos(setor_id);
create index idx_pb_brinde_usos_brinde      on playbook_brinde_usos(brinde_id);
create index idx_pb_stand_docs_stand        on playbook_stand_docs(stand_id);
create index idx_pb_workshop_prod_workshop  on playbook_workshop_produtos(workshop_id);


-- ----------------------------------------------------------------------------
-- Triggers set_atualizado_em (em toda tabela com coluna atualizado_em)
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
  tabelas text[] := array[
    'playbook_eventos','playbook_eventos_catalogo','playbook_catalogos',
    'playbook_setores','playbook_categorias','playbook_itens',
    'playbook_checklist_marcacoes','playbook_logistica','playbook_logistica_docs',
    'playbook_custos','playbook_leads','playbook_leads_manuais','playbook_portais',
    'playbook_associacoes','playbook_associacao_beneficios',
    'playbook_prospeccao_setores','playbook_prospeccao_eventos',
    'playbook_brindes','playbook_brinde_usos',
    'playbook_stands2027','playbook_stand_docs',
    'playbook_workshops','playbook_workshop_produtos'
  ];
begin
  foreach t in array tabelas loop
    execute format('drop trigger if exists trg_%s_atualizado_em on %I', t, t);
    execute format(
      'create trigger trg_%s_atualizado_em before update on %I
         for each row execute function set_atualizado_em()', t, t);
  end loop;
end $$;


-- ----------------------------------------------------------------------------
-- RLS — habilitar + policies dos 3 níveis
-- ----------------------------------------------------------------------------
-- editores: logado vê quem edita; SEM policy de escrita por editor
-- (evita auto-promoção — gestão de editores é via service_role/seed).
alter table playbook_editores enable row level security;
drop policy if exists playbook_editores_sel on playbook_editores;
create policy playbook_editores_sel on playbook_editores
  for select to authenticated using (true);

-- Conteúdo: SELECT público + escrita só-editor (tabelas "públicas");
-- duas exceções (PII/credenciais) com SELECT só-autenticado.
do $$
declare
  t text;
  publicas text[] := array[
    'playbook_eventos','playbook_eventos_catalogo','playbook_catalogos',
    'playbook_catalogo_consumo','playbook_setores','playbook_categorias',
    'playbook_itens','playbook_checklist_marcacoes','playbook_logistica',
    'playbook_logistica_docs','playbook_custos','playbook_leads',
    'playbook_associacoes','playbook_associacao_beneficios',
    'playbook_prospeccao_setores','playbook_prospeccao_eventos',
    'playbook_brindes','playbook_brinde_usos','playbook_stands2027',
    'playbook_stand_docs','playbook_workshops','playbook_workshop_produtos'
  ];
  sensiveis text[] := array['playbook_leads_manuais','playbook_portais'];
  todas text[] := publicas || sensiveis;
begin
  -- habilita RLS + escrita só-editor em todas as tabelas de conteúdo
  foreach t in array todas loop
    execute format('alter table %I enable row level security', t);

    execute format('drop policy if exists %I on %I', t || '_ins_editor', t);
    execute format('create policy %I on %I for insert to authenticated with check (is_playbook_editor())', t || '_ins_editor', t);

    execute format('drop policy if exists %I on %I', t || '_upd_editor', t);
    execute format('create policy %I on %I for update to authenticated using (is_playbook_editor()) with check (is_playbook_editor())', t || '_upd_editor', t);

    execute format('drop policy if exists %I on %I', t || '_del_editor', t);
    execute format('create policy %I on %I for delete to authenticated using (is_playbook_editor())', t || '_del_editor', t);
  end loop;

  -- SELECT público (anon + logado)
  foreach t in array publicas loop
    execute format('drop policy if exists %I on %I', t || '_sel_pub', t);
    execute format('create policy %I on %I for select to anon, authenticated using (true)', t || '_sel_pub', t);
  end loop;

  -- SELECT só-logado (dados sensíveis: PII de leads + credenciais de portal)
  foreach t in array sensiveis loop
    execute format('drop policy if exists %I on %I', t || '_sel_auth', t);
    execute format('create policy %I on %I for select to authenticated using (true)', t || '_sel_auth', t);
  end loop;
end $$;


-- ----------------------------------------------------------------------------
-- Storage — 2 buckets
--   • playbook-publico : docs de logística e de stands (PDF/imagem) — leitura
--                        pública (bucket public), escrita só-editor.
--   • playbook-leads   : planilhas de leads (PII) — privado, leitura só-logado,
--                        escrita só-editor.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('playbook-publico', 'playbook-publico', true, 10485760)
on conflict (id) do update set public = excluded.public;

insert into storage.buckets (id, name, public, file_size_limit)
values ('playbook-leads', 'playbook-leads', false, 10485760)
on conflict (id) do update set public = excluded.public;

-- playbook-publico: leitura pública (bucket public dispensa policy de select);
-- escrita só-editor.
drop policy if exists "playbook_publico_insert_editor" on storage.objects;
create policy "playbook_publico_insert_editor"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'playbook-publico' and is_playbook_editor());

drop policy if exists "playbook_publico_update_editor" on storage.objects;
create policy "playbook_publico_update_editor"
  on storage.objects for update to authenticated
  using (bucket_id = 'playbook-publico' and is_playbook_editor());

drop policy if exists "playbook_publico_delete_editor" on storage.objects;
create policy "playbook_publico_delete_editor"
  on storage.objects for delete to authenticated
  using (bucket_id = 'playbook-publico' and is_playbook_editor());

-- playbook-leads: leitura só-logado, escrita só-editor.
drop policy if exists "playbook_leads_select_auth" on storage.objects;
create policy "playbook_leads_select_auth"
  on storage.objects for select to authenticated
  using (bucket_id = 'playbook-leads');

drop policy if exists "playbook_leads_insert_editor" on storage.objects;
create policy "playbook_leads_insert_editor"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'playbook-leads' and is_playbook_editor());

drop policy if exists "playbook_leads_delete_editor" on storage.objects;
create policy "playbook_leads_delete_editor"
  on storage.objects for delete to authenticated
  using (bucket_id = 'playbook-leads' and is_playbook_editor());


-- ----------------------------------------------------------------------------
-- Seed dos editores (Daniel + Fernanda), resolvidos por e-mail
-- ----------------------------------------------------------------------------
insert into playbook_editores (usuario_id)
select id from auth.users
where lower(email) in ('analista.dados1@tecnofink.com', 'marketing@tecnofink.com')
on conflict (usuario_id) do nothing;


-- =============================================================================
-- Fim do 10_playbook.sql — o conteúdo-semente (eventos, catálogos, checklist,
-- etc.) é inserido em 11_playbook_seed.sql.
-- =============================================================================
