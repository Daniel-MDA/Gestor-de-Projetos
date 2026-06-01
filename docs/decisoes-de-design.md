# Decisões de design

Este documento registra as decisões técnicas tomadas durante o desenvolvimento, com contexto e alternativas consideradas. A intenção é responder à pergunta "por que isso foi feito assim?" no futuro.

---

## 1. Por que Next.js 16 com App Router?

**Contexto**: precisávamos de SSR para carregar dados sensíveis no servidor (multi-tenant) e ter SEO mínimo, mas com interatividade rica no kanban.

**Alternativas consideradas**:
- **Vite + React puro**: mais simples, mas exige fazer SSR à mão. Cookies/sessão Supabase ficam mais complicados.
- **Remix**: parecido, mas comunidade menor e menos integração com Vercel.
- **Next.js Pages Router**: padrão mais velho, mas Server Actions e fluxos modernos são exclusivos do App Router.

**Decisão**: Next.js 16 com App Router. Server Components reduzem bundle e simplificam buscar dados. Server Actions eliminam a necessidade de endpoints REST internos. Deploy 1-click na Vercel.

**Trade-offs**: curva de aprendizado da convenção Client/Server Component. Cuidado constante com onde colocar `"use client"`.

---

## 2. Por que Supabase ao invés de banco próprio?

**Contexto**: o projeto é uma consultoria, com orçamento limitado e prazo de implantação curto. Custo de infraestrutura precisava ser próximo de zero.

**Alternativas consideradas**:
- **Postgres + auth próprio**: total controle, mas semanas de trabalho a mais (auth, RLS, realtime, storage).
- **Firebase**: NoSQL, ruim para queries relacionais complexas (kanban + gantt + multi-tenant).
- **PlanetScale + Clerk + S3 + Pusher**: stack composta, custo agregado e maior superfície de problema.

**Decisão**: Supabase. Plano Free serve para o uso inicial (até 500 MB no Postgres, 1 GB no Storage). Tudo integrado: Postgres + Auth + Storage + Realtime + RLS.

**Trade-offs**:
- Lock-in moderado (mas migração para Postgres puro é viável)
- Plano Free tem limites de Realtime e e-mails de auth
- Latência um pouco maior por estar na nuvem (boa o suficiente em São Paulo)

---

## 3. Por que `SECURITY DEFINER` em quase tudo?

**Contexto**: durante o desenvolvimento, encontramos um bug onde INSERTs diretos em `projetos` falhavam com erro de RLS, mesmo com policy correta, role correto, e `auth.uid()` retornando o valor esperado.

**O bug** (documentado com detalhe):
- Policy: `(auth.uid() = criado_por)`, role `authenticated`
- JWT chegando corretamente: confirmado via debug RPC
- `auth.uid()` retornando o UUID certo: confirmado em SQL isolado
- INSERT direto via SQL Editor com `set local role authenticated`: **falhava com mesmo erro**

Após horas de debug não conseguimos reproduzir o bug em ambiente isolado, nem identificar a causa raiz.

**Solução adotada**: encapsular o INSERT em uma função `SECURITY DEFINER`, que roda como `postgres` (bypass de RLS) mas valida internamente que `auth.uid()` está presente. Funciona em 100% dos casos.

Após o sucesso desse padrão, estendemos para todas as operações sensíveis:
- Criar projeto, criar tarefa
- Adicionar/alterar/remover membro
- Arquivar/excluir projeto, excluir tarefa

**Vantagens**:
- Lógica de validação concentrada no banco (impossível pular pelo frontend)
- Retorno estruturado em JSONB (`{status, ...}`) com casos previstos
- Imune ao bug obscuro do INSERT direto
- Mais fácil de testar (rodar SQL no Editor)

**Trade-offs**:
- Mais SQL para escrever e manter
- Operações simples (SELECT) continuam usando RLS direto
- `SECURITY DEFINER` exige cuidado: se a função tiver bug de permissão, vira escalonamento de privilégio

---

## 4. Por que multi-projeto com tabela de membros?

**Alternativa considerada**: cada usuário ter um único "workspace" (sem multi-projeto).

**Decisão**: implementar multi-projeto desde o início porque:
- A Tecnofink tem múltiplas implantações em paralelo (não só Bitrix24)
- Permitir compartilhar projetos entre pessoas é natural (manager + analista + dev)
- Sistema de papéis (admin/editor/leitor) viria a precisar mesmo num único projeto

**Trade-off**: complexidade adicional no schema (tabela `membros_projeto`, policies que filtram por membership). Mas o padrão se paga rápido.

---

## 5. Por que `responsavel` é `text` em vez de FK pra `auth.users`?

**Contexto**: começamos o projeto migrando 70 tarefas de um XLSX. O campo `responsavel` vinha como texto livre ("Daniel", "Equipe técnica", "Marco M1") — não havia UUID.

**Alternativas consideradas**:
- **Forçar FK pra `auth.users`**: exigiria limpar/converter todas as 70 tarefas migradas, sem garantia de bater nomes.
- **Coluna nova `responsavel_id` + manter `responsavel` legado**: duas colunas para conceito único.

**Decisão**: manter `responsavel` como `text`. Aceitar dois formatos:
- UUID (novo padrão, gravado pela UI ao escolher membro no select)
- Texto livre (legado, mantido nas tarefas migradas)

Frontend distingue via regex de UUID:
- Se for UUID: busca o membro na lista carregada, mostra `display_name` ou e-mail
- Se for texto: mostra como está (legado)

**Vantagens**:
- Migração inicial preservada sem retrabalho
- Tarefas novas têm validação (select de membros do projeto)

**Trade-offs**:
- Pequena complexidade no frontend (lib `responsavel.ts`)
- Reports/exports precisam tratar os dois formatos

---

## 6. Por que "Atrasada" é status efetivo (calculado) e não armazenado?

**Contexto**: tarefas com prazo vencido precisam aparecer como atrasadas, mas atualizar status no banco diariamente seria fragilidade (precisaria cron job, e poderia falhar).

**Decisão**: status efetivo calculado em runtime via `lib/tarefas.ts:statusEfetivo()`:

```typescript
function statusEfetivo(t: Tarefa): StatusEfetivo {
  if (t.status === "Concluída") return "Concluída";
  if (t.prazo) {
    const hoje = new Date();
    const prazoDate = new Date(t.prazo);
    if (prazoDate < hoje) return "Atrasada";
  }
  return t.status;
}
```

A função roda em todos os lugares onde o status é exibido (cards, kanban, lista, gantt). O banco armazena o status "real" (`'Em progresso'`, etc.); a UI exibe o status efetivo.

**Consequências**:
- Não precisa de cron/scheduler
- Status sempre coerente com a data atual
- Drag para coluna "Atrasada" é **bloqueado** (não faz sentido — atrasada é consequência, não escolha)
- Select de status no TaskModal **exclui** "Atrasada"

**Trade-off**: queries que filtram por status no banco não pegam tarefas atrasadas direto. Precisaria fazer `where status != 'Concluída' and prazo < current_date` no SQL.

---

## 7. Por que cookies em vez de localStorage pra sessão?

**Decisão**: usar `@supabase/ssr` que armazena tokens em cookies httpOnly.

**Razões**:
- Server Components precisam acessar a sessão no servidor → cookies disponíveis automaticamente via `cookies()` do Next.js
- HttpOnly = mais difícil pra XSS roubar token
- Refresh automático via middleware (`proxy.ts`) atualiza cookies sem JavaScript do cliente

**Trade-off**: cookies têm limite de tamanho (4 KB). Refresh tokens grandes às vezes estouram. Mitigação: o Supabase divide em múltiplos cookies se necessário.

---

## 8. Por que "Por status" e "Por etapa" ao invés de filtros?

**Contexto**: o usuário quer ver as tarefas agrupadas tanto pelo status (kanban tradicional) quanto pelo estágio do projeto (etapas como "Diagnóstico", "Configuração").

**Alternativas consideradas**:
- Apenas filtros (ex: "mostrar só F1"): perde a visão de fluxo
- Tela separada de "Etapas" com cards: divide a atenção do usuário

**Decisão**: switch no header do kanban que troca o agrupamento. Mesmo componente, dois layouts. Drag-and-drop muda contextualmente:
- Modo status → arrastar muda `status`
- Modo etapa → arrastar muda `fase`

**Trade-off**: 2x mais lógica de drop. Mas o ganho de UX (uma tela, dois views) compensa.

---

## 9. Por que UNDO de 5 segundos em vez de confirm?

**Contexto**: drag-and-drop de cards é uma ação que pode ser feita errado (arrastar pra coluna errada por engano).

**Alternativas consideradas**:
- Confirm antes de cada movimentação: péssimo UX, lento.
- Sem reversão: usuário tem que mover manualmente de volta.

**Decisão**: ação imediata + toast "Tarefa movida" com botão Desfazer por 5 segundos. Padrão Gmail/Linear.

**Como funciona**:
- Mover dispara o UPDATE imediatamente (otimistic UI)
- Estado anterior salvo em `undoInfo` (status anterior + data conclusão anterior)
- Setting timeout de 5s para limpar `undoInfo`
- Clicar em Desfazer reverte com novo UPDATE

**Vantagens**:
- Operação rápida (não interrompe fluxo)
- Reversível (não precisa lembrar valor antigo)

---

## 10. Por que cookies em vez de URL query pra projeto ativo?

**Alternativa considerada**: `/dashboard?projeto=uuid` — projeto ativo na URL.

**Decisão**: cookie `projeto_atual` com TTL de 90 dias.

**Razões**:
- URL sem ID fica mais limpa (`/dashboard` em vez de UUIDs feios)
- Usuário compartilhar URL não vaza projeto (privacidade leve)
- Trocar projeto não exige replace de URL (apenas `router.refresh()`)
- Mais simples: cookies não exigem manter sync com `useSearchParams`

**Trade-off**: usuário não consegue ter duas abas em projetos diferentes (cookie é único). Aceitável.

---

## 11. Por que Tailwind CSS 4 em vez de styled-components ou CSS Modules?

**Decisão rápida**:
- Stack atual da Vercel (templates oficiais usam Tailwind)
- Bundle final pequeno (purge automático)
- DX rápida para iteração
- Cores e dimensões expressas inline facilitam revisão visual

**Padrão adotado**: variáveis CSS para a paleta (`#1a1815`, `#1f4e79`, `#fbfaf6`, etc.). Sem componentes "design system" — cada componente compõe utilidades Tailwind diretamente.

---

## 12. Por que Fraunces (serif) ao invés de Inter (sans-serif) padrão?

**Contexto de UX**: queríamos um visual que não parecesse com "mais um SaaS B2B". A Tecnofink é uma empresa de seguros, com tradição — visual editorial reforça seriedade.

**Decisão**:
- **Fraunces** (serif elegante) para títulos
- **Inter** (sans-serif) para corpo
- **Mono** para dados estruturados (códigos, datas, percentuais)

Cor de destaque: `#1f4e79` (azul-marinho), não roxo/azul vibrante.

**Trade-off**: tipografia personalizada precisa ser carregada (via Google Fonts ou self-hosted). Pequeno custo de performance no primeiro carregamento.

---

## 13. Por que "Display Name" no Supabase metadata em vez de tabela `perfis`?

**Alternativa considerada**: criar tabela `perfis` com `{user_id, nome, avatar, ...}`.

**Decisão**: aproveitar o `raw_user_meta_data` do `auth.users`. Salvar `display_name` ali.

**Razões**:
- Não exige nova tabela
- Painel do Supabase já mostra Display Name (UX administrativa pronta)
- Editável via SQL simples (`update auth.users set raw_user_meta_data = jsonb_set(...)`)

**Trade-off**: se quisermos campos mais ricos no futuro (telefone, depto, foto), aí sim criar tabela `perfis` separada.

---

## 14. Por que pasta `sql/` versus migrations automáticas?

**Contexto**: o Supabase tem CLI próprio para migrations versionadas. Mas para este projeto, a equipe usaria o painel web (mais visual).

**Decisão**: scripts SQL numerados (`01_`, `02_`, ...) em `/sql/`. Idempotentes (`create or replace`, `if not exists`).

**Trade-off**: sem rollback automático. Para mudanças destrutivas, requer comando manual (drop column, etc).

Para projetos maiores recomendaria usar [Supabase CLI Migrations](https://supabase.com/docs/guides/cli/local-development#database-migrations). Para este, a abordagem manual está adequada.

---

## 15. Por que TypeScript strict?

**Decisão**: `strict: true` no `tsconfig.json` desde o início.

**Razões**:
- Tipos vindos do Supabase ajudam a evitar bugs (ex: nullable de `criado_por`)
- Refatorações são seguras
- Code review fica mais rápido (compilador pega muita coisa)

**Trade-off**: tempo de setup inicial maior, mas economiza tempo em produção.

---

## Histórico de decisões reverenciadas

Decisões importantes documentadas em commits do Git ou aqui:
- **18/05**: kickoff, escolha de stack
- **19/05**: bug do INSERT em `projetos` → adoção de SECURITY DEFINER
- **22/05**: refatoração para suportar multi-projeto
- **27/05**: introdução de switch status/etapa
- **28/05**: deploy em produção na Vercel

---

## Para evoluir

Áreas onde reconheço que a decisão atual é "boa o suficiente" mas não ótima:

1. **Numeração de tarefas até TASK-999**: deve servir, mas se um projeto crescer muito, esbarrar nesse limite. Solução: ampliar para 4 dígitos via migration simples.

2. **Sem soft delete em tarefas**: ao excluir, perde-se permanentemente. Para um sistema de produção mais maduro, valeria adicionar `deletado_em` + filtro nas queries.

3. **Realtime sem deduplicação robusta**: quando o INSERT local é seguido pelo evento Realtime, tem checagem para evitar duplicar, mas é frágil. Idealmente o frontend ignoraria eventos próprios via `commit_timestamp`.

4. **Sem rate limit em uploads**: usuário poderia spam de uploads grandes. O bucket tem 10 MB/arquivo, mas não há limite por hora/dia. Para uso da equipe interna, ok.

Cada um desses pontos é endereçável sem refatoração grande quando aparecer a necessidade real.
