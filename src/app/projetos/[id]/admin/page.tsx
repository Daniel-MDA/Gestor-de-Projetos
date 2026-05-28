import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import MembrosAdmin from "./MembrosAdmin";
import ZonaPerigosa from "./ZonaPerigosa";
import { Projeto, PapelProjeto, MembroComUsuario } from "@/lib/projetos";

export default async function AdminProjetoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projetoId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: projeto } = await supabase
    .from("projetos")
    .select("*")
    .eq("id", projetoId)
    .maybeSingle();

  if (!projeto) notFound();

  const { data: meuMembro } = await supabase
    .from("membros_projeto")
    .select("papel")
    .eq("projeto_id", projetoId)
    .eq("usuario_id", user.id)
    .maybeSingle();

  const meuPapel = (meuMembro?.papel as PapelProjeto | undefined) ?? null;

  if (meuPapel !== "admin") {
    return (
      <main className="min-h-screen bg-[#f8f6f1] py-10 px-6">
        <div className="max-w-xl mx-auto">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-[#7c7a72] hover:text-[#1a1815] mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao dashboard
          </Link>
          <div className="bg-white border border-[#e6e2d6] rounded-2xl p-8 text-center">
            <ShieldAlert className="w-12 h-12 text-[#c64429] mx-auto mb-3" />
            <h1
              className="text-xl font-medium text-[#1a1815] mb-2"
              style={{ fontFamily: "var(--font-fraunces), serif" }}
            >
              Acesso restrito
            </h1>
            <p className="text-sm text-[#7c7a72]">
              Apenas administradores deste projeto podem gerenciar membros.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const { data: membrosData, error: errMembros } = await supabase.rpc(
    "listar_membros_projeto",
    { p_projeto_id: projetoId }
  );

  if (errMembros) {
    return (
      <main className="p-8">
        <div className="bg-[#fcdcd6] border border-[#f3c8be] text-[#8c2c1b] p-4 rounded-lg">
          Erro ao carregar membros: {errMembros.message}
        </div>
      </main>
    );
  }

  type MembroRaw = {
    usuario_id: string;
    papel: PapelProjeto;
    email: string;
    adicionado_em: string;
    adicionado_por: string | null;
  };

  const membros: MembroComUsuario[] = ((membrosData as MembroRaw[] | null) ?? []).map(
    (m) => ({
      projeto_id: projetoId,
      usuario_id: m.usuario_id,
      papel: m.papel,
      adicionado_em: m.adicionado_em,
      adicionado_por: m.adicionado_por,
      usuario_email: m.email,
    })
  );

  const projetoTyped = projeto as Projeto;

  return (
    <main className="min-h-screen bg-[#f8f6f1] py-10 px-6">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-[#7c7a72] hover:text-[#1a1815] mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao dashboard
        </Link>

        <div className="mb-6">
          <div className="text-[10px] tracking-[0.15em] uppercase text-[#7c7a72] font-mono mb-1">
            Administrar projeto
          </div>
          <h1
            className="text-3xl font-medium text-[#1a1815] tracking-tight"
            style={{ fontFamily: "var(--font-fraunces), serif" }}
          >
            {projetoTyped.nome}
          </h1>
          {projetoTyped.descricao && (
            <p className="text-sm text-[#7c7a72] mt-2">
              {projetoTyped.descricao}
            </p>
          )}
        </div>

        <div className="space-y-6">
          <MembrosAdmin
            projetoId={projetoId}
            membrosIniciais={membros}
            usuarioAtualId={user.id}
          />

          <ZonaPerigosa
            projetoId={projetoId}
            projetoNome={projetoTyped.nome}
          />
        </div>
      </div>
    </main>
  );
}