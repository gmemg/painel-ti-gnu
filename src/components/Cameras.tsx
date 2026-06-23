import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  CameraStatus,
  RatStatus,
  InventarioHistoricoEntry,
} from "../types";
import { getCameras, saveCameras } from "../utils/storage";
import { useAuth } from "../context/AuthContext";
import "./InventarioMontagem.css";
import "./Cameras.css";

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const nowIso = () => new Date().toISOString();

const STATUS_OPTIONS: Array<{ value: CameraStatus; label: string }> = [
  { value: "online", label: "OK" },
  { value: "offline", label: "FORA" },
  { value: "reposicionar", label: "REPOSICIONAR" },
];

const SEDE_OPTIONS = ["", "AP", "IP", "UP", "MV"] as const;

const RAT_OPTIONS: RatStatus[] = [
  "",
  "Aguardando assinatura",
  "Assinado",
  "Criar",
  "Criado",
  "Imprimir",
];

const FIELD_LABELS: Record<
  keyof Omit<Camera, "id" | "historico" | "updatedAt" | "status" | "rat">,
  string
> = {
  local: "Local",
  sede: "Sede",
  marca: "Marca",
  modelo: "Modelo",
  ip: "IP",
  chamado: "Chamado",
};

type SortOption = "manual" | "local" | "status" | "recentes";

type UndoState = { camera: Camera; index: number; message: string } | null;

const createHistoricoEntry = (
  descricao: string,
  data = nowIso(),
): InventarioHistoricoEntry => ({ id: createId(), data, descricao });

const addHistory = (
  camera: Camera,
  descricao: string,
  data = nowIso(),
): Camera => ({
  ...camera,
  updatedAt: data,
  historico: [createHistoricoEntry(descricao, data), ...camera.historico].slice(
    0,
    25,
  ),
});

const createCamera = (): Camera => {
  const data = nowIso();
  return {
    id: createId(),
    local: "",
    sede: "",
    marca: "",
    modelo: "",
    ip: "",
    rat: "",
    chamado: "",
    status: "online",
    historico: [createHistoricoEntry("Câmera cadastrada", data)],
    updatedAt: data,
  };
};

const normalizeCamera = (c: any): Camera => {
  const data = c?.updatedAt ?? nowIso();
  const validRat: RatStatus[] = [
    "Aguardando assinatura",
    "Assinado",
    "Criar",
    "Criado",
    "Imprimir",
    "",
  ];
  return {
    id: c?.id ?? createId(),
    local: c?.local ?? "",
    sede: c?.sede ?? "",
    marca: c?.marca ?? "",
    modelo: c?.modelo ?? "",
    ip: c?.ip ?? "",
    rat: validRat.includes(c?.rat) ? c.rat : "",
    chamado: c?.chamado ?? "",
    status: (["online", "offline", "reposicionar", "reposicionada"] as CameraStatus[]).includes(
      c?.status,
    )
      ? c.status
      : "online",
    historico: Array.isArray(c?.historico)
      ? c.historico
      : [createHistoricoEntry("Câmera migrada", data)],
    updatedAt: data,
  };
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(date.getDate())}/${p(date.getMonth() + 1)}/${date.getFullYear()} ${p(date.getHours())}:${p(date.getMinutes())}`;
};

const normalizeText = (value: string) =>
  value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const Cameras = () => {
  const { isAdmin } = useAuth();
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [undoState, setUndoState] = useState<UndoState>(null);
  const [historicoAberto, setHistoricoAberto] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("manual");
  const [search, setSearch] = useState("");

  const fieldStartValuesRef = useRef<Record<string, string>>({});

  useEffect(() => {
    getCameras()
      .then((saved) => {
        setCameras(saved.length > 0 ? saved.map(normalizeCamera) : []);
        setCarregado(true);
      })
      .catch((err) => console.error("Erro ao carregar câmeras", err));
  }, []);

  useEffect(() => {
    if (!carregado) return;
    const handle = window.setTimeout(() => {
      saveCameras(cameras).catch((err) =>
        console.error("Erro ao salvar câmeras", err),
      );
    }, 250);
    return () => window.clearTimeout(handle);
  }, [carregado, cameras]);

  useEffect(() => {
    if (!undoState) return;
    const handle = window.setTimeout(() => setUndoState(null), 8000);
    return () => window.clearTimeout(handle);
  }, [undoState]);

  const statusTotals = useMemo(() => {
    const totals: Record<CameraStatus, number> = {
      online: 0,
      offline: 0,
      reposicionar: 0,
      reposicionada: 0,
    };
    cameras.forEach((c) => {
      totals[c.status] += 1;
    });
    return totals;
  }, [cameras]);

  const camerasOrdenadas = useMemo(() => {
    const base = [...cameras];
    if (sortBy === "local")
      base.sort((a, b) => a.local.localeCompare(b.local, "pt-BR"));
    else if (sortBy === "status")
      base.sort((a, b) => a.status.localeCompare(b.status));
    else if (sortBy === "recentes")
      base.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return base;
  }, [cameras, sortBy]);

  const camerasFiltradas = useMemo(() => {
    const termo = normalizeText(search.trim());
    if (!termo) return camerasOrdenadas;
    return camerasOrdenadas.filter((c) => {
      const statusLabel =
        STATUS_OPTIONS.find((o) => o.value === c.status)?.label ?? "";
      const haystack = normalizeText(
        [
          c.local,
          c.sede,
          c.marca,
          c.modelo,
          c.ip,
          c.rat,
          c.chamado,
          statusLabel,
        ].join(" "),
      );
      return haystack.includes(termo);
    });
  }, [camerasOrdenadas, search]);

  const cameraHistoricoAberto = useMemo(
    () => cameras.find((c) => c.id === historicoAberto) ?? null,
    [cameras, historicoAberto],
  );

  const markFieldStart = (
    id: string,
    campo: keyof typeof FIELD_LABELS,
    valor: string,
  ) => {
    fieldStartValuesRef.current[`${id}:${campo}`] = valor;
  };

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

  const handleFieldChange = (
    id: string,
    campo: keyof Omit<Camera, "id" | "historico" | "updatedAt" | "rat">,
    valor: string,
  ) => {
    const data = nowIso();
    setCameras((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              [campo]: campo === "status" ? (valor as CameraStatus) : valor,
              updatedAt: data,
            }
          : c,
      ),
    );
  };

  const handleFieldBlur = (
    id: string,
    campo: keyof typeof FIELD_LABELS,
    valorAtual: string,
  ) => {
    const key = `${id}:${campo}`;
    const valorInicial = fieldStartValuesRef.current[key];
    delete fieldStartValuesRef.current[key];
    if (valorInicial === undefined || valorInicial === valorAtual) return;
    const data = nowIso();
    setCameras((prev) =>
      prev.map((c) =>
        c.id === id
          ? addHistory(
              { ...c, updatedAt: data },
              `${FIELD_LABELS[campo]} alterado para "${valorAtual || "vazio"}"`,
              data,
            )
          : c,
      ),
    );
  };

  const handleRatChange = (id: string, rat: RatStatus) => {
    const data = nowIso();
    setCameras((prev) =>
      prev.map((c) =>
        c.id === id
          ? addHistory(
              { ...c, rat, updatedAt: data },
              `RAT alterado para "${rat || "vazio"}"`,
              data,
            )
          : c,
      ),
    );
  };

  const handleStatusChange = (id: string, status: CameraStatus) => {
    const statusLabel =
      STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
    const data = nowIso();
    setCameras((prev) =>
      prev.map((c) =>
        c.id === id
          ? addHistory(
              { ...c, status, updatedAt: data },
              `Status alterado para ${statusLabel}`,
              data,
            )
          : c,
      ),
    );
  };

  const handleAdicionarCamera = () => {
    setCameras((prev) => [...prev, createCamera()]);
  };

  const handleRemoverCamera = (id: string) => {
    const index = cameras.findIndex((c) => c.id === id);
    const camera = cameras[index];
    if (!camera) return;
    setCameras((prev) => prev.filter((c) => c.id !== id));
    setUndoState({ camera, index, message: "Câmera removida." });
  };

  const handleUndoRemove = () => {
    if (!undoState) return;
    const restaurada = addHistory(
      undoState.camera,
      "Câmera restaurada após remoção",
    );
    setCameras((prev) => {
      const next = [...prev];
      next.splice(undoState.index, 0, restaurada);
      return next;
    });
    setUndoState(null);
  };

  return (
    <div className="inventario">
      <div className="inventario-header">
        <div className="inventario-title">
          <h2>Câmeras</h2>
          <div className="inventario-stats">
            <span className="inventario-stat">
              Total: <strong>{cameras.length}</strong>
            </span>
            <span className="inventario-stat">
              Online: <strong>{statusTotals.online}</strong>
            </span>
            <span className="inventario-stat">
              Offline: <strong>{statusTotals.offline}</strong>
            </span>
          </div>
        </div>
        {isAdmin && (
          <div className="inventario-actions">
            <button
              type="button"
              className="btn-add-item"
              onClick={handleAdicionarCamera}
            >
              + Adicionar câmera
            </button>
          </div>
        )}
      </div>

      <div className="inventario-toolbar">
        <div className="inventario-toolbar-field inventario-toolbar-search">
          <label htmlFor="cameras-busca">Buscar</label>
          <input
            id="cameras-busca"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Local, sede, marca, modelo, IP, RAT..."
          />
        </div>
        <div className="inventario-toolbar-field inventario-toolbar-sort">
          <label htmlFor="cameras-ordem">Ordem</label>
          <select
            id="cameras-ordem"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
          >
            <option value="manual">Manual</option>
            <option value="local">Local</option>
            <option value="status">Status</option>
            <option value="recentes">Última edição</option>
          </select>
        </div>
      </div>

      <div className="inventario-card">
        <div className="inventario-card-body">
          {cameras.length === 0 ? (
            <div className="empty-state">Nenhuma câmera cadastrada.</div>
          ) : (
            <div className="ut-wrap">
              <div className="ut-head cameras-ut-head">
                <span>#</span>
                <span>Status</span>
                <span>Local</span>
                <span>Sede</span>
                <span>Marca</span>
                <span>Modelo</span>
                <span>IP</span>
                <span>RAT</span>
                <span>Chamado</span>
                <span>Atualizado</span>
                <span></span>
              </div>
              {camerasFiltradas.map((camera, idx) => (
                <div key={camera.id} className="ut-row cameras-ut-row">
                  <span className="ut-num">{idx + 1}</span>
                  <div className="ut-status">
                    <select
                      className={`unit-editor status-select status-${camera.status}`}
                      value={camera.status}
                      disabled={!isAdmin}
                      onChange={(e) =>
                        handleStatusChange(
                          camera.id,
                          e.target.value as CameraStatus,
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          focusNextEditor(e.currentTarget);
                        }
                      }}
                    >
                      {STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    className="unit-editor ut-input"
                    type="text"
                    readOnly={!isAdmin}
                    placeholder={FIELD_LABELS.local}
                    value={camera.local}
                    onFocus={() => markFieldStart(camera.id, "local", camera.local)}
                    onBlur={() => handleFieldBlur(camera.id, "local", camera.local)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); focusNextEditor(e.currentTarget); }
                    }}
                    onChange={(e) => handleFieldChange(camera.id, "local", e.target.value)}
                  />
                  <select
                    className="unit-editor ut-input"
                    value={camera.sede}
                    disabled={!isAdmin}
                    onChange={(e) => {
                      markFieldStart(camera.id, "sede", camera.sede);
                      handleFieldChange(camera.id, "sede", e.target.value);
                      handleFieldBlur(camera.id, "sede", e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); focusNextEditor(e.currentTarget); }
                    }}
                  >
                    {SEDE_OPTIONS.map((o) => (
                      <option key={o} value={o}>{o || "—"}</option>
                    ))}
                  </select>
                  {(["marca", "modelo", "ip"] as const).map(
                    (campo) => (
                      <input
                        key={campo}
                        className="unit-editor ut-input"
                        type="text"
                        readOnly={!isAdmin}
                        placeholder={FIELD_LABELS[campo]}
                        value={camera[campo]}
                        onFocus={() =>
                          markFieldStart(camera.id, campo, camera[campo])
                        }
                        onBlur={() =>
                          handleFieldBlur(camera.id, campo, camera[campo])
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            focusNextEditor(e.currentTarget);
                          }
                        }}
                        onChange={(e) =>
                          handleFieldChange(camera.id, campo, e.target.value)
                        }
                      />
                    ),
                  )}
                  <select
                    className="unit-editor ut-input"
                    value={camera.rat}
                    disabled={!isAdmin}
                    onChange={(e) =>
                      handleRatChange(camera.id, e.target.value as RatStatus)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        focusNextEditor(e.currentTarget);
                      }
                    }}
                  >
                    {RAT_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o || "—"}
                      </option>
                    ))}
                  </select>
                  <input
                    className="unit-editor ut-input"
                    type="text"
                    readOnly={!isAdmin}
                    placeholder={FIELD_LABELS.chamado}
                    value={camera.chamado}
                    onFocus={() =>
                      markFieldStart(camera.id, "chamado", camera.chamado)
                    }
                    onBlur={() =>
                      handleFieldBlur(camera.id, "chamado", camera.chamado)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        focusNextEditor(e.currentTarget);
                      }
                    }}
                    onChange={(e) =>
                      handleFieldChange(camera.id, "chamado", e.target.value)
                    }
                  />
                  <span className="ut-date">
                    {formatDateTime(camera.updatedAt)}
                  </span>
                  <div className="ut-actions">
                    <button
                      type="button"
                      className="btn-historico-unidade"
                      onClick={() => setHistoricoAberto(camera.id)}
                    >
                      Hist.
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        className="btn-remover-unidade"
                        onClick={() => handleRemoverCamera(camera.id)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {cameraHistoricoAberto && (
        <div
          className="inventario-modal-overlay"
          role="presentation"
          onClick={() => setHistoricoAberto(null)}
        >
          <div
            className="inventario-modal inventario-history-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="historico-camera-titulo"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="inventario-modal-header">
              <h3 id="historico-camera-titulo">
                Histórico —{" "}
                {cameraHistoricoAberto.local ||
                  cameraHistoricoAberto.modelo ||
                  "Câmera"}
              </h3>
            </div>
            <div className="inventario-history-list">
              {cameraHistoricoAberto.historico.map((entry) => (
                <div key={entry.id} className="inventario-history-entry">
                  <span className="inventario-history-date">
                    {formatDateTime(entry.data)}
                  </span>
                  <span className="inventario-history-description">
                    {entry.descricao}
                  </span>
                </div>
              ))}
            </div>
            <div className="inventario-form-actions">
              <button
                type="button"
                className="btn-cancelar-item"
                onClick={() => setHistoricoAberto(null)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

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

export default Cameras;
