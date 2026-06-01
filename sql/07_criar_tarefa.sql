-- =============================================================================
-- 07 — RPC: criar_tarefa
-- =============================================================================
-- Cria tarefa com código automático no formato TASK-NNN (3 dígitos).
-- Próximo número é MAX existente no projeto + 1.
-- Suporta até TASK-999 por projeto.
--
-- IMPORTANTE: esta versão NÃO grava criado_por. A versão com criado_por
-- está no script 09_excluir_tarefa.sql (que altera a tabela e atualiza
-- esta função).
--
-- Retorna jsonb:
--   { status: 'ok', tarefa_id, codigo }
--   { status: 'nao_autorizado' }
--   { status: 'projeto_nao_encontrado' }
--   { status: 'titulo_vazio' }
--   { status: 'limite_codigo_atingido' }  -- ultrapassou TASK-999
-- =============================================================================


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

  -- Valida papel (admin ou editor)
  select papel into v_caller_papel
  from membros_projeto
  where projeto_id = p_projeto_id
    and usuario_id = v_user_id;

  if v_caller_papel is null or v_caller_papel not in ('admin', 'editor') then
    return jsonb_build_object('status', 'nao_autorizado');
  end if;

  -- Valida título e fase
  v_titulo_trim := trim(coalesce(p_titulo, ''));
  if length(v_titulo_trim) = 0 then
    return jsonb_build_object('status', 'titulo_vazio');
  end if;

  v_fase_trim := trim(coalesce(p_fase, ''));
  if length(v_fase_trim) = 0 then
    v_fase_trim := 'Sem etapa';
  end if;

  -- Próximo número: MAX dos códigos no formato TASK-NNN + 1
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
    responsavel, data_inicio, prazo, prioridade, status
  )
  values (
    p_projeto_id, v_codigo, v_fase_trim, v_titulo_trim,
    nullif(trim(coalesce(p_descricao, '')), ''),
    nullif(trim(coalesce(p_responsavel, '')), ''),
    p_data_inicio,
    p_prazo,
    p_prioridade,
    'Não iniciada'
  )
  returning id into v_tarefa_id;

  return jsonb_build_object(
    'status',    'ok',
    'tarefa_id', v_tarefa_id,
    'codigo',    v_codigo
  );
end;
$$;

revoke all on function criar_tarefa from public;
grant execute on function criar_tarefa to authenticated;
