# Schema do banco

Este documento descreve o schema do Postgres (Supabase) usado pelo sistema: tabelas, tipos, relações, policies RLS, triggers e funções RPC.

---

## Diagrama entidade-relacionamento

```
                          ┌─────────────────┐
                          │   auth.users    │  (gerenciada pelo Supabase)
                          │─────────────────│
                          │  id (uuid) PK   │
                          │  email          │
                          │  raw_user_      │
                          │   meta_data     │
                          └────────┬────────┘
                                   │
                  ┌────────────────┼──────────────────┐
                  │                │                  │
                  ▼                ▼                  ▼
        ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐
        │ projetos         │  │ membros_projeto  │  │ comentarios  │
        │──────────────────│  │──────────────────│  │──────────────│
        │ id (uuid) PK     │  │ projeto_id PK FK │  │ id (uuid) PK │
        │ nome             │  │ usuario_id PK FK │  │ tarefa_id FK │
        │ descricao        │  │ papel            │  │ autor_id FK  │
        │ criado_por FK    │  │ adicionado_em    │  │ texto        │
        │ criado_em        │  │ adicionado_por   │  │ criado_em    │
        │ atualizado_em    │  └──────────────────┘  │ editado_em   │
        │ arquivado        │           │            └──────────────┘
        └────────┬─────────┘           │
                 │                     │
                 ▼                     │
        ┌──────────────────┐           │
        │ tarefas          │◄──────────┘
        │──────────────────│
        │ id (uuid) PK     │
        │ projeto_id FK    │
        │ codigo (TASK-NNN)│
        │ fase             │
        │ titulo           │
        │ descricao        │
        │ responsavel      │  (UUID de auth.users OU texto livre)
        │ data_inicio      │
        │ prazo            │
        │ prioridade       │  enum: Alta, Média, Baixa
        │ status           │  enum: Não iniciada ... Atrasada
        │ data_conclusao   │
        │ criado_por FK    │
        │ criado_em        │
        │ atualizado_em    │
        └────────┬─────────┘
                 │
                 ▼
        ┌──────────────────┐
        │ anexos           │
        │──────────────────│
        │ id (uuid) PK     │
        │ tarefa_id FK     │
        │ nome_arquivo     │
        │ storage_path     │  caminho no bucket Storage
        │ tamanho_bytes    │
        │ tipo_mime        │
        │ enviado_por FK   │
        │ enviado_em       │
        └──────────────────┘
```

---

## Tipos enumerados

```sql
create type papel_projeto as enum ('admin', 'editor', 'leitor');

create type prioridade_tarefa as enum ('Alta', 'Média', 'Baixa');

create type status_tarefa as enum (
  'Não iniciada',
  'Em progresso',
  'Em revisão',
  'Concluída',
  'Atrasada'
);
```

`status_tarefa` inclui `'Atrasada'`, mas na prática o status efetivo de uma tarefa é calculado dinamicamente: se `prazo < hoje` e status não é `'Concluída'`, a tarefa é tratada como `'Atrasada'`, independente do valor armazenado. Ver `lib/tarefas.ts:statusEfetivo()`.

---

## Tabelas

### `projetos`

| Coluna | Tipo | Constraints |
|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `nome` | text | NOT NULL |
| `descricao` | text | nullable |
| `criado_por` | uuid | NOT NULL, FK → `auth.users` |
| `criado_em` | timestamptz | default `now()` |
| `atualizado_em` | timestamptz | default `now()`, trigger atualiza |
| `arquivado` | boolean | default `false` |

**Triggers**:
- `set_atualizado_em` BEFORE UPDATE: atualiza `atualizado_em` para `now()`
- `adicionar_criador_como_admin` AFTER INSERT: cria registro em `membros_projeto` com papel `'admin'` para o criador

### `membros_projeto`

Relação N:M entre `auth.users` e `projetos`, com atributo extra `papel`.

| Coluna | Tipo | Constraints |
|---|---|---|
| `projeto_id` | uuid | PK composta, FK → `projetos` ON DELETE CASCADE |
| `usuario_id` | uuid | PK composta, FK → `auth.users` |
| `papel` | papel_projeto | NOT NULL |
| `adicionado_em` | timestamptz | default `now()` |
| `adicionado_por` | uuid | FK → `auth.users`, nullable |

PK composta `(projeto_id, usuario_id)` garante 1 papel por usuário/projeto.

### `tarefas`

| Coluna | Tipo | Constraints |
|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `projeto_id` | uuid | NOT NULL, FK → `projetos` ON DELETE CASCADE |
| `codigo` | text | NOT NULL, formato `TASK-NNN`, único por projeto |
| `fase` | text | NOT NULL (chamada de "etapa" na UI) |
| `titulo` | text | NOT NULL |
| `descricao` | text | nullable |
| `responsavel` | text | nullable — UUID de membro OU texto livre legado |
| `data_inicio` | date | nullable |
| `prazo` | date | nullable |
| `prioridade` | prioridade_tarefa | default `'Média'` |
| `status` | status_tarefa | default `'Não iniciada'` |
| `data_conclusao` | date | nullable, preenchida ao mover para `'Concluída'` |
| `criado_por` | uuid | FK → `auth.users`, nullable (tarefas migradas têm null) |
| `criado_em` | timestamptz | default `now()` |
| `atualizado_em` | timestamptz | default `now()`, trigger atualiza |

**Triggers**:
- `set_atualizado_em` BEFORE UPDATE
- `REPLICA IDENTITY FULL` (para Realtime emitir payload completo em DELETE)

**Sobre `responsavel`**:
Campo `text` flexível para acomodar dois formatos:
- Novo: UUID de membro (atribuição validada)
- Legado: texto livre (vindo da migração inicial do XLSX)

A UI distingue os dois via regex de UUID. Ver `lib/responsavel.ts`.

### `comentarios`

| Coluna | Tipo | Constraints |
|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `tarefa_id` | uuid | NOT NULL, FK → `tarefas` ON DELETE CASCADE |
| `autor_id` | uuid | NOT NULL, FK → `auth.users` |
| `texto` | text | NOT NULL |
| `criado_em` | timestamptz | default `now()` |
| `editado_em` | timestamptz | nullable, preenchido na edição |

**Realtime habilitado**: REPLICA IDENTITY FULL.

### `anexos`

| Coluna | Tipo | Constraints |
|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `tarefa_id` | uuid | NOT NULL, FK → `tarefas` ON DELETE CASCADE |
| `nome_arquivo` | text | NOT NULL — nome original do upload |
| `storage_path` | text | NOT NULL — path no bucket |
| `tamanho_bytes` | int8 | NOT NULL |
| `tipo_mime` | text | nullable |
| `enviado_por` | uuid | NOT NULL, FK → `auth.users` |
| `enviado_em` | timestamptz | default `now()` |

**Importante**: ao deletar registro de `anexos`, o arquivo físico no Storage **não é deletado automaticamente**. As Server Actions de exclusão (`excluirTarefaAction`, `excluirProjetoAction`) chamam `storage.remove(paths)` explicitamente antes do DELETE no banco.

---

## Row-Level Security

Todas as 5 tabelas têm RLS habilitado. As policies usam funções helper `SECURITY DEFINER`:

```sql
-- Funções auxiliares (em public)
create function is_membro(p_projeto_id uuid) returns boolean
  security definer language sql stable
  as $$ select exists(
    select 1 from membros_projeto
    where projeto_id = p_projeto_id and usuario_id = auth.uid()
  ) $$;

create function get_papel(p_projeto_id uuid) returns papel_projeto
  security definer language sql stable
  as $$ select papel from membros_projeto
    where projeto_id = p_projeto_id and usuario_id = auth.uid() $$;

create function is_admin(p_projeto_id uuid) returns boolean
  security definer language sql stable
  as $$ select get_papel(p_projeto_id) = 'admin' $$;

create function is_editor_ou_admin(p_projeto_id uuid) returns boolean
  security definer language sql stable
  as $$ select get_papel(p_projeto_id) in ('admin', 'editor') $$;
```

### Policies (resumo)

**projetos**:
- SELECT: `is_membro(id)`
- INSERT: ⚠️ não usa policy direta — toda criação passa por RPC `criar_projeto`
- UPDATE: `is_admin(id)` (atualmente)
- DELETE: `is_admin(id)`

**membros_projeto**:
- SELECT: `is_membro(projeto_id)`
- INSERT/UPDATE/DELETE: passam por RPCs (`adicionar_membro_por_email`, `alterar_papel_membro`, `remover_membro`)

**tarefas**:
- SELECT: `is_membro(projeto_id)`
- INSERT: passa por RPC `criar_tarefa`
- UPDATE: `is_editor_ou_admin(projeto_id)` (permite drag-and-drop direto)
- DELETE: passa por RPC `excluir_tarefa`

**comentarios**:
- SELECT/INSERT: `is_membro(tarefa.projeto_id)` via subquery
- UPDATE/DELETE: `autor_id = auth.uid()` OU `is_admin(...)`

**anexos**:
- SELECT/INSERT: `is_membro(tarefa.projeto_id)`
- DELETE: `enviado_por = auth.uid()` OU `is_admin(...)`

> **Padrão importante**: para qualquer operação que envolva INSERT, dependência cruzada ou cascade, preferimos RPC `SECURITY DEFINER` ao invés de policy direta. Ver `decisoes-de-design.md` para o histórico dessa decisão.

---

## Funções RPC

Listadas em ordem de criação. Todas com `SECURITY DEFINER` e `grant execute to authenticated`.

### `criar_projeto(p_nome, p_descricao)`
Cria projeto + adiciona criador como admin (via trigger). Retorna `{status, projeto_id}`.

### `adicionar_membro_por_email(p_projeto_id, p_email, p_papel)`
Busca usuário em `auth.users` por e-mail (case-insensitive) e adiciona como membro. Valida que o chamador é admin. Retorna `{status, usuario_id?, email?}`. Status pode ser `ok`, `usuario_nao_encontrado`, `ja_membro`, `nao_autorizado`.

### `alterar_papel_membro(p_projeto_id, p_usuario_id, p_novo_papel)`
Altera papel de um membro. Protege o "último admin" — não permite rebaixar o único admin do projeto. Retorna `{status}`.

### `remover_membro(p_projeto_id, p_usuario_id)`
Remove membro. Admin pode remover qualquer um; usuário comum pode remover a si mesmo. Protege o último admin. Retorna `{status}`.

### `listar_membros_projeto(p_projeto_id)`
Retorna JSONB array com membros + e-mail (join com `auth.users`). Usada na tela de admin. Não usa view `usuarios_publicos` por causa de um bug obscuro em JOIN.

### `listar_membros_para_atribuicao(p_projeto_id)`
Similar à anterior, mas retorna apenas `{usuario_id, email, display_name}`. Usada para popular selects de "Responsável".

### `arquivar_projeto(p_projeto_id)`
Marca `arquivado = true`. Reversível pelo painel do Supabase.

### `listar_anexos_projeto(p_projeto_id)`
Retorna paths de todos os anexos de tarefas do projeto. Usado pela Server Action de exclusão para limpar o Storage antes do DELETE.

### `excluir_projeto(p_projeto_id, p_nome_confirmacao)`
Exige que o nome do projeto seja digitado (confirmação dupla). Cascade no banco apaga tudo: tarefas, comentários, anexos, membros, projeto.

### `criar_tarefa(p_projeto_id, p_titulo, p_fase, ...)`
Cria tarefa com código automático (`TASK-NNN`). Calcula o próximo número via `MAX(codigo)` filtrado por regex. Suporta até `TASK-999` por projeto. Retorna `{status, tarefa_id, codigo}`.

### `listar_anexos_tarefa(p_tarefa_id)`
Versão por tarefa. Usado pela Server Action de exclusão de tarefa.

### `excluir_tarefa(p_tarefa_id)`
Permite admin do projeto OU criador da tarefa (`criado_por = auth.uid()`). Cascade no banco apaga comentários e anexos. Retorna `{status}`.

---

## View: `usuarios_publicos`

```sql
create view usuarios_publicos
with (security_invoker = on) as
select u.id, u.email, u.raw_user_meta_data->>'full_name' as nome
from auth.users u
where u.id = auth.uid() or compartilha_projeto(u.id);
```

A função `compartilha_projeto(p_outro_usuario_id)` retorna true se o chamador compartilha algum projeto com o outro usuário. Permite que membros vejam os e-mails dos colegas do mesmo projeto.

> **Nota histórica**: tentamos usar essa view via JOIN em queries do front, mas encontramos um bug onde o próprio usuário não aparecia no JOIN. Substituímos por RPCs específicas (`listar_membros_*`) que fazem o JOIN internamente.

---

## Storage

**Bucket**: `anexos-tarefas`
- Privado (não acessível via URL pública)
- Tamanho máximo por arquivo: 10 MB

**Path determinístico**:
```
{projeto_id}/{tarefa_id}/{timestamp_ms}_{nome_original}
```

Exemplo: `f47ac10b-58cc-4372-a567-0e02b2c3d479/abc.../1748345600000_proposta.pdf`

**Download**: via `createSignedUrl(path, 60)` (TTL de 60s). URL temporária que abre em nova aba.

**Policies** (configuradas via `02_storage_policies.sql`):
- SELECT/INSERT: usuário deve ser membro do projeto (extraído do path)
- DELETE: feito apenas via Server Actions

---

## Realtime

Habilitado em:
- `tarefas` — Kanban e Gantt reagem a INSERT/UPDATE/DELETE
- `comentarios` — Aba de comentários do TaskModal

Necessário rodar para events DELETE chegarem com payload completo:
```sql
alter table tarefas replica identity full;
alter table comentarios replica identity full;
```

Sem isso, ao deletar uma tarefa, o evento Realtime chega sem o `id` da linha apagada, impedindo o frontend de remover do estado local.

---

## Idempotência

Todos os scripts SQL em `/sql/` usam `create or replace` para funções e `if not exists` para tabelas/colunas. É seguro rodar todos numa sessão limpa, ou re-rodar individualmente após mudanças.

Tipos enumerados (`create type`) **não são idempotentes** — falham se já existirem. Em projetos novos, rode `01_schema_inicial.sql` uma única vez.
