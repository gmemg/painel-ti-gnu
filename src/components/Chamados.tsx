import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { ChamadoItem, ChamadoStatusType, ChamadosResponse } from "../types";
import { getGlpiChamados } from "../utils/storage";
import "./Chamados.css";

interface TabConfig {
  key: ChamadoStatusType;
  label: string;
  cor: string;
  badgeBg: string;
  icon: React.ReactNode;
}

const TABS: TabConfig[] = [
  {
    key: "novos",
    label: "Novos",
    cor: "#2b8ffb",
    badgeBg: "rgba(43, 143, 251, 0.15)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
        <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "atribuidos",
    label: "Atribuídos",
    cor: "#6366f1",
    badgeBg: "rgba(99, 102, 241, 0.15)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    key: "pendentes",
    label: "Pendentes",
    cor: "#eab308",
    badgeBg: "rgba(234, 179, 8, 0.15)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    key: "planejados",
    label: "Planejados",
    cor: "#a855f7",
    badgeBg: "rgba(168, 85, 247, 0.15)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    key: "solucionados",
    label: "Solucionados",
    cor: "#10b981",
    badgeBg: "rgba(16, 185, 129, 0.15)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
        <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "fechados",
    label: "Fechados",
    cor: "#9ca3af",
    badgeBg: "rgba(156, 163, 175, 0.15)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
];

const STATUS_COLOR_MAP: Record<string, { cor: string; bg: string }> = {
  Novo: { cor: "#2b8ffb", bg: "rgba(43, 143, 251, 0.16)" },
  Atribuído: { cor: "#6366f1", bg: "rgba(99, 102, 241, 0.16)" },
  "Em andamento": { cor: "#6366f1", bg: "rgba(99, 102, 241, 0.16)" },
  Pendente: { cor: "#eab308", bg: "rgba(234, 179, 8, 0.16)" },
  Planejado: { cor: "#a855f7", bg: "rgba(168, 85, 247, 0.16)" },
  Solucionado: { cor: "#10b981", bg: "rgba(16, 185, 129, 0.16)" },
  Fechado: { cor: "#9ca3af", bg: "rgba(156, 163, 175, 0.16)" },
};

type SortField =
  | "id"
  | "titulo"
  | "status"
  | "dataAbertura"
  | "dataModificacao"
  | "requerente"
  | "tecnico"
  | "categoria"
  | "grupoTecnico";

export default function Chamados() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Lê aba ativa da URL ou inicia com "novos"
  const tabParam = searchParams.get("status") as ChamadoStatusType | null;
  const abaAtiva: ChamadoStatusType =
    tabParam && TABS.some((t) => t.key === tabParam) ? tabParam : "novos";

  // Estados locais
  const [chamadosPorAba, setChamadosPorAba] = useState<
    Partial<Record<ChamadoStatusType, ChamadoItem[]>>
  >({});
  const [counts, setCounts] = useState<Record<ChamadoStatusType, number>>({
    novos: 0,
    atribuidos: 0,
    planejados: 0,
    pendentes: 0,
    solucionados: 0,
    fechados: 0,
  });
  const [carregando, setCarregando] = useState<boolean>(true);
  const [sincronizando, setSincronizando] = useState<boolean>(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  // Filtros
  const [busca, setBusca] = useState<string>("");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [filtroGrupo, setFiltroGrupo] = useState<string>("todos");

  // Ordenação
  const [campoOrdenacao, setCampoOrdenacao] = useState<SortField>("dataAbertura");
  const [ordemAscendente, setOrdemAscendente] = useState<boolean>(false);

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState<number>(1);
  const [itensPorPagina, setItensPorPagina] = useState<number>(25);

  const mudarAba = (novaAba: ChamadoStatusType) => {
    setSearchParams({ status: novaAba });
    setPaginaAtual(1);
  };

  const carregarChamados = useCallback(
    async (status: ChamadoStatusType, force: boolean = false) => {
      try {
        if (force) {
          setSincronizando(true);
        } else {
          setCarregando(true);
        }

        const data: ChamadosResponse = await getGlpiChamados(status, force);

        if (data.counts) {
          setCounts(data.counts);
        }
        if (data.lastSync) {
          setLastSync(data.lastSync);
        }

        setChamadosPorAba((prev) => ({
          ...prev,
          [status]: data.chamados || [],
        }));
      } catch (err) {
        console.error("Erro ao carregar chamados:", err);
      } finally {
        setCarregando(false);
        setSincronizando(false);
      }
    },
    []
  );

  // Carrega ao montar ou ao trocar de aba (se não estiver em cache)
  useEffect(() => {
    if (!chamadosPorAba[abaAtiva]) {
      carregarChamados(abaAtiva, false);
    }
  }, [abaAtiva, carregarChamados, chamadosPorAba]);

  // Atualização periódica leve em segundo plano a cada 45 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      carregarChamados(abaAtiva, true);
    }, 45000);
    return () => clearInterval(timer);
  }, [abaAtiva, carregarChamados]);

  const listaAtual = chamadosPorAba[abaAtiva] || [];

  // Extrai lista única de categorias e grupos disponíveis na aba ativa
  const categoriasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    listaAtual.forEach((c) => {
      if (c.categoria && c.categoria !== "Sem categoria") {
        set.add(c.categoria);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [listaAtual]);

  const gruposDisponiveis = useMemo(() => {
    const set = new Set<string>();
    listaAtual.forEach((c) => {
      if (c.grupoTecnico && c.grupoTecnico !== "Não atribuído") {
        set.add(c.grupoTecnico);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [listaAtual]);

  // Filtragem
  const chamadosFiltrados = useMemo(() => {
    let filtrados = [...listaAtual];

    // Busca textual livre
    if (busca.trim()) {
      const q = busca.toLowerCase().trim();
      filtrados = filtrados.filter((c) => {
        return (
          c.id.toLowerCase().includes(q) ||
          c.titulo.toLowerCase().includes(q) ||
          c.requerente.toLowerCase().includes(q) ||
          c.tecnico.toLowerCase().includes(q) ||
          c.categoria.toLowerCase().includes(q) ||
          c.grupoTecnico.toLowerCase().includes(q) ||
          c.status.toLowerCase().includes(q)
        );
      });
    }

    // Filtro por Categoria
    if (filtroCategoria !== "todas") {
      filtrados = filtrados.filter((c) => c.categoria === filtroCategoria);
    }

    // Filtro por Grupo
    if (filtroGrupo !== "todos") {
      filtrados = filtrados.filter((c) => c.grupoTecnico === filtroGrupo);
    }

    // Ordenação
    filtrados.sort((a, b) => {
      let valorA: string | number = "";
      let valorB: string | number = "";

      switch (campoOrdenacao) {
        case "id":
          valorA = parseInt(a.id.replace(/\D/g, ""), 10) || 0;
          valorB = parseInt(b.id.replace(/\D/g, ""), 10) || 0;
          break;
        case "dataAbertura":
          valorA = a.dataAberturaRaw || a.dataAbertura || "";
          valorB = b.dataAberturaRaw || b.dataAbertura || "";
          break;
        case "dataModificacao":
          valorA = a.dataModificacaoRaw || a.dataModificacao || "";
          valorB = b.dataModificacaoRaw || b.dataModificacao || "";
          break;
        case "status":
          valorA = a.status || "";
          valorB = b.status || "";
          break;
        case "requerente":
          valorA = a.requerente || "";
          valorB = b.requerente || "";
          break;
        case "tecnico":
          valorA = a.tecnico || "";
          valorB = b.tecnico || "";
          break;
        case "categoria":
          valorA = a.categoria || "";
          valorB = b.categoria || "";
          break;
        case "grupoTecnico":
          valorA = a.grupoTecnico || "";
          valorB = b.grupoTecnico || "";
          break;
        case "titulo":
        default:
          valorA = a.titulo || "";
          valorB = b.titulo || "";
          break;
      }

      if (typeof valorA === "number" && typeof valorB === "number") {
        return ordemAscendente ? valorA - valorB : valorB - valorA;
      }

      const strA = String(valorA).toLowerCase();
      const strB = String(valorB).toLowerCase();
      return ordemAscendente
        ? strA.localeCompare(strB, "pt-BR")
        : strB.localeCompare(strA, "pt-BR");
    });

    return filtrados;
  }, [
    listaAtual,
    busca,
    filtroCategoria,
    filtroGrupo,
    campoOrdenacao,
    ordemAscendente,
  ]);

  // Paginação
  const totalPaginas = Math.max(
    1,
    Math.ceil(chamadosFiltrados.length / itensPorPagina)
  );
  const chamadosPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * itensPorPagina;
    return chamadosFiltrados.slice(inicio, inicio + itensPorPagina);
  }, [chamadosFiltrados, paginaAtual, itensPorPagina]);

  const alternarOrdenacao = (campo: SortField) => {
    if (campoOrdenacao === campo) {
      setOrdemAscendente((prev) => !prev);
    } else {
      setCampoOrdenacao(campo);
      // Padrão: decrescente para datas e ID, crescente para nomes
      setOrdemAscendente(
        campo !== "dataAbertura" &&
          campo !== "dataModificacao" &&
          campo !== "id"
      );
    }
  };

  const renderSortArrow = (campo: SortField) => {
    if (campoOrdenacao !== campo) return null;
    return (
      <span className="ch-sort-arrow" aria-hidden="true">
        {ordemAscendente ? " ▲" : " ▼"}
      </span>
    );
  };

  const abaAtivaConfig = TABS.find((t) => t.key === abaAtiva) || TABS[0];

  return (
    <div className="chamados-container">
      {/* Topo / Header da Página */}
      <div className="ch-page-header">
        <div className="ch-page-title-wrap">
          <div className="ch-title-icon-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <div>
            <h1 className="ch-page-title">Chamados GLPI</h1>
            <p className="ch-page-subtitle">
              Visualização e monitoramento integrado dos chamados de Helpdesk e T.I.
            </p>
          </div>
        </div>

        <div className="ch-header-actions">
          <div className="ch-sync-info">
            <span
              className="ch-pulse-dot"
              style={{ backgroundColor: sincronizando ? "#eab308" : "#10b981" }}
            />
            <span className="ch-sync-text">
              {sincronizando
                ? "Sincronizando com GLPI..."
                : lastSync
                ? `Atualizado às ${lastSync}`
                : "Ao vivo"}
            </span>
          </div>

          <button
            type="button"
            className="ch-btn-refresh"
            onClick={() => carregarChamados(abaAtiva, true)}
            disabled={sincronizando || carregando}
            title="Atualizar lista agora com o GLPI"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              width="15"
              height="15"
              className={sincronizando ? "ch-spin" : ""}
            >
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{sincronizando ? "Atualizando..." : "Recarregar"}</span>
          </button>
        </div>
      </div>

      {/* Barra de Abas Principais (Novos, Atribuídos, Pendentes, Planejados, Solucionados, Fechados) */}
      <div className="ch-tabs-bar" role="tablist">
        {TABS.map((tab) => {
          const isActive = tab.key === abaAtiva;
          const count = counts[tab.key] ?? 0;

          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              type="button"
              className={`ch-tab-btn ${isActive ? "active" : ""}`}
              style={{
                "--tab-accent": tab.cor,
                "--tab-bg": tab.badgeBg,
              } as React.CSSProperties}
              onClick={() => mudarAba(tab.key)}
            >
              <span className="ch-tab-icon">{tab.icon}</span>
              <span className="ch-tab-label">{tab.label}</span>
              <span className="ch-tab-count">[{count}]</span>
            </button>
          );
        })}
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="ch-filters-bar">
        <div className="ch-search-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            className="ch-search-input"
            placeholder="Buscar por ID, título, requerente, técnico, categoria ou grupo..."
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPaginaAtual(1);
            }}
          />
          {busca && (
            <button
              type="button"
              className="ch-search-clear"
              onClick={() => {
                setBusca("");
                setPaginaAtual(1);
              }}
              title="Limpar busca"
            >
              ✕
            </button>
          )}
        </div>

        <div className="ch-select-filters">
          {/* Filtro por Categoria */}
          <div className="ch-select-group">
            <label htmlFor="filtro-categoria" className="ch-select-label">
              Categoria:
            </label>
            <select
              id="filtro-categoria"
              className="ch-select"
              value={filtroCategoria}
              onChange={(e) => {
                setFiltroCategoria(e.target.value);
                setPaginaAtual(1);
              }}
            >
              <option value="todas">Todas as categorias</option>
              {categoriasDisponiveis.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Grupo */}
          <div className="ch-select-group">
            <label htmlFor="filtro-grupo" className="ch-select-label">
              Grupo:
            </label>
            <select
              id="filtro-grupo"
              className="ch-select"
              value={filtroGrupo}
              onChange={(e) => {
                setFiltroGrupo(e.target.value);
                setPaginaAtual(1);
              }}
            >
              <option value="todos">Todos os grupos</option>
              {gruposDisponiveis.map((grp) => (
                <option key={grp} value={grp}>
                  {grp}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="ch-filters-summary">
          <span>
            Mostrando <strong>{chamadosFiltrados.length}</strong> de{" "}
            <strong>{listaAtual.length}</strong> chamados{" "}
            <span style={{ color: abaAtivaConfig.cor }}>({abaAtivaConfig.label})</span>
          </span>
        </div>
      </div>

      {/* Conteúdo / Tabela de Chamados */}
      <div className="ch-table-wrapper">
        {carregando && listaAtual.length === 0 ? (
          <div className="ch-loading-state">
            <div className="ch-spinner" />
            <p>Carregando chamados do GLPI...</p>
          </div>
        ) : chamadosFiltrados.length === 0 ? (
          <div className="ch-empty-state">
            <div className="ch-empty-icon" style={{ color: abaAtivaConfig.cor }}>
              {abaAtivaConfig.icon}
            </div>
            <h3>Nenhum chamado encontrado</h3>
            <p>
              {busca || filtroCategoria !== "todas" || filtroGrupo !== "todos"
                ? "Nenhum resultado corresponde aos filtros selecionados."
                : `Não há chamados com status "${abaAtivaConfig.label}" no momento.`}
            </p>
            {(busca || filtroCategoria !== "todas" || filtroGrupo !== "todos") && (
              <button
                type="button"
                className="ch-btn-reset-filters"
                onClick={() => {
                  setBusca("");
                  setFiltroCategoria("todas");
                  setFiltroGrupo("todos");
                }}
              >
                Limpar Filtros
              </button>
            )}
          </div>
        ) : (
          <>
            <table className="ch-table">
              <thead>
                <tr>
                  <th
                    className="ch-th-id ch-sortable"
                    onClick={() => alternarOrdenacao("id")}
                    title="Ordenar por ID"
                  >
                    ID {renderSortArrow("id")}
                  </th>
                  <th
                    className="ch-th-titulo ch-sortable"
                    onClick={() => alternarOrdenacao("titulo")}
                    title="Ordenar por título"
                  >
                    Título {renderSortArrow("titulo")}
                  </th>
                  <th
                    className="ch-th-status ch-sortable"
                    onClick={() => alternarOrdenacao("status")}
                    title="Ordenar por status"
                  >
                    Status {renderSortArrow("status")}
                  </th>
                  <th
                    className="ch-th-data ch-sortable"
                    onClick={() => alternarOrdenacao("dataAbertura")}
                    title="Ordenar por data de abertura"
                  >
                    Data de Abertura {renderSortArrow("dataAbertura")}
                  </th>
                  <th
                    className="ch-th-data ch-sortable"
                    onClick={() => alternarOrdenacao("dataModificacao")}
                    title="Ordenar por última atualização"
                  >
                    Última Atualização {renderSortArrow("dataModificacao")}
                  </th>
                  <th
                    className="ch-th-requerente ch-sortable"
                    onClick={() => alternarOrdenacao("requerente")}
                    title="Ordenar por requerente"
                  >
                    Requerente {renderSortArrow("requerente")}
                  </th>
                  <th
                    className="ch-th-tecnico ch-sortable"
                    onClick={() => alternarOrdenacao("tecnico")}
                    title="Ordenar por técnico atribuído"
                  >
                    Técnico Atribuído {renderSortArrow("tecnico")}
                  </th>
                  <th
                    className="ch-th-categoria ch-sortable"
                    onClick={() => alternarOrdenacao("categoria")}
                    title="Ordenar por categoria"
                  >
                    Categoria {renderSortArrow("categoria")}
                  </th>
                  <th
                    className="ch-th-grupo ch-sortable"
                    onClick={() => alternarOrdenacao("grupoTecnico")}
                    title="Ordenar por grupo técnico"
                  >
                    Grupo Técnico {renderSortArrow("grupoTecnico")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {chamadosPaginados.map((c) => {
                  const statusInfo =
                    STATUS_COLOR_MAP[c.status] || {
                      cor: "#94a3b8",
                      bg: "rgba(148, 163, 184, 0.15)",
                    };

                  return (
                    <tr key={c.id} className="ch-row">
                      {/* ID do Chamado com Link */}
                      <td className="ch-td-id">
                        {c.url ? (
                          <a
                            href={c.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ch-ticket-link"
                            title={`Abrir chamado #${c.id} no GLPI`}
                          >
                            <span>#{c.id}</span>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                              <polyline points="15 3 21 3 21 9" />
                              <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                          </a>
                        ) : (
                          <span className="ch-ticket-id">#{c.id}</span>
                        )}
                      </td>

                      {/* Título do Chamado */}
                      <td className="ch-td-titulo">
                        <span className="ch-ticket-title" title={c.titulo}>
                          {c.titulo}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="ch-td-status">
                        <div className="ch-status-text" style={{ color: statusInfo.cor }}>
                          <span
                            className="ch-status-dot"
                            style={{ backgroundColor: statusInfo.cor }}
                          />
                          <span>{c.status}</span>
                        </div>
                      </td>

                      {/* Data de Abertura */}
                      <td className="ch-td-data">
                        <span className="ch-date-val">{c.dataAbertura}</span>
                      </td>

                      {/* Última Atualização */}
                      <td className="ch-td-data">
                        <span className="ch-date-val">{c.dataModificacao}</span>
                      </td>

                      {/* Requerente */}
                      <td className="ch-td-requerente">
                        <div className="ch-person-cell">
                          <span className="ch-person-avatar">
                            {c.requerente.charAt(0).toUpperCase()}
                          </span>
                          <span className="ch-person-name" title={c.requerente}>
                            {c.requerente}
                          </span>
                        </div>
                      </td>

                      {/* Técnico Atribuído */}
                      <td className="ch-td-tecnico">
                        {c.tecnico && c.tecnico !== "Não atribuído" ? (
                          <div className="ch-person-cell">
                            <span className="ch-tech-avatar">
                              {c.tecnico.charAt(0).toUpperCase()}
                            </span>
                            <span className="ch-person-name" title={c.tecnico}>
                              {c.tecnico}
                            </span>
                          </div>
                        ) : (
                          <span className="ch-unassigned-text">Não atribuído</span>
                        )}
                      </td>

                      {/* Categoria */}
                      <td className="ch-td-categoria">
                        {c.categoria && c.categoria !== "Sem categoria" ? (
                          <span className="ch-category-text" title={c.categoria}>
                            {c.categoria}
                          </span>
                        ) : (
                          <span className="ch-category-empty">Sem categoria</span>
                        )}
                      </td>

                      {/* Grupo Técnico */}
                      <td className="ch-td-grupo">
                        {c.grupoTecnico && c.grupoTecnico !== "Não atribuído" ? (
                          <span className="ch-group-text" title={c.grupoTecnico}>
                            {c.grupoTecnico}
                          </span>
                        ) : (
                          <span className="ch-group-empty">Não atribuído</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Paginação */}
            <div className="ch-pagination-bar">
              <div className="ch-pagination-size">
                <span>Itens por página:</span>
                <select
                  value={itensPorPagina}
                  onChange={(e) => {
                    setItensPorPagina(Number(e.target.value));
                    setPaginaAtual(1);
                  }}
                  className="ch-pagination-select"
                >
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={300}>Todos</option>
                </select>
              </div>

              <div className="ch-pagination-controls">
                <button
                  type="button"
                  className="ch-page-btn"
                  onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                  disabled={paginaAtual <= 1}
                  title="Página anterior"
                >
                  Anterior
                </button>
                <span className="ch-page-info">
                  Página <strong>{paginaAtual}</strong> de{" "}
                  <strong>{totalPaginas}</strong>
                </span>
                <button
                  type="button"
                  className="ch-page-btn"
                  onClick={() =>
                    setPaginaAtual((p) => Math.min(totalPaginas, p + 1))
                  }
                  disabled={paginaAtual >= totalPaginas}
                  title="Próxima página"
                >
                  Próxima
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

