import { useEffect, useRef, useState } from "react";
import { Impressora, TonerRegistro, TonerTipo } from "../types";
import {
  getImpressoras,
  saveImpressoras,
  getToners,
  saveToners,
} from "../utils/storage";
import { useAuth } from "../context/AuthContext";
import "./Impressoras.css";

type TonerKey = "tonerPreto" | "tonerCiano" | "tonerMagenta" | "tonerAmarelo";

const TONERS: Array<{ key: TonerKey; label: string; cor: string }> = [
  { key: "tonerPreto", label: "P", cor: "#000000" },
  { key: "tonerCiano", label: "C", cor: "#00ccee" },
  { key: "tonerMagenta", label: "M", cor: "#f0138a" },
  { key: "tonerAmarelo", label: "A", cor: "#f5c200" },
];

type TonerField = "preto" | "ciano" | "magenta" | "amarelo";

const TONER_COLS: Array<{ key: TonerField; label: string; cor: string }> = [
  { key: "preto", label: "P", cor: "#9ca3af" },
  { key: "ciano", label: "C", cor: "#00ccee" },
  { key: "magenta", label: "M", cor: "#f0138a" },
  { key: "amarelo", label: "A", cor: "#f5c200" },
];

const TONER_PAINEIS: Array<{ tipo: TonerTipo; titulo: string; cor: string }> = [
  { tipo: "solicitado", titulo: "Solicitados", cor: "#f97316" },
  { tipo: "cheio", titulo: "Estoque Cheios", cor: "#22c55e" },
  { tipo: "vazio", titulo: "Estoque Vazios", cor: "#ef4444" },
];

function TonerPanel({
  tipo,
  titulo,
  cor,
  registros,
  onAdd,
  onChange,
  onRemove,
  podeEditar,
}: {
  tipo: TonerTipo;
  titulo: string;
  cor: string;
  registros: TonerRegistro[];
  onAdd: (tipo: TonerTipo) => void;
  onChange: (id: string, field: string, value: string | number) => void;
  onRemove: (id: string) => void;
  podeEditar: boolean;
}) {
  return (
    <div className="toner-panel">
      <div className="toner-panel-header" style={{ borderTopColor: cor }}>
        <span className="toner-panel-titulo" style={{ color: cor }}>
          {titulo}
        </span>
        {podeEditar && (
          <button
            type="button"
            className="toner-btn-add"
            onClick={() => onAdd(tipo)}
          >
            + Adicionar
          </button>
        )}
      </div>
      {registros.length === 0 ? (
        <div className="toner-empty">Nenhum registro.</div>
      ) : (
        <div className="toner-table-wrap">
          <table className="toner-table">
            <thead>
              <tr>
                <th className="toner-th-modelo">Modelo</th>
                {TONER_COLS.map((c) => (
                  <th
                    key={c.key}
                    className="toner-th-cor"
                    style={{ color: c.cor }}
                  >
                    {c.label}
                  </th>
                ))}
                {podeEditar && <th className="toner-th-acoes" />}
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r.id} className="toner-row">
                  <td>
                    <input
                      className="toner-input toner-input-modelo"
                      type="text"
                      value={r.modelo}
                      placeholder="Modelo"
                      readOnly={!podeEditar}
                      onChange={(e) => onChange(r.id, "modelo", e.target.value)}
                    />
                  </td>
                  {TONER_COLS.map((c) => (
                    <td key={c.key} className="toner-td-num">
                      <input
                        className="toner-input toner-input-num"
                        type="number"
                        min="0"
                        value={r[c.key] === 0 ? "" : r[c.key]}
                        placeholder="0"
                        readOnly={!podeEditar}
                        onChange={(e) =>
                          onChange(
                            r.id,
                            c.key,
                            Math.max(0, Number(e.target.value) || 0),
                          )
                        }
                      />
                    </td>
                  ))}
                  {podeEditar && (
                    <td className="toner-td-acoes">
                      <button
                        type="button"
                        className="toner-btn-remove"
                        onClick={() => onRemove(r.id)}
                        aria-label="Remover"
                      >
                        ✕
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const FORM_VAZIO: Omit<Impressora, "id" | "updatedAt"> = {
  local: "",
  sede: "",
  marca: "",
  modelo: "",
  numeroSerie: "",
  ip: "",
  mac: "",
  link: "",
  tonerPreto: 100,
  tonerCiano: 100,
  tonerMagenta: 100,
  tonerAmarelo: 100,
};

function gerarId(): string {
  return `imp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function TonerBar({
  label,
  valor,
  cor,
}: {
  label: string;
  valor: number;
  cor: string;
}) {
  const pct = Math.max(0, Math.min(100, valor));
  return (
    <div className="imp-toner-row">
      <span className="imp-toner-label">{label}</span>
      <div className="imp-toner-track">
        <div
          className="imp-toner-fill"
          style={{ width: `${pct}%`, backgroundColor: cor }}
        />
      </div>
      <span className="imp-toner-pct">{pct}%</span>
    </div>
  );
}

function ImpressoraCard({
  impressora,
  onEdit,
  onDelete,
  podeEditar,
}: {
  impressora: Impressora;
  onEdit: (imp: Impressora) => void;
  onDelete: (id: string) => void;
  podeEditar: boolean;
}) {
  return (
    <div className="imp-card">
      <div className="imp-card-header">
        <div className="imp-card-title">
          <span className="imp-card-local">
            {impressora.local || "Sem localização"}
          </span>
          {(impressora.marca || impressora.modelo) && (
            <span className="imp-card-subtitle">
              {[impressora.marca, impressora.modelo]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
        </div>
        <div className="imp-card-actions">
          {impressora.link && (
            <a
              href={impressora.link}
              target="_blank"
              rel="noopener noreferrer"
              className="imp-btn-icon imp-btn-link"
              title="Abrir no GLPI"
              aria-label="Abrir no GLPI"
            >
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                width="15"
                height="15"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11 3h6m0 0v6m0-6L8 12M5 5H4a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1v-1"
                />
              </svg>
            </a>
          )}
          {podeEditar && (
            <>
              <button
                type="button"
                className="imp-btn-icon"
                onClick={() => onEdit(impressora)}
                title="Editar impressora"
                aria-label="Editar impressora"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  width="15"
                  height="15"
                >
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </button>
              <button
                type="button"
                className="imp-btn-icon imp-btn-icon-danger"
                onClick={() => onDelete(impressora.id)}
                title="Remover impressora"
                aria-label="Remover impressora"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  width="15"
                  height="15"
                >
                  <path
                    fillRule="evenodd"
                    d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
      <div className="imp-card-body">
        <div className="imp-info-grid">
          <div className="imp-info-item">
            <span className="imp-info-label">MAC</span>
            <span className="imp-info-value imp-info-mono">
              {impressora.mac || "—"}
            </span>
          </div>
          <div className="imp-info-item">
            <span className="imp-info-label">IP</span>
            <span className="imp-info-value imp-info-mono">
              {impressora.ip || "—"}
            </span>
          </div>
          <div className="imp-info-item">
            <span className="imp-info-label">Nº Série</span>
            <span className="imp-info-value imp-info-mono">
              {impressora.numeroSerie || "—"}
            </span>
          </div>
          <div className="imp-info-item">
            <span className="imp-info-label">Sede</span>
            <span className="imp-info-value">{impressora.sede || "—"}</span>
          </div>
        </div>
        <div className="imp-card-toners">
          <div className="imp-toners-title">Toner</div>
          {TONERS.map(({ key, label, cor }) => (
            <TonerBar
              key={key}
              label={label}
              valor={impressora[key]}
              cor={cor}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Impressoras() {
  const { isAdmin } = useAuth();
  const [impressoras, setImpressoras] = useState<Impressora[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Impressora | null>(null);
  const [form, setForm] = useState<Omit<Impressora, "id" | "updatedAt">>({
    ...FORM_VAZIO,
  });
  const [confirmarRemocao, setConfirmarRemocao] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [view, setView] = useState<"impressoras" | "toners">("impressoras");
  const [toners, setToners] = useState<TonerRegistro[]>([]);
  const primeiroInputRef = useRef<HTMLInputElement>(null);
  const tonersLoadedRef = useRef(false);
  const tonerSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getImpressoras()
      .then(setImpressoras)
      .catch(() => setErro("Não foi possível carregar as impressoras."))
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    if (modalAberto) {
      const t = setTimeout(() => primeiroInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [modalAberto]);

  const salvarLista = async (lista: Impressora[]) => {
    const atualizado = await saveImpressoras(lista);
    setImpressoras(atualizado);
  };

  const abrirModalNovo = () => {
    setEditando(null);
    setForm({ ...FORM_VAZIO });
    setModalAberto(true);
  };

  const abrirModalEditar = (imp: Impressora) => {
    setEditando(imp);
    setForm({
      local: imp.local,
      sede: imp.sede,
      marca: imp.marca,
      modelo: imp.modelo,
      numeroSerie: imp.numeroSerie,
      ip: imp.ip,
      mac: imp.mac,
      link: imp.link,
      tonerPreto: imp.tonerPreto,
      tonerCiano: imp.tonerCiano,
      tonerMagenta: imp.tonerMagenta,
      tonerAmarelo: imp.tonerAmarelo,
    });
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setEditando(null);
  };

  const setField = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErroSalvar(null);
    try {
      const agora = new Date().toISOString();
      if (editando) {
        await salvarLista(
          impressoras.map((imp) =>
            imp.id === editando.id
              ? { ...form, id: editando.id, updatedAt: agora }
              : imp,
          ),
        );
      } else {
        await salvarLista([
          ...impressoras,
          { ...form, id: gerarId(), updatedAt: agora },
        ]);
      }
      fecharModal();
    } catch {
      setErroSalvar("Erro ao salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  const confirmarDelete = async () => {
    if (!confirmarRemocao) return;
    try {
      await salvarLista(
        impressoras.filter((imp) => imp.id !== confirmarRemocao),
      );
    } finally {
      setConfirmarRemocao(null);
    }
  };

  useEffect(() => {
    getToners()
      .then((data) => {
        setToners(data);
        tonersLoadedRef.current = true;
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!tonersLoadedRef.current) return;
    if (tonerSaveTimerRef.current) clearTimeout(tonerSaveTimerRef.current);
    tonerSaveTimerRef.current = setTimeout(() => {
      saveToners(toners).catch(console.error);
    }, 400);
    return () => {
      if (tonerSaveTimerRef.current) clearTimeout(tonerSaveTimerRef.current);
    };
  }, [toners]);

  const handleTonerAdd = (tipo: TonerTipo) => {
    const novo: TonerRegistro = {
      id: `tn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      tipo,
      modelo: "",
      preto: 0,
      ciano: 0,
      magenta: 0,
      amarelo: 0,
      updatedAt: new Date().toISOString(),
    };
    setToners((prev) => [...prev, novo]);
  };

  const handleTonerChange = (
    id: string,
    field: string,
    value: string | number,
  ) => {
    setToners((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, [field]: value, updatedAt: new Date().toISOString() }
          : r,
      ),
    );
  };

  const handleTonerRemove = (id: string) => {
    setToners((prev) => prev.filter((r) => r.id !== id));
  };

  if (carregando) {
    return (
      <div className="imp-loading">
        <div className="imp-loading-spinner" />
        <span>Carregando impressoras…</span>
      </div>
    );
  }

  if (erro) {
    return <div className="imp-erro">{erro}</div>;
  }

  return (
    <div className="imp-page">
      <div className="imp-toolbar">
        <div className="imp-toolbar-title-group">
          <h2 className="imp-toolbar-title">
            {view === "toners" ? "Solicitações" : "Impressoras"}
          </h2>
          {view === "impressoras" && (
            <div className="imp-toolbar-stats">
              <span className="imp-toolbar-stat">
                Impressoras cadastradas: <strong>{impressoras.length}</strong>
              </span>
            </div>
          )}
        </div>
        <div className="imp-toolbar-right">
          {view === "impressoras" && isAdmin && (
            <button
              type="button"
              className="imp-btn-add"
              onClick={abrirModalNovo}
            >
              + Adicionar
            </button>
          )}
          <button
            type="button"
            className="imp-btn-solicitacoes"
            onClick={() =>
              setView(view === "toners" ? "impressoras" : "toners")
            }
          >
            {view === "toners" ? "Impressoras" : "Solicitações"}
          </button>
        </div>
      </div>

      {view === "toners" ? (
        <div className="toner-paineis">
          {TONER_PAINEIS.map((p) => (
            <TonerPanel
              key={p.tipo}
              tipo={p.tipo}
              titulo={p.titulo}
              cor={p.cor}
              registros={toners.filter((r) => r.tipo === p.tipo)}
              onAdd={handleTonerAdd}
              onChange={handleTonerChange}
              onRemove={handleTonerRemove}
              podeEditar={isAdmin}
            />
          ))}
        </div>
      ) : impressoras.length === 0 ? (
        <div className="imp-vazio">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            width="52"
            height="52"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.056 48.056 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z"
            />
          </svg>
          <p>Nenhuma impressora cadastrada.</p>
          {isAdmin && (
            <button
              type="button"
              className="imp-btn-add"
              onClick={abrirModalNovo}
            >
              Adicionar impressora
            </button>
          )}
        </div>
      ) : (
        <div className="imp-grid">
          {impressoras.map((imp) => (
            <ImpressoraCard
              key={imp.id}
              impressora={imp}
              onEdit={abrirModalEditar}
              onDelete={(id) => setConfirmarRemocao(id)}
              podeEditar={isAdmin}
            />
          ))}
        </div>
      )}

      {/* Modal: Adicionar / Editar */}
      {modalAberto && (
        <div
          className="imp-modal-overlay"
          onClick={fecharModal}
          onKeyDown={(e) => e.key === "Escape" && fecharModal()}
        >
          <div
            className="imp-modal"
            role="dialog"
            aria-modal="true"
            aria-label={editando ? "Editar impressora" : "Adicionar impressora"}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="imp-modal-header">
              <h3>{editando ? "Editar Impressora" : "Adicionar Impressora"}</h3>
              <button
                type="button"
                className="imp-modal-close"
                onClick={fecharModal}
                aria-label="Fechar"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  width="18"
                  height="18"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            <form className="imp-modal-form" onSubmit={handleSubmit}>
              <div className="imp-form-grid">
                <div className="imp-form-field">
                  <label htmlFor="imp-local">Local</label>
                  <input
                    ref={primeiroInputRef}
                    id="imp-local"
                    type="text"
                    value={form.local}
                    onChange={(e) => setField("local", e.target.value)}
                    placeholder="Ex: Sala de reuniões"
                  />
                </div>
                <div className="imp-form-field">
                  <label htmlFor="imp-sede">Sede</label>
                  <input
                    id="imp-sede"
                    type="text"
                    value={form.sede}
                    onChange={(e) => setField("sede", e.target.value)}
                    placeholder="Ex: Unidade Centro"
                  />
                </div>
                <div className="imp-form-field">
                  <label htmlFor="imp-marca">Marca</label>
                  <input
                    id="imp-marca"
                    type="text"
                    value={form.marca}
                    onChange={(e) => setField("marca", e.target.value)}
                    placeholder="Ex: HP, Canon, Epson"
                  />
                </div>
                <div className="imp-form-field">
                  <label htmlFor="imp-modelo">Modelo</label>
                  <input
                    id="imp-modelo"
                    type="text"
                    value={form.modelo}
                    onChange={(e) => setField("modelo", e.target.value)}
                    placeholder="Ex: LaserJet Pro M404n"
                  />
                </div>
                <div className="imp-form-field">
                  <label htmlFor="imp-serie">Nº Série</label>
                  <input
                    id="imp-serie"
                    type="text"
                    value={form.numeroSerie}
                    onChange={(e) => setField("numeroSerie", e.target.value)}
                    placeholder="Número de série"
                  />
                </div>
                <div className="imp-form-field">
                  <label htmlFor="imp-ip">IP</label>
                  <input
                    id="imp-ip"
                    type="text"
                    value={form.ip}
                    onChange={(e) => setField("ip", e.target.value)}
                    placeholder="Ex: 192.168.1.100"
                  />
                </div>
                <div className="imp-form-field">
                  <label htmlFor="imp-mac">MAC</label>
                  <input
                    id="imp-mac"
                    type="text"
                    value={form.mac}
                    onChange={(e) => setField("mac", e.target.value)}
                    placeholder="Ex: 00:1A:2B:3C:4D:5E"
                  />
                </div>
                <div className="imp-form-field imp-form-field-full">
                  <label htmlFor="imp-link">Link (painel/acesso web)</label>
                  <input
                    id="imp-link"
                    type="text"
                    value={form.link}
                    onChange={(e) => setField("link", e.target.value)}
                    placeholder="Ex: http://192.168.1.100"
                  />
                </div>
              </div>

              <div className="imp-form-toners">
                <div className="imp-form-toners-title">Nível de Toner</div>
                {TONERS.map(({ key, label, cor }) => (
                  <div key={key} className="imp-form-toner-row">
                    <span
                      className="imp-form-toner-dot"
                      style={{ backgroundColor: cor }}
                    />
                    <label
                      className="imp-form-toner-label"
                      htmlFor={`toner-${key}`}
                    >
                      {label}
                    </label>
                    <input
                      id={`toner-${key}`}
                      type="range"
                      min={0}
                      max={100}
                      value={form[key]}
                      onChange={(e) => setField(key, Number(e.target.value))}
                      style={{ accentColor: cor }}
                      className="imp-form-toner-range"
                    />
                    <div className="imp-form-toner-number-wrap">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={form[key]}
                        onChange={(e) =>
                          setField(
                            key,
                            Math.min(100, Math.max(0, Number(e.target.value))),
                          )
                        }
                        className="imp-form-toner-number"
                      />
                      <span>%</span>
                    </div>
                  </div>
                ))}
              </div>

              {erroSalvar && <p className="imp-modal-erro">{erroSalvar}</p>}
              <div className="imp-modal-footer">
                <button
                  type="button"
                  className="imp-btn-cancel"
                  onClick={fecharModal}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="imp-btn-save"
                  disabled={salvando}
                >
                  {salvando
                    ? "Salvando…"
                    : editando
                      ? "Salvar alterações"
                      : "Adicionar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmar remoção */}
      {confirmarRemocao && (
        <div
          className="imp-modal-overlay"
          onClick={() => setConfirmarRemocao(null)}
        >
          <div
            className="imp-modal imp-modal-confirm"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="imp-modal-header">
              <h3>Remover impressora</h3>
            </div>
            <div className="imp-modal-body">
              Tem certeza que deseja remover esta impressora? Esta ação não pode
              ser desfeita.
            </div>
            <div className="imp-modal-footer">
              <button
                type="button"
                className="imp-btn-cancel"
                onClick={() => setConfirmarRemocao(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="imp-btn-delete"
                onClick={confirmarDelete}
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
