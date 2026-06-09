import { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import {
  InventarioHistoricoEntry,
  InventarioItem,
  InventarioStatus,
  InventarioUnidade,
} from "../types";
import { getInventario, saveInventario } from "../utils/storage";
import "./InventarioMontagem.css";

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const nowIso = () => new Date().toISOString();

const STATUS_OPTIONS: Array<{ value: InventarioStatus; label: string }> = [
  { value: "disponivel", label: "Disponível" },
  { value: "em_uso", label: "Em uso" },
  { value: "manutencao", label: "Manutenção" },
  { value: "reservado", label: "Reservado" },
];

const FIELD_LABELS: Record<
  keyof Omit<InventarioUnidade, "id" | "historico" | "updatedAt" | "status">,
  string
> = {
  modelo: "Modelo",
  patrimonio: "Patrimônio",
  localizacao: "Localização",
  requerente: "Requerente",
  montadoPor: "Montado por",
};

type SortOption = "manual" | "nome" | "quantidade" | "recentes";

type UndoState =
  | {
      kind: "item";
      item: InventarioItem;
      index: number;
      message: string;
    }
  | {
      kind: "unit";
      itemId: string;
      itemName: string;
      unidade: InventarioUnidade;
      index: number;
      message: string;
    }
  | null;

const createHistoricoEntry = (
  descricao: string,
  data = nowIso(),
): InventarioHistoricoEntry => ({
  id: createId(),
  data,
  descricao,
});

const addHistory = (
  unidade: InventarioUnidade,
  descricao: string,
  data = nowIso(),
): InventarioUnidade => ({
  ...unidade,
  updatedAt: data,
  historico: [
    createHistoricoEntry(descricao, data),
    ...unidade.historico,
  ].slice(0, 25),
});

const createUnidade = (
  partial?: Partial<InventarioUnidade>,
  descricaoInicial = "Unidade cadastrada",
): InventarioUnidade => {
  const data = partial?.updatedAt ?? nowIso();
  const base: InventarioUnidade = {
    id: partial?.id ?? createId(),
    modelo: partial?.modelo ?? "",
    patrimonio: partial?.patrimonio ?? "",
    localizacao: partial?.localizacao ?? "",
    requerente: partial?.requerente ?? "",
    montadoPor: partial?.montadoPor ?? "",
    status: partial?.status ?? "disponivel",
    historico:
      partial?.historico && partial.historico.length > 0
        ? partial.historico
        : [createHistoricoEntry(descricaoInicial, data)],
    updatedAt: data,
  };

  return base;
};

const createItem = (
  nome: string,
  id = createId(),
  unidades = [createUnidade()],
): InventarioItem => ({
  id,
  item: nome,
  unidades,
  updatedAt: nowIso(),
});

const normalizeInventario = (data: any[]): InventarioItem[] =>
  data.map((item) => {
    const itemData = item ?? {};
    let unidadesOriginais: any[] = [];

    if (Array.isArray(itemData.unidades)) {
      unidadesOriginais = itemData.unidades;
    } else {
      const quantidade = Number(itemData.quantidade);
      const totalUnidades =
        Number.isFinite(quantidade) && quantidade > 0 ? quantidade : 1;
      unidadesOriginais = Array.from({ length: totalUnidades }, () => ({
        modelo: itemData.modelo ?? "",
        patrimonio: itemData.patrimonio ?? "",
        localizacao: itemData.localizacao ?? "",
        requerente: itemData.requerente ?? "",
        montadoPor: itemData.montadoPor ?? "",
      }));
    }

    const unidades = unidadesOriginais.map((unidade) =>
      createUnidade(unidade, "Unidade migrada para o novo inventário"),
    );

    return {
      id: itemData.id ?? createId(),
      item: itemData.item ?? "Item",
      unidades,
      updatedAt:
        itemData.updatedAt ??
        unidades.reduce(
          (maisRecente, unidade) =>
            unidade.updatedAt > maisRecente ? unidade.updatedAt : maisRecente,
          nowIso(),
        ),
    };
  });

// As datas são salvas como ISO em UTC (via toISOString).
// Para exibir o horário real em que a ação ocorreu para o usuário, precisamos usar o fuso local.
const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const pad2 = (n: number) => String(n).padStart(2, "0");

  const dd = pad2(date.getDate());
  const mm = pad2(date.getMonth() + 1);
  const yyyy = date.getFullYear();
  const HH = pad2(date.getHours());
  const MM = pad2(date.getMinutes());

  return `${dd}/${mm}/${yyyy} ${HH}:${MM}`;
};

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const InventarioMontagem = () => {
  const [itens, setItens] = useState<InventarioItem[]>([]);
  const [mostrarFormularioItem, setMostrarFormularioItem] = useState(false);
  const [novoItemNome, setNovoItemNome] = useState("");
  const [itemParaRemover, setItemParaRemover] = useState<InventarioItem | null>(
    null,
  );
  const [itemEditandoId, setItemEditandoId] = useState<string | null>(null);
  const [nomeEmEdicao, setNomeEmEdicao] = useState("");
  const [dragSourceId, setDragSourceId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [canDragId, setCanDragId] = useState<string | null>(null);
  const [undoState, setUndoState] = useState<UndoState>(null);
  const [inventarioCarregado, setInventarioCarregado] = useState(false);

  const [historicoAberto, setHistoricoAberto] = useState<{
    itemNome: string;
    unidadeId: string;
  } | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("manual");
  const [search, setSearch] = useState("");
  const fieldStartValuesRef = useRef<Record<string, string>>({});

  const inventarioListRef = useRef<HTMLDivElement>(null);
  const prevPositionsRef = useRef<Record<string, DOMRect>>({});
  const prevItemIdsRef = useRef<string[]>([]);
  const removerModalRef = useRef<HTMLDivElement | null>(null);
  const dragSourceRef = useRef<string | null>(null);
  const dragTargetRef = useRef<string | null>(null);

  const [visualItens, setVisualItens] = useState<InventarioItem[]>([]);
  const lastItemIdsRef = useRef<string[]>([]);
  const lastSortByRef = useRef<SortOption>("manual");

  useEffect(() => {
    const currentIds = itens.map((item) => item.id);
    const prevIds = lastItemIdsRef.current;

    const idsChanged =
      currentIds.length !== prevIds.length ||
      currentIds.some((id, idx) => id !== prevIds[idx]);

    const sortByChanged = sortBy !== lastSortByRef.current;

    if (idsChanged || sortByChanged || visualItens.length === 0) {
      let base = [...itens];

      if (sortBy === "nome") {
        base.sort((a, b) => a.item.localeCompare(b.item, "pt-BR"));
      } else if (sortBy === "quantidade") {
        base.sort((a, b) => b.unidades.length - a.unidades.length);
      } else if (sortBy === "recentes") {
        base.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      }

      setVisualItens(base);
      lastItemIdsRef.current = currentIds;
      lastSortByRef.current = sortBy;
    }
  }, [itens, sortBy, dragSourceId]);

  useEffect(() => {
    setVisualItens((prev) =>
      prev.map((visualItem) => {
        const updated = itens.find((it) => it.id === visualItem.id);
        return updated ? updated : visualItem;
      }),
    );
  }, [itens]);

  useLayoutEffect(() => {
    if (!inventarioListRef.current) return;

    const listElement = inventarioListRef.current;
    const cards = Array.from(
      listElement.querySelectorAll("[data-flip-id]"),
    ) as HTMLElement[];

    const prevPositions = prevPositionsRef.current;
    const currentPositions: Record<string, DOMRect> = {};

    cards.forEach((card) => {
      const id = card.getAttribute("data-flip-id");
      if (id) {
        currentPositions[id] = card.getBoundingClientRect();
      }
    });

    const currentItemIds = cards.map(
      (card) => card.getAttribute("data-flip-id") || "",
    );
    const prevItemIds = prevItemIdsRef.current;

    let orderChanged = currentItemIds.length !== prevItemIds.length;
    if (!orderChanged) {
      for (let i = 0; i < currentItemIds.length; i++) {
        if (currentItemIds[i] !== prevItemIds[i]) {
          orderChanged = true;
          break;
        }
      }
    }

    if (orderChanged) {
      cards.forEach((card) => {
        const id = card.getAttribute("data-flip-id");
        if (!id) return;

        if (id === dragSourceId) return;

        const prevRect = prevPositions[id];
        const currentRect = currentPositions[id];

        if (prevRect && currentRect) {
          const deltaX = prevRect.left - currentRect.left;
          const deltaY = prevRect.top - currentRect.top;

          if (deltaX !== 0 || deltaY !== 0) {
            card.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0)`;
            card.style.transition = "none";

            requestAnimationFrame(() => {
              card.style.transform = "";
              card.style.transition =
                "transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)";
            });
          }
        }
      });
    }

    prevPositionsRef.current = currentPositions;
    prevItemIdsRef.current = currentItemIds;
  });

  useEffect(() => {
    getInventario()
      .then((inventarioSalvo) => {
        if (inventarioSalvo.length > 0) {
          const normalizado = normalizeInventario(inventarioSalvo);
          setItens(normalizado);
          return saveInventario(normalizado).finally(() => {
            setInventarioCarregado(true);
          });
        }

        setItens([]);
        return saveInventario([]).finally(() => {
          setInventarioCarregado(true);
        });
      })
      .catch((error) => {
        console.error("Erro ao carregar inventário", error);
      });
  }, []);

  useEffect(() => {
    if (!inventarioCarregado) return;
    const handle = window.setTimeout(() => {
      saveInventario(itens).catch((error) => {
        console.error("Erro ao salvar inventário", error);
      });
    }, 250);
    return () => {
      window.clearTimeout(handle);
    };
  }, [inventarioCarregado, itens]);

  useEffect(() => {
    if (!undoState) return;
    const handle = window.setTimeout(() => {
      setUndoState(null);
    }, 8000);
    return () => window.clearTimeout(handle);
  }, [undoState]);

  useEffect(() => {
    if (itemParaRemover && removerModalRef.current) {
      try {
        removerModalRef.current.focus();
      } catch (err) {
        /* ignore */
      }
    }
  }, [itemParaRemover]);

  const totalUnidades = useMemo(
    () => itens.reduce((acc, item) => acc + item.unidades.length, 0),
    [itens],
  );

  const statusTotals = useMemo(() => {
    const totals: Record<InventarioStatus, number> = {
      disponivel: 0,
      em_uso: 0,
      manutencao: 0,
      reservado: 0,
    };

    itens.forEach((item) => {
      item.unidades.forEach((unidade) => {
        totals[unidade.status] += 1;
      });
    });

    return totals;
  }, [itens]);

  const itensFiltrados = useMemo(() => {
    const termo = normalizeText(search.trim());
    return termo.length === 0
      ? visualItens
      : visualItens.filter((item) => {
          const statusText = item.unidades
            .map(
              (unidade) =>
                STATUS_OPTIONS.find((opt) => opt.value === unidade.status)
                  ?.label ?? "",
            )
            .join(" ");
          const haystack = normalizeText(
            [
              item.item,
              statusText,
              ...item.unidades.flatMap((unidade) => [
                unidade.modelo,
                unidade.patrimonio,
                unidade.localizacao,
                unidade.requerente,
                unidade.montadoPor,
              ]),
            ].join(" "),
          );
          return haystack.includes(termo);
        });
  }, [visualItens, search]);

  const unidadeHistoricoAberto = useMemo(() => {
    if (!historicoAberto) return null;
    for (const item of itens) {
      const unidade = item.unidades.find(
        (candidate) => candidate.id === historicoAberto.unidadeId,
      );
      if (unidade) {
        return {
          itemNome: historicoAberto.itemNome,
          unidade,
        };
      }
    }
    return null;
  }, [historicoAberto, itens]);

  const markFieldStartValue = (
    itemId: string,
    unidadeId: string,
    campo: keyof typeof FIELD_LABELS,
    valor: string,
  ) => {
    fieldStartValuesRef.current[`${itemId}:${unidadeId}:${campo}`] = valor;
  };

  const focusNextEditor = (current: HTMLElement) => {
    const inputs = Array.from(
      document.querySelectorAll<HTMLElement>(".unit-editor"),
    ).filter((element) => !element.hasAttribute("disabled"));
    const index = inputs.indexOf(current);
    if (index >= 0 && index < inputs.length - 1) {
      inputs[index + 1].focus();
      if ("select" in inputs[index + 1] || "value" in inputs[index + 1]) {
        const candidate = inputs[index + 1] as HTMLInputElement;
        candidate.select?.();
      }
    }
  };

  const appendHistorico = (
    itemId: string,
    unidadeId: string,
    descricao: string,
  ) => {
    const data = nowIso();
    setItens((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;

        const unidades = item.unidades.map((unidade) =>
          unidade.id === unidadeId
            ? addHistory(unidade, descricao, data)
            : unidade,
        );

        return {
          ...item,
          unidades,
          updatedAt: data,
        };
      }),
    );
  };

  const handleUnitChange = (
    itemId: string,
    unidadeId: string,
    campo: keyof Omit<InventarioUnidade, "id" | "historico" | "updatedAt">,
    valor: string,
  ) => {
    const data = nowIso();
    setItens((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              updatedAt: data,
              unidades: item.unidades.map((unidade) =>
                unidade.id === unidadeId
                  ? {
                      ...unidade,
                      [campo]:
                        campo === "status"
                          ? (valor as InventarioStatus)
                          : valor,
                      updatedAt: data,
                    }
                  : unidade,
              ),
            }
          : item,
      ),
    );
  };

  const handleUnitBlur = (
    itemId: string,
    unidadeId: string,
    campo: keyof typeof FIELD_LABELS,
    valorAtual: string,
  ) => {
    const key = `${itemId}:${unidadeId}:${campo}`;
    const valorInicial = fieldStartValuesRef.current[key];
    delete fieldStartValuesRef.current[key];

    if (valorInicial === undefined || valorInicial === valorAtual) return;

    appendHistorico(
      itemId,
      unidadeId,
      `${FIELD_LABELS[campo]} alterado para "${valorAtual || "vazio"}"`,
    );
  };

  const handleStatusChange = (
    itemId: string,
    unidadeId: string,
    status: InventarioStatus,
  ) => {
    const statusLabel =
      STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
    handleUnitChange(itemId, unidadeId, "status", status);
    appendHistorico(itemId, unidadeId, `Status alterado para ${statusLabel}`);
  };

  const handleAddUnit = (itemId: string) => {
    const novaUnidade = createUnidade(
      undefined,
      "Unidade adicionada ao inventário",
    );
    setItens((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              updatedAt: nowIso(),
              unidades: [...item.unidades, novaUnidade],
            }
          : item,
      ),
    );
  };

  const handleRemoveUnit = (itemId: string, unidadeId: string) => {
    const item = itens.find((candidate) => candidate.id === itemId);
    if (!item) return;
    const index = item.unidades.findIndex(
      (unidade) => unidade.id === unidadeId,
    );
    const unidade = item.unidades[index];
    if (!unidade) return;

    setItens((prev) =>
      prev.map((candidate) =>
        candidate.id === itemId
          ? {
              ...candidate,
              updatedAt: nowIso(),
              unidades: candidate.unidades.filter(
                (current) => current.id !== unidadeId,
              ),
            }
          : candidate,
      ),
    );

    setUndoState({
      kind: "unit",
      itemId,
      itemName: item.item,
      unidade,
      index,
      message: `Unidade removida de ${item.item}.`,
    });
  };

  const handleAbrirFormularioItem = () => {
    setMostrarFormularioItem(true);
  };

  const handleCancelarItem = () => {
    setMostrarFormularioItem(false);
    setNovoItemNome("");
  };

  const handleSalvarItem = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nome = novoItemNome.trim();
    if (!nome) return;

    const novoItem = createItem(nome);
    setItens((prev) => [...prev, novoItem]);
    setNovoItemNome("");
    setMostrarFormularioItem(false);
  };

  const handlePedirRemocaoItem = (itemId: string) => {
    const alvo = itens.find((item) => item.id === itemId);
    if (!alvo) return;
    setItemParaRemover(alvo);
  };

  const handleIniciarEdicaoItem = (item: InventarioItem) => {
    setItemEditandoId(item.id);
    setNomeEmEdicao(item.item);
  };

  const handleCancelarEdicaoItem = () => {
    setItemEditandoId(null);
    setNomeEmEdicao("");
  };

  const handleSalvarEdicaoItem = (itemId: string) => {
    const nome = nomeEmEdicao.trim();
    if (!nome) return;

    setItens((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              item: nome,
              updatedAt: nowIso(),
            }
          : item,
      ),
    );
    handleCancelarEdicaoItem();
  };

  const handleCancelarRemocaoItem = () => {
    setItemParaRemover(null);
  };

  const handleConfirmarRemocaoItem = () => {
    if (!itemParaRemover) return;
    const id = itemParaRemover.id;
    const index = itens.findIndex((item) => item.id === id);

    setItens((prev) => prev.filter((item) => item.id !== id));
    setUndoState({
      kind: "item",
      item: itemParaRemover,
      index,
      message: `Item ${itemParaRemover.item} removido.`,
    });
    setItemParaRemover(null);
  };

  const handleUndoRemove = () => {
    if (!undoState) return;

    if (undoState.kind === "item") {
      const restaurado: InventarioItem = {
        ...undoState.item,
        updatedAt: nowIso(),
        unidades: undoState.item.unidades.map((unidade) =>
          addHistory(unidade, "Item restaurado após remoção"),
        ),
      };

      setItens((prev) => {
        const proximo = [...prev];
        proximo.splice(undoState.index, 0, restaurado);
        return proximo;
      });
    }

    if (undoState.kind === "unit") {
      const restaurada = addHistory(
        undoState.unidade,
        "Unidade restaurada após remoção",
      );
      setItens((prev) =>
        prev.map((item) => {
          if (item.id !== undoState.itemId) return item;
          const unidades = [...item.unidades];
          unidades.splice(undoState.index, 0, restaurada);
          return {
            ...item,
            unidades,
            updatedAt: nowIso(),
          };
        }),
      );
    }

    setUndoState(null);
  };

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    if (sortBy !== "manual" || canDragId !== itemId) {
      e.preventDefault();
      return;
    }
    dragSourceRef.current = itemId;
    setDragSourceId(itemId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (
    e: React.DragEvent<HTMLElement>,
    targetId: string,
  ) => {
    e.preventDefault();
    if (
      !dragSourceRef.current ||
      dragSourceRef.current === targetId ||
      sortBy !== "manual"
    )
      return;

    e.dataTransfer.dropEffect = "move";

    if (dragTargetRef.current === targetId) return;
    dragTargetRef.current = targetId;
    setDragOverId(targetId);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = dragSourceRef.current;

    if (!sourceId || sourceId === targetId) {
      cleanupDrag();
      return;
    }

    setItens((prev) => {
      const fromIdx = prev.findIndex((i) => i.id === sourceId);
      const toIdx = prev.findIndex((i) => i.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const next = [...prev];
      [next[fromIdx], next[toIdx]] = [next[toIdx], next[fromIdx]];
      return next;
    });

    cleanupDrag();
  };

  const cleanupDrag = () => {
    dragSourceRef.current = null;
    dragTargetRef.current = null;
    setDragSourceId(null);
    setDragOverId(null);
    setCanDragId(null);
  };

  const handleDragEnd = () => {
    cleanupDrag();
  };

  const renderItem = (item: InventarioItem) => {
    const estaEditando = itemEditandoId === item.id;
    const estaArrastando = dragSourceId === item.id;
    const estaHover = dragOverId === item.id && dragSourceId !== item.id;
    const statusResumo = STATUS_OPTIONS.map((option) => ({
      ...option,
      total: item.unidades.filter((unidade) => unidade.status === option.value)
        .length,
    })).filter((entry) => entry.total > 0);

    return (
      <section
        className={`inventario-card ${
          estaArrastando ? "is-dragging" : ""
        } ${estaHover ? "is-drag-over" : ""}`}
        key={item.id}
        data-flip-id={item.id}
        draggable={
          canDragId === item.id && !estaEditando && sortBy === "manual"
        }
        onDragStart={(e) => handleDragStart(e, item.id)}
        onDragOver={(e) => handleDragOver(e, item.id)}
        onDrop={(e) => handleDrop(e, item.id)}
        onDragEnd={handleDragEnd}
      >
        <div className="inventario-card-header">
          <div className="inventario-card-title">
            {estaEditando ? (
              <div
                className="inventario-item-edit"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  className="inventario-item-edit-input"
                  value={nomeEmEdicao}
                  onChange={(e) => setNomeEmEdicao(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" ||
                      (e.key === "s" && (e.ctrlKey || e.metaKey))
                    ) {
                      e.preventDefault();
                      handleSalvarEdicaoItem(item.id);
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      handleCancelarEdicaoItem();
                    }
                  }}
                  autoFocus
                />
                <div className="inventario-item-edit-actions">
                  <button
                    type="button"
                    className="btn-salvar-edicao-item"
                    onClick={() => handleSalvarEdicaoItem(item.id)}
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    className="btn-cancelar-edicao-item"
                    onClick={handleCancelarEdicaoItem}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="inventario-item-header-row">
                  <button
                    type="button"
                    className={`btn-drag-handle ${
                      sortBy !== "manual" ? "is-disabled" : ""
                    }`}
                    title="Clique e segure para arrastar"
                    aria-label="Arrastar item"
                    disabled={sortBy !== "manual"}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      if (sortBy === "manual") setCanDragId(item.id);
                    }}
                    onMouseUp={(e) => {
                      e.stopPropagation();
                      if (!dragSourceRef.current) setCanDragId(null);
                    }}
                    onMouseLeave={(e) => {
                      e.stopPropagation();
                      if (!dragSourceRef.current) setCanDragId(null);
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      if (sortBy === "manual") setCanDragId(item.id);
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                      if (!dragSourceRef.current) setCanDragId(null);
                    }}
                  >
                    ⋮⋮
                  </button>
                  <span className="inventario-item-name">{item.item}</span>
                </div>
                <div className="inventario-card-meta">
                  <span className="inventario-item-count">
                    {item.unidades.length} unidades
                  </span>
                  {statusResumo.map((entry) => (
                    <span
                      key={entry.value}
                      className={`status-badge status-${entry.value}`}
                    >
                      {entry.label}: {entry.total}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="inventario-card-buttons">
            <button
              type="button"
              className="btn-editar-item"
              onClick={(e) => {
                e.stopPropagation();
                handleIniciarEdicaoItem(item);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              Editar
            </button>
            <button
              type="button"
              className="btn-add-unit-header"
              onClick={(e) => {
                e.stopPropagation();
                handleAddUnit(item.id);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              + Unidade
            </button>
            <button
              type="button"
              className="btn-remover-item"
              onClick={(e) => {
                e.stopPropagation();
                handlePedirRemocaoItem(item.id);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              Remover
            </button>
          </div>
        </div>

        <div
          className="inventario-card-body"
          onDragStart={(e) => e.stopPropagation()}
        >
          {item.unidades.length === 0 ? (
            <div className="empty-state">Nenhuma unidade cadastrada.</div>
          ) : (
            <div className="ut-wrap">
              <div className="ut-head">
                <span>#</span>
                <span>Status</span>
                <span>Modelo</span>
                <span>Patrimônio</span>
                <span>Localização</span>
                <span>Requerente</span>
                <span>Montado por</span>
                <span>Atualizado</span>
                <span></span>
              </div>
              {item.unidades.map((unidade, uIdx) => (
                <div key={unidade.id} className="ut-row">
                  <span className="ut-num">{uIdx + 1}</span>
                  <div className="ut-status">
                    <select
                      className={`unit-editor status-select status-${unidade.status}`}
                      value={unidade.status}
                      onChange={(e) =>
                        handleStatusChange(
                          item.id,
                          unidade.id,
                          e.target.value as InventarioStatus,
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          focusNextEditor(e.currentTarget);
                        }
                      }}
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    className="unit-editor ut-input"
                    type="text"
                    placeholder="Modelo"
                    value={unidade.modelo}
                    onFocus={() =>
                      markFieldStartValue(item.id, unidade.id, "modelo", unidade.modelo)
                    }
                    onBlur={() =>
                      handleUnitBlur(item.id, unidade.id, "modelo", unidade.modelo)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        focusNextEditor(e.currentTarget);
                      }
                    }}
                    onChange={(e) =>
                      handleUnitChange(item.id, unidade.id, "modelo", e.target.value)
                    }
                  />
                  <input
                    className="unit-editor ut-input"
                    type="text"
                    placeholder="Patrimônio"
                    value={unidade.patrimonio}
                    onFocus={() =>
                      markFieldStartValue(item.id, unidade.id, "patrimonio", unidade.patrimonio)
                    }
                    onBlur={() =>
                      handleUnitBlur(item.id, unidade.id, "patrimonio", unidade.patrimonio)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        focusNextEditor(e.currentTarget);
                      }
                    }}
                    onChange={(e) =>
                      handleUnitChange(item.id, unidade.id, "patrimonio", e.target.value)
                    }
                  />
                  <input
                    className="unit-editor ut-input"
                    type="text"
                    placeholder="Localização"
                    value={unidade.localizacao}
                    onFocus={() =>
                      markFieldStartValue(item.id, unidade.id, "localizacao", unidade.localizacao)
                    }
                    onBlur={() =>
                      handleUnitBlur(item.id, unidade.id, "localizacao", unidade.localizacao)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        focusNextEditor(e.currentTarget);
                      }
                    }}
                    onChange={(e) =>
                      handleUnitChange(item.id, unidade.id, "localizacao", e.target.value)
                    }
                  />
                  <input
                    className="unit-editor ut-input"
                    type="text"
                    placeholder="Requerente"
                    value={unidade.requerente}
                    onFocus={() =>
                      markFieldStartValue(item.id, unidade.id, "requerente", unidade.requerente)
                    }
                    onBlur={() =>
                      handleUnitBlur(item.id, unidade.id, "requerente", unidade.requerente)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        focusNextEditor(e.currentTarget);
                      }
                    }}
                    onChange={(e) =>
                      handleUnitChange(item.id, unidade.id, "requerente", e.target.value)
                    }
                  />
                  <input
                    className="unit-editor ut-input"
                    type="text"
                    placeholder="Montado por"
                    value={unidade.montadoPor}
                    onFocus={() =>
                      markFieldStartValue(item.id, unidade.id, "montadoPor", unidade.montadoPor)
                    }
                    onBlur={() =>
                      handleUnitBlur(item.id, unidade.id, "montadoPor", unidade.montadoPor)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        focusNextEditor(e.currentTarget);
                      }
                    }}
                    onChange={(e) =>
                      handleUnitChange(item.id, unidade.id, "montadoPor", e.target.value)
                    }
                  />
                  <span className="ut-date">{formatDateTime(unidade.updatedAt)}</span>
                  <div className="ut-actions">
                    <button
                      type="button"
                      className="btn-historico-unidade"
                      onClick={() =>
                        setHistoricoAberto({
                          itemNome: item.item,
                          unidadeId: unidade.id,
                        })
                      }
                    >
                      Hist.
                    </button>
                    <button
                      type="button"
                      className="btn-remover-unidade"
                      onClick={() => handleRemoveUnit(item.id, unidade.id)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  };

  return (
    <div className="inventario">
      <div className="inventario-header">
        <div className="inventario-title">
          <h2>Inventário de montagem</h2>
          <div className="inventario-stats">
            <span className="inventario-stat">
              Itens cadastrados: <strong>{itens.length}</strong>
            </span>
            <span className="inventario-stat">
              Unidades: <strong>{totalUnidades}</strong>
            </span>
            <span className="inventario-stat">
              Disponíveis: <strong>{statusTotals.disponivel}</strong>
            </span>
            <span className="inventario-stat">
              Em uso: <strong>{statusTotals.em_uso}</strong>
            </span>
          </div>
        </div>
        <div className="inventario-actions">
          <button
            type="button"
            className="btn-add-item"
            onClick={handleAbrirFormularioItem}
          >
            + Adicionar item
          </button>
        </div>
      </div>

      <div className="inventario-toolbar">
        <div className="inventario-toolbar-field inventario-toolbar-search">
          <label htmlFor="inventario-busca">Buscar</label>
          <input
            id="inventario-busca"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Item, patrimônio, localização..."
          />
        </div>
        <div className="inventario-toolbar-field inventario-toolbar-sort">
          <label htmlFor="inventario-ordem">Ordem</label>
          <select
            id="inventario-ordem"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
          >
            <option value="manual">Manual</option>
            <option value="nome">Nome</option>
            <option value="quantidade">Qtd. unidades</option>
            <option value="recentes">Última edição</option>
          </select>
        </div>
      </div>

      {mostrarFormularioItem && (
        <div
          className="inventario-modal-overlay"
          role="presentation"
          onClick={handleCancelarItem}
        >
          <div
            className="inventario-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="novo-item-titulo"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="inventario-modal-header">
              <h3 id="novo-item-titulo">Cadastrar novo item</h3>
            </div>
            <form className="inventario-form" onSubmit={handleSalvarItem}>
              <div className="inventario-form-field">
                <label htmlFor="novo-item">Nome do item</label>
                <input
                  id="novo-item"
                  type="text"
                  value={novoItemNome}
                  onChange={(e) => setNovoItemNome(e.target.value)}
                  required
                />
              </div>
              <div className="inventario-form-actions">
                <button
                  type="button"
                  className="btn-cancelar-item"
                  onClick={handleCancelarItem}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-salvar-item">
                  Salvar item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {itemParaRemover && (
        <div
          className="inventario-modal-overlay"
          role="presentation"
          onClick={handleCancelarRemocaoItem}
        >
          <div
            className="inventario-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remover-item-titulo"
            onClick={(e) => e.stopPropagation()}
            ref={removerModalRef}
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleConfirmarRemocaoItem();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                handleCancelarRemocaoItem();
              }
            }}
          >
            <div className="inventario-modal-header">
              <h3 id="remover-item-titulo">Remover item</h3>
            </div>
            <div className="inventario-modal-body">
              Tem certeza que deseja remover o item{" "}
              <strong>&quot;{itemParaRemover.item}&quot;</strong> e todas as
              unidades?
            </div>
            <div className="inventario-form-actions">
              <button
                type="button"
                className="btn-cancelar-item"
                onClick={handleCancelarRemocaoItem}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-remover-item-confirmar"
                onClick={handleConfirmarRemocaoItem}
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      )}

      {unidadeHistoricoAberto && (
        <div
          className="inventario-modal-overlay"
          role="presentation"
          onClick={() => setHistoricoAberto(null)}
        >
          <div
            className="inventario-modal inventario-history-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="historico-unidade-titulo"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="inventario-modal-header">
              <h3 id="historico-unidade-titulo">
                Histórico - {unidadeHistoricoAberto.itemNome}
              </h3>
            </div>
            <div className="inventario-history-list">
              {unidadeHistoricoAberto.unidade.historico.map((entry) => (
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

      <div className="inventario-list" ref={inventarioListRef}>
        {itensFiltrados.map((item) => renderItem(item))}
      </div>
    </div>
  );
};

export default InventarioMontagem;
