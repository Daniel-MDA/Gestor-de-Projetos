-- =============================================================================
-- 06 — Zona perigosa: arquivar e excluir projetos
-- =============================================================================
-- 3 funções RPC:
--   1. arquivar_projeto      → marca arquivado=true (reversível, sem perda)
--   2. listar_anexos_projeto → retorna paths dos anexos no Storage
--                              (front limpa antes do delete no banco)
--   3. excluir_projeto       → DELETE em cascata, com confirmação por nome
--
-- Todas validam que o chamador é admin do projeto.
-- =============================================================================


-- ----------------------------------------------------------------------------
-- 1. RPC: arquivar_projeto
-- ----------------------------------------------------------------------------
create or replace function arquivar_projeto(p_projeto_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_papel papel_projeto;
  v_existe boolean;
begin
  select exists (
    select 1 from projetos where id = p_projeto_id
  ) into v_existe;

  if not v_existe then
    return jsonb_build_object('status', 'projeto_nao_encontrado');
  end if;

  select papel into v_caller_papel
  from membros_projeto
  where projeto_id = p_projeto_id
    and usuario_id = auth.uid();

  if v_caller_papel is null or v_caller_papel <> 'admin' then
    return jsonb_build_object('status', 'nao_autorizado');
  end if;

  update projetos
  set arquivado = true
  where id = p_projeto_id;

  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function arquivar_projeto from public;
grant execute on function arquivar_projeto to authenticated;


-- ----------------------------------------------------------------------------
-- 2. RPC: listar_anexos_projeto
-- ----------------------------------------------------------------------------
-- Usada pela Server Action de exclusão para limpar o Storage antes
-- do DELETE no banco.
-- ----------------------------------------------------------------------------
create or replace function listar_anexos_projeto(p_projeto_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_papel papel_projeto;
  v_paths text[];
begin
  select papel into v_caller_papel
  from membros_projeto
  where projeto_id = p_projeto_id
    and usuario_id = auth.uid();

  if v_caller_papel is null or v_caller_papel <> 'admin' then
    return jsonb_build_object('status', 'nao_autorizado');
  end if;

  select array_agg(a.storage_path) into v_paths
  from anexos a
  join tarefas t on t.id = a.tarefa_id
  where t.projeto_id = p_projeto_id;

  return jsonb_build_object(
    'status', 'ok',
    'paths',  coalesce(to_jsonb(v_paths), '[]'::jsonb)
  );
end;
$$;

revoke all on function listar_anexos_projeto from public;
grant execute on function listar_anexos_projeto to authenticated;


-- ----------------------------------------------------------------------------
-- 3. RPC: excluir_projeto
-- ----------------------------------------------------------------------------
-- Exige confirmação digitando o nome do projeto (proteção contra acidente).
-- Cascade no banco já apaga tudo, mas fazemos explicitamente para ser
-- à prova de schemas alterados.
-- ----------------------------------------------------------------------------
create or replace function excluir_projeto(
  p_projeto_id uuid,
  p_nome_confirmacao text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_papel papel_projeto;
  v_nome_real text;
begin
  select nome into v_nome_real
  from projetos
  where id = p_projeto_id;

  if v_nome_real is null then
    return jsonb_build_object('status', 'projeto_nao_encontrado');
  end if;

  select papel into v_caller_papel
  from membros_projeto
  where projeto_id = p_projeto_id
    and usuario_id = auth.uid();

  if v_caller_papel is null or v_caller_papel <> 'admin' then
    return jsonb_build_object('status', 'nao_autorizado');
  end if;

  if trim(coalesce(p_nome_confirmacao, '')) <> v_nome_real then
    return jsonb_build_object('status', 'nome_nao_confere');
  end if;

  -- DELETE explícito (cascade no banco também cobriria, mas
  -- explicitamos para robustez)
  delete from anexos
  where tarefa_id in (
    select id from tarefas where projeto_id = p_projeto_id
  );

  delete from comentarios
  where tarefa_id in (
    select id from tarefas where projeto_id = p_projeto_id
  );

  delete from tarefas where projeto_id = p_projeto_id;
  delete from membros_projeto where projeto_id = p_projeto_id;
  delete from projetos where id = p_projeto_id;

  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function excluir_projeto from public;
grant execute on function excluir_projeto to authenticated;
