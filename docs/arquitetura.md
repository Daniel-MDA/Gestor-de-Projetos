# Arquitetura

Este documento descreve a arquitetura técnica do sistema em três camadas: frontend (Next.js), camada de orquestração (Server Actions e Middleware) e backend (Supabase). Também explica decisões importantes como o uso de funções `SECURITY DEFINER` no Postgres.

---

## Visão geral

```
┌──────────────────────────────────────────────────────────────────────┐
│  Browser (React 19)                                                  │
│                                                                      │
│  ┌────────────────┐    ┌──────────────┐    ┌─────────────────┐       │
│  │ Server         │    │ Client       │    │ Realtime        │       │
│  │ Components     │    │ Components   │    │ Subscriptions   │       │
│  │ (dashboard,    │    │ (Kanban,     │    │ (WebSocket      │       │
│  │  admin)        │    │  TaskModal)  │    │  para tarefas)  │       │
│  └────────┬───────┘    └──────┬───────┘    └────────┬────────┘       │
└───────────┼───────────────────┼─────────────────────┼────────────────┘
            │                   │                     │
   HTTP (RSC, SSR)        Server Actions       WebSocket
            │                   │                     │
            ▼                   ▼                     │
┌──────────────────────────────────────────────────────────────────────┐
│  Next.js 16 (Vercel)                                                 │
│                                                                      │
│  ┌────────────────┐    ┌──────────────────┐    ┌──────────────┐      │
│  │ Server         │    │ Server Actions   │    │ Middleware   │      │
│  │ Components     │    │ (criar projeto,  │    │ (proxy.ts)   │      │
│  │                │    │  criar tarefa,   │    │              │      │
│  │ SSR + dados    │    │  excluir, etc.)  │    │ Refresh JWT  │      │
│  │ via Supabase   │    │                  │    │              │      │
│  └────────┬───────┘    └────────┬─────────┘    └──────┬───────┘      │
└───────────┼─────────────────────┼─────────────────────┼──────────────┘
            │                     │                     │
            ▼                     ▼                     │
┌──────────────────────────────────────────────────────────────────────┐
│  Supabase                                                            │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  ┌─────────────┐ │
│  │ Postgres 17  │  │ Auth (JWT)   │  │ Storage    │  │ Realtime    │ │
│  │              │  │              │  │            │  │             │ │
│  │ Tables       │  │ Email +      │  │ Bucket     │  │ Postgres    │ │
│  │ RLS          │  │ password     │  │ privado    │  │ → WebSocket │ │
│  │ Functions    │  │              │  │ Signed URL │  │             │ │
│  └──────────────┘  └──────────────┘  └────────────┘  └─────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Camadas

### 1. Frontend (Browser)

**Server Components** (a maioria das páginas):
- `app/dashboard/page.tsx` — busca projetos, papéis e tarefas no servidor antes de renderizar
- `app/projetos/[id]/admin/page.tsx` — valida acesso, busca membros, renderiza
- `app/projetos/novo/page.tsx` — interface simples, sem dados pré-carregados

Server Components rodam **no servidor da Vercel**, têm acesso aos cookies, e enviam HTML completo para o browser. Não aumentam o bundle JS do cliente.

**Client Components** (interatividade):
- `Kanban.tsx`, `TaskModal.tsx`, `BoardArea.tsx` — drag-and-drop, modais, formulários
- `Comentarios.tsx`, `Anexos.tsx` — realtime + uploads
- `ProjectSelector.tsx` — dropdown estado local

Identificados pelo `"use client"` no topo. Têm bundle JS, mas só componentes interativos.

**Realtime Subscriptions**:
- `useTarefasRealtime` (em `lib/realtime.ts`) abre uma conexão WebSocket via Supabase Realtime
- Postgres dispara eventos em INSERT/UPDATE/DELETE em `tarefas`
- O hook recebe e atualiza o state local imediatamente
- Padrão similar em `useComentariosRealtime`

### 2. Camada de orquestração (Next.js)

**Server Actions** (`"use server"`):
São funções que rodam no servidor, chamadas a partir de Client Components. O Next.js gera um endpoint HTTP automático para cada uma.

Usadas para operações que não devem ser feitas pelo cliente direto:
- `criarProjetoAction` — chama RPC `criar_projeto`
- `criarTarefaAction` — chama RPC `criar_tarefa`
- `excluirTarefaAction` — limpa Storage + chama RPC `excluir_tarefa`
- `arquivarProjetoAction` / `excluirProjetoAction` — gestão de projetos

Vantagens: validação centralizada, `revalidatePath()` invalida cache do RSC, sessão e cookies disponíveis.

**Middleware (`proxy.ts`)**:
Renomeado de `middleware.ts` no Next.js 16. Roda em toda rota (exceto estáticos).

Função única: chamar `updateSession()` do Supabase para refrescar o JWT armazenado em cookie. Sem isso, sessões expirariam silenciosamente em 1 hora.

### 3. Backend (Supabase)

**Postgres 17** com:
- 5 tabelas principais (ver `schema-banco.md`)
- Row-Level Security em todas
- Triggers (ex: `set_atualizado_em`, `adicionar_criador_como_admin`)
- 12+ funções `SECURITY DEFINER` para RPCs

**Auth**:
- Email + senha (sem OAuth)
- JWT armazenado em cookie via `@supabase/ssr`
- Display Name salvo em `raw_user_meta_data->>'display_name'`

**Storage**:
- Bucket `anexos-tarefas` (privado, 10 MB max por arquivo)
- Path determinístico: `{projeto_id}/{tarefa_id}/{timestamp}_{nome}`
- Download via signed URL (TTL de 60s)
- Limpeza explícita ao excluir tarefa ou projeto

**Realtime**:
- Habilitado nas tabelas `tarefas` e `comentarios`
- Requer `REPLICA IDENTITY FULL` para events DELETE virem com payload completo
- WebSocket público, mas RLS aplica antes de emitir eventos

---

## Decisão central: `SECURITY DEFINER` em RPCs

Durante o desenvolvimento, descobrimos um bug obscuro: o INSERT direto na tabela `projetos` falhava com erro de RLS mesmo com policy correta (`auth.uid() = criado_por`) e papel autenticado válido. Após horas de debug (logs HTTP, claims JWT, `auth.uid()` retornando valor correto isolado), **não conseguimos identificar a causa raiz**.

**Solução pragmática**: encapsular operações sensíveis em funções PL/pgSQL com `SECURITY DEFINER`. Essas funções rodam como `postgres` (bypass de RLS) mas validam internamente:
- Se `auth.uid()` está presente
- Se o usuário tem permissão (papel correto no projeto)
- Inputs (nome não vazio, formato válido, etc.)

Exemplo simplificado:

```sql
create function criar_tarefa(p_projeto_id uuid, p_titulo text, ...)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_papel papel_projeto;
begin
  -- 1. Auth
  if auth.uid() is null then
    return jsonb_build_object('status', 'nao_autorizado');
  end if;

  -- 2. Papel
  select papel into v_caller_papel
  from membros_projeto
  where projeto_id = p_projeto_id and usuario_id = auth.uid();

  if v_caller_papel not in ('admin', 'editor') then
    return jsonb_build_object('status', 'nao_autorizado');
  end if;

  -- 3. INSERT (bypassa RLS porque security definer)
  insert into tarefas (...) values (...);

  return jsonb_build_object('status', 'ok');
end;
$$;
```

**Vantagens dessa abordagem**:
- Operações sensíveis ficam em um lugar só (banco), versionadas em SQL
- Validações próximas dos dados (impossível pular)
- Retorno estruturado em JSONB (sem distinguir HTTP 400 vs 500)
- Imune ao bug obscuro de RLS no INSERT direto

**Trade-offs**:
- Mais SQL pra manter (mas reaproveitável entre frontends)
- Operações simples (SELECT) continuam usando RLS direto, sem RPC

---

## Fluxos típicos

### Login

```
1. Browser → POST /auth/v1/token (Supabase Auth)
2. Supabase valida senha, retorna JWT (access_token + refresh_token)
3. @supabase/ssr salva os tokens em cookies (httpOnly)
4. Browser → redirect /dashboard
5. Server Component lê cookies, instancia client server-side
6. Query supabase.from("projetos") com JWT → RLS filtra
```

### Criar tarefa

```
1. Click "Nova tarefa" → modal abre (Client Component)
2. Submit → Server Action criarTarefaAction(input)
3. Server Action chama supabase.rpc("criar_tarefa", params)
4. Postgres: função SECURITY DEFINER valida e insere
5. Postgres: trigger Realtime dispara evento INSERT
6. WebSocket → Kanban.tsx (outra aba) recebe → setState
7. Server Action retorna {ok, tarefaId} → revalidatePath("/dashboard")
```

### Excluir tarefa

```
1. TaskModal: click "Excluir" → confirm
2. Server Action excluirTarefaAction(tarefaId)
3. supabase.rpc("listar_anexos_tarefa") → lista paths no Storage
4. supabase.storage.from(BUCKET).remove(paths) → limpa arquivos
5. supabase.rpc("excluir_tarefa") → DELETE em cascata no banco
6. onDeleted callback → setTarefas(prev => prev.filter(...))
7. Realtime DELETE → outras abas também removem
```

### Trocar projeto

```
1. ProjectSelector: click em outro projeto
2. document.cookie = `projeto_atual=${id}; path=/; max-age=...`
3. router.refresh() → Next.js re-renderiza Server Component
4. page.tsx lê cookie, busca novo projeto e tarefas, renderiza
```

---

## Bibliotecas e versões

| Lib | Versão | Notas |
|---|---|---|
| `next` | 16.2.6 | App Router, Server Actions, Turbopack |
| `react` | 19.2.4 | + React Compiler |
| `typescript` | 5.x | |
| `tailwindcss` | 4.x | Sem PostCSS config externa |
| `@supabase/ssr` | latest | Cliente Supabase com cookies |
| `@supabase/supabase-js` | latest | SDK base |
| `lucide-react` | 0.x | Ícones |

---

## Deploy

**Vercel** com deploy contínuo:
- Push em `main` no GitHub → Vercel detecta → build + deploy automático
- Variáveis de ambiente cadastradas no painel da Vercel (não vão pro Git)
- Domínio: `tecnofink.vercel.app`

**Supabase**: hospedagem direta no plano Free. Postgres + Auth + Storage + Realtime no mesmo projeto. Não há infraestrutura adicional a gerenciar.

---

## Pontos de extensão

Áreas pensadas para evolução futura:
- **Notificações por e-mail**: SMTP customizado no Supabase + função trigger
- **Histórico de mudanças**: tabela `tarefas_audit` com triggers
- **Filtros**: query params em `/dashboard?responsavel=...&prazo=...`
- **Exportação**: server action gerando XLSX/PDF on-demand
- **Mobile**: aplicar `@media` no kanban + gestos touch para drag

Cada um teria impacto contido. A arquitetura suporta sem refatoração estrutural.
