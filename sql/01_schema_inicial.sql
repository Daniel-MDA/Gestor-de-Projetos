-- =============================================================================
-- 01 — Schema inicial
-- =============================================================================
-- Cria estrutura base do sistema:
--   - Tipos enumerados (papel, prioridade, status)
--   - 5 tabelas (projetos, membros_projeto, tarefas, comentarios, anexos)
--   - Triggers (set_atualizado_em, adicionar_criador_como_admin)
--   - Funções helper (is_membro, get_papel, is_admin, is_editor_ou_admin)
--   - RLS habilitado em todas as tabelas
--   - Policies base
--
-- IMPORTANTE: tipos enumerados não são idempotentes. Rode este script
-- apenas uma vez em projeto novo. Para re-aplicar, faça drop manual antes.
-- =============================================================================


-- ----------------------------------------------------------------------------
-- Tipos enumerados
-- ----------------------------------------------------------------------------
create type papel_projeto as enum ('admin', 'editor', 'leitor');

create type prioridade_tarefa as enum ('Alta', 'Média', 'Baixa');

create type status_tarefa as enum (
  'Não iniciada',
  'Em progresso',
  'Em revisão',
  'Concluída',
  'Atrasada'
);


-- ----------------------------------------------------------------------------
-- Tabela: projetos
-- ----------------------------------------------------------------------------
create table projetos (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  descricao       text,
  criado_por      uuid not null references auth.users(id),
  criado_em       timestamptz default now(),
  atualizado_em   timestamptz default now(),
  arquivado       boolean default false
);

create index idx_projetos_criado_por on projetos(criado_por);
create index idx_projetos_arquivado on projetos(arquivado);


-- ----------------------------------------------------------------------------
-- Tabela: membros_projeto
-- ----------------------------------------------------------------------------
create table membros_projeto (
  projeto_id      uuid not null references projetos(id) on delete cascade,
  usuario_id      uuid not null references auth.users(id),
  papel           papel_projeto not null,
  adicionado_em   timestamptz default now(),
  adicionado_por  uuid references auth.users(id),
  primary key (projeto_id, usuario_id)
);

create index idx_membros_usuario on membros_projeto(usuario_id);


-- ----------------------------------------------------------------------------
-- Tabela: tarefas
-- ----------------------------------------------------------------------------
create table tarefas (
  id              uuid primary key default gen_random_uuid(),
  projeto_id      uuid not null references projetos(id) on delete cascade,
  codigo          text not null,
  fase            text not null,
  titulo          text not null,
  descricao       text,
  responsavel     text,
  data_inicio     date,
  prazo           date,
  prioridade      prioridade_tarefa default 'Média',
  status          status_tarefa default 'Não iniciada',
  data_conclusao  date,
  criado_em       timestamptz default now(),
  atualizado_em   timestamptz default now(),
  unique (projeto_id, codigo)
);

create index idx_tarefas_projeto on tarefas(projeto_id);
create index idx_tarefas_status on tarefas(status);
create index idx_tarefas_prazo on tarefas(prazo);


-- ----------------------------------------------------------------------------
-- Tabela: comentarios
-- ----------------------------------------------------------------------------
create table comentarios (
  id          uuid primary key default gen_random_uuid(),
  tarefa_id   uuid not null references tarefas(id) on delete cascade,
  autor_id    uuid not null references auth.users(id),
  texto       text not null,
  criado_em   timestamptz default now(),
  editado_em  timestamptz
);

create index idx_comentarios_tarefa on comentarios(tarefa_id);


-- ----------------------------------------------------------------------------
-- Tabela: anexos
-- ----------------------------------------------------------------------------
create table anexos (
  id              uuid primary key default gen_random_uuid(),
  tarefa_id       uuid not null references tarefas(id) on delete cascade,
  nome_arquivo    text not null,
  storage_path    text not null,
  tamanho_bytes   int8 not null,
  tipo_mime       text,
  enviado_por     uuid not null references auth.users(id),
  enviado_em      timestamptz default now()
);

create index idx_anexos_tarefa on anexos(tarefa_id);


-- ----------------------------------------------------------------------------
-- Trigger genérico: atualiza coluna atualizado_em em UPDATE
-- ----------------------------------------------------------------------------
create or replace function set_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create trigger trg_projetos_atualizado_em
  before update on projetos
  for each row execute function set_atualizado_em();

create trigger trg_tarefas_atualizado_em
  before update on tarefas
  for each row execute function set_atualizado_em();


-- ----------------------------------------------------------------------------
-- Trigger: ao criar projeto, adiciona o criador como admin
-- ----------------------------------------------------------------------------
create or replace function adicionar_criador_como_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into membros_projeto (projeto_id, usuario_id, papel, adicionado_por)
  values (new.id, new.criado_por, 'admin', new.criado_por);
  return new;
end;
$$;

create trigger trg_projetos_adicionar_admin
  after insert on projetos
  for each row execute function adicionar_criador_como_admin();


-- ----------------------------------------------------------------------------
-- Funções helper para RLS
-- ----------------------------------------------------------------------------
create or replace function is_membro(p_projeto_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(
    select 1 from membros_projeto
    where projeto_id = p_projeto_id and usuario_id = auth.uid()
  );
$$;

create or replace function get_papel(p_projeto_id uuid)
returns papel_projeto
language sql
security definer
stable
set search_path = public
as $$
  select papel from membros_projeto
  where projeto_id = p_projeto_id and usuario_id = auth.uid();
$$;

create or replace function is_admin(p_projeto_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select get_papel(p_projeto_id) = 'admin';
$$;

create or replace function is_editor_ou_admin(p_projeto_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select get_papel(p_projeto_id) in ('admin', 'editor');
$$;


-- ----------------------------------------------------------------------------
-- RLS: habilitar em todas as tabelas
-- ----------------------------------------------------------------------------
alter table projetos enable row level security;
alter table membros_projeto enable row level security;
alter table tarefas enable row level security;
alter table comentarios enable row level security;
alter table anexos enable row level security;


-- ----------------------------------------------------------------------------
-- Policies — projetos
-- ----------------------------------------------------------------------------
create policy projetos_select_membros on projetos
  for select to authenticated
  using (is_membro(id));

create policy projetos_insert_autenticados on projetos
  for insert to authenticated
  with check (auth.uid() = criado_por);

create policy projetos_update_admin on projetos
  for update to authenticated
  using (is_admin(id));

create policy projetos_delete_admin on projetos
  for delete to authenticated
  using (is_admin(id));


-- ----------------------------------------------------------------------------
-- Policies — membros_projeto
-- ----------------------------------------------------------------------------
create policy membros_select_membros on membros_projeto
  for select to authenticated
  using (is_membro(projeto_id));

create policy membros_insert_admin on membros_projeto
  for insert to authenticated
  with check (is_admin(projeto_id));

create policy membros_update_admin on membros_projeto
  for update to authenticated
  using (is_admin(projeto_id));

create policy membros_delete_admin on membros_projeto
  for delete to authenticated
  using (is_admin(projeto_id));


-- ----------------------------------------------------------------------------
-- Policies — tarefas
-- ----------------------------------------------------------------------------
create policy tarefas_select_membros on tarefas
  for select to authenticated
  using (is_membro(projeto_id));

create policy tarefas_insert_editor on tarefas
  for insert to authenticated
  with check (is_editor_ou_admin(projeto_id));

create policy tarefas_update_editor on tarefas
  for update to authenticated
  using (is_editor_ou_admin(projeto_id));

create policy tarefas_delete_admin on tarefas
  for delete to authenticated
  using (is_admin(projeto_id));


-- ----------------------------------------------------------------------------
-- Policies — comentarios
-- ----------------------------------------------------------------------------
create policy comentarios_select_membros on comentarios
  for select to authenticated
  using (is_membro(
    (select projeto_id from tarefas where id = comentarios.tarefa_id)
  ));

create policy comentarios_insert_membros on comentarios
  for insert to authenticated
  with check (
    autor_id = auth.uid() and is_membro(
      (select projeto_id from tarefas where id = comentarios.tarefa_id)
    )
  );

create policy comentarios_update_autor on comentarios
  for update to authenticated
  using (autor_id = auth.uid());

create policy comentarios_delete_autor_admin on comentarios
  for delete to authenticated
  using (
    autor_id = auth.uid()
    or is_admin((select projeto_id from tarefas where id = comentarios.tarefa_id))
  );


-- ----------------------------------------------------------------------------
-- Policies — anexos
-- ----------------------------------------------------------------------------
create policy anexos_select_membros on anexos
  for select to authenticated
  using (is_membro(
    (select projeto_id from tarefas where id = anexos.tarefa_id)
  ));

create policy anexos_insert_editor on anexos
  for insert to authenticated
  with check (
    enviado_por = auth.uid()
    and is_editor_ou_admin(
      (select projeto_id from tarefas where id = anexos.tarefa_id)
    )
  );

create policy anexos_delete_autor_admin on anexos
  for delete to authenticated
  using (
    enviado_por = auth.uid()
    or is_admin((select projeto_id from tarefas where id = anexos.tarefa_id))
  );


-- ----------------------------------------------------------------------------
-- Realtime: habilitar em tarefas e comentarios
-- ----------------------------------------------------------------------------
alter table tarefas replica identity full;
alter table comentarios replica identity full;

alter publication supabase_realtime add table tarefas;
alter publication supabase_realtime add table comentarios;
