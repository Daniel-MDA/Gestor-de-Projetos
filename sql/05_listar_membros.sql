-- =============================================================================
-- 05 — RPC: listar_membros_projeto
-- =============================================================================
-- Retorna lista de membros do projeto com e-mail (join com auth.users).
--
-- Por que existir: tentamos usar a view usuarios_publicos via JOIN em
-- queries do front, mas encontramos bug onde o próprio usuário não aparecia
-- no JOIN. Esta RPC faz o JOIN internamente e é mais previsível.
--
-- Roda como SECURITY DEFINER mas valida que o chamador é membro do projeto.
--
-- Retorna jsonb array:
-- [
--   {
--     usuario_id, papel, email, adicionado_em, adicionado_por
--   },
--   ...
-- ]
-- =============================================================================


create or replace function listar_membros_projeto(p_projeto_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_eh_membro boolean;
  v_resultado jsonb;
begin
  -- Valida que o chamador é membro
  select exists (
    select 1 from membros_projeto
    where projeto_id = p_projeto_id
      and usuario_id = auth.uid()
  ) into v_eh_membro;

  if not v_eh_membro then
    return jsonb_build_array();
  end if;

  -- Lista todos os membros com email
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'usuario_id',     m.usuario_id,
      'papel',          m.papel,
      'email',          u.email,
      'adicionado_em',  m.adicionado_em,
      'adicionado_por', m.adicionado_por
    )
    order by m.adicionado_em
  ), '[]'::jsonb)
  into v_resultado
  from membros_projeto m
  join auth.users u on u.id = m.usuario_id
  where m.projeto_id = p_projeto_id;

  return v_resultado;
end;
$$;

revoke all on function listar_membros_projeto from public;
grant execute on function listar_membros_projeto to authenticated;
