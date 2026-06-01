-- =============================================================================
-- 04 — Admin de membros
-- =============================================================================
-- Cria:
--   1. compartilha_projeto (helper)
--   2. View usuarios_publicos (lookup de e-mails entre membros)
--   3. RPC adicionar_membro_por_email
--   4. RPC alterar_papel_membro (com proteção do "último admin")
--   5. RPC remover_membro (com proteção do "último admin")
--
-- Todas as RPCs:
--   - SECURITY DEFINER
--   - Validam internamente o papel do chamador
--   - Retornam jsonb estruturado
-- =============================================================================


-- ----------------------------------------------------------------------------
-- 1. Helper: o outro usuário compartilha algum projeto com o usuário atual?
-- ----------------------------------------------------------------------------
create or replace function compartilha_projeto(p_outro_usuario_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from membros_projeto m1
    join membros_projeto m2 on m1.projeto_id = m2.projeto_id
    where m1.usuario_id = auth.uid()
      and m2.usuario_id = p_outro_usuario_id
  );
$$;

revoke all on function compartilha_projeto from public;
grant execute on function compartilha_projeto to authenticated;


-- ----------------------------------------------------------------------------
-- 2. View: usuarios_publicos
-- ----------------------------------------------------------------------------
-- Lista id + email + nome dos usuários que o chamador pode ver:
--   - o próprio usuário
--   - usuários que compartilham algum projeto com o chamador
-- ----------------------------------------------------------------------------
drop view if exists usuarios_publicos;

create view usuarios_publicos
with (security_invoker = on) as
select
  u.id,
  u.email,
  u.raw_user_meta_data->>'full_name' as nome
from auth.users u
where
  u.id = auth.uid()
  or compartilha_projeto(u.id);

grant select on usuarios_publicos to authenticated;


-- ----------------------------------------------------------------------------
-- 3. RPC: adicionar_membro_por_email
-- ----------------------------------------------------------------------------
-- Retorna jsonb:
--   { status: 'ok', usuario_id, email }
--   { status: 'usuario_nao_encontrado' }
--   { status: 'ja_membro' }
--   { status: 'nao_autorizado' }
-- ----------------------------------------------------------------------------
create or replace function adicionar_membro_por_email(
  p_projeto_id uuid,
  p_email text,
  p_papel papel_projeto
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_papel papel_projeto;
  v_usuario_id uuid;
  v_email_existente text;
begin
  -- Valida que o chamador é admin
  select papel into v_caller_papel
  from membros_projeto
  where projeto_id = p_projeto_id
    and usuario_id = auth.uid();

  if v_caller_papel is null or v_caller_papel <> 'admin' then
    return jsonb_build_object('status', 'nao_autorizado');
  end if;

  -- Busca usuário pelo e-mail (case-insensitive)
  select id, email into v_usuario_id, v_email_existente
  from auth.users
  where lower(email) = lower(trim(p_email))
  limit 1;

  if v_usuario_id is null then
    return jsonb_build_object('status', 'usuario_nao_encontrado');
  end if;

  -- Já é membro?
  if exists (
    select 1 from membros_projeto
    where projeto_id = p_projeto_id
      and usuario_id = v_usuario_id
  ) then
    return jsonb_build_object(
      'status', 'ja_membro',
      'usuario_id', v_usuario_id,
      'email', v_email_existente
    );
  end if;

  -- Adiciona
  insert into membros_projeto (projeto_id, usuario_id, papel, adicionado_por)
  values (p_projeto_id, v_usuario_id, p_papel, auth.uid());

  return jsonb_build_object(
    'status', 'ok',
    'usuario_id', v_usuario_id,
    'email', v_email_existente
  );
end;
$$;

revoke all on function adicionar_membro_por_email from public;
grant execute on function adicionar_membro_por_email to authenticated;


-- ----------------------------------------------------------------------------
-- 4. RPC: alterar_papel_membro
-- ----------------------------------------------------------------------------
-- Retorna jsonb:
--   { status: 'ok' }
--   { status: 'nao_autorizado' }
--   { status: 'membro_nao_encontrado' }
--   { status: 'ultimo_admin' }  -- tentando rebaixar o último admin
-- ----------------------------------------------------------------------------
create or replace function alterar_papel_membro(
  p_projeto_id uuid,
  p_usuario_id uuid,
  p_novo_papel papel_projeto
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_papel papel_projeto;
  v_papel_atual papel_projeto;
  v_total_admins int;
begin
  select papel into v_caller_papel
  from membros_projeto
  where projeto_id = p_projeto_id
    and usuario_id = auth.uid();

  if v_caller_papel is null or v_caller_papel <> 'admin' then
    return jsonb_build_object('status', 'nao_autorizado');
  end if;

  select papel into v_papel_atual
  from membros_projeto
  where projeto_id = p_projeto_id
    and usuario_id = p_usuario_id;

  if v_papel_atual is null then
    return jsonb_build_object('status', 'membro_nao_encontrado');
  end if;

  if v_papel_atual = p_novo_papel then
    return jsonb_build_object('status', 'ok');
  end if;

  -- Proteção do último admin
  if v_papel_atual = 'admin' and p_novo_papel <> 'admin' then
    select count(*) into v_total_admins
    from membros_projeto
    where projeto_id = p_projeto_id
      and papel = 'admin';

    if v_total_admins <= 1 then
      return jsonb_build_object('status', 'ultimo_admin');
    end if;
  end if;

  update membros_projeto
  set papel = p_novo_papel
  where projeto_id = p_projeto_id
    and usuario_id = p_usuario_id;

  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function alterar_papel_membro from public;
grant execute on function alterar_papel_membro to authenticated;


-- ----------------------------------------------------------------------------
-- 5. RPC: remover_membro
-- ----------------------------------------------------------------------------
-- Admin remove qualquer um; usuário comum pode remover a si mesmo.
-- Protege o último admin.
-- ----------------------------------------------------------------------------
create or replace function remover_membro(
  p_projeto_id uuid,
  p_usuario_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_papel papel_projeto;
  v_papel_alvo papel_projeto;
  v_total_admins int;
begin
  select papel into v_caller_papel
  from membros_projeto
  where projeto_id = p_projeto_id
    and usuario_id = auth.uid();

  if v_caller_papel is null then
    return jsonb_build_object('status', 'nao_autorizado');
  end if;

  -- Admin pode remover qualquer um; senão, só a si mesmo
  if v_caller_papel <> 'admin' and auth.uid() <> p_usuario_id then
    return jsonb_build_object('status', 'nao_autorizado');
  end if;

  select papel into v_papel_alvo
  from membros_projeto
  where projeto_id = p_projeto_id
    and usuario_id = p_usuario_id;

  if v_papel_alvo is null then
    return jsonb_build_object('status', 'membro_nao_encontrado');
  end if;

  -- Proteção do último admin
  if v_papel_alvo = 'admin' then
    select count(*) into v_total_admins
    from membros_projeto
    where projeto_id = p_projeto_id
      and papel = 'admin';

    if v_total_admins <= 1 then
      return jsonb_build_object('status', 'ultimo_admin');
    end if;
  end if;

  delete from membros_projeto
  where projeto_id = p_projeto_id
    and usuario_id = p_usuario_id;

  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function remover_membro from public;
grant execute on function remover_membro to authenticated;
