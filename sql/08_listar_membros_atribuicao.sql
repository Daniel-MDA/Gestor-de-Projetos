-- =============================================================================
-- 08 — RPC: listar_membros_para_atribuicao
-- =============================================================================
-- Retorna membros do projeto com info enxuta para popular selects de
-- "Responsável" no modal de criar/editar tarefa.
--
-- Diferente de listar_membros_projeto (script 05), aqui não retornamos
-- papel/data de adição. Foco em display_name + email para a UI.
--
-- Retorna jsonb array:
-- [
--   { usuario_id, email, display_name }
-- ]
-- ou jsonb_build_array() se o chamador não é membro.
-- =============================================================================


create or replace function listar_membros_para_atribuicao(p_projeto_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_eh_membro boolean;
  v_resultado jsonb;
begin
  -- Valida que chamador é membro
  select exists (
    select 1 from membros_projeto
    where projeto_id = p_projeto_id
      and usuario_id = auth.uid()
  ) into v_eh_membro;

  if not v_eh_membro then
    return jsonb_build_array();
  end if;

  -- Pega display_name (preenchido via painel Supabase ou
  -- admin_set_display_name) ou full_name como fallback.
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'usuario_id',   m.usuario_id,
      'email',        u.email,
      'display_name', coalesce(
        u.raw_user_meta_data->>'display_name',
        u.raw_user_meta_data->>'full_name'
      )
    )
    order by
      coalesce(
        u.raw_user_meta_data->>'display_name',
        u.raw_user_meta_data->>'full_name',
        u.email
      )
  ), '[]'::jsonb)
  into v_resultado
  from membros_projeto m
  join auth.users u on u.id = m.usuario_id
  where m.projeto_id = p_projeto_id;

  return v_resultado;
end;
$$;

revoke all on function listar_membros_para_atribuicao from public;
grant execute on function listar_membros_para_atribuicao to authenticated;


-- ----------------------------------------------------------------------------
-- Helper administrativo: setar display_name de um usuário
-- ----------------------------------------------------------------------------
-- O painel do Supabase NÃO permite editar Display Name de usuários
-- existentes (só na criação). Esta função facilita atualizar.
--
-- Limitada a admins (usuário precisa ser admin em algum projeto).
-- ----------------------------------------------------------------------------
create or replace function admin_set_display_name(
  p_email text,
  p_display_name text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from membros_projeto
    where usuario_id = auth.uid()
      and papel = 'admin'
  ) then
    return false;
  end if;

  update auth.users
  set raw_user_meta_data = jsonb_set(
    coalesce(raw_user_meta_data, '{}'::jsonb),
    '{display_name}',
    to_jsonb(p_display_name)
  )
  where email = p_email;

  return found;
end;
$$;

revoke all on function admin_set_display_name from public;
grant execute on function admin_set_display_name to authenticated;
