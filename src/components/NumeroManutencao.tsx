import { useEffect, useMemo, useRef, useState } from "react";
import { ManutencaoRegistro } from "../types";
import { getManutencao, saveManutencao } from "../utils/storage";
import { useAuth } from "../context/AuthContext";
import "./InventarioMontagem.css";
import "./NumeroManutencao.css";

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const nowIso = () => new Date().toISOString();

const SEDE_OPTIONS = ["", "AP", "IP", "UP", "MV"] as const;

const EQUIPAMENTO_OPTIONS = [
  "",
  "Cancela",
  "Catraca",
  "Facial",
  "Digital",
  "Semáforo",
] as const;

const FIELD_LABELS: Record<
  keyof Omit<ManutencaoRegistro, "id" | "updatedAt" | "equipamento" | "sede">,
  string
> = {
  nm: "NM",
  local: "Local",
  patrimonio: "Patrimônio",
  fornecedor: "Fornecedor",
};

type SortOption = "manual" | "equipamento" | "recentes";
type UndoState = {
  registro: ManutencaoRegistro;
  index: number;
  message: string;
} | null;

const createRegistro = (): ManutencaoRegistro => ({
  id: createId(),
  equipamento: "",
  nm: "",
  local: "",
  patrimonio: "",
  fornecedor: "",
  sede: "",
  updatedAt: nowIso(),
});

const normalizeRegistro = (r: any): ManutencaoRegistro => ({
  id: r?.id ?? createId(),
  equipamento: r?.equipamento ?? "",
  nm: r?.nm ?? "",
  local: r?.local ?? "",
  patrimonio: r?.patrimonio ?? "",
  fornecedor: r?.fornecedor ?? "",
  sede: r?.sede ?? "",
  updatedAt: r?.updatedAt ?? nowIso(),
});

const normalizeText = (value: string) =>
  value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(date.getDate())}/${p(date.getMonth() + 1)}/${date.getFullYear()} ${p(date.getHours())}:${p(date.getMinutes())}`;
};

const NumeroManutencao = () => {
  const { isAdmin } = useAuth();
  const [registros, setRegistros] = useState<ManutencaoRegistro[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [undoState, setUndoState] = useState<UndoState>(null);
  const [sortBy, setSortBy] = useState<SortOption>("manual");
  const [search, setSearch] = useState("");
  const fieldStartValuesRef = useRef<Record<string, string>>({});

  useEffect(() => {
    getManutencao()
      .then((saved) => {
        setRegistros(saved.map(normalizeRegistro));
        setCarregado(true);
      })
      .catch((err) => console.error("Erro ao carregar manutenção", err));
  }, []);

  useEffect(() => {
    if (!carregado) return;
    const handle = window.setTimeout(() => {
      saveManutencao(registros).catch((err) =>
        console.error("Erro ao salvar manutenção", err),
      );
    }, 250);
    return () => window.clearTimeout(handle);
  }, [carregado, registros]);

  useEffect(() => {
    if (!undoState) return;
    const handle = window.setTimeout(() => setUndoState(null), 8000);
    return () => window.clearTimeout(handle);
  }, [undoState]);

  const registrosOrdenados = useMemo(() => {
    const base = [...registros];
    if (sortBy === "equipamento")
      base.sort((a, b) => a.equipamento.localeCompare(b.equipamento, "pt-BR"));
    else if (sortBy === "recentes")
      base.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return base;
  }, [registros, sortBy]);

  const registrosFiltrados = useMemo(() => {
    const termo = normalizeText(search.trim());
    if (!termo) return registrosOrdenados;
    return registrosOrdenados.filter((r) => {
      const haystack = normalizeText(
        [r.equipamento, r.nm, r.local, r.patrimonio, r.fornecedor].join(" "),
      );
      return haystack.includes(termo);
    });
  }, [registrosOrdenados, search]);

  const focusNextEditor = (current: HTMLElement) => {
    const inputs = Array.from(
      document.querySelectorAll<HTMLElement>(".unit-editor"),
    ).filter((el) => !el.hasAttribute("disabled"));
    const idx = inputs.indexOf(current);
    if (idx >= 0 && idx < inputs.length - 1) {
      inputs[idx + 1].focus();
      (inputs[idx + 1] as HTMLInputElement).select?.();
    }
  };

  const markFieldStart = (id: string, campo: string, valor: string) => {
    fieldStartValuesRef.current[`${id}:${campo}`] = valor;
  };

  const handleFieldChange = (
    id: string,
    campo: keyof Omit<ManutencaoRegistro, "id" | "updatedAt">,
    valor: string,
  ) => {
    setRegistros((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, [campo]: valor, updatedAt: nowIso() } : r,
      ),
    );
  };

  const handleFieldBlur = (id: string, campo: string, valorAtual: string) => {
    const key = `${id}:${campo}`;
    const valorInicial = fieldStartValuesRef.current[key];
    delete fieldStartValuesRef.current[key];
    if (valorInicial === undefined || valorInicial === valorAtual) return;
    setRegistros((prev) =>
      prev.map((r) => (r.id === id ? { ...r, updatedAt: nowIso() } : r)),
    );
  };

  const handleAdicionarRegistro = () => {
    setRegistros((prev) => [...prev, createRegistro()]);
  };

  const handleRemoverRegistro = (id: string) => {
    const index = registros.findIndex((r) => r.id === id);
    const registro = registros[index];
    if (!registro) return;
    setRegistros((prev) => prev.filter((r) => r.id !== id));
    setUndoState({ registro, index, message: "Registro removido." });
  };

  const handleUndoRemove = () => {
    if (!undoState) return;
    setRegistros((prev) => {
      const next = [...prev];
      next.splice(undoState.index, 0, undoState.registro);
      return next;
    });
    setUndoState(null);
  };

  return (
    <div className="inventario">
      <div className="inventario-header">
        <div className="inventario-title">
          <h2>Nº Manutenção</h2>
          <div className="inventario-stats">
            <span className="inventario-stat">
              Registros: <strong>{registros.length}</strong>
            </span>
          </div>
        </div>
        {isAdmin && (
          <div className="inventario-actions">
            <button
              type="button"
              className="btn-add-item"
              onClick={handleAdicionarRegistro}
            >
              + Adicionar
            </button>
          </div>
        )}
      </div>

      <div className="inventario-toolbar">
        <div className="inventario-toolbar-field inventario-toolbar-search">
          <label htmlFor="manutencao-busca">Buscar</label>
          <input
            id="manutencao-busca"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Equipamento, NM, local, patrimônio..."
          />
        </div>
        <div className="inventario-toolbar-field inventario-toolbar-sort">
          <label htmlFor="manutencao-ordem">Ordem</label>
          <select
            id="manutencao-ordem"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
          >
            <option value="manual">Manual</option>
            <option value="equipamento">Equipamento</option>
            <option value="recentes">Última edição</option>
          </select>
        </div>
      </div>

      <div className="inventario-card">
        {registros.length === 0 ? (
          <div className="empty-state">Nenhum registro de NM.</div>
        ) : (
          <div className="ut-wrap">
            <div className="ut-head nm-ut-head">
              <span>#</span>
              <span>Equipamento</span>
              <span>Sede</span>
              <span>NM</span>
              <span>Local</span>
              <span>Patrimônio</span>
              <span>Fornecedor</span>
              <span>Atualizado</span>
              <span></span>
            </div>
            {registrosFiltrados.length === 0 ? (
              <div className="empty-state">Nenhum resultado para a busca.</div>
            ) : (
              registrosFiltrados.map((r, idx) => (
                <div key={r.id} className="ut-row nm-ut-row">
                  <span className="ut-num">{idx + 1}</span>
                  <select
                    className="unit-editor ut-input"
                    value={r.equipamento}
                    disabled={!isAdmin}
                    onChange={(e) => {
                      markFieldStart(r.id, "equipamento", r.equipamento);
                      handleFieldChange(r.id, "equipamento", e.target.value);
                      handleFieldBlur(r.id, "equipamento", e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        focusNextEditor(e.currentTarget);
                      }
                    }}
                  >
                    {EQUIPAMENTO_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o || "—"}
                      </option>
                    ))}
                  </select>
                  <select
                    className="unit-editor ut-input"
                    value={r.sede}
                    disabled={!isAdmin}
                    onChange={(e) => {
                      markFieldStart(r.id, "sede", r.sede);
                      handleFieldChange(r.id, "sede", e.target.value);
                      handleFieldBlur(r.id, "sede", e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        focusNextEditor(e.currentTarget);
                      }
                    }}
                  >
                    {SEDE_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o || "—"}
                      </option>
                    ))}
                  </select>
                  {(["nm", "local", "patrimonio", "fornecedor"] as const).map(
                    (campo) => (
                      <input
                        key={campo}
                        className="unit-editor ut-input"
                        type="text"
                        readOnly={!isAdmin}
                        placeholder={FIELD_LABELS[campo]}
                        value={r[campo]}
                        onFocus={() => markFieldStart(r.id, campo, r[campo])}
                        onBlur={() => handleFieldBlur(r.id, campo, r[campo])}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            focusNextEditor(e.currentTarget);
                          }
                        }}
                        onChange={(e) =>
                          handleFieldChange(r.id, campo, e.target.value)
                        }
                      />
                    ),
                  )}
                  <span className="ut-date">{formatDateTime(r.updatedAt)}</span>
                  <div className="ut-actions">
                    {isAdmin && (
                      <button
                        type="button"
                        className="btn-remover-unidade"
                        onClick={() => handleRemoverRegistro(r.id)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {undoState && (
        <div className="inventario-toast" role="status" aria-live="polite">
          <span>{undoState.message}</span>
          <button type="button" onClick={handleUndoRemove}>
            Desfazer
          </button>
        </div>
      )}
    </div>
  );
};

export default NumeroManutencao;
