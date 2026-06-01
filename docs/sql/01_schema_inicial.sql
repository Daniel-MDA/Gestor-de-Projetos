-- =============================================================================
-- Tecnofink CRM — Schema Inicial
-- Versão 1.0
-- Data 14052026
--
-- Para executar
--   1. Acesse o Supabase Dashboard
--   2. Menu lateral → SQL Editor
--   3. New query → cole todo este arquivo
--   4. Clique em Run (canto inferior direito) ou Ctrl+Enter
--
-- Para reverter (se quiser começar do zero)
--   Veja o bloco RESET no final, comentado.
-- =============================================================================


-- =============================================================================
-- TIPOS ENUMERADOS
-- =============================================================================
-- Garantem que só valores válidos entrem no banco.

create type papel_projeto as enum ('admin', 'editor', 'leitor');

create type status_tarefa as enum (
  'Não iniciada',
  'Em progresso',
  'Em revisão',
  'Concluída',
  'Atrasada'
);

create type prioridade_tarefa as enum ('Alta', 'Média', 'Baixa');


-- =============================================================================
-- TABELA projetos
-- =============================================================================
create table projetos (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  descricao    text,
  criado_por   uuid not null references auth.users(id) on delete restrict,
  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  arquivado    boolean not null default false
);

comment on table projetos is 'Projetos de gestão. Cada usuário pode ter acesso a múltiplos projetos com papéis diferentes.';

create index idx_projetos_arquivado on projetos (arquivado);


-- =============================================================================
-- TABELA membros_projeto
-- =============================================================================
-- Tabela-chave do sistema de permissões. O mesmo usuário pode ser admin
-- de um projeto e leitor de outro.

create table membros_projeto (
  projeto_id    uuid not null references projetos(id) on delete cascade,
  usuario_id    uuid not null references auth.users(id) on delete cascade,
  papel         papel_projeto not null default 'leitor',
  adicionado_em timestamptz not null default now(),
  adicionado_por uuid references auth.users(id) on delete set null,

  primary key (projeto_id, usuario_id)
);

comment on table membros_projeto is 'Define quem participa de cada projeto e com qual papel.';

create index idx_membros_usuario on membros_projeto (usuario_id);


-- =============================================================================
-- TABELA tarefas
-- =============================================================================
create table tarefas (
  id              uuid primary key default gen_random_uuid(),
  projeto_id      uuid not null references projetos(id) on delete cascade,
  codigo          text not null,  -- identificador legível TASK-001, TASK-002, etc.
  fase            text not null,
  titulo          text not null,
  descricao       text,
  responsavel     text,
  data_inicio     date,
  prazo           date,
  prioridade      prioridade_tarefa not null default 'Média',
  status          status_tarefa not null default 'Não iniciada',
  data_conclusao  date,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),

  -- O código é único dentro de cada projeto
  unique (projeto_id, codigo)
);

comment on table tarefas is 'Tarefas dos projetos. Substitui a planilha RQ60.';

create index idx_tarefas_projeto on tarefas (projeto_id);
create index idx_tarefas_status on tarefas (projeto_id, status);
create index idx_tarefas_prazo on tarefas (projeto_id, prazo);


-- =============================================================================
-- TABELA comentarios
-- =============================================================================
create table comentarios (
  id          uuid primary key default gen_random_uuid(),
  tarefa_id   uuid not null references tarefas(id) on delete cascade,
  autor_id    uuid not null references auth.users(id) on delete restrict,
  texto       text not null check (length(trim(texto))  0),
  criado_em   timestamptz not null default now(),
  editado_em  timestamptz
);

comment on table comentarios is 'Thread de comentários por tarefa.';

create index idx_comentarios_tarefa on comentarios (tarefa_id, criado_em);


-- =============================================================================
-- TABELA anexos
-- =============================================================================
-- Os arquivos em si ficam no Storage do Supabase. Esta tabela guarda apenas
-- referências (metadados + caminho no Storage).

create table anexos (
  id              uuid primary key default gen_random_uuid(),
  tarefa_id       uuid not null references tarefas(id) on delete cascade,
  nome_arquivo    text not null,
  storage_path    text not null,  -- caminho no bucket do Storage
  tamanho_bytes   bigint not null check (tamanho_bytes = 0),
  tipo_mime       text,
  enviado_por     uuid not null references auth.users(id) on delete restrict,
  enviado_em      timestamptz not null default now()
);

comment on table anexos is 'Metadados de arquivos anexados às tarefas. Os arquivos ficam no Supabase Storage.';

create index idx_anexos_tarefa on anexos (tarefa_id);


-- =============================================================================
-- TRIGGER atualizar atualizado_em automaticamente
-- =============================================================================
create or replace function set_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create trigger projetos_set_atualizado_em
  before update on projetos
  for each row execute function set_atualizado_em();

create trigger tarefas_set_atualizado_em
  before update on tarefas
  for each row execute function set_atualizado_em();


-- =============================================================================
-- FUNÇÕES AUXILIARES DE PERMISSÃO
-- =============================================================================
-- Usadas pelas políticas RLS. Definidas como SECURITY DEFINER pra evitar
-- recursão infinita (uma política consultando uma tabela que tem política
-- que consulta a mesma tabela...).

-- O usuário atual é membro do projeto
create or replace function is_membro(p_projeto_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from membros_projeto
    where projeto_id = p_projeto_id
      and usuario_id = auth.uid()
  );
$$;

-- Qual o papel do usuário atual neste projeto (retorna NULL se não for membro)
create or replace function get_papel(p_projeto_id uuid)
returns papel_projeto
language sql
security definer
set search_path = public
stable
as $$
  select papel from membros_projeto
  where projeto_id = p_projeto_id
    and usuario_id = auth.uid()
  limit 1;
$$;

-- O usuário atual é admin deste projeto
create or replace function is_admin(p_projeto_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select get_papel(p_projeto_id) = 'admin';
$$;

-- O usuário atual é admin OU editor
create or replace function is_editor_ou_admin(p_projeto_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select get_papel(p_projeto_id) in ('admin', 'editor');
$$;


-- =============================================================================
-- HABILITAR ROW LEVEL SECURITY
-- =============================================================================
-- Mesmo já habilitado por default no projeto, garantimos aqui.

alter table projetos         enable row level security;
alter table membros_projeto  enable row level security;
alter table tarefas          enable row level security;
alter table comentarios      enable row level security;
alter table anexos           enable row level security;


-- =============================================================================
-- POLÍTICAS RLS projetos
-- =============================================================================

-- LEITURA vê os projetos onde é membro
create policy projetos_select_membros
  on projetos for select
  using (is_membro(id));

-- INSERÇÃO qualquer usuário autenticado pode criar projeto (vira admin pelo trigger)
create policy projetos_insert_autenticados
  on projetos for insert
  with check (auth.uid() = criado_por);

-- ATUALIZAÇÃO só admins do projeto
create policy projetos_update_admin
  on projetos for update
  using (is_admin(id));

-- EXCLUSÃO só admins do projeto
create policy projetos_delete_admin
  on projetos for delete
  using (is_admin(id));


-- =============================================================================
-- TRIGGER ao criar projeto, adicionar criador como admin automaticamente
-- =============================================================================
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

create trigger projetos_after_insert_add_admin
  after insert on projetos
  for each row execute function adicionar_criador_como_admin();


-- =============================================================================
-- POLÍTICAS RLS membros_projeto
-- =============================================================================

-- LEITURA vê membros dos projetos onde ele mesmo participa
create policy membros_select_membros_do_projeto
  on membros_projeto for select
  using (is_membro(projeto_id));

-- INSERÇÃO só admin do projeto pode adicionar gente.
-- EXCEÇÃO o trigger de criação inicial roda como SECURITY DEFINER e bypassa RLS,
-- então quando o usuário cria o projeto, ele entra como admin sem problema.
create policy membros_insert_admin
  on membros_projeto for insert
  with check (is_admin(projeto_id));

-- ATUALIZAÇÃO (mudar papel) só admin
create policy membros_update_admin
  on membros_projeto for update
  using (is_admin(projeto_id));

-- EXCLUSÃO admin pode remover qualquer um; usuário pode remover a si mesmo
create policy membros_delete_admin_ou_self
  on membros_projeto for delete
  using (is_admin(projeto_id) or usuario_id = auth.uid());


-- =============================================================================
-- POLÍTICAS RLS tarefas
-- =============================================================================

-- LEITURA membros do projeto
create policy tarefas_select_membros
  on tarefas for select
  using (is_membro(projeto_id));

-- INSERÇÃO admin ou editor
create policy tarefas_insert_editor
  on tarefas for insert
  with check (is_editor_ou_admin(projeto_id));

-- ATUALIZAÇÃO admin ou editor
create policy tarefas_update_editor
  on tarefas for update
  using (is_editor_ou_admin(projeto_id));

-- EXCLUSÃO admin ou editor
create policy tarefas_delete_editor
  on tarefas for delete
  using (is_editor_ou_admin(projeto_id));


-- =============================================================================
-- POLÍTICAS RLS comentarios
-- =============================================================================
-- Funções auxiliares precisam buscar o projeto via tarefa_id

-- LEITURA membros do projeto onde a tarefa está
create policy comentarios_select_membros
  on comentarios for select
  using (
    exists (
      select 1 from tarefas t
      where t.id = comentarios.tarefa_id
        and is_membro(t.projeto_id)
    )
  );

-- INSERÇÃO admin ou editor; o autor obrigatoriamente é o usuário logado
create policy comentarios_insert_editor
  on comentarios for insert
  with check (
    autor_id = auth.uid()
    and exists (
      select 1 from tarefas t
      where t.id = comentarios.tarefa_id
        and is_editor_ou_admin(t.projeto_id)
    )
  );

-- ATUALIZAÇÃO só o autor pode editar o próprio comentário
create policy comentarios_update_autor
  on comentarios for update
  using (autor_id = auth.uid());

-- EXCLUSÃO o autor ou um admin do projeto
create policy comentarios_delete_autor_ou_admin
  on comentarios for delete
  using (
    autor_id = auth.uid()
    or exists (
      select 1 from tarefas t
      where t.id = comentarios.tarefa_id
        and is_admin(t.projeto_id)
    )
  );


-- =============================================================================
-- POLÍTICAS RLS anexos
-- =============================================================================

create policy anexos_select_membros
  on anexos for select
  using (
    exists (
      select 1 from tarefas t
      where t.id = anexos.tarefa_id
        and is_membro(t.projeto_id)
    )
  );

create policy anexos_insert_editor
  on anexos for insert
  with check (
    enviado_por = auth.uid()
    and exists (
      select 1 from tarefas t
      where t.id = anexos.tarefa_id
        and is_editor_ou_admin(t.projeto_id)
    )
  );

create policy anexos_delete_admin_ou_quem_enviou
  on anexos for delete
  using (
    enviado_por = auth.uid()
    or exists (
      select 1 from tarefas t
      where t.id = anexos.tarefa_id
        and is_admin(t.projeto_id)
    )
  );


-- =============================================================================
-- HABILITAR REALTIME nas tabelas relevantes
-- =============================================================================
-- Permite ao frontend escutar mudanças em tempo real (websocket).

alter publication supabase_realtime add table projetos;
alter publication supabase_realtime add table tarefas;
alter publication supabase_realtime add table comentarios;
alter publication supabase_realtime add table anexos;
alter publication supabase_realtime add table membros_projeto;


-- =============================================================================
-- FIM DO SCRIPT
-- =============================================================================

-- Verificação rápida lista as tabelas criadas
-- select table_name from information_schema.tables
-- where table_schema = 'public'
-- order by table_name;


-- =============================================================================
-- RESET (descomente apenas se precisar começar do zero)
-- =============================================================================
-- drop table if exists anexos cascade;
-- drop table if exists comentarios cascade;
-- drop table if exists tarefas cascade;
-- drop table if exists membros_projeto cascade;
-- drop table if exists projetos cascade;
-- drop type if exists papel_projeto;
-- drop type if exists status_tarefa;
-- drop type if exists prioridade_tarefa;
-- drop function if exists is_membro cascade;
-- drop function if exists get_papel cascade;
-- drop function if exists is_admin cascade;
-- drop function if exists is_editor_ou_admin cascade;
-- drop function if exists adicionar_criador_como_admin cascade;
-- drop function if exists set_atualizado_em cascade;