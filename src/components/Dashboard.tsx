import { useState, useEffect, useRef } from "react";
import {
  reconcileEventosAutomaticos,
  getHistorico,
  getGlpiDashboard,
  getGlpiDashboardCache,
  getGlpiDashboardLastSync,
  getGlpiTecnicoDetalhes,
  buscarGlpiUsuarios,
  getToken,
  TecnicoDetalhesResponse,
  GlpiUsuarioBusca,
  ChamadoAntigo
} from "../utils/storage";
import { tocarSomNovoChamado } from "../utils/audioNotification";

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
  fechadosGeral?: number;
  fechadosAno?: number;
  fechadosMes?: number;
  solucionadosGeral?: number;
  solucionadosAno?: number;
  solucionadosMes?: number;
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

const formatNomeComInicial = (nomeCompleto: string) => {
  if (!nomeCompleto) return "";
  const partes = nomeCompleto.trim().split(/\s+/);
  if (partes.length === 1) return partes[0];
  let idx = 1;
  const preps = ["de", "da", "do", "dos", "das"];
  if (preps.includes(partes[idx].toLowerCase()) && partes.length > 2) {
    idx = 2;
  }
  return `${partes[0]} ${partes[idx][0].toUpperCase()}.`;
};

const renderTrofeuIcon = (idx: number) => {
  const cores = [
    "#fbbf24", // Ouro
    "#cbd5e1", // Prata
    "#d97706", // Bronze
  ];
  const color = cores[idx] || "#94a3b8";

  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill={color}
      style={{ flexShrink: 0 }}
    >
      <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V18H8v2h8v-2h-3v-2.1c2.08-.43 3.69-2.07 3.97-4.16C19.33 11.45 21 9.4 21 7V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
    </svg>
  );
};



const getMesAnoAberturaTag = (item: { mesAnoAbertura?: string; dataAbertura?: string }) => {
  if (item.mesAnoAbertura) return item.mesAnoAbertura;
  if (!item.dataAbertura) return null;
  const clean = item.dataAbertura.trim().split(" ")[0].split("T")[0];
  let year: string | undefined, month: number | undefined;
  if (clean.includes("-")) {
    const parts = clean.split("-");
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        year = parts[0];
        month = parseInt(parts[1], 10);
      } else if (parts[2].length === 4) {
        year = parts[2];
        month = parseInt(parts[1], 10);
      }
    }
  } else if (clean.includes("/")) {
    const parts = clean.split("/");
    if (parts.length === 3) {
      if (parts[2].length === 4) {
        year = parts[2];
        month = parseInt(parts[1], 10);
      } else if (parts[0].length === 4) {
        year = parts[0];
        month = parseInt(parts[1], 10);
      }
    }
  }
  if (year && month && month >= 1 && month <= 12) {
    const shortMonths = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${shortMonths[month - 1]}/${year}`;
  }
  return null;
};

const isMesIgual = (
  item: { mesAnoAbertura?: string; dataAbertura?: string; criadoOutroMes?: boolean },
  targetMes: number,
  targetAno: number
): boolean => {
  if (typeof item.criadoOutroMes === "boolean") {
    return !item.criadoOutroMes;
  }
  const dateStr = item.dataAbertura || "";
  if (!dateStr) return true;
  const clean = dateStr.trim().split(" ")[0].split("T")[0];
  let year: number | undefined, month: number | undefined;
  if (clean.includes("-")) {
    const parts = clean.split("-");
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
      } else if (parts[2].length === 4) {
        year = parseInt(parts[2], 10);
        month = parseInt(parts[1], 10);
      }
    }
  } else if (clean.includes("/")) {
    const parts = clean.split("/");
    if (parts.length === 3) {
      if (parts[2].length === 4) {
        year = parseInt(parts[2], 10);
        month = parseInt(parts[1], 10);
      } else if (parts[0].length === 4) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
      }
    }
  }
  if (year && month) {
    return year === targetAno && month === targetMes;
  }
  return true;
};

export default function Dashboard() {
  const [currentTime, setCurrentTime] = useState<string>("");

  // Cache inicial do localStorage (0ms load time)
  const cacheInicial = getGlpiDashboardCache();

  // Estados do GLPI
  const [kpis, setKpis] = useState<any>(
    cacheInicial?.kpis || {
      novos: 0,
      atribuidos: 0,
      pendentes: 0,
      planejados: 0,
      solucionados: 0,
      fechados: 0,
    }
  );
  const [tecnicos, setTecnicos] = useState<Tecnico[]>(cacheInicial?.tecnicos || []);
  const [totalComputadores, setTotalComputadores] = useState<number>(cacheInicial?.totalComputadores || 0);
  const [totalImpressoras, setTotalImpressoras] = useState<number>(cacheInicial?.totalImpressoras || 0);
  const [totalTotens, setTotalTotens] = useState<number>(() => {
    const saved = localStorage.getItem("painel_total_totens");
    return saved !== null ? parseInt(saved, 10) || 0 : 0;
  });
  const [editandoTotens, setEditandoTotens] = useState<boolean>(false);
  const [inputTotens, setInputTotens] = useState<string>("");

  const salvarTotens = () => {
    const parsed = parseInt(inputTotens, 10);
    const val = isNaN(parsed) ? 0 : Math.max(0, parsed);
    setTotalTotens(val);
    localStorage.setItem("painel_total_totens", String(val));
    setEditandoTotens(false);
  };
  const [chamadosAntigos, setChamadosAntigos] = useState<ChamadoAntigo[]>(cacheInicial?.chamadosAntigos || []);
  const [modalChamadosAntigosAberto, setModalChamadosAntigosAberto] = useState<boolean>(false);
  const [abaModalAntigos, setAbaModalAntigos] = useState<"interacao_30" | "todos">("interacao_30");
  const [filtroModalAntigos, setFiltroModalAntigos] = useState<string>("");
  const [filtroRankingMode, setFiltroRankingMode] = useState<"especifico" | "geral">("especifico");
  const [mesRanking, setMesRanking] = useState<number>(new Date().getMonth() + 1);
  const [anoRanking, setAnoRanking] = useState<number>(new Date().getFullYear());
  const [dadosRankingCustom, setDadosRankingCustom] = useState<Record<string, { count: number; fechados: number; solucionados: number }> | null>(null);

  const [carregandoGlpi, setCarregandoGlpi] = useState<boolean>(!cacheInicial);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => {
    const raw = getGlpiDashboardLastSync();
    if (!raw) return null;
    try {
      const d = new Date(raw);
      return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return null;
    }
  });
  const [progressoGlpi, setProgressoGlpi] = useState<number>(0);

  const [carregandoRanking, setCarregandoRanking] = useState<boolean>(false);
  const [progressoRanking, setProgressoRanking] = useState<number>(0);

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
  const [rankingDetalhesAbertoId, setRankingDetalhesAbertoId] = useState<string | null>(null);
  const [filtroDetalhesStatus, setFiltroDetalhesStatus] = useState<string>("todos");
  const [filtroDetalhesTecnico, setFiltroDetalhesTecnico] = useState<string>("todos");
  const [filtroDetalhesMes, setFiltroDetalhesMes] = useState<string>("todos");

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
    if (rankingDetalhesAbertoId === tech.id) {
      setRankingDetalhesAbertoId(null);
      return;
    }
    setTecnicoDetalhes(tech);
    setBuscaChamadosDetalhes("");
    setFiltroDetalhesStatus("todos");
    setFiltroDetalhesTecnico("todos");
    setFiltroDetalhesMes("todos");
    setDadosDetalhes(null);
    setRankingDetalhesAbertoId(tech.id);
    setModalDetalhesAberto(false);
    carregarDetalhesTecnico(tech, anoDetalhes);
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

  // Ref para monitorar aumento de chamados novos e disparar sinal sonoro
  const prevNovosRef = useRef<number | null>(null);

  // Função reutilizável para buscar/atualizar dados do GLPI
  const carregarGlpi = async (force: boolean = false) => {
    setIsSyncing(true);
    let progressTimer: any;
    setProgressoGlpi(15);
    progressTimer = setInterval(() => {
      setProgressoGlpi((p) => (p < 90 ? Math.min(90, p + Math.floor(Math.random() * 10 + 5)) : p));
    }, 250);

    try {
      const data = await getGlpiDashboard(force);
      if (data.kpis) {
        setKpis(data.kpis);
        if (typeof data.kpis.novos === "number") {
          if (prevNovosRef.current !== null && data.kpis.novos > prevNovosRef.current) {
            const somAtivo = localStorage.getItem("som_novos_chamados_ativo") === "true";
            if (somAtivo) {
              tocarSomNovoChamado();
            }
          }
          prevNovosRef.current = data.kpis.novos;
        }
      }
      if (data.tecnicos && data.tecnicos.length > 0) setTecnicos(data.tecnicos);
      if (typeof data.totalComputadores === "number") setTotalComputadores(data.totalComputadores);
      if (typeof data.totalImpressoras === "number") setTotalImpressoras(data.totalImpressoras);
      if (data.chamadosAntigos && Array.isArray(data.chamadosAntigos)) setChamadosAntigos(data.chamadosAntigos);
      
      const agora = new Date();
      setLastSyncTime(agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
      setProgressoGlpi(100);
      setTimeout(() => setCarregandoGlpi(false), 300);
    } catch (error) {
      console.error("Erro ao carregar dados do GLPI:", error);
      setProgressoGlpi(100);
      setTimeout(() => setCarregandoGlpi(false), 300);
    } finally {
      clearInterval(progressTimer);
      setIsSyncing(false);
    }
  };

  // Efeito para carregar dados da API do GLPI
  useEffect(() => {
    carregarGlpi(false);
    const interval = setInterval(() => carregarGlpi(false), 60000); // Atualiza a cada 1 minuto
    return () => {
      clearInterval(interval);
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
          const map: Record<string, { count: number; fechados: number; solucionados: number }> = {};
          data.tecnicos.forEach((t: any) => {
            if (t.nome) {
              map[t.nome.toLowerCase().trim()] = {
                count: t.count || 0,
                fechados: t.fechados ?? t.count ?? 0,
                solucionados: t.solucionados ?? 0
              };
            }
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




  const chamadosFechadosMesTI = Math.max(0, kpis.fechadosMes || 0);
  const chamadosSolucionadosMesTI = Math.max(0, kpis.solucionadosMes || 0);
  const totalChamadosMesTI = chamadosFechadosMesTI + chamadosSolucionadosMesTI;
  const nomeMesAtual = new Date().toLocaleDateString("pt-BR", { month: "long" });
  const nomeMesCapitalizado = nomeMesAtual.charAt(0).toUpperCase() + nomeMesAtual.slice(1);



  // Usa as estatísticas globais do ano (ou geral se o usuário não quiser filtrar por ano, mas as variáveis do backend são fechados/solucionados)
  const totalFechadosAnoTI = Math.max(0, kpis.fechados ?? kpis.fechadosAno ?? 0);
  const totalSolucionadosAnoTI = Math.max(0, kpis.solucionados ?? kpis.solucionadosAno ?? 0);
  const totalChamadosAnoTI = totalFechadosAnoTI + totalSolucionadosAnoTI;

  // Lista de Técnicos do Ranking TI (ordenados conforme o filtro ativo do Ranking TI)
  const rankingTITecnicos = [...tecnicosExibidos]
    .map((tech) => {
      let val = 0;
      let fechadosVal = 0;
      let solucionadosVal = 0;

      if (filtroRankingMode === "geral") {
        val = tech.resolvidos;
        fechadosVal = tech.fechadosGeral ?? tech.resolvidos;
        solucionadosVal = tech.solucionadosGeral ?? 0;
      } else if (dadosRankingCustom) {
        const customData = dadosRankingCustom[tech.nome.toLowerCase().trim()];
        val = customData ? customData.count : 0;
        fechadosVal = customData ? customData.fechados : 0;
        solucionadosVal = customData ? customData.solucionados : 0;
      } else {
        val = tech.resolvidosMes ?? 0;
        fechadosVal = tech.fechadosMes ?? tech.resolvidosMes ?? 0;
        solucionadosVal = tech.solucionadosMes ?? 0;
      }
      return { ...tech, val, fechadosVal, solucionadosVal };
    })
    .sort((a, b) => b.val - a.val);

  // Top 3 Técnicos de TI (Puxado diretamente do Ranking TI)
  const top3Tecnicos = rankingTITecnicos.slice(0, 3);

  // Top 3 Integrantes da TI que mais resolveram chamados no ano
  const top3TecnicosAno = [...tecnicosExibidos]
    .map((tech) => {
      const valAno = tech.resolvidosAno ?? (
        tech.fechadosAno != null || tech.solucionadosAno != null
          ? (tech.fechadosAno || 0) + (tech.solucionadosAno || 0)
          : (tech.resolvidos ?? 0)
      );
      return { ...tech, valAno };
    })
    .sort((a, b) => b.valAno - a.valAno)
    .slice(0, 3);

  const totalSemSolucaoTI = Math.max(0, (kpis.novos || 0) + (kpis.atribuidos || 0) + (kpis.pendentes || 0));

  // Chamados sem interação há 30 dias ou mais (1 mês ou mais)
  const chamadosSemInteracao30Dias = chamadosAntigos.filter(
    (c) => c.diasSemInteracao >= 30 || c.diasAberto >= 30
  );

  const chamadoPiorInteracao = chamadosSemInteracao30Dias.length > 0
    ? [...chamadosSemInteracao30Dias].sort((a, b) => b.diasSemInteracao - a.diasSemInteracao)[0]
    : chamadosAntigos.length > 0
      ? [...chamadosAntigos].sort((a, b) => b.diasSemInteracao - a.diasSemInteracao)[0]
      : null;

  const listaAntigosBase = abaModalAntigos === "interacao_30" ? chamadosSemInteracao30Dias : chamadosAntigos;

  const listaAntigosOrdenada = [...listaAntigosBase].sort((a, b) => b.diasSemInteracao - a.diasSemInteracao);

  const listaAntigosFiltrada = listaAntigosOrdenada.filter((item) => {
    if (!filtroModalAntigos.trim()) return true;
    const query = filtroModalAntigos.toLowerCase();
    return (
      item.id.toLowerCase().includes(query) ||
      item.titulo.toLowerCase().includes(query) ||
      item.requerente.toLowerCase().includes(query) ||
      item.tecnico.toLowerCase().includes(query) ||
      item.status.toLowerCase().includes(query)
    );
  });

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
          <button
            type="button"
            className="db-btn-refresh"
            onClick={() => carregarGlpi(true)}
            disabled={isSyncing}
            title="Forçar sincronização manual com o GLPI"
            style={{
              background: "rgba(15, 23, 42, 0.6)",
              border: "1px solid rgba(148, 163, 184, 0.25)",
              color: "#f1f5f9",
              borderRadius: "4px",
              padding: "0.45rem 0.75rem",
              cursor: isSyncing ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              fontSize: "0.8rem",
              fontWeight: 600,
              transition: "all 0.15s ease"
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              width="14"
              height="14"
              style={{
                transform: isSyncing ? "rotate(360deg)" : "none",
                transition: isSyncing ? "transform 1s linear infinite" : "none"
              }}
            >
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {isSyncing ? "Sincronizando..." : "Recarregar"}
          </button>
          <div className="db-update-badge">
            <span className="db-pulse-dot" style={{ backgroundColor: isSyncing ? "#eab308" : "#10b981" }}></span>
            <span>
              {isSyncing
                ? "Sincronizando com GLPI..."
                : lastSyncTime
                ? `Atualizado às ${lastSyncTime} • Em cache`
                : `Atualizando ao vivo • ${currentTime}`}
            </span>
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

        {/* Totens */}
        <div className="db-card kpi-totens" style={getCardStyle("totens")}>
          <button
            type="button"
            className="db-card-edit-btn"
            title="Editar quantidade de Totens"
            onClick={() => {
              setInputTotens(String(totalTotens));
              setEditandoTotens(true);
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
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
            {editandoTotens ? (
              <div className="toten-edit-container">
                <input
                  type="number"
                  min="0"
                  autoFocus
                  value={inputTotens}
                  onChange={(e) => setInputTotens(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") salvarTotens();
                    if (e.key === "Escape") setEditandoTotens(false);
                  }}
                  className="toten-input-edit"
                />
                <button
                  type="button"
                  onClick={salvarTotens}
                  className="toten-btn-save"
                  title="Salvar"
                >
                  ✓
                </button>
              </div>
            ) : (
              <h3 className="db-card-value">{totalTotens}</h3>
            )}
            <p className="db-card-title">Totens</p>
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

      {/* Seção de Informações Importantes da TI */}
      <div className="db-chart-section premium-dashboard-section">
        {/* Informações da TI Redesenhadas em Grid Responsivo */}
        <div className="premium-kpi-grid">
          <div className="premium-kpi-card glass-blue">
            <div className="kpi-content">
              <span className="kpi-label">Total Chamados TI</span>
              <span className="kpi-value" style={{ margin: '6px 0' }}>
                {carregandoGlpi ? "..." : totalChamadosAnoTI} <small>atendimentos</small>
              </span>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                <span className="kpi-pill kpi-pill-green">Fechados: {totalFechadosAnoTI}</span>
                <span className="kpi-pill kpi-pill-cyan">Solucionados: {totalSolucionadosAnoTI}</span>
              </div>
            </div>
          </div>

          <div className="premium-kpi-card glass-orange">
            <div className="kpi-content">
              <span className="kpi-label">Chamados no Mês Atual</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                {top3Tecnicos.length > 0 ? top3Tecnicos.map((t, idx) => (
                  <div key={idx} className="top3-row">
                    <div className="top3-left">
                      {renderTrofeuIcon(idx)}
                      <span>{formatNomeComInicial(t.nome)}</span>
                    </div>
                    <span className="top3-val-badge">{t.val || 0}</span>
                  </div>
                )) : <span className="kpi-value">Nenhum</span>}
              </div>
            </div>
          </div>

          <div className="premium-kpi-card glass-amber">
            <div className="kpi-content">
              <span className="kpi-label">Chamados no Ano</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                {top3TecnicosAno.length > 0 ? top3TecnicosAno.map((t, idx) => (
                  <div key={idx} className="top3-row">
                    <div className="top3-left">
                      {renderTrofeuIcon(idx)}
                      <span>{formatNomeComInicial(t.nome)}</span>
                    </div>
                    <span className="top3-val-badge">{t.valAno || 0}</span>
                  </div>
                )) : <span className="kpi-value">Nenhum</span>}
              </div>
            </div>
          </div>

          <div className="premium-kpi-card glass-purple">
            <div className="kpi-content">
              <span className="kpi-label" style={{ textAlign: 'center' }}>Chamados Concluídos ({nomeMesCapitalizado})</span>
              <span className="kpi-value" style={{ margin: '6px 0', fontSize: '2rem', display: 'flex', justifyContent: 'center', color: '#34d399' }}>
                {carregandoGlpi ? "..." : totalChamadosMesTI}
              </span>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <span className="kpi-pill kpi-pill-green">Fechados: {chamadosFechadosMesTI}</span>
                <span className="kpi-pill kpi-pill-cyan">Solucionados: {chamadosSolucionadosMesTI}</span>
              </div>
            </div>
          </div>

          <div
            className="premium-kpi-card glass-green clickable-kpi-card"
            onClick={() => setModalChamadosAntigosAberto(true)}
            title="Clique para ver os chamados sem interação há 1 mês ou mais (30+ dias)"
            style={{ cursor: "pointer" }}
          >
            <div className="kpi-content">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="kpi-label" style={{ marginBottom: 0 }}>Sem Interação (+30d)</span>
                <span style={{ fontSize: '0.72rem', background: 'rgba(52, 211, 153, 0.15)', border: '1px solid rgba(52, 211, 153, 0.3)', padding: '2px 8px', borderRadius: '2px', color: '#34d399', fontWeight: 700 }}>
                  Ver lista ↗
                </span>
              </div>
              <span className="kpi-value" style={{ margin: '6px 0', justifyContent: 'center' }}>
                {carregandoGlpi ? "..." : chamadosSemInteracao30Dias.length} <small>chamados</small>
              </span>
              {chamadoPiorInteracao ? (
                <div style={{ fontSize: '0.78rem', color: '#fca5a5', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '3px 8px', borderRadius: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ fontWeight: 700, color: '#ef4444' }}>#{chamadoPiorInteracao.id}</span> • {chamadoPiorInteracao.diasSemInteracao}d s/ atualização
                </div>
              ) : (
                <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  Nenhum chamado há +30d s/ resposta
                </div>
              )}
            </div>
          </div>

          <div className="premium-kpi-card glass-yellow">
            <div className="kpi-content">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="kpi-label" style={{ marginBottom: 0 }}>Fila Ativa da TI</span>
              </div>
              <span className="kpi-value" style={{ margin: '6px 0', justifyContent: 'center' }}>
                {totalSemSolucaoTI}
              </span>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', textAlign: 'center' }}>
                Atendimentos em processamento no GLPI
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Seção Inferior: Widgets de Consulta */}
      <div className="db-lower-section">
        {/* Widget 1: Ranking de Produtividade dos Técnicos */}
        <div className="db-tech-widget">
          <div className="db-widget-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <div className="db-widget-title-group">
              <h3>Chamados TI</h3>
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
              {rankingTITecnicos.map((tech, index) => {
                const isTop3 = index < 3;
                const medalColor = index === 0 ? "gold" : index === 1 ? "silver" : "bronze";
                const valorExibido = tech.val;
                const siglaMeses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
                const labelExibido =
                  filtroRankingMode === "geral"
                    ? "total"
                    : `${siglaMeses[mesRanking - 1]}/${anoRanking}`;
                const isRankingOpen = rankingDetalhesAbertoId === tech.id;
                const detalhesDoTech = isRankingOpen ? dadosDetalhes : null;
                const chamadosDoTech = detalhesDoTech
                  ? detalhesDoTech.meses.flatMap((mes) =>
                    mes.chamados.map((chamado) => ({ ...chamado, mes: mes.mes, nomeMes: mes.nomeMes }))
                  )
                  : [];
                const statusDisponiveis = Array.from(
                  new Set(chamadosDoTech.map((c) => c.status || "Sem status"))
                ).sort();
                const tecnicosDisponiveis = Array.from(
                  new Set(chamadosDoTech.map((c) => c.tecnico || tech.nome))
                ).sort();
                const mesesDisponiveis = detalhesDoTech
                  ? detalhesDoTech.meses.filter((m) => m.total > 0)
                  : [];
                const chamadosInlineFiltrados = chamadosDoTech
                  .filter((c) => filtroDetalhesStatus === "todos" || (c.status || "Sem status") === filtroDetalhesStatus)
                  .filter((c) => filtroDetalhesTecnico === "todos" || (c.tecnico || tech.nome) === filtroDetalhesTecnico)
                  .filter((c) => filtroDetalhesMes === "todos" || String(c.mes) === filtroDetalhesMes)
                  .filter((c) => {
                    if (!buscaChamadosDetalhes.trim()) return true;
                    const q = buscaChamadosDetalhes.toLowerCase().trim();
                    return (
                      c.id.toLowerCase().includes(q) ||
                      c.titulo.toLowerCase().includes(q) ||
                      c.requerente.toLowerCase().includes(q) ||
                      (c.tecnico || "").toLowerCase().includes(q) ||
                      (c.status || "").toLowerCase().includes(q)
                    );
                  })
                  .sort((a, b) => {
                    const numA = parseInt(a.id.replace(/\D/g, ""), 10) || 0;
                    const numB = parseInt(b.id.replace(/\D/g, ""), 10) || 0;
                    return numB - numA;
                  });
                return (
                  <div key={tech.id} className={`db-ranking-item-block ${isRankingOpen ? "open" : ""}`}>
                    <div
                      className="db-ranking-item db-ranking-item-clickable"
                      onClick={() => abrirModalDetalhes(tech)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          abrirModalDetalhes(tech);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      title={`Ver chamados fechados e solucionados de ${tech.nome}`}
                    >
                      <div className="db-ranking-position-wrap">
                        <span className={`db-ranking-position ${isTop3 ? `medal-${medalColor}` : ""}`}>
                          {index + 1}
                        </span>
                      </div>
                      <div className="db-ranking-avatar">{tech.avatar}</div>
                      <div className="db-ranking-info">
                        <span className="db-ranking-name">{tech.nome}</span>
                        <div className="db-ranking-sub-breakdown" style={{ display: 'flex', gap: '6px', fontSize: '0.78rem', marginTop: '2px', fontWeight: 500 }}>
                          <span style={{ color: '#10b981' }}>Fechados: {tech.fechadosVal}</span>
                          <span style={{ color: '#38bdf8' }}>• Solucionados: {tech.solucionadosVal}</span>
                        </div>
                      </div>
                      <div className="db-ranking-value-wrap">
                        <span className="db-ranking-value">{valorExibido}</span>
                        <span className="db-ranking-label">{labelExibido}</span>
                      </div>
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
                    {isRankingOpen && (
                      <div className="db-ranking-details-panel" onClick={(e) => e.stopPropagation()}>
                        <div className="db-ranking-details-toolbar">
                          <div className="db-ranking-details-summary">
                            <strong>{chamadosInlineFiltrados.length}</strong>
                            <span>
                              {chamadosInlineFiltrados.length === 1 ? "chamado exibido" : "chamados exibidos"}
                            </span>
                          </div>

                          <div className="db-ranking-details-filters">
                            <select
                              className="db-select-filtro"
                              value={filtroDetalhesStatus}
                              onChange={(e) => setFiltroDetalhesStatus(e.target.value)}
                            >
                              <option value="todos">Todos os status</option>
                              {statusDisponiveis.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>

                            <select
                              className="db-select-filtro"
                              value={filtroDetalhesTecnico}
                              onChange={(e) => setFiltroDetalhesTecnico(e.target.value)}
                            >
                              <option value="todos">Resolvidos em equipe</option>
                              {tecnicosDisponiveis.map((tecnico) => (
                                <option key={tecnico} value={tecnico}>
                                  {tecnico}
                                </option>
                              ))}
                            </select>

                            <select
                              className="db-select-filtro"
                              value={filtroDetalhesMes}
                              onChange={(e) => setFiltroDetalhesMes(e.target.value)}
                            >
                              <option value="todos">Todos os meses</option>
                              {mesesDisponiveis.map((mes) => (
                                <option key={mes.mes} value={String(mes.mes)}>
                                  {mes.nomeMes}
                                </option>
                              ))}
                            </select>

                            <select
                              className="db-select-filtro"
                              value={anoDetalhes}
                              onChange={(e) => alterarAnoDetalhes(Number(e.target.value))}
                            >
                              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                                <option key={y} value={y}>
                                  {y}
                                </option>
                              ))}
                            </select>

                            <input
                              type="text"
                              className="db-ranking-details-search"
                              placeholder="Buscar ID, titulo, requerente..."
                              value={buscaChamadosDetalhes}
                              onChange={(e) => setBuscaChamadosDetalhes(e.target.value)}
                            />
                          </div>
                        </div>

                        {carregandoDetalhes ? (
                          <div className="db-ranking-details-loading">Buscando chamados...</div>
                        ) : chamadosInlineFiltrados.length === 0 ? (
                          <div className="db-ranking-details-empty">Nenhum chamado encontrado para os filtros selecionados.</div>
                        ) : (
                          <div className="db-tickets-table-wrap">
                            <table className="db-tickets-table">
                              <thead>
                                <tr>
                                  <th style={{ width: "56px" }}>Nº</th>
                                  <th style={{ width: "96px" }}>ID</th>
                                  <th>Titulo</th>
                                  <th>Requerente</th>
                                  <th>Tecnico</th>
                                  <th style={{ width: "120px" }}>Status</th>
                                  <th style={{ width: "140px", textAlign: "right" }}>Concluido em</th>
                                </tr>
                              </thead>
                              <tbody>
                                {chamadosInlineFiltrados.map((c, chamadoIndex) => (
                                  <tr key={`${c.id}-${chamadoIndex}`}>
                                    <td>
                                      <span className="db-ticket-row-number">{chamadoIndex + 1}</span>
                                    </td>
                                    <td>
                                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "2px" }}>
                                        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                                          {c.url ? (
                                            <a
                                              href={c.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="db-ticket-id"
                                              style={{ textDecoration: "none" }}
                                              title={`Abrir chamado #${c.id} no GLPI`}
                                            >
                                              #{c.id}
                                            </a>
                                          ) : (
                                            <span className="db-ticket-id">#{c.id}</span>
                                          )}
                                        </div>
                                        {filtroDetalhesMes !== "todos" && (() => {
                                          const mesSelecionado = parseInt(filtroDetalhesMes, 10);
                                          const isSame = isMesIgual(c, mesSelecionado, anoDetalhes);
                                          const tag = getMesAnoAberturaTag(c);
                                          return !isSame && tag ? (
                                            <span
                                              className="db-ticket-mes-abertura outro-mes"
                                              title={`Chamado criado em ${c.dataAbertura || tag}`}
                                            >
                                              Aberto em {tag}
                                            </span>
                                          ) : null;
                                        })()}
                                      </div>
                                    </td>
                                    <td>
                                      <span className="db-ticket-title">{c.titulo}</span>
                                    </td>
                                    <td>
                                      <span className="db-ticket-req">{c.requerente}</span>
                                    </td>
                                    <td>
                                      <span className="db-ticket-req">{c.tecnico || tech.nome}</span>
                                    </td>
                                    <td>
                                      <span className={`db-ticket-status ${(c.status || "").toLowerCase()}`}>
                                        {c.status || "-"}
                                      </span>
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
                            <p>Relatório Mensal de Indicadores e Ativos da TI</p>
                          </div>
                          <div class="period-badge">
                            ${periodoStr}
                          </div>
                        </div>

                        <!-- Resumo Geral da TI -->
                        <div class="section-title" style="margin-top: 12px;">📊 Total Chamados TI</div>
                        <div class="meta-grid" style="grid-template-columns: repeat(3, 1fr);">
                          <div class="meta-card">
                            <div class="val">${totalChamadosAnoTI}</div>
                            <div class="lbl">Total de Atendimentos</div>
                          </div>
                          <div class="meta-card">
                            <div class="val">${totalFechadosAnoTI}</div>
                            <div class="lbl">Chamados Fechados</div>
                          </div>
                          <div class="meta-card">
                            <div class="val">${totalSolucionadosAnoTI}</div>
                            <div class="lbl">Chamados Solucionados</div>
                          </div>
                        </div>

                        <!-- Status dos Chamados GLPI -->
                        <div class="section-title">🎫 Status dos Chamados GLPI</div>
                        <div class="meta-grid" style="grid-template-columns: repeat(6, 1fr);">
                          <div class="meta-card">
                            <div class="val">${kpis.novos ?? 0}</div>
                            <div class="lbl">Chamados Novos</div>
                          </div>
                          <div class="meta-card">
                            <div class="val">${kpis.atribuidos ?? 0}</div>
                            <div class="lbl">Atribuídos</div>
                          </div>
                          <div class="meta-card">
                            <div class="val">${kpis.pendentes ?? 0}</div>
                            <div class="lbl">Pendentes</div>
                          </div>
                          <div class="meta-card">
                            <div class="val">${kpis.planejados ?? 0}</div>
                            <div class="lbl">Planejados</div>
                          </div>
                          <div class="meta-card">
                            <div class="val">${kpis.solucionados ?? 0}</div>
                            <div class="lbl">Solucionados</div>
                          </div>
                          <div class="meta-card">
                            <div class="val">${kpis.fechados ?? 0}</div>
                            <div class="lbl">Fechados</div>
                          </div>
                        </div>

                        <!-- Inventário e Ativos -->
                        <div class="section-title">🖥️ Inventário e Ativos</div>
                        <div class="meta-grid" style="grid-template-columns: repeat(3, 1fr);">
                          <div class="meta-card">
                            <div class="val">${totalComputadores}</div>
                            <div class="lbl">Total Computadores</div>
                          </div>
                          <div class="meta-card">
                            <div class="val">${totalImpressoras}</div>
                            <div class="lbl">Total Impressoras</div>
                          </div>
                          <div class="meta-card">
                            <div class="val">${totalTotens}</div>
                            <div class="lbl">Totens</div>
                          </div>
                        </div>

                        <!-- Montagens e Equipamentos -->
                        <div class="section-title">📦 Montagens e Equipamentos</div>
                        <div class="meta-grid" style="grid-template-columns: repeat(3, 1fr);">
                          <div class="meta-card">
                            <div class="val">${montagensPendentes}</div>
                            <div class="lbl">Montagens Pendentes</div>
                          </div>
                          <div class="meta-card">
                            <div class="val">${montagensRealizadas}</div>
                            <div class="lbl">Montagens Realizadas</div>
                          </div>
                          <div class="meta-card">
                            <div class="val">${eqPendentes}</div>
                            <div class="lbl">Eq. Pendente (Hist.)</div>
                          </div>
                        </div>

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
                {gerandoPdf ? "Buscando dados..." : "Gerar relatório"}
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

                      const chamadosFiltrados = m.chamados
                        .filter((c) => {
                          if (!buscaChamadosDetalhes) return true;
                          const q = buscaChamadosDetalhes.toLowerCase().trim();
                          return (
                            c.id.toLowerCase().includes(q) ||
                            c.titulo.toLowerCase().includes(q) ||
                            c.requerente.toLowerCase().includes(q) ||
                            (c.tecnico || "").toLowerCase().includes(q) ||
                            (c.status || "").toLowerCase().includes(q) ||
                            (c.mesAnoAbertura && c.mesAnoAbertura.toLowerCase().includes(q))
                          );
                        })
                        .sort((a, b) => {
                          const isSameA = isMesIgual(a, m.mes, anoDetalhes);
                          const isSameB = isMesIgual(b, m.mes, anoDetalhes);
                          if (isSameA !== isSameB) {
                            return isSameA ? -1 : 1;
                          }
                          const numA = parseInt(a.id.replace(/\D/g, ""), 10) || 0;
                          const numB = parseInt(b.id.replace(/\D/g, ""), 10) || 0;
                          return numB - numA;
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
                                        <th style={{ width: "56px" }}>Nº</th>
                                        <th style={{ width: "96px" }}>ID</th>
                                        <th>Descrição</th>
                                        <th>Requerente</th>
                                        <th>Tecnico</th>
                                        <th style={{ width: "120px" }}>Status</th>
                                        <th style={{ width: "140px", textAlign: "right" }}>Concluído em</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {chamadosFiltrados.map((c, chamadoIndex) => {
                                        const isSame = isMesIgual(c, m.mes, anoDetalhes);
                                        return (
                                          <tr key={c.id}>
                                            <td>
                                              <span className="db-ticket-row-number">{chamadoIndex + 1}</span>
                                            </td>
                                            <td>
                                              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "2px" }}>
                                                <div style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                                                  {c.url ? (
                                                    <a
                                                      href={c.url}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="db-ticket-id"
                                                      style={{ textDecoration: "none" }}
                                                      title={`Abrir chamado #${c.id} no GLPI`}
                                                    >
                                                      #{c.id}
                                                    </a>
                                                  ) : (
                                                    <span className="db-ticket-id">#{c.id}</span>
                                                  )}
                                                  {c.url && (
                                                    <a
                                                      href={c.url}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="db-ticket-external-link"
                                                      title={`Abrir chamado #${c.id} no GLPI`}
                                                    >
                                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                                                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" strokeLinecap="round" strokeLinejoin="round" />
                                                        <polyline points="15 3 21 3 21 9" strokeLinecap="round" strokeLinejoin="round" />
                                                        <line x1="10" y1="14" x2="21" y2="3" strokeLinecap="round" strokeLinejoin="round" />
                                                      </svg>
                                                    </a>
                                                  )}
                                                </div>
                                                {!isSame && getMesAnoAberturaTag(c) && (
                                                  <span
                                                    className="db-ticket-mes-abertura outro-mes"
                                                    title={`Chamado criado em ${c.dataAbertura || getMesAnoAberturaTag(c)}`}
                                                  >
                                                    Aberto em {getMesAnoAberturaTag(c)}
                                                  </span>
                                                )}
                                              </div>
                                            </td>
                                            <td>
                                              <span className="db-ticket-title">{c.titulo}</span>
                                            </td>
                                            <td>
                                              <span className="db-ticket-req">{c.requerente}</span>
                                            </td>
                                            <td>
                                              <span className="db-ticket-req">{c.tecnico || tecnicoDetalhes.nome}</span>
                                            </td>
                                            <td>
                                              <span className={`db-ticket-status ${(c.status || "").toLowerCase()}`}>
                                                {c.status || "-"}
                                              </span>
                                            </td>
                                            <td style={{ textAlign: "right" }}>
                                              <span className="db-ticket-date">{c.dataFechamento || "-"}</span>
                                            </td>
                                          </tr>
                                        );
                                      })}
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
                        borderRadius: "2px",
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

      {/* Modal de Chamados Antigos e Sem Interação */}
      {modalChamadosAntigosAberto && (
        <div className="db-report-overlay" onClick={() => setModalChamadosAntigosAberto(false)}>
          <div className="db-report-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '920px', width: '92%' }}>
            <div className="db-report-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-strong)' }}>
                  <span>💤</span> Chamados Sem Interação (1+ Mês)
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Chamados ativos parados há mais de 30 dias sem nenhuma atualização ou resposta
                </p>
              </div>
              <button
                type="button"
                className="db-report-close-btn"
                onClick={() => setModalChamadosAntigosAberto(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <div className="db-report-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              {/* Controles de Aba e Busca */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div className="db-tab-group" style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className={`db-tab-btn ${abaModalAntigos === "interacao_30" ? "active" : ""}`}
                    onClick={() => setAbaModalAntigos("interacao_30")}
                  >
                    💤 Sem Interação (+30 dias) ({chamadosSemInteracao30Dias.length})
                  </button>
                  <button
                    type="button"
                    className={`db-tab-btn ${abaModalAntigos === "todos" ? "active" : ""}`}
                    onClick={() => setAbaModalAntigos("todos")}
                  >
                    ⏳ Todos da Fila ({chamadosAntigos.length})
                  </button>
                </div>

                <input
                  type="text"
                  className="db-select-filtro"
                  placeholder="Buscar chamado..."
                  value={filtroModalAntigos}
                  onChange={(e) => setFiltroModalAntigos(e.target.value)}
                  style={{ width: '220px', padding: '0.45rem 0.75rem' }}
                />
              </div>

              {/* Tabela de Resultados */}
              <div style={{ overflowX: 'auto', maxHeight: '420px', overflowY: 'auto', borderRadius: '0', border: '1px solid var(--border)', background: 'var(--surface-1)' }}>
                {listaAntigosFiltrada.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                    Nenhum chamado pendente ou encontrado com o filtro aplicado.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                        <th style={{ padding: '10px 14px' }}>ID</th>
                        <th style={{ padding: '10px 14px' }}>Título</th>
                        <th style={{ padding: '10px 14px' }}>Requerente</th>
                        <th style={{ padding: '10px 14px' }}>Técnico</th>
                        <th style={{ padding: '10px 14px' }}>Status</th>
                        <th style={{ padding: '10px 14px' }}>
                          {abaModalAntigos === "todos" ? "Tempo em Aberto" : "Tempo sem Atualizar"}
                        </th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listaAntigosFiltrada.map((item) => {
                        const valorDias = item.diasSemInteracao;
                        const corBadge = valorDias > 30 ? '#ef4444' : valorDias > 15 ? '#f97316' : '#eab308';
                        const bgBadge = valorDias > 30 ? 'rgba(239, 68, 68, 0.18)' : valorDias > 15 ? 'rgba(249, 115, 22, 0.18)' : 'rgba(234, 179, 8, 0.18)';

                        return (
                          <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '10px 14px', fontWeight: 700, color: '#38bdf8' }}>
                              {item.url ? (
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: '#38bdf8', textDecoration: 'none' }}
                                  title="Abrir no GLPI"
                                >
                                  #{item.id}
                                </a>
                              ) : (
                                `#${item.id}`
                              )}
                            </td>
                            <td style={{ padding: '10px 14px', color: 'var(--text-strong)', maxWidth: '280px' }}>
                              <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.titulo}>
                                {item.titulo}
                              </div>
                            </td>
                            <td style={{ padding: '10px 14px', color: 'var(--text-main)' }}>{item.requerente}</td>
                            <td style={{ padding: '10px 14px', color: 'var(--text-main)' }}>{item.tecnico}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ fontSize: '0.78rem', padding: '3px 8px', borderRadius: '2px', background: 'var(--surface-2)', color: 'var(--text-strong)', border: '1px solid var(--border)' }}>
                                {item.status}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ fontSize: '0.82rem', fontWeight: 700, padding: '3px 9px', borderRadius: '2px', color: corBadge, backgroundColor: bgBadge, display: 'inline-block' }}>
                                {valorDias} {valorDias === 1 ? 'dia' : 'dias'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              {item.url ? (
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    textDecoration: 'none',
                                    padding: '5px 12px',
                                    fontSize: '0.8rem',
                                    background: 'rgba(56, 189, 248, 0.15)',
                                    color: '#38bdf8',
                                    border: '1px solid rgba(56, 189, 248, 0.35)',
                                    borderRadius: '2px',
                                    fontWeight: 600,
                                    whiteSpace: 'nowrap',
                                    transition: 'all 0.2s ease'
                                  }}
                                  title={`Abrir chamado #${item.id} no GLPI`}
                                >
                                  <span>Abrir no GLPI</span>
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" strokeLinecap="round" strokeLinejoin="round" />
                                    <polyline points="15 3 21 3 21 9" strokeLinecap="round" strokeLinejoin="round" />
                                    <line x1="10" y1="14" x2="21" y2="3" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </a>
                              ) : (
                                <span style={{ color: '#64748b', fontSize: '0.8rem' }}>-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
              <button
                type="button"
                className="db-report-submit-btn"
                onClick={() => setModalChamadosAntigosAberto(false)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
