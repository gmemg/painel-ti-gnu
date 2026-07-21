import { useState, useEffect, useRef } from "react";
import {
  reconcileEventosAutomaticos,
  getHistorico,
  getGlpiDashboard,
  getGlpiTecnicoDetalhes,
  buscarGlpiUsuarios,
  getToken,
  TecnicoDetalhesResponse,
  GlpiUsuarioBusca
} from "../utils/storage";
import "./Dashboard.css";

interface Tecnico {
  id: string;
  glpiId?: string;
  nome: string;
  avatar: string;
  role: string;
  resolvidos: number;
  resolvidosMes?: number;
  resolvidosAno?: number;
}

interface Pessoa {
  id: string;
  nome: string;
  chamados: number;
  abertos?: number;
  fechados?: number;
  total?: number;
  abertosMes?: number;
  fechadosMes?: number;
  fechadosAno?: number;
  cor: string;
}

const DEFAULT_COLORS: Record<string, string> = {
  novos: "#2b8ffb",
  atribuidos: "#6366f1",
  pendentes: "#eab308",
  planejados: "#a855f7",
  solucionados: "#10b981",
  fechados: "#9ca3af",
  impressoras: "#14b8a6",
  computadores: "#2b8ffb",
  totens: "#a855f7",
  "montagens-pendentes": "#f97316",
  "montagens-realizadas": "#10b981",
  "equipamentos-pendentes": "#eab308",
};

const PRESET_COLORS = [
  { name: "Azul", value: "#2b8ffb" },
  { name: "Verde", value: "#10b981" },
  { name: "Laranja", value: "#f97316" },
  { name: "Amarelo", value: "#eab308" },
  { name: "Roxo", value: "#a855f7" },
  { name: "Índigo", value: "#6366f1" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Vermelho", value: "#ef4444" },
  { name: "Cinza", value: "#9ca3af" },
];

export default function Dashboard() {
  const [currentTime, setCurrentTime] = useState<string>("");

  // Estados do GLPI
  const [kpis, setKpis] = useState<Record<string, number>>({
    novos: 0,
    atribuidos: 0,
    pendentes: 0,
    planejados: 0,
    solucionados: 0,
    fechados: 0,
  });
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [totalComputadores, setTotalComputadores] = useState<number>(0);
  const [totalImpressoras, setTotalImpressoras] = useState<number>(0);
  const [filtroRankingMode, setFiltroRankingMode] = useState<"especifico" | "geral">("especifico");
  const [mesRanking, setMesRanking] = useState<number>(new Date().getMonth() + 1);
  const [anoRanking, setAnoRanking] = useState<number>(new Date().getFullYear());
  const [dadosRankingCustom, setDadosRankingCustom] = useState<Record<string, number> | null>(null);

  const [filtroRequerenteMode, setFiltroRequerenteMode] = useState<"especifico" | "geral">("especifico");
  const [mesRequerente, setMesRequerente] = useState<number>(new Date().getMonth() + 1);
  const [anoRequerente, setAnoRequerente] = useState<number>(new Date().getFullYear());
  const [dadosRequerenteCustom, setDadosRequerenteCustom] = useState<Record<string, number> | null>(null);

  const [carregandoGlpi, setCarregandoGlpi] = useState<boolean>(true);
  const [progressoGlpi, setProgressoGlpi] = useState<number>(0);

  const [carregandoRanking, setCarregandoRanking] = useState<boolean>(false);
  const [progressoRanking, setProgressoRanking] = useState<number>(0);

  const [carregandoRequerente, setCarregandoRequerente] = useState<boolean>(false);
  const [progressoRequerente, setProgressoRequerente] = useState<number>(0);

  // Estados para Modal de Relatório PDF
  const [modalReportAberto, setModalReportAberto] = useState(false);
  const [mesRelatorio, setMesRelatorio] = useState<number>(new Date().getMonth() + 1);
  const [anoRelatorio, setAnoRelatorio] = useState<number>(new Date().getFullYear());
  const [gerandoPdf, setGerandoPdf] = useState(false);

  // Estados para Modal de Detalhes do Técnico (Ranking TI)
  const [modalDetalhesAberto, setModalDetalhesAberto] = useState(false);
  const [tecnicoDetalhes, setTecnicoDetalhes] = useState<Tecnico | null>(null);
  const [anoDetalhes, setAnoDetalhes] = useState<number>(new Date().getFullYear());
  const [dadosDetalhes, setDadosDetalhes] = useState<TecnicoDetalhesResponse | null>(null);
  const [carregandoDetalhes, setCarregandoDetalhes] = useState<boolean>(false);
  const [buscaChamadosDetalhes, setBuscaChamadosDetalhes] = useState<string>("");
  const [mesExpandido, setMesExpandido] = useState<number | null>(new Date().getMonth() + 1);

  const carregarDetalhesTecnico = async (tech: Tecnico, ano: number) => {
    setCarregandoDetalhes(true);
    try {
      const resp = await getGlpiTecnicoDetalhes(tech.nome, tech.glpiId, ano);
      setDadosDetalhes(resp);
    } catch (err) {
      console.error("Erro ao carregar detalhes do técnico:", err);
      setDadosDetalhes({
        nome: tech.nome,
        glpiId: tech.glpiId,
        ano: ano,
        totalAno: 0,
        meses: Array.from({ length: 12 }, (_, i) => ({
          mes: i + 1,
          nomeMes: [
            "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
            "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
          ][i],
          total: 0,
          chamados: []
        }))
      });
    } finally {
      setCarregandoDetalhes(false);
    }
  };

  const abrirModalDetalhes = (tech: Tecnico) => {
    setTecnicoDetalhes(tech);
    setAnoDetalhes(new Date().getFullYear());
    setBuscaChamadosDetalhes("");
    setMesExpandido(new Date().getMonth() + 1);
    setModalDetalhesAberto(true);
    carregarDetalhesTecnico(tech, new Date().getFullYear());
  };

  const alterarAnoDetalhes = (novoAno: number) => {
    setAnoDetalhes(novoAno);
    if (tecnicoDetalhes) {
      carregarDetalhesTecnico(tecnicoDetalhes, novoAno);
    }
  };

  // Estados para gerenciar exclusão e adição manual de pessoas nos rankings
  const [excluidosRanking, setExcluidosRanking] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("dashboard_ranking_excluidos");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [adicionadosPessoas, setAdicionadosPessoas] = useState<Pessoa[]>(() => {
    try {
      const saved = localStorage.getItem("dashboard_ranking_adicionados_pessoas");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [adicionadosTecnicos, setAdicionadosTecnicos] = useState<Tecnico[]>(() => {
    try {
      const saved = localStorage.getItem("dashboard_ranking_adicionados_tecnicos");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [modalAddPessoaAberto, setModalAddPessoaAberto] = useState(false);
  const [tipoPessoaAdd, setTipoPessoaAdd] = useState<"tecnico" | "requerente">("requerente");
  const [nomeAddPessoa, setNomeAddPessoa] = useState("");
  const [chamadosAddPessoa, setChamadosAddPessoa] = useState<number>(0);
  const [modalGerenciarOcultosAberto, setModalGerenciarOcultosAberto] = useState(false);
  const [activeRankingMenuId, setActiveRankingMenuId] = useState<string | null>(null);

  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveRankingMenuId(null);
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  // Estados para busca em tempo real de usuários no GLPI
  const [buscaGlpiQuery, setBuscaGlpiQuery] = useState("");
  const [resultadosBuscaGlpi, setResultadosBuscaGlpi] = useState<GlpiUsuarioBusca[]>([]);
  const [carregandoBuscaGlpi, setCarregandoBuscaGlpi] = useState(false);
  const [usuarioGlpiSelecionado, setUsuarioGlpiSelecionado] = useState<GlpiUsuarioBusca | null>(null);

  useEffect(() => {
    if (!buscaGlpiQuery.trim() || buscaGlpiQuery.trim().length < 2) {
      setResultadosBuscaGlpi([]);
      return;
    }
    const timer = setTimeout(async () => {
      setCarregandoBuscaGlpi(true);
      try {
        const res = await buscarGlpiUsuarios(buscaGlpiQuery);
        setResultadosBuscaGlpi(res);
      } catch (err) {
        console.error("Erro na busca GLPI:", err);
      } finally {
        setCarregandoBuscaGlpi(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [buscaGlpiQuery]);

  const selecionarUsuarioGlpi = (u: GlpiUsuarioBusca) => {
    setUsuarioGlpiSelecionado(u);
    setNomeAddPessoa(u.nome);
    setChamadosAddPessoa(u.chamados);
    setBuscaGlpiQuery("");
    setResultadosBuscaGlpi([]);
  };

  const salvarExcluidos = (novosExcluidos: string[]) => {
    setExcluidosRanking(novosExcluidos);
    localStorage.setItem("dashboard_ranking_excluidos", JSON.stringify(novosExcluidos));
  };

  const ocultarDoRanking = (idOuNome: string) => {
    if (!excluidosRanking.includes(idOuNome)) {
      const atualizados = [...excluidosRanking, idOuNome];
      salvarExcluidos(atualizados);
    }
  };

  const restaurarDoRanking = (idOuNome: string) => {
    const atualizados = excluidosRanking.filter((item) => item !== idOuNome);
    salvarExcluidos(atualizados);
  };

  const removerPermanentemente = (idOuNome: string) => {
    const novosExcluidos = excluidosRanking.filter((item) => item !== idOuNome);
    salvarExcluidos(novosExcluidos);

    const novasPessoas = adicionadosPessoas.filter(
      (p) => p.id !== idOuNome && p.nome !== idOuNome
    );
    setAdicionadosPessoas(novasPessoas);
    localStorage.setItem(
      "dashboard_ranking_adicionados_pessoas",
      JSON.stringify(novasPessoas)
    );

    const novosTechs = adicionadosTecnicos.filter(
      (t) => t.id !== idOuNome && t.nome !== idOuNome
    );
    setAdicionadosTecnicos(novosTechs);
    localStorage.setItem(
      "dashboard_ranking_adicionados_tecnicos",
      JSON.stringify(novosTechs)
    );
  };

  const adicionarPessoaManualmente = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeAddPessoa.trim()) return;

    const idUnico = usuarioGlpiSelecionado?.id || nomeAddPessoa.toLowerCase().trim().replace(/\s+/g, "-");
    const glpiId = usuarioGlpiSelecionado?.glpiId;

    if (tipoPessoaAdd === "tecnico") {
      const novoTech: Tecnico = {
        id: idUnico,
        glpiId: glpiId,
        nome: nomeAddPessoa.trim(),
        avatar: nomeAddPessoa.trim().split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase(),
        role: "Técnico de Suporte",
        resolvidos: usuarioGlpiSelecionado?.resolvidos ?? chamadosAddPessoa,
        resolvidosMes: usuarioGlpiSelecionado?.resolvidosMes ?? chamadosAddPessoa,
        resolvidosAno: usuarioGlpiSelecionado?.resolvidosAno ?? chamadosAddPessoa,
      };
      const novosTechs = [...adicionadosTecnicos.filter((t) => t.id !== idUnico), novoTech];
      setAdicionadosTecnicos(novosTechs);
      localStorage.setItem("dashboard_ranking_adicionados_tecnicos", JSON.stringify(novosTechs));
    } else {
      const novaPessoa: Pessoa = {
        id: idUnico,
        nome: nomeAddPessoa.trim(),
        chamados: usuarioGlpiSelecionado?.chamados ?? chamadosAddPessoa,
        fechados: usuarioGlpiSelecionado?.fechados ?? chamadosAddPessoa,
        fechadosMes: usuarioGlpiSelecionado?.fechadosMes ?? chamadosAddPessoa,
        fechadosAno: usuarioGlpiSelecionado?.fechadosAno ?? chamadosAddPessoa,
        cor: "#2b8ffb",
      };
      const novasPessoas = [...adicionadosPessoas.filter((p) => p.id !== idUnico), novaPessoa];
      setAdicionadosPessoas(novasPessoas);
      localStorage.setItem("dashboard_ranking_adicionados_pessoas", JSON.stringify(novasPessoas));
    }

    if (excluidosRanking.includes(idUnico) || excluidosRanking.includes(nomeAddPessoa.trim())) {
      restaurarDoRanking(idUnico);
      restaurarDoRanking(nomeAddPessoa.trim());
    }

    setNomeAddPessoa("");
    setChamadosAddPessoa(0);
    setUsuarioGlpiSelecionado(null);
    setBuscaGlpiQuery("");
    setModalAddPessoaAberto(false);
  };

  const overlayMouseDownRef = useRef(false);

  // Estados para contagens dinâmicas
  const [montagensPendentes, setMontagensPendentes] = useState<number>(0);
  const [montagensRealizadas, setMontagensRealizadas] = useState<number>(0);
  const [eqPendentes, setEqPendentes] = useState<number>(0);
  const [carregandoDinamicos, setCarregandoDinamicos] = useState<boolean>(true);

  // Estado para controle de cor de cada card
  const [cardColors, setCardColors] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem("dashboard_card_colors");
    if (saved) {
      try {
        return { ...DEFAULT_COLORS, ...JSON.parse(saved) };
      } catch (e) {
        console.error("Erro ao carregar cores salvas do dashboard:", e);
      }
    }
    return DEFAULT_COLORS;
  });

  const [activePickerId, setActivePickerId] = useState<string | null>(null);

  // Efeito para fechar o popover ao clicar fora
  useEffect(() => {
    if (!activePickerId) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".db-color-popover-wrapper")) {
        setActivePickerId(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [activePickerId]);

  // Formatação do relógio em tempo real
  useEffect(() => {
    const formatTime = () => {
      const now = new Date();
      return now.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    };
    setCurrentTime(formatTime());
    const interval = setInterval(() => {
      setCurrentTime(formatTime());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Efeito para carregar as contagens dinâmicas do Storage
  useEffect(() => {
    const carregarDados = async () => {
      try {
        const ativos = await reconcileEventosAutomaticos();
        setMontagensPendentes(ativos.filter((e) => !e.removido).length);

        const historico = await getHistorico();
        setMontagensRealizadas(historico.filter((e) => e.concluido).length);
        setEqPendentes(historico.filter((e) => e.eqPendente && !e.concluido).length);
      } catch (error) {
        console.error("Erro ao carregar dados dinâmicos do Dashboard:", error);
      } finally {
        setCarregandoDinamicos(false);
      }
    };

    carregarDados();
    const interval = setInterval(carregarDados, 30000);
    return () => clearInterval(interval);
  }, []);

  // Efeito para carregar dados da API do GLPI
  useEffect(() => {
    let progressTimer: any;
    const carregarGlpi = async () => {
      setProgressoGlpi(15);
      progressTimer = setInterval(() => {
        setProgressoGlpi((p) => (p < 90 ? Math.min(90, p + Math.floor(Math.random() * 10 + 5)) : p));
      }, 250);

      try {
        const data = await getGlpiDashboard();
        if (data.kpis) setKpis(data.kpis);
        if (data.tecnicos && data.tecnicos.length > 0) setTecnicos(data.tecnicos);
        if (data.pessoas && data.pessoas.length > 0) setPessoas(data.pessoas);
        if (typeof data.totalComputadores === "number") setTotalComputadores(data.totalComputadores);
        if (typeof data.totalImpressoras === "number") setTotalImpressoras(data.totalImpressoras);
        setProgressoGlpi(100);
        setTimeout(() => setCarregandoGlpi(false), 300);
      } catch (error) {
        console.error("Erro ao carregar dados do GLPI:", error);
        setProgressoGlpi(100);
        setTimeout(() => setCarregandoGlpi(false), 300);
      } finally {
        clearInterval(progressTimer);
      }
    };

    carregarGlpi();
    const interval = setInterval(carregarGlpi, 60000); // Atualiza a cada 1 minuto
    return () => {
      clearInterval(interval);
      clearInterval(progressTimer);
    };
  }, []);

  // Efeitos para carregar dados de mês/ano customizados para os rankings
  useEffect(() => {
    if (filtroRankingMode === "geral") return;
    setCarregandoRanking(true);
    setProgressoRanking(20);
    const progressTimer = setInterval(() => {
      setProgressoRanking((p) => (p < 90 ? Math.min(90, p + Math.floor(Math.random() * 12 + 6)) : p));
    }, 200);

    const token = getToken();
    fetch(`/api/glpi/relatorio?tipo=mensal&mes=${mesRanking}&ano=${anoRanking}`, {
      headers: { Authorization: token ? `Bearer ${token}` : "" }
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.tecnicos) {
          const map: Record<string, number> = {};
          data.tecnicos.forEach((t: any) => {
            if (t.nome) map[t.nome.toLowerCase().trim()] = t.count;
          });
          setDadosRankingCustom(map);
        }
        setProgressoRanking(100);
        setTimeout(() => setCarregandoRanking(false), 250);
      })
      .catch((err) => {
        console.error("Erro ao filtrar ranking por mes/ano:", err);
        setProgressoRanking(100);
        setTimeout(() => setCarregandoRanking(false), 250);
      })
      .finally(() => clearInterval(progressTimer));
  }, [mesRanking, anoRanking, filtroRankingMode]);

  useEffect(() => {
    if (filtroRequerenteMode === "geral") return;
    setCarregandoRequerente(true);
    setProgressoRequerente(20);
    const progressTimer = setInterval(() => {
      setProgressoRequerente((p) => (p < 90 ? Math.min(90, p + Math.floor(Math.random() * 12 + 6)) : p));
    }, 200);

    const token = getToken();
    fetch(`/api/glpi/relatorio?tipo=mensal&mes=${mesRequerente}&ano=${anoRequerente}`, {
      headers: { Authorization: token ? `Bearer ${token}` : "" }
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && (data.requerentesAbertosMes || data.requerentes)) {
          const list = (data.requerentesAbertosMes && data.requerentesAbertosMes.length > 0)
            ? data.requerentesAbertosMes
            : data.requerentes;
          const map: Record<string, number> = {};
          list.forEach((p: any) => {
            if (p.nome) map[p.nome.toLowerCase().trim()] = p.count;
          });
          setDadosRequerenteCustom(map);
        }
        setProgressoRequerente(100);
        setTimeout(() => setCarregandoRequerente(false), 250);
      })
      .catch((err) => {
        console.error("Erro ao filtrar requerentes por mes/ano:", err);
        setProgressoRequerente(100);
        setTimeout(() => setCarregandoRequerente(false), 250);
      })
      .finally(() => clearInterval(progressTimer));
  }, [mesRequerente, anoRequerente, filtroRequerenteMode]);

  const renderProgressBar = (label: string, pct: number) => {
    const clampedPct = Math.min(100, Math.max(0, Math.round(pct)));
    return (
      <div className="db-widget-loading" style={{ padding: "2.2rem 1rem", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div className="db-progress-text">
          <span>{label}</span>
          <span style={{ fontWeight: 800 }}>{clampedPct}%</span>
        </div>
        <div className="db-progress-bar-wrap">
          <div className="db-progress-bar-fill" style={{ width: `${Math.max(5, clampedPct)}%` }} />
        </div>
      </div>
    );
  };
  const saveColors = (newColors: Record<string, string>) => {
    setCardColors(newColors);
    localStorage.setItem("dashboard_card_colors", JSON.stringify(newColors));
  };

  // Os estados 'tecnicos' e 'pessoas' agora controlam estes dados obtidos via API

  const getCardStyle = (cardId: string) => {
    const accentColor = cardColors[cardId] || DEFAULT_COLORS[cardId];
    return {
      "--card-accent": accentColor,
      "--card-accent-dim": `${accentColor}14`, // ~8% de opacidade
      "--card-accent-glow": `${accentColor}1c`, // ~11% de opacidade
    } as React.CSSProperties;
  };

  const renderColorPicker = (cardId: string) => {
    const isOpened = activePickerId === cardId;
    const currentColor = cardColors[cardId] || DEFAULT_COLORS[cardId];

    return (
      <div className="db-color-popover-wrapper">
        <button
          type="button"
          className={`db-card-color-btn ${isOpened ? "active" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            setActivePickerId(isOpened ? null : cardId);
          }}
          title="Personalizar cor do card"
          aria-label="Personalizar cor do card"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 14.7255 3.09032 17.1962 4.85857 19C4.85857 19 4.5 20 5.5 21C6.5 22 8 22 8 22M12 22C11.5 22 10.5 22 10.5 20.5C10.5 19 12 18.5 12 17.5C12 16.5 10.5 16 9.5 16C8.5 16 7.5 16.5 6.5 16C5.5 15.5 5 14 5 12C5 8.13401 8.13401 5 12 5C15.866 5 19 8.13401 19 12C19 15.866 15.866 19 12 19" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="7.5" cy="10.5" r="1.2" fill="currentColor" />
            <circle cx="11.5" cy="7.5" r="1.2" fill="currentColor" />
            <circle cx="16.5" cy="9.5" r="1.2" fill="currentColor" />
            <circle cx="15.5" cy="14.5" r="1.2" fill="currentColor" />
          </svg>
        </button>

        {isOpened && (
          <div className="db-color-popover" onClick={(e) => e.stopPropagation()}>
            <div className="db-color-popover-title">Cor de Destaque</div>
            <div className="db-color-presets">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className={`db-preset-circle ${currentColor === preset.value ? "active" : ""}`}
                  style={{ backgroundColor: preset.value }}
                  onClick={() => {
                    const updated = { ...cardColors, [cardId]: preset.value };
                    saveColors(updated);
                    setActivePickerId(null);
                  }}
                  title={preset.name}
                  aria-label={preset.name}
                />
              ))}
            </div>
            <div className="db-color-picker-custom">
              <label htmlFor={`custom-color-${cardId}`}>Personalizar:</label>
              <input
                id={`custom-color-${cardId}`}
                type="color"
                value={currentColor}
                onChange={(e) => {
                  const updated = { ...cardColors, [cardId]: e.target.value };
                  saveColors(updated);
                }}
              />
            </div>
            <button
              type="button"
              className="db-color-reset-btn"
              onClick={() => {
                const updated = { ...cardColors, [cardId]: DEFAULT_COLORS[cardId] };
                saveColors(updated);
                setActivePickerId(null);
              }}
            >
              Restaurar Padrão
            </button>
          </div>
        )}
      </div>
    );
  };

  const tecnicosExibidos = [...tecnicos, ...adicionadosTecnicos]
    .filter((t, idx, self) => self.findIndex((x) => x.id === t.id || x.nome.toLowerCase() === t.nome.toLowerCase()) === idx)
    .filter((t) => !excluidosRanking.includes(t.id) && !excluidosRanking.includes(t.nome) && !excluidosRanking.includes(String(t.glpiId || "")));

  const pessoasExibidas = [...pessoas, ...adicionadosPessoas]
    .filter((p, idx, self) => self.findIndex((x) => x.id === p.id || x.nome.toLowerCase() === p.nome.toLowerCase()) === idx)
    .filter((p) => !excluidosRanking.includes(p.id) && !excluidosRanking.includes(p.nome));

  return (
    <div className="db-container">
      {/* Header do Dashboard */}
      <div className="db-header">
        <div className="db-header-left">
          <h2>Dashboard GLPI</h2>
          <p className="db-subtitle">Métricas e Indicadores Gerais do Sistema</p>
        </div>
        <div className="db-header-right" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <button
            type="button"
            className="db-btn-report"
            onClick={() => setModalReportAberto(true)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 2V8H20" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M16 13H8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M16 17H8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10 9H8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Gerar Relatório PDF
          </button>
          <div className="db-update-badge">
            <span className="db-pulse-dot"></span>
            <span>Atualizando ao vivo • {currentTime}</span>
          </div>
        </div>
      </div>

      {/* Grid Principal de Indicadores */}
      <div className="db-kpi-grid">
        {/* Chamados Novos */}
        <div className="db-card kpi-novos" style={getCardStyle("novos")}>
          <div className="db-card-header">
            <div className="db-card-icon-wrap var-accent-bg-dim">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="db-card-icon var-accent-color">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="db-card-header-actions">
              <span className="db-card-trend trend-up">Novo</span>
              {renderColorPicker("novos")}
            </div>
          </div>
          <div className="db-card-body">
            <h3 className="db-card-value">{carregandoGlpi ? "..." : kpis.novos}</h3>
            <p className="db-card-title">Chamados Novos</p>
          </div>
        </div>

        {/* Chamados Atribuídos */}
        <div className="db-card kpi-atribuidos" style={getCardStyle("atribuidos")}>
          <div className="db-card-header">
            <div className="db-card-icon-wrap var-accent-bg-dim">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="db-card-icon var-accent-color">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div className="db-card-header-actions">
              <span className="db-card-trend trend-neutral">Em andamento</span>
              {renderColorPicker("atribuidos")}
            </div>
          </div>
          <div className="db-card-body">
            <h3 className="db-card-value">{carregandoGlpi ? "..." : kpis.atribuidos}</h3>
            <p className="db-card-title">Atribuídos</p>
          </div>
        </div>

        {/* Chamados Pendentes */}
        <div className="db-card kpi-pendentes" style={getCardStyle("pendentes")}>
          <div className="db-card-header">
            <div className="db-card-icon-wrap var-accent-bg-dim">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="db-card-icon var-accent-color">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="db-card-header-actions">
              <span className="db-card-trend trend-warning">Aguardando</span>
              {renderColorPicker("pendentes")}
            </div>
          </div>
          <div className="db-card-body">
            <h3 className="db-card-value">{carregandoGlpi ? "..." : kpis.pendentes}</h3>
            <p className="db-card-title">Chamados Pendentes</p>
          </div>
        </div>

        {/* Chamados Planejados */}
        <div className="db-card kpi-planejados" style={getCardStyle("planejados")}>
          <div className="db-card-header">
            <div className="db-card-icon-wrap var-accent-bg-dim">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="db-card-icon var-accent-color">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div className="db-card-header-actions">
              <span className="db-card-trend trend-neutral">Agendados</span>
              {renderColorPicker("planejados")}
            </div>
          </div>
          <div className="db-card-body">
            <h3 className="db-card-value">{carregandoGlpi ? "..." : kpis.planejados}</h3>
            <p className="db-card-title">Planejados</p>
          </div>
        </div>

        {/* Chamados Solucionados */}
        <div className="db-card kpi-solucionados" style={getCardStyle("solucionados")}>
          <div className="db-card-header">
            <div className="db-card-icon-wrap var-accent-bg-dim">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="db-card-icon var-accent-color">
                <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="db-card-header-actions">
              <span className="db-card-trend trend-up">Concluídos</span>
              {renderColorPicker("solucionados")}
            </div>
          </div>
          <div className="db-card-body">
            <h3 className="db-card-value">{carregandoGlpi ? "..." : (kpis.solucionados ?? 0)}</h3>
            <p className="db-card-title">Chamados Solucionados</p>
          </div>
        </div>

        {/* Chamados Fechados */}
        <div className="db-card kpi-fechados" style={getCardStyle("fechados")}>
          <div className="db-card-header">
            <div className="db-card-icon-wrap var-accent-bg-dim">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="db-card-icon var-accent-color">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className="db-card-header-actions">
              <span className="db-card-trend trend-neutral">Arquivados</span>
              {renderColorPicker("fechados")}
            </div>
          </div>
          <div className="db-card-body">
            <h3 className="db-card-value">{carregandoGlpi ? "..." : kpis.fechados}</h3>
            <p className="db-card-title">Chamados Fechados</p>
          </div>
        </div>

        {/* Impressoras */}
        <div className="db-card kpi-impressoras" style={getCardStyle("impressoras")}>
          <div className="db-card-header">
            <div className="db-card-icon-wrap var-accent-bg-dim">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="db-card-icon var-accent-color">
                <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <path d="M6 14h12v8H6z" />
              </svg>
            </div>
            <div className="db-card-header-actions">
              <span className="db-card-trend trend-neutral">Rede</span>
              {renderColorPicker("impressoras")}
            </div>
          </div>
          <div className="db-card-body">
            <h3 className="db-card-value">{carregandoGlpi ? "..." : totalImpressoras}</h3>
            <p className="db-card-title">Total Impressoras</p>
          </div>
        </div>

        {/* Total de Computadores */}
        <div className="db-card kpi-computadores" style={getCardStyle("computadores")}>
          <div className="db-card-header">
            <div className="db-card-icon-wrap var-accent-bg-dim">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="db-card-icon var-accent-color">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <div className="db-card-header-actions">
              <span className="db-card-trend trend-neutral">Inventário</span>
              {renderColorPicker("computadores")}
            </div>
          </div>
          <div className="db-card-body">
            <h3 className="db-card-value">{carregandoGlpi ? "..." : totalComputadores}</h3>
            <p className="db-card-title">Total Computadores</p>
          </div>
        </div>

        {/* Total de Totens */}
        <div className="db-card kpi-totens" style={getCardStyle("totens")}>
          <div className="db-card-header">
            <div className="db-card-icon-wrap var-accent-bg-dim">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="db-card-icon var-accent-color">
                <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                <line x1="12" y1="18" x2="12" y2="18.01" strokeWidth="3" />
                <line x1="8" y1="6" x2="16" y2="6" />
              </svg>
            </div>
            <div className="db-card-header-actions">
              <span className="db-card-trend trend-neutral">Ativos</span>
              {renderColorPicker("totens")}
            </div>
          </div>
          <div className="db-card-body">
            <h3 className="db-card-value">-</h3>
            <p className="db-card-title">Total de Totens</p>
          </div>
        </div>

        {/* Total de Montagens Pendentes (DINÂMICO) */}
        <div className="db-card kpi-montagens-pendentes" style={getCardStyle("montagens-pendentes")}>
          <div className="db-card-header">
            <div className="db-card-icon-wrap var-accent-bg-dim">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="db-card-icon var-accent-color">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="db-card-header-actions">
              <span className="db-card-trend trend-warning">Fila</span>
              {renderColorPicker("montagens-pendentes")}
            </div>
          </div>
          <div className="db-card-body">
            <h3 className="db-card-value">{carregandoDinamicos ? "..." : montagensPendentes}</h3>
            <p className="db-card-title">Montagens Pendentes</p>
          </div>
        </div>

        {/* Total de Montagens Realizadas (DINÂMICO) */}
        <div className="db-card kpi-montagens-realizadas" style={getCardStyle("montagens-realizadas")}>
          <div className="db-card-header">
            <div className="db-card-icon-wrap var-accent-bg-dim">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="db-card-icon var-accent-color">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="22 4 12 14.01 9 11.01" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="db-card-header-actions">
              <span className="db-card-trend trend-up">Histórico</span>
              {renderColorPicker("montagens-realizadas")}
            </div>
          </div>
          <div className="db-card-body">
            <h3 className="db-card-value">{carregandoDinamicos ? "..." : montagensRealizadas}</h3>
            <p className="db-card-title">Montagens Realizadas</p>
          </div>
        </div>

        {/* Chamados com Equipamento Pendente (DINÂMICO) */}
        <div className="db-card kpi-equipamentos-pendentes" style={getCardStyle("equipamentos-pendentes")}>
          <div className="db-card-header">
            <div className="db-card-icon-wrap var-accent-bg-dim">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="db-card-icon var-accent-color">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div className="db-card-header-actions">
              <span className="db-card-trend trend-warning">Atenção</span>
              {renderColorPicker("equipamentos-pendentes")}
            </div>
          </div>
          <div className="db-card-body">
            <h3 className="db-card-value">{carregandoDinamicos ? "..." : eqPendentes}</h3>
            <p className="db-card-title">Eq. Pendente (Hist.)</p>
          </div>
        </div>
      </div>

      {/* Seção Inferior: Widgets de Consulta */}
      <div className="db-lower-section">
        {/* Widget 1: Ranking de Produtividade dos Técnicos */}
        <div className="db-tech-widget">
          <div className="db-widget-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <div className="db-widget-title-group">
              <h3>Ranking TI</h3>
              <p>
                {filtroRankingMode === "geral"
                  ? ""
                  : ` ${["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"][mesRanking - 1]} de ${anoRanking} (GLPI)`}
              </p>
            </div>
            <div className="db-tab-group" style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
              <select
                className="db-select-filtro"
                value={filtroRankingMode === "geral" ? "geral" : mesRanking}
                onChange={(e) => {
                  if (e.target.value === "geral") {
                    setFiltroRankingMode("geral");
                  } else {
                    setFiltroRankingMode("especifico");
                    setMesRanking(Number(e.target.value));
                  }
                }}
              >
                <option value={1}>Janeiro</option>
                <option value={2}>Fevereiro</option>
                <option value={3}>Março</option>
                <option value={4}>Abril</option>
                <option value={5}>Maio</option>
                <option value={6}>Junho</option>
                <option value={7}>Julho</option>
                <option value={8}>Agosto</option>
                <option value={9}>Setembro</option>
                <option value={10}>Outubro</option>
                <option value={11}>Novembro</option>
                <option value={12}>Dezembro</option>
                <option value="geral">Histórico Geral</option>
              </select>

              {filtroRankingMode !== "geral" && (
                <select
                  className="db-select-filtro"
                  value={anoRanking}
                  onChange={(e) => setAnoRanking(Number(e.target.value))}
                >
                  <option value={2024}>2024</option>
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                </select>
              )}
              <button
                type="button"
                className="db-btn-add-person"
                onClick={() => {
                  setTipoPessoaAdd("tecnico");
                  setModalAddPessoaAberto(true);
                }}
                title="Adicionar pessoa ao Ranking TI"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                  <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="8.5" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="20" y1="8" x2="20" y2="14" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="17" y1="11" x2="23" y2="11" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {excluidosRanking.length > 0 && (
                <button
                  type="button"
                  className="db-btn-manage-hidden"
                  onClick={() => setModalGerenciarOcultosAberto(true)}
                  title={`Pessoas ocultadas (${excluidosRanking.length})`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="db-hidden-count-badge">{excluidosRanking.length}</span>
                </button>
              )}
            </div>
          </div>

          {carregandoGlpi || carregandoRanking ? (
            renderProgressBar("Carregando Ranking TI...", carregandoGlpi ? progressoGlpi : progressoRanking)
          ) : tecnicosExibidos.length === 0 ? (
            <div className="db-widget-empty">Nenhum técnico encontrado.</div>
          ) : (
            <div className="db-ranking-list">
              {[...tecnicosExibidos]
                .map((tech) => {
                  let val = 0;
                  if (filtroRankingMode === "geral") {
                    val = tech.resolvidos;
                  } else if (dadosRankingCustom) {
                    val = dadosRankingCustom[tech.nome.toLowerCase().trim()] ?? 0;
                  } else {
                    val = tech.resolvidosMes ?? 0;
                  }
                  return { ...tech, val };
                })
                .sort((a, b) => b.val - a.val)
                .map((tech, index) => {
                  const isTop3 = index < 3;
                  const medalColor = index === 0 ? "gold" : index === 1 ? "silver" : "bronze";
                  const valorExibido = tech.val;
                  const siglaMeses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
                  const labelExibido =
                    filtroRankingMode === "geral"
                      ? "total"
                      : `${siglaMeses[mesRanking - 1]}/${anoRanking}`;
                  return (
                    <div key={tech.id} className="db-ranking-item">
                      <div className="db-ranking-position-wrap">
                        <span className={`db-ranking-position ${isTop3 ? `medal-${medalColor}` : ""}`}>
                          {index + 1}
                        </span>
                      </div>
                      <div className="db-ranking-avatar">{tech.avatar}</div>
                      <div className="db-ranking-info">
                        <span className="db-ranking-name">{tech.nome}</span>
                      </div>
                      <div className="db-ranking-value-wrap">
                        <span className="db-ranking-value">{valorExibido}</span>
                        <span className="db-ranking-label">{labelExibido}</span>
                      </div>
                      <button
                        type="button"
                        className="db-btn-detalhes-ranking"
                        onClick={() => abrirModalDetalhes(tech)}
                        title={`Ver chamados concluídos de ${tech.nome}`}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                          <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Detalhes
                      </button>
                      <div style={{ position: "relative" }}>
                        <button
                          type="button"
                          className={`db-btn-ranking-menu ${activeRankingMenuId === tech.id ? "active" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveRankingMenuId(activeRankingMenuId === tech.id ? null : tech.id);
                          }}
                          title="Opções"
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                            <circle cx="12" cy="5" r="2" />
                            <circle cx="12" cy="12" r="2" />
                            <circle cx="12" cy="19" r="2" />
                          </svg>
                        </button>
                        {activeRankingMenuId === tech.id && (
                          <div className="db-ranking-popover" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="db-ranking-popover-item db-popover-danger"
                              onClick={() => {
                                ocultarDoRanking(tech.id);
                                setActiveRankingMenuId(null);
                              }}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              Remover
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Widget 2: Chamados por Requerente */}
        <div className="db-tech-widget">
          <div className="db-widget-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <div className="db-widget-title-group">
              <h3>Chamados por requerente</h3>
              <p>
                {filtroRequerenteMode === "geral"
                  ? ""
                  : ` ${["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"][mesRequerente - 1]} de ${anoRequerente} (GLPI)`}
              </p>
            </div>
            <div className="db-tab-group" style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
              <select
                className="db-select-filtro"
                value={filtroRequerenteMode === "geral" ? "geral" : mesRequerente}
                onChange={(e) => {
                  if (e.target.value === "geral") {
                    setFiltroRequerenteMode("geral");
                  } else {
                    setFiltroRequerenteMode("especifico");
                    setMesRequerente(Number(e.target.value));
                  }
                }}
              >
                <option value={1}>Janeiro</option>
                <option value={2}>Fevereiro</option>
                <option value={3}>Março</option>
                <option value={4}>Abril</option>
                <option value={5}>Maio</option>
                <option value={6}>Junho</option>
                <option value={7}>Julho</option>
                <option value={8}>Agosto</option>
                <option value={9}>Setembro</option>
                <option value={10}>Outubro</option>
                <option value={11}>Novembro</option>
                <option value={12}>Dezembro</option>
                <option value="geral">Histórico Geral</option>
              </select>

              {filtroRequerenteMode !== "geral" && (
                <select
                  className="db-select-filtro"
                  value={anoRequerente}
                  onChange={(e) => setAnoRequerente(Number(e.target.value))}
                >
                  <option value={2024}>2024</option>
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                </select>
              )}
              <button
                type="button"
                className="db-btn-add-person"
                onClick={() => {
                  setTipoPessoaAdd("requerente");
                  setModalAddPessoaAberto(true);
                }}
                title="Adicionar pessoa ao Ranking de Requerentes"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                  <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="8.5" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="20" y1="8" x2="20" y2="14" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="17" y1="11" x2="23" y2="11" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {excluidosRanking.length > 0 && (
                <button
                  type="button"
                  className="db-btn-manage-hidden"
                  onClick={() => setModalGerenciarOcultosAberto(true)}
                  title={`Pessoas ocultadas (${excluidosRanking.length})`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="db-hidden-count-badge">{excluidosRanking.length}</span>
                </button>
              )}
            </div>
          </div>

          {carregandoGlpi || carregandoRequerente ? (
            renderProgressBar("Carregando Requerentes...", carregandoGlpi ? progressoGlpi : progressoRequerente)
          ) : pessoasExibidas.length === 0 ? (
            <div className="db-widget-empty">Nenhum requerente encontrado.</div>
          ) : (
            <div className="db-sector-list">
              {[...pessoasExibidas]
                .map((pessoa) => {
                  let val = 0;
                  if (filtroRequerenteMode === "geral") {
                    val = pessoa.fechados ?? pessoa.chamados;
                  } else if (dadosRequerenteCustom) {
                    val = dadosRequerenteCustom[pessoa.nome.toLowerCase().trim()] ?? 0;
                  } else {
                    val = pessoa.fechadosMes ?? 0;
                  }
                  return { ...pessoa, val };
                })
                .sort((a, b) => b.val - a.val)
                .map((pessoa) => {
                  const valorExibido = pessoa.val;
                  const siglaMeses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
                  const labelExibido =
                    filtroRequerenteMode === "geral"
                      ? "fechados"
                      : `em ${siglaMeses[mesRequerente - 1]}/${anoRequerente}`;
                  return (
                    <div key={pessoa.id} className="db-sector-item">
                      <div className="db-sector-info-row">
                        <span className="db-sector-name">{pessoa.nome}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                          <span className="db-sector-count">
                            <strong>{valorExibido}</strong> {labelExibido}
                          </span>
                          <div style={{ position: "relative" }}>
                            <button
                              type="button"
                              className={`db-btn-ranking-menu ${activeRankingMenuId === pessoa.id ? "active" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveRankingMenuId(activeRankingMenuId === pessoa.id ? null : pessoa.id);
                              }}
                              title="Opções"
                            >
                              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                                <circle cx="12" cy="5" r="2" />
                                <circle cx="12" cy="12" r="2" />
                                <circle cx="12" cy="19" r="2" />
                              </svg>
                            </button>
                            {activeRankingMenuId === pessoa.id && (
                              <div className="db-ranking-popover" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  className="db-ranking-popover-item db-popover-danger"
                                  onClick={() => {
                                    ocultarDoRanking(pessoa.id);
                                    setActiveRankingMenuId(null);
                                  }}
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                                    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                  Remover
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="db-sector-divider" />
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Relatórios em PDF */}
      {modalReportAberto && (
        <div
          className="db-report-overlay"
          onMouseDown={(e) => {
            overlayMouseDownRef.current = e.target === e.currentTarget;
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && overlayMouseDownRef.current) {
              setModalReportAberto(false);
            }
            overlayMouseDownRef.current = false;
          }}
        >
          <div className="db-report-modal" onClick={(e) => e.stopPropagation()}>
            <div className="db-report-modal-header">
              <h3>📄 Gerar Relatório em PDF</h3>
              <button
                type="button"
                className="db-report-close-btn"
                onClick={() => setModalReportAberto(false)}
              >
                ✕
              </button>
            </div>

            <div className="db-report-modal-body">
              <p className="db-report-desc">
                Selecione o tipo de relatório e o período desejado para a geração do documento em PDF:
              </p>

              <div className="db-report-selectors-row">
                <div className="db-report-field">
                  <label>Selecione o Mês:</label>
                  <select
                    value={mesRelatorio}
                    onChange={(e) => setMesRelatorio(Number(e.target.value))}
                  >
                    <option value={1}>Janeiro</option>
                    <option value={2}>Fevereiro</option>
                    <option value={3}>Março</option>
                    <option value={4}>Abril</option>
                    <option value={5}>Maio</option>
                    <option value={6}>Junho</option>
                    <option value={7}>Julho</option>
                    <option value={8}>Agosto</option>
                    <option value={9}>Setembro</option>
                    <option value={10}>Outubro</option>
                    <option value={11}>Novembro</option>
                    <option value={12}>Dezembro</option>
                  </select>
                </div>

                <div className="db-report-field">
                  <label>Selecione o Ano:</label>
                  <select
                    value={anoRelatorio}
                    onChange={(e) => setAnoRelatorio(Number(e.target.value))}
                  >
                    <option value={2024}>2024</option>
                    <option value={2025}>2025</option>
                    <option value={2026}>2026</option>
                    <option value={2027}>2027</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="db-report-modal-footer">
              <button
                type="button"
                className="db-report-cancel-btn"
                onClick={() => setModalReportAberto(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="db-report-submit-btn"
                disabled={gerandoPdf}
                onClick={async () => {
                  setGerandoPdf(true);
                  try {
                    const token = getToken();
                    const res = await fetch(`/api/glpi/relatorio?tipo=mensal&mes=${mesRelatorio}&ano=${anoRelatorio}`, {
                      headers: { Authorization: token ? `Bearer ${token}` : "" }
                    });
                    const data = res.ok ? await res.json() : null;

                    const periodoStr = data?.periodoLabel || `${mesRelatorio}/${anoRelatorio}`;
                    const tipoRelatorioStr = "mensal";
                    const dataEmissao = data?.dataEmissao || new Date().toLocaleString("pt-BR");
                    const totalFechados = data?.totalFechados ?? 0;
                    const listRequerentes = data?.requerentes || [];

                    const totalAbertosMes = data?.totalAbertosMes ?? 0;
                    const totalAbertosAno = data?.totalAbertosAno ?? 0;
                    const totalAbertosGeral = data?.totalAbertosGeral ?? 0;
                    const requerentesAbertosMes = data?.requerentesAbertosMes || [];

                    const topRequerente = requerentesAbertosMes.length > 0 ? requerentesAbertosMes[0] : (listRequerentes.length > 0 ? listRequerentes[0] : null);

                    const printWindow = window.open("", "_blank");
                    if (!printWindow) {
                      alert("Por favor, permita popups para gerar o relatório PDF.");
                      setGerandoPdf(false);
                      return;
                    }

                    const htmlContent = `
                      <!DOCTYPE html>
                      <html lang="pt-BR">
                      <head>
                        <meta charset="UTF-8">
                        <title>Relatorio_TI_${tipoRelatorioStr}_${periodoStr.replace(/[^a-zA-Z0-9]/g, "_")}</title>
                        <style>
                          @page { size: A4 portrait; margin: 12mm; }
                          body {
                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                            color: #0f172a;
                            background: #ffffff;
                            margin: 0;
                            padding: 0;
                            font-size: 12px;
                            line-height: 1.4;
                          }
                          .header-bar {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            border-bottom: 3px solid #2b8ffb;
                            padding-bottom: 10px;
                            margin-bottom: 16px;
                          }
                          .brand-title h1 {
                            margin: 0;
                            font-size: 17px;
                            color: #0f172a;
                            font-weight: 800;
                            letter-spacing: -0.4px;
                          }
                          .brand-title p {
                            margin: 2px 0 0 0;
                            font-size: 11px;
                            color: #64748b;
                            font-weight: 500;
                          }
                          .period-badge {
                            background: #eff6ff;
                            border: 1px solid #bfdbfe;
                            color: #1e40af;
                            padding: 6px 14px;
                            border-radius: 20px;
                            font-size: 12px;
                            font-weight: 700;
                            text-align: right;
                          }
                          .meta-grid {
                            display: grid;
                            grid-template-columns: repeat(5, 1fr);
                            gap: 8px;
                            margin-bottom: 18px;
                          }
                          .meta-card {
                            background: #f8fafc;
                            border: 1px solid #e2e8f0;
                            border-radius: 8px;
                            padding: 10px 8px;
                            text-align: center;
                          }
                          .meta-card .val {
                            font-size: 18px;
                            font-weight: 800;
                            color: #2b8ffb;
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
                          }
                          .meta-card .val-sub {
                            font-size: 11px;
                            font-weight: 700;
                            color: #0f172a;
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
                            margin-top: 2px;
                          }
                          .meta-card .lbl {
                            font-size: 10px;
                            color: #64748b;
                            text-transform: uppercase;
                            font-weight: 600;
                            margin-top: 3px;
                          }
                          .section-title {
                            font-size: 12px;
                            font-weight: 700;
                            color: #0f172a;
                            border-left: 4px solid #2b8ffb;
                            padding-left: 8px;
                            margin: 16px 0 8px 0;
                            text-transform: uppercase;
                            letter-spacing: 0.4px;
                          }
                          table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 16px;
                          }
                          th {
                            background: #f1f5f9;
                            color: #475569;
                            font-size: 10px;
                            text-transform: uppercase;
                            font-weight: 700;
                            padding: 6px 8px;
                            text-align: left;
                            border-bottom: 2px solid #cbd5e1;
                          }
                          td {
                            padding: 6px 8px;
                            border-bottom: 1px solid #e2e8f0;
                            font-size: 11px;
                          }
                          tr:nth-child(even) td {
                            background: #f8fafc;
                          }
                          .pos-badge {
                            display: inline-block;
                            width: 20px;
                            height: 20px;
                            line-height: 20px;
                            border-radius: 50%;
                            background: #e2e8f0;
                            color: #334155;
                            font-size: 10px;
                            font-weight: 700;
                            text-align: center;
                          }
                          .pos-1 { background: #fef08a; color: #854d0e; }
                          .pos-2 { background: #e2e8f0; color: #475569; }
                          .pos-3 { background: #ffedd5; color: #9a3412; }
                          .two-cols {
                            display: grid;
                            grid-template-columns: 1fr 1fr;
                            gap: 16px;
                          }
                          .ops-summary-box {
                            background: #f8fafc;
                            border: 1px solid #e2e8f0;
                            border-radius: 8px;
                            padding: 12px 14px;
                            margin-bottom: 16px;
                            display: grid;
                            grid-template-columns: repeat(4, 1fr);
                            gap: 12px;
                          }
                          .ops-summary-box-3 {
                            grid-template-columns: repeat(3, 1fr);
                          }
                          .ops-item {
                            display: flex;
                            flex-direction: column;
                          }
                          .ops-item .title {
                            font-size: 10px;
                            color: #64748b;
                            text-transform: uppercase;
                            font-weight: 600;
                          }
                          .ops-item .num {
                            font-size: 16px;
                            font-weight: 800;
                            color: #0f172a;
                            margin-top: 2px;
                          }
                          .footer-info {
                            margin-top: 24px;
                            border-top: 1px solid #e2e8f0;
                            padding-top: 10px;
                            display: flex;
                            justify-content: space-between;
                            font-size: 10px;
                            color: #94a3b8;
                          }
                        </style>
                      </head>
                      <body>
                        <div class="header-bar">
                          <div class="brand-title">
                            <h1>GRÊMIO NÁUTICO UNIÃO — TECNOLOGIA DA INFORMAÇÃO</h1>
                            <p>Relatório Gerencial de Desempenho, Atendimentos e Montagens (GLPI)</p>
                          </div>
                          <div class="period-badge">
                            ${periodoStr}
                          </div>
                        </div>

                        <!-- Grid de Destaques Executivos -->
                        <div class="meta-grid" style="grid-template-columns: repeat(2, 1fr);">
                          <div class="meta-card">
                            <div class="val" style="color: #2b8ffb;">${totalFechados}</div>
                            <div class="lbl">Chamados Fechados TI</div>
                          </div>
                          <div class="meta-card">
                            <div class="val-sub" title="${topRequerente ? topRequerente.nome : 'Nenhum'}">
                              ${topRequerente ? topRequerente.nome : 'N/A'}
                            </div>
                            <div class="lbl">Maior Requerente (${topRequerente ? topRequerente.count : 0})</div>
                          </div>
                        </div>

                        <!-- Chamados Abertos e Requerentes -->
                        <div class="section-title" style="margin-top: 24px;">📈 Totais de Chamados Abertos</div>
                        <div class="ops-summary-box ops-summary-box-3">
                          <div class="ops-item">
                            <span class="title">Total Mensal</span>
                            <span class="num" style="color: #f97316;">${totalAbertosMes}</span>
                          </div>
                          <div class="ops-item">
                            <span class="title">Total Anual</span>
                            <span class="num" style="color: #f97316;">${totalAbertosAno}</span>
                          </div>
                          <div class="ops-item">
                            <span class="title">Total Geral</span>
                            <span class="num" style="color: #f97316;">${totalAbertosGeral}</span>
                          </div>
                        </div>

                        <div class="section-title">📝 Quantidade de chamados por requerente</div>
                        <table>
                          <thead>
                            <tr>
                              <th style="width: 35px; text-align: center;">#</th>
                              <th>Requerente / Setor</th>
                              <th style="text-align: right;">Qtd. Abertos (Mês)</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${requerentesAbertosMes.length === 0 ? '<tr><td colspan="3" style="text-align:center; color:#94a3b8;">Nenhum chamado aberto neste mês</td></tr>' :
                        requerentesAbertosMes.map((p: any, i: number) => `
                                <tr>
                                  <td style="text-align: center;"><span class="pos-badge ${i < 3 ? `pos-${i + 1}` : ''}">${i + 1}</span></td>
                                  <td><strong>${p.nome}</strong></td>
                                  <td style="text-align: right; font-weight: 700; color: #f97316;">${p.count}</td>
                                </tr>
                              `).join('')
                      }
                          </tbody>
                        </table>
                        
                        <div class="footer-info">
                          <span>Painel de Gerenciamento da TI — Grêmio Náutico União</span>
                          <span>Data de Emissão: ${dataEmissao}</span>
                        </div>

                        <script>
                          window.onload = function() {
                            setTimeout(function() {
                              window.print();
                            }, 400);
                          };
                        </script>
                      </body>
                      </html>
                    `;

                    printWindow.document.open();
                    printWindow.document.write(htmlContent);
                    printWindow.document.close();
                    setModalReportAberto(false);
                  } catch (err) {
                    console.error("Erro ao gerar relatório PDF:", err);
                    alert("Erro ao conectar ao servidor para gerar relatório.");
                  } finally {
                    setGerandoPdf(false);
                  }
                }}
              >
                {gerandoPdf ? "Buscando dados..." : "🚀 Gerar e Baixar PDF"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes do Técnico (Ranking TI) */}
      {modalDetalhesAberto && tecnicoDetalhes && (
        <div
          className="db-modal-overlay"
          onMouseDown={() => (overlayMouseDownRef.current = true)}
          onClick={(e) => {
            if (e.target === e.currentTarget && overlayMouseDownRef.current) {
              setModalDetalhesAberto(false);
            }
            overlayMouseDownRef.current = false;
          }}
        >
          <div className="db-modal-content db-modal-detalhes" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="db-modal-header">
              <div className="db-modal-detalhes-user">
                <div className="db-ranking-avatar db-avatar-lg">{tecnicoDetalhes.avatar}</div>
                <div>
                  <h3 className="db-modal-detalhes-title">{tecnicoDetalhes.nome}</h3>
                  <p className="db-modal-detalhes-sub">Detalhamento de Chamados Concluídos por Mês</p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div className="db-year-select-wrap">
                  <label htmlFor="select-ano-detalhes">Ano:</label>
                  <select
                    id="select-ano-detalhes"
                    className="db-select-ano"
                    value={anoDetalhes}
                    onChange={(e) => alterarAnoDetalhes(Number(e.target.value))}
                  >
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="db-modal-close"
                  onClick={() => setModalDetalhesAberto(false)}
                  title="Fechar"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="db-modal-body db-modal-detalhes-body">
              {carregandoDetalhes ? (
                <div className="db-widget-loading" style={{ padding: "3rem 0" }}>
                  <span>Buscando chamados do técnico em {anoDetalhes}...</span>
                  <div className="db-loading-bar-wrap" style={{ width: "220px", marginTop: "1rem" }}>
                    <div className="db-loading-bar-fill" />
                  </div>
                </div>
              ) : (
                <>
                  {/* Cards de Métricas do Técnico */}
                  {dadosDetalhes && (
                    <div className="db-detalhes-metrics">
                      <div className="db-metric-card">
                        <span className="db-metric-val" style={{ color: "#10b981" }}>
                          {dadosDetalhes.totalAno}
                        </span>
                        <span className="db-metric-lbl">Total Fechados em {anoDetalhes}</span>
                      </div>
                      <div className="db-metric-card">
                        <span className="db-metric-val" style={{ color: "#2b8ffb" }}>
                          {(dadosDetalhes.totalAno / 12).toFixed(1)}
                        </span>
                        <span className="db-metric-lbl">Média Mensal</span>
                      </div>
                      <div className="db-metric-card">
                        <span className="db-metric-val" style={{ color: "#a855f7" }}>
                          {(() => {
                            const maxMes = [...dadosDetalhes.meses].sort((a, b) => b.total - a.total)[0];
                            return maxMes && maxMes.total > 0 ? `${maxMes.nomeMes} (${maxMes.total})` : "N/A";
                          })()}
                        </span>
                        <span className="db-metric-lbl">Mês Destaque</span>
                      </div>
                    </div>
                  )}

                  {/* Campo de Busca nos Chamados */}
                  <div className="db-detalhes-search-wrap">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.35-4.35" />
                    </svg>
                    <input
                      type="text"
                      className="db-detalhes-search-input"
                      placeholder="Buscar por ID, título ou requerente..."
                      value={buscaChamadosDetalhes}
                      onChange={(e) => setBuscaChamadosDetalhes(e.target.value)}
                    />
                    {buscaChamadosDetalhes && (
                      <button
                        type="button"
                        className="db-detalhes-search-clear"
                        onClick={() => setBuscaChamadosDetalhes("")}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Grade de Meses (Janeiro a Dezembro) */}
                  <div className="db-detalhes-months-grid">
                    {dadosDetalhes?.meses.map((m) => {
                      const maxTotalMes = Math.max(1, ...(dadosDetalhes?.meses.map((x) => x.total) || [0]));
                      const pctBar = Math.min(100, Math.round((m.total / maxTotalMes) * 100));

                      const chamadosFiltrados = m.chamados.filter((c) => {
                        if (!buscaChamadosDetalhes) return true;
                        const q = buscaChamadosDetalhes.toLowerCase().trim();
                        return (
                          c.id.toLowerCase().includes(q) ||
                          c.titulo.toLowerCase().includes(q) ||
                          c.requerente.toLowerCase().includes(q)
                        );
                      });

                      const isExpanded = buscaChamadosDetalhes.trim() !== "" ? chamadosFiltrados.length > 0 : mesExpandido === m.mes;

                      return (
                        <div key={m.mes} className={`db-month-card ${isExpanded ? "open" : ""}`}>
                          <div
                            className="db-month-header"
                            onClick={() => setMesExpandido(mesExpandido === m.mes ? null : m.mes)}
                          >
                            <div className="db-month-title-wrap">
                              <span className="db-month-name">{m.nomeMes}</span>
                              <span className={`db-month-badge ${m.total > 0 ? "has-items" : ""}`}>
                                {m.total} {m.total === 1 ? "chamado" : "chamados"}
                              </span>
                            </div>

                            <div className="db-month-header-right">
                              <div className="db-month-progress-bg" title={`${pctBar}% do pico mensal`}>
                                <div
                                  className="db-month-progress-fill"
                                  style={{ width: `${pctBar}%` }}
                                />
                              </div>
                              <span className="db-month-toggle-icon">
                                {isExpanded ? "▲" : "▼"}
                              </span>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="db-month-content">
                              {chamadosFiltrados.length === 0 ? (
                                <p className="db-month-empty">
                                  {m.total === 0
                                    ? "Nenhum chamado concluído neste mês."
                                    : "Nenhum chamado encontrado com a busca."}
                                </p>
                              ) : (
                                <div className="db-tickets-table-wrap">
                                  <table className="db-tickets-table">
                                    <thead>
                                      <tr>
                                        <th style={{ width: "90px" }}>Chamado</th>
                                        <th>Descrição</th>
                                        <th>Requerente</th>
                                        <th style={{ width: "140px", textAlign: "right" }}>Concluído em</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {chamadosFiltrados.map((c) => (
                                        <tr key={c.id}>
                                          <td>
                                            <span className="db-ticket-id">#{c.id}</span>
                                          </td>
                                          <td>
                                            <span className="db-ticket-title">{c.titulo}</span>
                                          </td>
                                          <td>
                                            <span className="db-ticket-req">{c.requerente}</span>
                                          </td>
                                          <td style={{ textAlign: "right" }}>
                                            <span className="db-ticket-date">{c.dataFechamento || "-"}</span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal para Adicionar Pessoa ao Ranking */}
      {modalAddPessoaAberto && (
        <div
          className="db-modal-overlay"
          onMouseDown={() => (overlayMouseDownRef.current = true)}
          onClick={(e) => {
            if (e.target === e.currentTarget && overlayMouseDownRef.current) {
              setModalAddPessoaAberto(false);
            }
            overlayMouseDownRef.current = false;
          }}
        >
          <div className="db-modal-content db-modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="db-modal-header">
              <h3>
                Adicionar {tipoPessoaAdd === "tecnico" ? "Técnico (TI)" : "Requerente (Qualquer Setor)"}
              </h3>
              <button
                type="button"
                className="db-modal-close"
                onClick={() => setModalAddPessoaAberto(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={adicionarPessoaManualmente} className="db-modal-body" style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "1.25rem" }}>
              <div className="db-form-group" style={{ position: "relative" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.3rem", display: "block" }}>
                  Buscar Usuário no GLPI:
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    placeholder="Digite o nome da pessoa (ex: Guilherme, Carlos)..."
                    value={usuarioGlpiSelecionado ? usuarioGlpiSelecionado.nome : buscaGlpiQuery || nomeAddPessoa}
                    onChange={(e) => {
                      setUsuarioGlpiSelecionado(null);
                      setBuscaGlpiQuery(e.target.value);
                      setNomeAddPessoa(e.target.value);
                    }}
                    className="db-detalhes-search-input"
                    style={{ paddingLeft: "0.85rem", width: "100%" }}
                  />
                  {carregandoBuscaGlpi && (
                    <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      Buscando...
                    </span>
                  )}
                </div>

                {/* Dropdown de sugestões do GLPI */}
                {resultadosBuscaGlpi.length > 0 && !usuarioGlpiSelecionado && (
                  <div className="db-autocomplete-dropdown">
                    {resultadosBuscaGlpi.map((u) => (
                      <div
                        key={u.glpiId}
                        className="db-autocomplete-item"
                        onClick={() => selecionarUsuarioGlpi(u)}
                      >
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span className="db-autocomplete-name">{u.nome}</span>
                          <span className="db-autocomplete-sub">
                            {u.chamados} chamados fechados ({u.fechadosMes} este mês / {u.fechadosAno} este ano)
                          </span>
                        </div>
                        <span className="db-autocomplete-badge">Selecionar</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {usuarioGlpiSelecionado && (
                <div className="db-glpi-user-badge-selected">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div>
                    <strong>{usuarioGlpiSelecionado.nome}</strong>
                    <span>
                      {usuarioGlpiSelecionado.chamados} chamados fechados no total ({usuarioGlpiSelecionado.fechadosMes} no mês, {usuarioGlpiSelecionado.fechadosAno} no ano)
                    </span>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  className="db-report-cancel-btn"
                  onClick={() => {
                    setModalAddPessoaAberto(false);
                    setUsuarioGlpiSelecionado(null);
                    setBuscaGlpiQuery("");
                  }}
                >
                  Cancelar
                </button>
                <button type="submit" className="db-report-submit-btn" disabled={!nomeAddPessoa.trim()}>
                  Adicionar ao Ranking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Gerenciar Pessoas Ocultadas */}
      {modalGerenciarOcultosAberto && (
        <div
          className="db-modal-overlay"
          onMouseDown={() => (overlayMouseDownRef.current = true)}
          onClick={(e) => {
            if (e.target === e.currentTarget && overlayMouseDownRef.current) {
              setModalGerenciarOcultosAberto(false);
            }
            overlayMouseDownRef.current = false;
          }}
        >
          <div className="db-modal-content db-modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="db-modal-header">
              <h3>Pessoas Ocultadas do Ranking</h3>
              <button
                type="button"
                className="db-modal-close"
                onClick={() => setModalGerenciarOcultosAberto(false)}
              >
                ✕
              </button>
            </div>
            <div className="db-modal-body" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {excluidosRanking.length === 0 ? (
                <p style={{ margin: 0, color: "var(--text-muted)", fontStyle: "italic", fontSize: "0.88rem" }}>
                  Nenhuma pessoa foi removida do ranking.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "300px", overflowY: "auto" }}>
                  {excluidosRanking.map((item) => (
                    <div
                      key={item}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: "var(--surface-2)",
                        padding: "0.6rem 0.85rem",
                        borderRadius: "8px",
                        border: "1px solid var(--border)"
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--text-strong)" }}>
                        {item.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <button
                          type="button"
                          className="db-btn-detalhes-ranking"
                          onClick={() => restaurarDoRanking(item)}
                          title="Restaurar no ranking"
                        >
                          Restaurar
                        </button>
                        <div style={{ position: "relative" }}>
                          <button
                            type="button"
                            className={`db-btn-ranking-menu ${activeRankingMenuId === `oculto-${item}` ? "active" : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveRankingMenuId(activeRankingMenuId === `oculto-${item}` ? null : `oculto-${item}`);
                            }}
                            title="Opções"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                              <circle cx="12" cy="5" r="2" />
                              <circle cx="12" cy="12" r="2" />
                              <circle cx="12" cy="19" r="2" />
                            </svg>
                          </button>
                          {activeRankingMenuId === `oculto-${item}` && (
                            <div className="db-ranking-popover" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                className="db-ranking-popover-item db-popover-danger"
                                onClick={() => {
                                  removerPermanentemente(item);
                                  setActiveRankingMenuId(null);
                                }}
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                                  <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                Remover
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem", paddingTop: "0.5rem", borderTop: "1px solid var(--border)" }}>
                {excluidosRanking.length > 0 && (
                  <button
                    type="button"
                    className="db-report-cancel-btn"
                    onClick={() => salvarExcluidos([])}
                    style={{ color: "#ef4444" }}
                  >
                    Restaurar Todos
                  </button>
                )}
                <button
                  type="button"
                  className="db-report-submit-btn"
                  onClick={() => setModalGerenciarOcultosAberto(false)}
                >
                  Concluído
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
