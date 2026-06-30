"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  MembroComUsuario,
  PapelProjeto,
  PAPEIS_INFO,
} from "@/lib/projetos";
import {
  UserPlus,
  Mail,
  Loader2,
  Trash2,
  Shield,
  Pencil,
  Check,
  X,
} from "lucide-react";

type Props = {
  projetoId: string;
  membrosIniciais: MembroComUsuario[];
  usuarioAtualId: string;
};

type Mensagem = {
  tipo: "sucesso" | "erro" | "aviso";
  texto: string;
};

export default function MembrosAdmin({
  projetoId,
  membrosIniciais,
  usuarioAtualId,
}: Props) {
  const [membros, setMembros] = useState<MembroComUsuario[]>(membrosIniciais);
  const [emailConvite, setEmailConvite] = useState("");
  const [papelConvite, setPapelConvite] = useState<PapelProjeto>("editor");
  const [convidando, setConvidando] = useState(false);
  const [mensagem, setMensagem] = useState<Mensagem | null>(null);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [novoPapelEdicao, setNovoPapelEdicao] = useState<PapelProjeto>("editor");
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  async function convidar() {
    const email = emailConvite.trim();
    if (!email) return;
    setConvidando(true);
    setMensagem(null);

    const supabase = createClient();
    const { data, error } = await supabase.rpc("adicionar_membro_por_email", {
      p_projeto_id: projetoId,
      p_email: email,
      p_papel: papelConvite,
    });

    if (error) {
      setMensagem({ tipo: "erro", texto: "Erro: " + error.message });
      setConvidando(false);
      return;
    }

    const resultado = data as {
      status: string;
      usuario_id?: string;
      email?: string;
    };

    if (resultado.status === "usuario_nao_encontrado") {
      setMensagem({
        tipo: "aviso",
        texto:
          "Esse e-mail ainda não tem conta no sistema. Peça à pessoa para cadastrar-se primeiro (você pode criar a conta dela em Authentication → Users no painel do Supabase).",
      });
    } else if (resultado.status === "ja_membro") {
      setMensagem({
        tipo: "aviso",
        texto: "Esse usuário já é membro do projeto.",
      });
    } else if (resultado.status === "nao_autorizado") {
      setMensagem({
        tipo: "erro",
        texto: "Você não tem permissão para adicionar membros.",
      });
    } else if (resultado.status === "ok") {
      const emailReal = resultado.email ?? email;
      setMensagem({
        tipo: "sucesso",
        texto: `${emailReal} foi adicionado como ${PAPEIS_INFO[papelConvite].label.toLowerCase()}.`,
      });
      setMembros((prev) => [
        ...prev,
        {
          projeto_id: projetoId,
          usuario_id: resultado.usuario_id!,
          papel: papelConvite,
          adicionado_em: new Date().toISOString(),
          adicionado_por: usuarioAtualId,
          usuario_email: emailReal,
        },
      ]);
      setEmailConvite("");
    }

    setConvidando(false);
  }

  async function alterarPapel(usuarioId: string, novoPapel: PapelProjeto) {
    setSalvandoEdicao(true);
    setMensagem(null);

    const supabase = createClient();
    const { data, error } = await supabase.rpc("alterar_papel_membro", {
      p_projeto_id: projetoId,
      p_usuario_id: usuarioId,
      p_novo_papel: novoPapel,
    });

    if (error) {
      setMensagem({ tipo: "erro", texto: "Erro ao alterar papel: " + error.message });
      setSalvandoEdicao(false);
      return;
    }

    const resultado = data as { status: string };

    if (resultado.status === "nao_autorizado") {
      setMensagem({ tipo: "erro", texto: "Sem permissão para alterar papel." });
    } else if (resultado.status === "membro_nao_encontrado") {
      setMensagem({ tipo: "erro", texto: "Membro não encontrado." });
    } else if (resultado.status === "ultimo_admin") {
      setMensagem({
        tipo: "erro",
        texto:
          "Não é possível rebaixar o último administrador do projeto. Promova outra pessoa a admin antes.",
      });
    } else if (resultado.status === "ok") {
      setMembros((prev) =>
        prev.map((m) =>
          m.usuario_id === usuarioId ? { ...m, papel: novoPapel } : m
        )
      );
      setEditandoId(null);
      setMensagem({ tipo: "sucesso", texto: "Papel atualizado." });
    }

    setSalvandoEdicao(false);
  }

  async function remover(usuarioId: string, email: string) {
    if (usuarioId === usuarioAtualId) {
      if (
        !confirm(
          "Você está removendo a si mesmo do projeto. Perderá acesso ao sair desta página. Deseja continuar?"
        )
      )
        return;
    } else {
      if (!confirm(`Remover ${email} do projeto?`)) return;
    }

    setMensagem(null);

    const supabase = createClient();
    const { data, error } = await supabase.rpc("remover_membro", {
      p_projeto_id: projetoId,
      p_usuario_id: usuarioId,
    });

    if (error) {
      setMensagem({ tipo: "erro", texto: "Erro ao remover: " + error.message });
      return;
    }

    const resultado = data as { status: string };

    if (resultado.status === "nao_autorizado") {
      setMensagem({ tipo: "erro", texto: "Sem permissão para remover." });
    } else if (resultado.status === "membro_nao_encontrado") {
      setMensagem({ tipo: "erro", texto: "Membro não encontrado." });
    } else if (resultado.status === "ultimo_admin") {
      setMensagem({
        tipo: "erro",
        texto:
          "Não é possível remover o último administrador do projeto. Promova outra pessoa a admin antes.",
      });
    } else if (resultado.status === "ok") {
      setMembros((prev) => prev.filter((m) => m.usuario_id !== usuarioId));
      setMensagem({ tipo: "sucesso", texto: "Membro removido." });
    }
  }

  const totalAdmins = membros.filter((m) => m.papel === "admin").length;

  return (
    <div className="space-y-6">
      {/* Adicionar membro */}
      <div className="bg-white border border-[#e5e5ea] rounded-2xl p-6">
        <h2
          className="text-lg font-medium text-[#18182a] mb-1"
          style={{ fontFamily: "var(--font-bricolage), serif" }}
        >
          Adicionar membro
        </h2>
        <p className="text-xs text-[#8e8e9a] mb-4">
          O usuário precisa já ter conta no sistema. Adicionar aqui apenas concede
          o papel escolhido neste projeto.
        </p>

        <div className="flex flex-col md:flex-row gap-2">
          <div className="flex-1 relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8e8e9a]" />
            <input
              type="email"
              value={emailConvite}
              onChange={(e) => setEmailConvite(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && convidar()}
              placeholder="email@dominio.com"
              disabled={convidando}
              className="w-full pl-10 pr-3 py-2 text-sm bg-[#ffffff] border border-[#d4d4da] rounded-lg outline-none focus:border-[#0c0059]"
            />
          </div>
          <select
            value={papelConvite}
            onChange={(e) => setPapelConvite(e.target.value as PapelProjeto)}
            disabled={convidando}
            className="px-3 py-2 text-sm bg-[#ffffff] border border-[#d4d4da] rounded-lg outline-none focus:border-[#0c0059]"
          >
            <option value="admin">Administrador</option>
            <option value="editor">Editor</option>
            <option value="leitor">Leitor</option>
          </select>
          <button
            onClick={convidar}
            disabled={convidando || !emailConvite.trim()}
            className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm bg-[#18182a] hover:bg-[#0c0059] disabled:bg-[#8e8e9a] text-white rounded-lg transition-colors"
          >
            {convidando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
            Adicionar
          </button>
        </div>

        {mensagem && (
          <div
            className={`mt-3 px-3 py-2 rounded-lg text-sm border flex items-start justify-between gap-2 ${
              mensagem.tipo === "sucesso"
                ? "bg-[#d9f0df] border-[#2f9b5b]/30 text-[#1f6f3e]"
                : mensagem.tipo === "aviso"
                ? "bg-[#fbf0d7] border-[#d99b1f]/30 text-[#8a5e0c]"
                : "bg-[#fcdcd6] border-[#f3c8be] text-[#8c2c1b]"
            }`}
          >
            <span>{mensagem.texto}</span>
            <button onClick={() => setMensagem(null)} className="shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Lista de membros */}
      <div className="bg-white border border-[#e5e5ea] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e5e5ea] flex items-center justify-between">
          <h2
            className="text-lg font-medium text-[#18182a]"
            style={{ fontFamily: "var(--font-bricolage), serif" }}
          >
            Membros
          </h2>
          <span className="text-xs text-[#8e8e9a] font-mono">
            {membros.length} {membros.length === 1 ? "pessoa" : "pessoas"}
          </span>
        </div>

        <div>
          {membros.map((m) => {
            const editando = editandoId === m.usuario_id;
            const ehVoce = m.usuario_id === usuarioAtualId;
            const ehUltimoAdmin = m.papel === "admin" && totalAdmins === 1;

            return (
              <div
                key={m.usuario_id}
                className="px-6 py-3 flex items-center gap-4 border-b border-[#e5e5ea] last:border-b-0 hover:bg-[#ffffff]"
              >
                <div className="w-9 h-9 rounded-full bg-[#e6eef7] flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4 text-[#0c0059]" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#18182a] truncate">
                    {m.usuario_email}
                    {ehVoce && (
                      <span className="ml-2 text-[10px] font-mono text-[#8e8e9a] uppercase">
                        (você)
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-[#8e8e9a] font-mono mt-0.5">
                    Adicionado em{" "}
                    {new Date(m.adicionado_em).toLocaleDateString("pt-BR")}
                  </div>
                </div>

                {editando ? (
                  <div className="flex items-center gap-1">
                    <select
                      value={novoPapelEdicao}
                      onChange={(e) =>
                        setNovoPapelEdicao(e.target.value as PapelProjeto)
                      }
                      disabled={salvandoEdicao}
                      className="px-2 py-1 text-xs bg-white border border-[#d4d4da] rounded outline-none focus:border-[#0c0059]"
                    >
                      <option value="admin">Administrador</option>
                      <option value="editor">Editor</option>
                      <option value="leitor">Leitor</option>
                    </select>
                    <button
                      onClick={() => alterarPapel(m.usuario_id, novoPapelEdicao)}
                      disabled={salvandoEdicao}
                      className="p-1.5 text-[#1f6f3e] hover:bg-[#d9f0df] rounded transition-colors disabled:opacity-50"
                      title="Confirmar"
                    >
                      {salvandoEdicao ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => setEditandoId(null)}
                      disabled={salvandoEdicao}
                      className="p-1.5 text-[#8e8e9a] hover:bg-[#f1f2f7] rounded transition-colors"
                      title="Cancelar"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wide"
                      style={{
                        background: PAPEIS_INFO[m.papel].cor + "20",
                        color: PAPEIS_INFO[m.papel].cor,
                      }}
                    >
                      {PAPEIS_INFO[m.papel].label}
                    </span>
                    <button
                      onClick={() => {
                        setEditandoId(m.usuario_id);
                        setNovoPapelEdicao(m.papel);
                      }}
                      disabled={ehUltimoAdmin}
                      className="p-1.5 text-[#8e8e9a] hover:bg-[#f1f2f7] rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title={
                        ehUltimoAdmin
                          ? "Não é possível rebaixar o último administrador"
                          : "Alterar papel"
                      }
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => remover(m.usuario_id, m.usuario_email)}
                      disabled={ehUltimoAdmin}
                      className="p-1.5 text-[#8e8e9a] hover:bg-[#fcdcd6] hover:text-[#8c2c1b] rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title={
                        ehUltimoAdmin
                          ? "Não é possível remover o último administrador"
                          : "Remover do projeto"
                      }
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-xs text-[#8e8e9a] space-y-1 px-1">
        <div>
          <span className="font-semibold text-[#8c2c1b]">Administrador:</span>{" "}
          edita tudo + gerencia membros + arquiva projeto
        </div>
        <div>
          <span className="font-semibold text-[#1d4d8a]">Editor:</span> edita
          tarefas, comentários e anexos
        </div>
        <div>
          <span className="font-semibold text-[#4a4a5a]">Leitor:</span> apenas
          visualiza
        </div>
      </div>
    </div>
  );
}