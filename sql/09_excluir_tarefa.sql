-- =============================================================================
-- 09 — Excluir tarefa: schema + RPCs
-- =============================================================================
-- 1. Adiciona coluna `criado_por` em `tarefas` (nullable).
-- 2. Atualiza `criar_tarefa` para preencher criado_por.
-- 3. Cria `listar_anexos_tarefa`.
-- 4. Cria `excluir_tarefa` (admin OU criador da tarefa).
--
-- Tarefas migradas/antigas ficam com criado_por = null. Para essas,
-- apenas admin do projeto pode excluir.
-- =============================================================================


-- ----------------------------------------------------------------------------
-- 1. Coluna criado_por
-- ----------------------------------------------------------------------------
alter table tarefas
  add column if not exists criado_por uuid references auth.users(id);


-- ----------------------------------------------------------------------------
-- 2. Atualiza criar_tarefa para gravar criado_por
-- ----------------------------------------------------------------------------
create or replace function criar_tarefa(
  p_projeto_id uuid,
  p_titulo text,
  p_fase text,
  p_descricao text default null,
  p_responsavel text default null,
  p_data_inicio date default null,
  p_prazo date default null,
  p_prioridade prioridade_tarefa default 'Média'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_caller_papel papel_projeto;
  v_existe_projeto boolean;
  v_max_num int;
  v_proximo_num int;
  v_codigo text;
  v_tarefa_id uuid;
  v_titulo_trim text;
  v_fase_trim text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('status', 'nao_autorizado');
  end if;

  select exists (
    select 1 from projetos where id = p_projeto_id
  ) into v_existe_projeto;

  if not v_existe_projeto then
    return jsonb_build_object('status', 'projeto_nao_encontrado');
  end if;

  select papel into v_caller_papel
  from membros_projeto
  where projeto_id = p_projeto_id
    and usuario_id = v_user_id;

  if v_caller_papel is null or v_caller_papel not in ('admin', 'editor') then
    return jsonb_build_object('status', 'nao_autorizado');
  end if;

  v_titulo_trim := trim(coalesce(p_titulo, ''));
  if length(v_titulo_trim) = 0 then
    return jsonb_build_object('status', 'titulo_vazio');
  end if;

  v_fase_trim := trim(coalesce(p_fase, ''));
  if length(v_fase_trim) = 0 then
    v_fase_trim := 'Sem etapa';
  end if;

  select coalesce(max(
    case
      when codigo ~ '^TASK-(\d+)$'
      then (regexp_match(codigo, '^TASK-(\d+)$'))[1]::int
      else 0
    end
  ), 0) into v_max_num
  from tarefas
  where projeto_id = p_projeto_id;

  v_proximo_num := v_max_num + 1;

  if v_proximo_num > 999 then
    return jsonb_build_object('status', 'limite_codigo_atingido');
  end if;

  v_codigo := 'TASK-' || lpad(v_proximo_num::text, 3, '0');

  insert into tarefas (
    projeto_id, codigo, fase, titulo, descricao,
    responsavel, data_inicio, prazo, prioridade, status,
    criado_por
  )
  values (
    p_projeto_id, v_codigo, v_fase_trim, v_titulo_trim,
    nullif(trim(coalesce(p_descricao, '')), ''),
    nullif(trim(coalesce(p_responsavel, '')), ''),
    p_data_inicio,
    p_prazo,
    p_prioridade,
    'Não iniciada',
    v_user_id
  )
  returning id into v_tarefa_id;

  return jsonb_build_object(
    'status',    'ok',
    'tarefa_id', v_tarefa_id,
    'codigo',    v_codigo
  );
end;
$$;


-- ----------------------------------------------------------------------------
-- 3. RPC: listar_anexos_tarefa
-- ----------------------------------------------------------------------------
create or replace function listar_anexos_tarefa(p_tarefa_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_projeto_id uuid;
  v_eh_membro boolean;
  v_paths text[];
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('status', 'nao_autorizado');
  end if;

  select projeto_id into v_projeto_id
  from tarefas
  where id = p_tarefa_id;

  if v_projeto_id is null then
    return jsonb_build_object('status', 'tarefa_nao_encontrada');
  end if;

  select exists (
    select 1 from membros_projeto
    where projeto_id = v_projeto_id
      and usuario_id = v_user_id
  ) into v_eh_membro;

  if not v_eh_membro then
    return jsonb_build_object('status', 'nao_autorizado');
  end if;

  select array_agg(storage_path) into v_paths
  from anexos
  where tarefa_id = p_tarefa_id;

  return jsonb_build_object(
    'status', 'ok',
    'paths',  coalesce(to_jsonb(v_paths), '[]'::jsonb)
  );
end;
$$;

revoke all on function listar_anexos_tarefa from public;
grant execute on function listar_anexos_tarefa to authenticated;


-- ----------------------------------------------------------------------------
-- 4. RPC: excluir_tarefa
-- ----------------------------------------------------------------------------
-- Pode excluir:
--   - admin do projeto (sempre)
--   - criador da tarefa (mesmo sendo editor)
--
-- Cascade no banco apaga comentários e anexos. Arquivos no Storage
-- são limpos ANTES, via Server Action no front (chamando listar_anexos_tarefa).
-- ----------------------------------------------------------------------------
create or replace function excluir_tarefa(p_tarefa_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_projeto_id uuid;
  v_criado_por uuid;
  v_caller_papel papel_projeto;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('status', 'nao_autorizado');
  end if;

  select projeto_id, criado_por
    into v_projeto_id, v_criado_por
  from tarefas
  where id = p_tarefa_id;

  if v_projeto_id is null then
    return jsonb_build_object('status', 'tarefa_nao_encontrada');
  end if;

  select papel into v_caller_papel
  from membros_projeto
  where projeto_id = v_projeto_id
    and usuario_id = v_user_id;

  if v_caller_papel is null then
    return jsonb_build_object('status', 'nao_autorizado');
  end if;

  -- Admin sempre; criador também
  if v_caller_papel <> 'admin' and v_criado_por is distinct from v_user_id then
    return jsonb_build_object('status', 'nao_autorizado');
  end if;

  delete from tarefas where id = p_tarefa_id;

  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function excluir_tarefa from public;
grant execute on function excluir_tarefa to authenticated;
