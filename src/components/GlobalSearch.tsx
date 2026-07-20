import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  getImpressoras,
  getEventos,
  getHistorico,
  getEquipamentosPendentes,
  getInventario,
  getManutencao,
  getTarefas,
  getHistoricoTarefas,
  getCameras,
  getEscalas,
  getEquipe,
  getGlpiDashboard,
} from "../utils/storage";
import {
  Impressora,
  Evento,
  InventarioItem,
  ManutencaoRegistro,
  Tarefa,
  Camera,
  Escala,
  MembroEquipe,
} from "../types";
import "./GlobalSearch.css";

interface SearchResult {
  id: string;
  category: "Páginas" | "Inventário" | "Manutenção (NM)" | "Impressoras" | "Montagens" | "Tarefas" | "Câmeras" | "Equipe TI";
  title: string;
  subtitle: string;
  url: string;
  icon: string;
}

const PAGES_INDEX: Array<{ title: string; subtitle: string; url: string; keywords: string; icon: string }> = [
  {
    title: "Dashboard / Visão Geral",
    subtitle: "KPIs do GLPI, Chamados por Requerente, Ranking TI",
    url: "/",
    keywords: "dashboard inicio home kpis glpi chamados requerente ranking ti estatisticas",
    icon: "📊",
  },
  {
    title: "Controle de Montagem",
    subtitle: "Registro de montagem e setup de computadores",
    url: "/montagem",
    keywords: "montagem controle computadores PC inventario cadastro novos equipamentos setup",
    icon: "💻",
  },
  {
    title: "Impressoras",
    subtitle: "Gestão, toners e monitoramento de impressoras",
    url: "/impressoras",
    keywords: "impressoras impressora toners ciano magenta amarelo preto cartucho glpi ip rede local",
    icon: "🖨️",
  },
  {
    title: "Histórico de Montagens",
    subtitle: "Consulta e exportação do histórico de montagens",
    url: "/historico",
    keywords: "historico montagens relatorio busca tombo usuario setor data chamado",
    icon: "📜",
  },
  {
    title: "Escala de Plantão",
    subtitle: "Escala dos técnicos de plantão da TI",
    url: "/plantao",
    keywords: "escala plantao sobreaviso suporte fds final de semana horario turnos equipe escala",
    icon: "📅",
  },
  {
    title: "Tarefas / Checklist",
    subtitle: "Rotinas diárias e tarefas pendentes",
    url: "/tarefas",
    keywords: "tarefas checklist rotina afazeres pendencias lembretes checklist diario",
    icon: "☑️",
  },
  {
    title: "Histórico de Tarefas",
    subtitle: "Registro de tarefas concluídas",
    url: "/historico-tarefas",
    keywords: "historico tarefas concluidas finalizadas relatorio afazeres",
    icon: "📑",
  },
  {
    title: "Equipamentos Pendentes",
    subtitle: "Equipamentos em manutenção ou aguardando peças",
    url: "/equipamentos-pendentes",
    keywords: "equipamentos pendentes manutencao conserto laboratorio pecas aguardando",
    icon: "🛠️",
  },
  {
    title: "Câmeras de Segurança",
    subtitle: "Visualização e controle do sistema de CFTV",
    url: "/cameras",
    keywords: "cameras cftv monitoramento seguranca gravacao nvr dvr imagens rat",
    icon: "🎥",
  },
  {
    title: "Números de Manutenção (NM)",
    subtitle: "NM, ramais, patrimônios e registros de manutenção",
    url: "/numero-manutencao",
    keywords: "numeros manutencao nm ramais contatos patrimonio fornecedor telefone chamadas suporte predial",
    icon: "📞",
  },
  {
    title: "Modo TV",
    subtitle: "Painel em tela cheia para exibição contínua",
    url: "/tv",
    keywords: "modo tv fullscreen tela cheia monitor kpi transmissao apresentacao",
    icon: "📺",
  },
];

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [results, setResults] = useState<SearchResult[]>([]);

  // Bases de Dados do Sistema
  const [impressoras, setImpressoras] = useState<Impressora[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [historico, setHistorico] = useState<Evento[]>([]);
  const [pendentes, setPendentes] = useState<Evento[]>([]);
  const [inventario, setInventario] = useState<InventarioItem[]>([]);
  const [manutencoes, setManutencoes] = useState<ManutencaoRegistro[]>([]);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [historicoTarefas, setHistoricoTarefas] = useState<Tarefa[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [equipe, setEquipe] = useState<MembroEquipe[]>([]);
  const [pessoasGlpi, setPessoasGlpi] = useState<Array<{ nome: string; chamados: number }>>([]);
  const [tecnicosGlpi, setTecnicosGlpi] = useState<Array<{ nome: string; resolvidos: number }>>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Carregar todos os dados do sistema para indexação universal
  useEffect(() => {
    const carregarTudo = async () => {
      try {
        const [
          imps,
          evs,
          hist,
          pend,
          inv,
          manut,
          tars,
          histTars,
          cams,
          esc,
          eq,
          glpiDash,
        ] = await Promise.all([
          getImpressoras().catch(() => []),
          getEventos().catch(() => []),
          getHistorico().catch(() => []),
          getEquipamentosPendentes().catch(() => []),
          getInventario().catch(() => []),
          getManutencao().catch(() => []),
          getTarefas().catch(() => []),
          getHistoricoTarefas().catch(() => []),
          getCameras().catch(() => []),
          getEscalas().catch(() => []),
          getEquipe().catch(() => []),
          getGlpiDashboard().catch(() => null),
        ]);

        setImpressoras(imps);
        setEventos(evs);
        setHistorico(hist);
        setPendentes(pend);
        setInventario(inv);
        setManutencoes(manut);
        setTarefas(tars);
        setHistoricoTarefas(histTars);
        setCameras(cams);
        setEscalas(esc);
        setEquipe(eq);

        if (glpiDash) {
          if (glpiDash.pessoas) setPessoasGlpi(glpiDash.pessoas);
          if (glpiDash.tecnicos) setTecnicosGlpi(glpiDash.tecnicos);
        }
      } catch (err) {
        console.error("[GlobalSearch] Erro ao indexar sistema:", err);
      }
    };

    carregarTudo();
  }, []);

  // Atalho de teclado Ctrl + K ou / para focar a busca
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsFocused(true);
      } else if (e.key === "Escape" && isFocused) {
        setIsFocused(false);
        inputRef.current?.blur();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFocused]);

  // Fechar ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filtrar resultados universais em tempo real
  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      setResults([]);
      setSelectedIndex(0);
      return;
    }

    const matches: SearchResult[] = [];

    // 1. Páginas & Recursos Principais
    PAGES_INDEX.forEach((page) => {
      if (
        page.title.toLowerCase().includes(q) ||
        page.subtitle.toLowerCase().includes(q) ||
        page.keywords.toLowerCase().includes(q)
      ) {
        matches.push({
          id: `page-${page.url}`,
          category: "Páginas",
          title: page.title,
          subtitle: page.subtitle,
          url: page.url,
          icon: page.icon,
        });
      }
    });

    // 2. Inventário de Computadores & Peças
    inventario.forEach((inv) => {
      const matchItemName = inv.item?.toLowerCase().includes(q);
      if (matchItemName) {
        matches.push({
          id: `inv-${inv.id}`,
          category: "Inventário",
          title: `Item Inventário: ${inv.item}`,
          subtitle: `${inv.unidades.length} unidade(s) cadastradas`,
          url: "/montagem",
          icon: "💻",
        });
      }
      (inv.unidades || []).forEach((u) => {
        const matchModelo = u.modelo?.toLowerCase().includes(q);
        const matchPat = u.patrimonio?.toLowerCase().includes(q);
        const matchLoc = u.localizacao?.toLowerCase().includes(q);
        const matchReq = u.requerente?.toLowerCase().includes(q);
        const matchMont = u.montadoPor?.toLowerCase().includes(q);
        const matchProb = u.problema?.toLowerCase().includes(q);

        if (matchModelo || matchPat || matchLoc || matchReq || matchMont || matchProb) {
          matches.push({
            id: `inv-u-${u.id}`,
            category: "Inventário",
            title: `Patrimônio: ${u.patrimonio || "S/N"} — ${u.modelo}`,
            subtitle: `Requerente: ${u.requerente || "N/A"} • Local: ${u.localizacao || "N/A"} (${u.status})`,
            url: "/montagem",
            icon: "💻",
          });
        }
      });
    });

    // 3. Manutenção & NMs (Números de Manutenção)
    manutencoes.forEach((m) => {
      const matchNm = m.nm?.toLowerCase().includes(q);
      const matchEq = m.equipamento?.toLowerCase().includes(q);
      const matchLoc = m.local?.toLowerCase().includes(q);
      const matchPat = m.patrimonio?.toLowerCase().includes(q);
      const matchForn = m.fornecedor?.toLowerCase().includes(q);
      const matchSede = m.sede?.toLowerCase().includes(q);

      if (matchNm || matchEq || matchLoc || matchPat || matchForn || matchSede) {
        matches.push({
          id: `manut-${m.id}`,
          category: "Manutenção (NM)",
          title: `NM: ${m.nm || "S/N"} — ${m.equipamento}`,
          subtitle: `Local: ${m.local || "N/A"} (${m.sede || "GNU"}) • Fornecedor: ${m.fornecedor || "N/A"}`,
          url: "/numero-manutencao",
          icon: "📞",
        });
      }
    });

    // 4. Impressoras & Toners
    impressoras.forEach((imp) => {
      const matchMarca = imp.marca?.toLowerCase().includes(q);
      const matchModelo = imp.modelo?.toLowerCase().includes(q);
      const matchIp = imp.ip?.toLowerCase().includes(q);
      const matchLocal = imp.local?.toLowerCase().includes(q);
      const matchSede = imp.sede?.toLowerCase().includes(q);
      const matchSerie = imp.numeroSerie?.toLowerCase().includes(q);

      if (matchMarca || matchModelo || matchIp || matchLocal || matchSede || matchSerie) {
        matches.push({
          id: `imp-${imp.id}`,
          category: "Impressoras",
          title: `${imp.marca || ""} ${imp.modelo || "Impressora"}`.trim(),
          subtitle: `IP: ${imp.ip || "N/A"} • Local: ${imp.local || "N/A"} • Série: ${imp.numeroSerie || "S/N"}`,
          url: "/impressoras",
          icon: "🖨️",
        });
      }
    });

    // 5. Montagens & Chamados (Eventos, Histórico e Pendentes)
    const todosEventos = [...eventos, ...historico, ...pendentes];
    const eventosIds = new Set<string>();

    todosEventos.forEach((ev) => {
      if (eventosIds.has(ev.id)) return;
      eventosIds.add(ev.id);

      const matchNome = ev.nomeEvento?.toLowerCase().includes(q);
      const matchLocal = ev.localEvento?.toLowerCase().includes(q);
      const matchReq = ev.requerente?.toLowerCase().includes(q);
      const matchChamado = ev.numeroChamado?.toLowerCase().includes(q);
      const matchPlantao = ev.funcionarioPlantao?.toLowerCase().includes(q);
      const matchEqs = ev.equipamentosNecessarios?.toLowerCase().includes(q);

      if (matchNome || matchLocal || matchReq || matchChamado || matchPlantao || matchEqs) {
        matches.push({
          id: `ev-${ev.id}`,
          category: "Montagens",
          title: ev.nomeEvento || "Montagem",
          subtitle: `Chamado: ${ev.numeroChamado || "N/A"} • Requerente: ${ev.requerente || "N/A"} • Local: ${ev.localEvento || "N/A"}`,
          url: ev.eqPendente ? "/equipamentos-pendentes" : "/historico",
          icon: "📜",
        });
      }
    });

    // 6. Tarefas & Checklist
    const todasTarefas = [...tarefas, ...historicoTarefas];
    const tarefasIds = new Set<string>();

    todasTarefas.forEach((t) => {
      if (tarefasIds.has(t.id)) return;
      tarefasIds.add(t.id);

      const matchTar = t.tarefa?.toLowerCase().includes(q);
      const matchDesc = t.descricao?.toLowerCase().includes(q);
      const matchResp = t.responsavel?.toLowerCase().includes(q);
      const matchCham = t.chamado?.toLowerCase().includes(q);

      if (matchTar || matchDesc || matchResp || matchCham) {
        matches.push({
          id: `tar-${t.id}`,
          category: "Tarefas",
          title: t.tarefa,
          subtitle: `Resp: ${t.responsavel || "N/A"} • Status: ${t.status} • Chamado: ${t.chamado || "N/A"}`,
          url: t.status === "concluida" ? "/historico-tarefas" : "/tarefas",
          icon: "☑️",
        });
      }
    });

    // 7. Câmeras de CFTV
    cameras.forEach((c) => {
      const matchLocal = c.local?.toLowerCase().includes(q);
      const matchSede = c.sede?.toLowerCase().includes(q);
      const matchMarca = c.marca?.toLowerCase().includes(q);
      const matchMod = c.modelo?.toLowerCase().includes(q);
      const matchIp = c.ip?.toLowerCase().includes(q);
      const matchCham = c.chamado?.toLowerCase().includes(q);

      if (matchLocal || matchSede || matchMarca || matchMod || matchIp || matchCham) {
        matches.push({
          id: `cam-${c.id}`,
          category: "Câmeras",
          title: `Câmera: ${c.marca || ""} ${c.modelo || c.local}`,
          subtitle: `Local: ${c.local} (${c.sede}) • IP: ${c.ip || "N/A"} • Status: ${c.status}`,
          url: "/cameras",
          icon: "🎥",
        });
      }
    });

    // 8. Equipe TI, Requerentes & Plantão
    escalas.forEach((esc) => {
      (esc.dias || []).forEach((d) => {
        if (d.nome?.toLowerCase().includes(q) || d.matricula?.toLowerCase().includes(q)) {
          matches.push({
            id: `esc-${d.id}`,
            category: "Equipe TI",
            title: `Plantão: ${d.nome}`,
            subtitle: `Data: ${d.data} • Matrícula: ${d.matricula || "N/A"}`,
            url: "/plantao",
            icon: "📅",
          });
        }
      });
    });

    equipe.forEach((eqMembro) => {
      if (eqMembro.nome.toLowerCase().includes(q) || eqMembro.cargo.toLowerCase().includes(q)) {
        matches.push({
          id: `eq-${eqMembro.id}`,
          category: "Equipe TI",
          title: eqMembro.nome,
          subtitle: `Cargo: ${eqMembro.cargo || "TI"} • Matrícula: ${eqMembro.matricula || "N/A"}`,
          url: "/plantao",
          icon: "👤",
        });
      }
    });

    tecnicosGlpi.forEach((tec) => {
      if (tec.nome.toLowerCase().includes(q)) {
        matches.push({
          id: `tec-glpi-${tec.nome}`,
          category: "Equipe TI",
          title: tec.nome,
          subtitle: `Técnico TI — ${tec.resolvidos} chamados no GLPI`,
          url: "/",
          icon: "👤",
        });
      }
    });

    pessoasGlpi.forEach((p) => {
      if (p.nome.toLowerCase().includes(q)) {
        matches.push({
          id: `p-glpi-${p.nome}`,
          category: "Equipe TI",
          title: p.nome,
          subtitle: `Requerente — ${p.chamados} chamados fechados no GLPI`,
          url: "/",
          icon: "👤",
        });
      }
    });

    // Remover duplicados por título
    const titulosVistos = new Set<string>();
    const resultadosFiltrados = matches.filter((item) => {
      const chave = `${item.category}-${item.title}`;
      if (titulosVistos.has(chave)) return false;
      titulosVistos.add(chave);
      return true;
    });

    setResults(resultadosFiltrados.slice(0, 12)); // Até 12 resultados no dropdown
    setSelectedIndex(0);
  }, [
    query,
    impressoras,
    eventos,
    historico,
    pendentes,
    inventario,
    manutencoes,
    tarefas,
    historicoTarefas,
    cameras,
    equipe,
    pessoasGlpi,
    tecnicosGlpi,
  ]);

  const handleSelect = (result: SearchResult) => {
    setIsFocused(false);
    setQuery("");
    navigate(result.url);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    }
  };

  return (
    <div className="global-search-container" ref={containerRef}>
      <div className={`global-search-input-wrap ${isFocused ? "focused" : ""}`}>
        <svg
          className="global-search-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          width="16"
          height="16"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>

        <input
          ref={inputRef}
          type="text"
          className="global-search-input"
          placeholder="Pesquisar"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          aria-label="Barra de Pesquisa Universal"
        />

        {query ? (
          <button
            type="button"
            className="global-search-clear-btn"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            title="Limpar pesquisa"
          >
            ✕
          </button>
        ) : (
          <span className="global-search-shortcut">Ctrl K</span>
        )}
      </div>

      {isFocused && query.trim() !== "" && (
        <div className="global-search-dropdown">
          {results.length > 0 ? (
            <div className="global-search-results-list">
              {results.map((item, index) => (
                <div
                  key={item.id}
                  className={`global-search-item ${index === selectedIndex ? "selected" : ""}`}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <span className="global-search-item-icon">{item.icon}</span>
                  <div className="global-search-item-content">
                    <div className="global-search-item-top-row">
                      <span className="global-search-item-title">{item.title}</span>
                      <span className="global-search-category-badge">{item.category}</span>
                    </div>
                    <span className="global-search-item-subtitle">{item.subtitle}</span>
                  </div>
                  <span className="global-search-item-action">Ir ↵</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="global-search-empty">
              <span>Nenhum resultado encontrado para "<strong>{query}</strong>"</span>
              <p>Busque por NM, patrimônio, tombo, impressora, IP, tarefa, câmera, pessoa ou página.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
