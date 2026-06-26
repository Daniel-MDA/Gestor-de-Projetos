import Link from "next/link";

export default function PlaybookNav({
  estaLogado,
  podeEditar,
}: {
  estaLogado: boolean;
  podeEditar: boolean;
}) {
  return (
    <nav className="pb-nav">
      <div className="pb-nav-inner">
        <Link href="/" className="pb-logo" title="Voltar ao início">
          <span className="pb-logo-mark">TF</span>
          <span className="pb-logo-text">Playbook 2026</span>
        </Link>
        <ul className="pb-nav-links">
          <li>
            <a href="#eventos">Eventos</a>
          </li>
          {podeEditar ? (
            <li>
              <span className="pb-badge-editor">✎ Modo editor</span>
            </li>
          ) : estaLogado ? null : (
            <li>
              <Link href="/login" className="pb-nav-cta">
                Entrar para editar
              </Link>
            </li>
          )}
        </ul>
      </div>
    </nav>
  );
}
