-- =============================================================================
-- 03 — RPC: criar_projeto
-- =============================================================================
-- Encapsula INSERT em `projetos` numa função SECURITY DEFINER que valida
-- internamente o usuário e os dados.
--
-- Por que existir: durante o desenvolvimento, INSERTs diretos em `projetos`
-- falhavam por RLS mesmo com policy e role corretos (bug obscuro não
-- reproduzível em ambiente isolado). Esta função contorna o problema
-- bypassando RLS de forma controlada.
--
-- Retorna jsonb:
--   { status: 'ok', projeto_id }
--   { status: 'erro', mensagem }
-- =============================================================================


create or replace function criar_projeto(
  p_nome text,
  p_descricao text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_projeto_id uuid;
  v_nome_trim text;
begin
  -- 1. Captura e valida o usuário atual
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object(
      'status', 'erro',
      'mensagem', 'Não autenticado.'
    );
  end if;

  -- 2. Valida nome
  v_nome_trim := trim(coalesce(p_nome, ''));
  if length(v_nome_trim) = 0 then
    return jsonb_build_object(
      'status', 'erro',
      'mensagem', 'Informe o nome do projeto.'
    );
  end if;
  if length(v_nome_trim) > 200 then
    return jsonb_build_object(
      'status', 'erro',
      'mensagem', 'Nome muito longo (máx. 200 caracteres).'
    );
  end if;

  -- 3. Cria projeto. O trigger adicionar_criador_como_admin já cria a
  --    linha em membros_projeto com papel='admin'.
  insert into projetos (nome, descricao, criado_por)
  values (
    v_nome_trim,
    nullif(trim(coalesce(p_descricao, '')), ''),
    v_user_id
  )
  returning id into v_projeto_id;

  return jsonb_build_object(
    'status', 'ok',
    'projeto_id', v_projeto_id
  );
end;
$$;

revoke all on function criar_projeto from public;
grant execute on function criar_projeto to authenticated;
