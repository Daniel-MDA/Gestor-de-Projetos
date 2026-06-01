-- =============================================================================
-- 02 — Storage policies
-- =============================================================================
-- Cria bucket privado para anexos de tarefas + policies de acesso.
--
-- Estrutura de paths no bucket:
--   {projeto_id}/{tarefa_id}/{timestamp}_{nome_arquivo}
--
-- IMPORTANTE: rodar via SQL Editor com role postgres OU criar o bucket
-- manualmente pelo painel (Storage → New bucket → "anexos-tarefas",
-- private, max 10MB). As policies abaixo são as mesmas em qualquer caso.
-- =============================================================================


-- ----------------------------------------------------------------------------
-- Cria bucket privado (10 MB por arquivo)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('anexos-tarefas', 'anexos-tarefas', false, 10485760)
on conflict (id) do nothing;


-- ----------------------------------------------------------------------------
-- Policies de Storage
-- ----------------------------------------------------------------------------
-- A primeira parte do path é o projeto_id. Extraímos via split_part
-- e validamos se o usuário é membro daquele projeto.

create policy "anexos_select_membros"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'anexos-tarefas'
    and is_membro((split_part(name, '/', 1))::uuid)
  );

create policy "anexos_insert_editor"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'anexos-tarefas'
    and is_editor_ou_admin((split_part(name, '/', 1))::uuid)
  );

create policy "anexos_delete_editor"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'anexos-tarefas'
    and is_editor_ou_admin((split_part(name, '/', 1))::uuid)
  );
