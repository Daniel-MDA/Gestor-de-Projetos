import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import DashboardHeader from "./DashboardHeader";
import StatusBar from "./StatusBar";
import PhasesRow from "./PhasesRow";
import GanttChart from "./GanttChart";
import BoardArea from "./BoardArea";
import OverduePopup from "./OverduePopup";
import { PapelProjeto, Projeto } from "@/lib/projetos";
import { MembroAtribuicao } from "@/lib/responsavel";

type ProjetoComPapel = Projeto & { papel: PapelProjeto };

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 1. Todos os projetos onde o usuário é membro
  const { data: membrosRaw, error: errMembros } = await supabase
    .from("membros_projeto")
    .select(
      `
      papel,
      projetos!inner(
        id, nome, descricao, criado_por, criado_em, atualizado_em, arquivado
      )
    `
    )
    .eq("usuario_id", user.id)
    .eq("projetos.arquivado", false);

  if (errMembros) {
    return (
      <main className="p-8">
        <div className="bg-[#fcdcd6] border border-[#f3c8be] text-[#8c2c1b] p-4 rounded-lg">
          Erro ao carregar projetos: {errMembros.message}
        </div>
      </main>
    );
  }

  type Raw = {
    papel: PapelProjeto;
    projetos: Projeto | Projeto[];
  };

  const todosProjetos: ProjetoComPapel[] = ((membrosRaw as Raw[] | null) ?? [])
    .map((m) => {
      const proj = Array.isArray(m.projetos) ? m.projetos[0] : m.projetos;
      return { ...proj, papel: m.papel };
    })
    .sort((a, b) => b.criado_em.localeCompare(a.criado_em));

  if (todosProjetos.length === 0) {
    return (
      <main className="min-h-screen tf-grid-bg flex items-center justify-center p-8">
        <div className="max-w-md text-center bg-white border border-[#e5e5ea] rounded-2xl p-8">
          <div
            className="text-xl font-medium text-[#18182a] mb-2"
            style={{ fontFamily: "var(--font-bricolage), serif" }}
          >
            Nenhum projeto ainda
          </div>
          <p className="text-sm text-[#8e8e9a] mb-5">
            Você ainda não participa de nenhum projeto. Crie um para começar.
          </p>
          <Link
            href="/projetos/novo"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-[#18182a] hover:bg-[#0c0059] text-white rounded-lg transition-colors"
          >
            Criar projeto
          </Link>
        </div>
      </main>
    );
  }

  // 2. Projeto ativo via cookie
  const cookieStore = await cookies();
  const cookieProjetoId = cookieStore.get("projeto_atual")?.value;
  const projetoAtivo =
    todosProjetos.find((p) => p.id === cookieProjetoId) ?? todosProjetos[0];

  const papelAtual = projetoAtivo.papel;

  // 3. Tarefas do projeto ativo
  const { data: tarefas, error: errTarefas } = await supabase
    .from("tarefas")
    .select("*")
    .eq("projeto_id", projetoAtivo.id)
    .order("codigo", { ascending: true });

  if (errTarefas) {
    return (
      <main className="p-8">
        <div className="bg-[#fcdcd6] border border-[#f3c8be] text-[#8c2c1b] p-4 rounded-lg">
          Erro ao carregar tarefas: {errTarefas.message}
        </div>
      </main>
    );
  }

  const listaTarefas = tarefas ?? [];

  // 4. Membros do projeto para selects de responsável
  const { data: membrosData } = await supabase.rpc(
    "listar_membros_para_atribuicao",
    { p_projeto_id: projetoAtivo.id }
  );

  const membros = (membrosData as MembroAtribuicao[] | null) ?? [];

  return (
    <main className="min-h-screen tf-grid-bg">
      <DashboardHeader
        userEmail={user.email!}
        projetoNome={projetoAtivo.nome}
        projetoId={projetoAtivo.id}
        todosProjetos={todosProjetos}
        tarefas={listaTarefas}
      />
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">
        <PhasesRow tarefas={listaTarefas} />
        <StatusBar tarefas={listaTarefas} />
        <GanttChart tarefas={listaTarefas} />
        <BoardArea
          tarefasIniciais={listaTarefas}
          projetoId={projetoAtivo.id}
          papel={papelAtual}
          usuarioAtualId={user.id}
          membros={membros}
        />
      </div>

      <OverduePopup tarefas={listaTarefas} projetoId={projetoAtivo.id} />
    </main>
  );
}