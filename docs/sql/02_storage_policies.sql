-- =============================================================================
-- Políticas de Storage — bucket "anexos-tarefas"
-- =============================================================================
-- Execute APÓS criar o bucket "anexos-tarefas" pelo painel do Supabase.
-- Como executar: SQL Editor → New query → cole e Run.
--
-- Convenção de path no bucket:
--   {projeto_id}/{tarefa_id}/{nome_arquivo}
--
-- Exemplo:
--   a3f9b1e2-7c8d-4b2a-9f1e-5d6c3a8b9e1f/b7e4c2a1-9d3f-4e5b-8c2a-1f9e7d6c3b4a/contrato.pdf
--
-- A primeira parte do path SEMPRE é o UUID do projeto. Isso permite que
-- as políticas extraiam o projeto_id do path e verifiquem se o usuário
-- tem acesso a esse projeto.
-- =============================================================================


-- LEITURA: membros do projeto podem baixar arquivos
create policy "anexos_storage_select_membros"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'anexos-tarefas'
    and is_membro((storage.foldername(name))[1]::uuid)
  );


-- UPLOAD: admins e editores podem fazer upload
create policy "anexos_storage_insert_editor"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'anexos-tarefas'
    and is_editor_ou_admin((storage.foldername(name))[1]::uuid)
  );


-- DELETE: admins e editores podem excluir
-- (a política mais granular — só quem enviou ou admin — fica no nível da tabela `anexos`)
create policy "anexos_storage_delete_editor"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'anexos-tarefas'
    and is_editor_ou_admin((storage.foldername(name))[1]::uuid)
  );


-- =============================================================================
-- FIM
-- =============================================================================
