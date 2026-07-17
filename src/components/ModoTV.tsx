import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Escala, Impressora, InventarioItem } from "../types";
import {
  reconcileEventosAutomaticos,
  reconcileTarefasAutomaticas,
  getCameras,
  getEquipamentosPendentes,
  getEscalas,
  getHistorico,
  getHistoricoTarefas,
  getImpressoras,
  getInventario,
  getTvConfig,
  saveTvConfig,
  TvConfig,
} from "../utils/storage";
import {
  formatDateTime,
  faltamDoisDiasOuMenos,
  faltam12HorasOuMenos,
  faltam24HorasOuMenos,
} from "../utils/dateUtils";
import { EscalaCard } from "./EscalaPlantao";
import "./ModoTV.css";

const INTERVALO = 45;

/* ─── Status ──────────────────────────────────────────────────────── */
const TAREFA_PRIORIDADE_LABEL: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Urgente",
};

const TAREFA_PRIORIDADE_COR: Record<string, string> = {
  baixa: "#9ca3af",
  media: "#2b8ffb",
  alta: "#f97316",
  critica: "#dc2626",
};

const CAM_STATUS_COR: Record<string, string> = {
  online: "#22c55e",
  offline: "#dc2626",
  reposicionar: "#f97316",
  reposicionada: "#22c55e",
};

const INV_STATUS_LABEL: Record<string, string> = {
  disponivel: "Disponível",
  em_uso: "Em uso",
  manutencao: "Manutenção",
  reservado: "Reservado",
};

const INV_STATUS_COR: Record<string, string> = {
  disponivel: "#22c55e",
  em_uso: "#dc2626",
  manutencao: "#f97316",
  reservado: "#a855f7",
};

function StatusBadge({
  label,
  cor,
  className,
}: {
  label: string;
  cor: string;
  className?: string;
}) {
  return (
    <span
      className={["tv-status-badge", className].filter(Boolean).join(" ")}
      style={{
        backgroundColor: cor + "26",
        color: cor,
        borderColor: cor + "77",
      }}
    >
      {label}
    </span>
  );
}

const TONERS_MINI: Array<{
  key: keyof Impressora;
  label: string;
  cor: string;
}> = [
  { key: "tonerPreto", label: "P", cor: "#d1d5db" },
  { key: "tonerCiano", label: "C", cor: "#22d3ee" },
  { key: "tonerMagenta", label: "M", cor: "#f0138a" },
  { key: "tonerAmarelo", label: "A", cor: "#f5c200" },
];

function TonerMini({ imp }: { imp: Impressora }) {
  return (
    <span className="tv-toner-mini">
      {TONERS_MINI.map(({ key, label, cor }) => {
        const val = imp[key];
        if (val === null || typeof val === "undefined") return null;
        return (
          <span key={label} className="tv-toner-chip" style={{ color: cor }}>
            {label} {val as number}%
          </span>
        );
      })}
    </span>
  );
}

/* ─── Definição de uma coluna ─────────────────────────────────────── */
interface Coluna {
  titulo: string;
  largura?: string;
  classe?: string;
  render: (row: Record<string, unknown>) => React.ReactNode;
}

type Accent = "azul" | "laranja" | "ciano" | "verde" | "roxo" | "indigo";

interface TelaDef {
  id: string;
  label: string;
  accent: Accent;
  colunas: Coluna[];
  load: () => Promise<Record<string, unknown>[]>;
  isUrgent?: (row: Record<string, unknown>) => boolean;
  isOrangeUrgent?: (row: Record<string, unknown>) => boolean;
  rowClass?: (row: Record<string, unknown>) => string | undefined;
  vazioMsg: string;
  /* Quando definido, renderiza conteúdo livre em vez da tabela. */
  renderCustom?: (rows: Record<string, unknown>[]) => React.ReactNode;
}

const txt = (v: unknown) => (v ? String(v) : "");

/* Colunas compartilhadas para telas baseadas em Evento */
const COLUNAS_EVENTO: Coluna[] = [
  {
    titulo: "Nome do Evento",
    largura: "10%",
    classe: "tv-td-destaque",
    render: (r) => txt(r.nomeEvento),
  },
  {
    titulo: "Data e Hora",
    largura: "10%",
    render: (r) => {
      if (!r.dataHora) return "—";
      const DIAS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
      const abrev = DIAS[new Date(String(r.dataHora)).getDay()];
      return `${formatDateTime(String(r.dataHora))} ${abrev}`;
    },
  },
  { titulo: "Local", largura: "10%", render: (r) => txt(r.localEvento) },
  {
    titulo: "Plantão T.I",
    largura: "10%",
    render: (r) => txt(r.funcionarioPlantao),
  },
  {
    titulo: "Plantão Eve.",
    largura: "10%",
    render: (r) => txt(r.plantaoEventos),
  },
  {
    titulo: "Equipamentos",
    largura: "15%",
    classe: "tv-td-desc",
    render: (r) => txt(r.equipamentosNecessarios),
  },
  { titulo: "Chamado", largura: "8%", render: (r) => txt(r.numeroChamado) },
  { titulo: "Requerente", largura: "10%", render: (r) => txt(r.requerente) },
];

const HIST_STATUS_LABEL: Record<string, string> = {
  concluido: "Concluído",
  removido: "Removido",
  "eq-pendente": "Eq Pendente",
};
const HIST_STATUS_COR: Record<string, string> = {
  concluido: "#22c55e",
  removido: "#ef4444",
  "eq-pendente": "#e67800",
};

const COLUNAS_HISTORICO: Coluna[] = [
  {
    titulo: "Nome do Evento",
    largura: "10%",
    classe: "tv-td-destaque",
    render: (r) => txt(r.nomeEvento),
  },
  {
    titulo: "Data e Hora",
    largura: "10%",
    render: (r) => {
      if (!r.dataHora) return "—";
      const DIAS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
      const abrev = DIAS[new Date(String(r.dataHora)).getDay()];
      return `${formatDateTime(String(r.dataHora))} ${abrev}`;
    },
  },
  { titulo: "Local", largura: "10%", render: (r) => txt(r.localEvento) },
  {
    titulo: "Plantão TI",
    largura: "9%",
    render: (r) => txt(r.funcionarioPlantao),
  },
  {
    titulo: "Plantão Eventos",
    largura: "9%",
    render: (r) => txt(r.plantaoEventos),
  },
  {
    titulo: "Equipamentos",
    largura: "13%",
    classe: "tv-td-desc",
    render: (r) => txt(r.equipamentosNecessarios),
  },
  { titulo: "Chamado", largura: "8%", render: (r) => txt(r.numeroChamado) },
  { titulo: "Requerente", largura: "9%", render: (r) => txt(r.requerente) },
  {
    titulo: "Status",
    largura: "9%",
    render: (r) => {
      const key =
        r.eqPendente && !r.concluido
          ? "eq-pendente"
          : r.concluido
            ? "concluido"
            : r.removido
              ? "removido"
              : null;
      if (!key) return "";
      return (
        <StatusBadge
          label={HIST_STATUS_LABEL[key]}
          cor={HIST_STATUS_COR[key]}
        />
      );
    },
  },
];

/* Colunas compartilhadas para telas baseadas em Tarefa */
const COLUNAS_TAREFA: Coluna[] = [
  { titulo: "Tarefa", classe: "tv-td-destaque", render: (r) => txt(r.tarefa) },
  {
    titulo: "Descrição",
    largura: "35%",
    classe: "tv-td-desc",
    render: (r) => txt(r.descricao),
  },
  {
    titulo: "Prioridade",
    largura: "10%",
    render: (r) => (
      <StatusBadge
        label={
          TAREFA_PRIORIDADE_LABEL[String(r.prioridade)] ?? String(r.prioridade)
        }
        cor={TAREFA_PRIORIDADE_COR[String(r.prioridade)] ?? "#9ca3af"}
        className={r.prioridade === "critica" ? "tv-badge-urgente" : undefined}
      />
    ),
  },
  { titulo: "Responsável", render: (r) => txt(r.responsavel) },
  {
    titulo: "Prazo",
    largura: "10%",
    render: (r) => (r.prazo ? formatDateTime(String(r.prazo)) : ""),
  },
  { titulo: "Chamado", largura: "10%", render: (r) => txt(r.chamado) },
];

const TAREFA_STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluído",
  cancelada: "Cancelada",
};

const TAREFA_STATUS_COR: Record<string, string> = {
  pendente: "#2b8ffb",
  em_andamento: "#f97316",
  concluida: "#22c55e",
  cancelada: "#ef4444",
};

const COLUNAS_TAREFA_HISTORICO: Coluna[] = [
  { titulo: "Tarefa", classe: "tv-td-destaque", render: (r) => txt(r.tarefa) },
  {
    titulo: "Descrição",
    largura: "35%",
    classe: "tv-td-desc",
    render: (r) => txt(r.descricao),
  },
  { titulo: "Responsável", render: (r) => txt(r.responsavel) },
  {
    titulo: "Prazo",
    largura: "10%",
    render: (r) => (r.prazo ? formatDateTime(String(r.prazo)) : ""),
  },
  { titulo: "Chamado", largura: "10%", render: (r) => txt(r.chamado) },
  {
    titulo: "Status",
    largura: "10%",
    render: (r) => (
      <StatusBadge
        label={TAREFA_STATUS_LABEL[String(r.status)] ?? String(r.status)}
        cor={TAREFA_STATUS_COR[String(r.status)] ?? "#9ca3af"}
      />
    ),
  },
];

const asRows = <T,>(arr: T[]) => arr as unknown as Record<string, unknown>[];

/* ─── Catálogo de telas disponíveis ───────────────────────────────── */
const CATALOGO: TelaDef[] = [
  {
    id: "montagens",
    label: "MONTAGENS",
    accent: "azul",
    colunas: COLUNAS_EVENTO,
    vazioMsg: "Nenhuma montagem cadastrada.",
    isUrgent: (r) =>
      r.prioridade === "urgente" ||
      faltam12HorasOuMenos(String(r.dataHora ?? "")),
    isOrangeUrgent: (r) => {
      if (r.prioridade === "urgente") return false;
      const dh = String(r.dataHora ?? "");
      return faltam24HorasOuMenos(dh) && !faltam12HorasOuMenos(dh);
    },
    load: async () => {
      const eventos = await reconcileEventosAutomaticos();
      return asRows(eventos.filter((e) => !e.removido));
    },
  },
  {
    id: "tarefas",
    label: "TAREFAS",
    accent: "azul",
    colunas: COLUNAS_TAREFA,
    vazioMsg: "Nenhuma tarefa pendente.",
    isUrgent: (r) => faltamDoisDiasOuMenos(String(r.prazo ?? "")),
    load: async () => {
      const ORDEM: Record<string, number> = {
        critica: 0,
        alta: 1,
        media: 2,
        baixa: 3,
      };
      const tarefas = await reconcileTarefasAutomaticas();
      tarefas.sort(
        (a, b) => (ORDEM[a.prioridade] ?? 9) - (ORDEM[b.prioridade] ?? 9),
      );
      return asRows(tarefas);
    },
  },
  {
    id: "equipamentos",
    label: "EQUIPAMENTOS PENDENTES",
    accent: "laranja",
    colunas: COLUNAS_EVENTO,
    vazioMsg: "Nenhum equipamento pendente.",
    load: async () => asRows(await getEquipamentosPendentes()),
  },
  {
    id: "impressoras",
    label: "IMPRESSORAS",
    accent: "azul",
    vazioMsg: "Nenhuma impressora cadastrada.",
    colunas: [
      {
        titulo: "Local",
        largura: "16%",
        classe: "tv-td-destaque",
        render: (r) => txt(r.local),
      },
      { titulo: "Sede", largura: "12%", render: (r) => txt(r.sede) },
      { titulo: "Marca", largura: "10%", render: (r) => txt(r.marca) },
      { titulo: "Modelo", largura: "14%", render: (r) => txt(r.modelo) },
      { titulo: "Nº Série", largura: "12%", render: (r) => txt(r.numeroSerie) },
      { titulo: "IP", largura: "15%", render: (r) => txt(r.ip) },
      { titulo: "MAC", largura: "17%", render: (r) => txt(r.mac) },
      {
        titulo: "Toner",
        largura: "20%",
        render: (r) => <TonerMini imp={r as unknown as Impressora} />,
      },
    ],
    load: async () => asRows(await getImpressoras()),
  },
  {
    id: "escala-plantao",
    label: "ESCALA DE PLANTÃO",
    accent: "azul",
    colunas: [],
    vazioMsg: "Nenhuma escala cadastrada.",
    load: async () => {
      const todas = await getEscalas();
      return asRows(
        todas.sort((a, b) => (a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes)),
      );
    },
  },
  {
    id: "historico-montagens",
    label: "HISTÓRICO DE MONTAGENS",
    accent: "azul",
    colunas: COLUNAS_HISTORICO,
    vazioMsg: "Nenhuma montagem no histórico.",
    rowClass: (r) =>
      r.eqPendente && !r.concluido
        ? "tv-linha-eq-pendente"
        : r.concluido
          ? "tv-linha-concluida"
          : r.removido
            ? "tv-linha-removida"
            : undefined,
    load: async () => asRows(await getHistorico()),
  },
  {
    id: "historico-tarefas",
    label: "HISTÓRICO DE TAREFAS",
    accent: "azul",
    colunas: COLUNAS_TAREFA_HISTORICO,
    vazioMsg: "Nenhuma tarefa no histórico.",
    load: async () => asRows(await getHistoricoTarefas()),
  },
  {
    id: "cameras",
    label: "CÂMERAS",
    accent: "azul",
    vazioMsg: "Nenhuma câmera cadastrada.",
    colunas: [
      {
        titulo: "Local",
        largura: "16%",
        classe: "tv-td-destaque",
        render: (r) => txt(r.local),
      },
      {
        titulo: "Sede",
        largura: "9%",
        classe: "tv-td-center",
        render: (r) => txt(r.sede),
      },
      { titulo: "Marca", largura: "9%", render: (r) => txt(r.marca) },
      { titulo: "Modelo", largura: "13%", render: (r) => txt(r.modelo) },
      { titulo: "IP", largura: "12%", render: (r) => txt(r.ip) },
      {
        titulo: "RAT",
        largura: "13%",
        classe: "tv-td-center",
        render: (r) => txt(r.rat),
      },
      {
        titulo: "Chamado",
        largura: "9%",
        classe: "tv-td-center",
        render: (r) => txt(r.chamado),
      },
      {
        titulo: "Status",
        largura: "11%",
        render: (r) => (
          <StatusBadge
            label={
              String(r.status) === "online"
                ? "Online"
                : String(r.status) === "reposicionar"
                  ? "Reposicionar"
                  : "Offline"
            }
            cor={CAM_STATUS_COR[String(r.status)] ?? "#9ca3af"}
          />
        ),
      },
    ],
    load: async () => {
      const ORDEM: Record<string, number> = {
        offline: 0,
        reposicionar: 1,
        reposicionada: 2,
        online: 3,
      };
      const cams = await getCameras();
      cams.sort((a, b) => (ORDEM[a.status] ?? 9) - (ORDEM[b.status] ?? 9));
      return asRows(cams);
    },
  },
  {
    id: "inventario",
    label: "INVENTÁRIO",
    accent: "azul",
    vazioMsg: "Nenhum item no inventário.",
    colunas: [
      {
        titulo: "Item",
        largura: "18%",
        classe: "tv-td-destaque",
        render: (r) => txt(r.item),
      },
      { titulo: "Modelo", largura: "13%", render: (r) => txt(r.modelo) },
      {
        titulo: "Patrimônio",
        largura: "11%",
        render: (r) => txt(r.patrimonio),
      },
      {
        titulo: "Localização",
        largura: "13%",
        render: (r) => txt(r.localizacao),
      },
      {
        titulo: "Requerente",
        largura: "11%",
        render: (r) => txt(r.requerente),
      },
      {
        titulo: "Montado por",
        largura: "11%",
        render: (r) => txt(r.montadoPor),
      },
      {
        titulo: "Problema",
        largura: "9%",
        render: (r) => txt(r.problema),
      },
      {
        titulo: "Status",
        largura: "10%",
        render: (r) =>
          r.status ? (
            <StatusBadge
              label={INV_STATUS_LABEL[String(r.status)] ?? String(r.status)}
              cor={INV_STATUS_COR[String(r.status)] ?? "#9ca3af"}
            />
          ) : (
            "—"
          ),
      },
    ],
    load: async () => {
      const itens: InventarioItem[] = await getInventario();
      return itens.flatMap((item) => {
        const unidades = [...item.unidades].sort((a, b) =>
          a.modelo.localeCompare(b.modelo, "pt-BR"),
        );
        return unidades.length > 0
          ? unidades.map((u) => ({ item: item.item, ...u }))
          : [{ item: item.item }];
      }) as Record<string, unknown>[];
    },
  },
];

const ACCENT_CLASSE: Record<Accent, string> = {
  azul: "",
  laranja: "tv-head-laranja",
  ciano: "tv-head-ciano",
  verde: "tv-head-verde",
  roxo: "tv-head-roxo",
  indigo: "tv-head-indigo",
};

/* Telas ativas por padrão (preserva o comportamento original). */
const PADRAO_ATIVAS = new Set(["montagens", "tarefas", "equipamentos"]);

function configPadrao(): { id: string; ativo: boolean }[] {
  return CATALOGO.map((t) => ({ id: t.id, ativo: PADRAO_ATIVAS.has(t.id) }));
}

/* Mescla a config salva com o catálogo: mantém ordem salva, descarta ids
   desconhecidos e acrescenta telas novas (inativas) ao final. */
function normalizarConfig(
  salva: TvConfig | null,
): { id: string; ativo: boolean }[] {
  if (!salva || !Array.isArray(salva.telas)) return configPadrao();
  const validas = salva.telas.filter((t) =>
    CATALOGO.some((c) => c.id === t.id),
  );
  const presentes = new Set(validas.map((t) => t.id));
  const faltantes = CATALOGO.filter((c) => !presentes.has(c.id)).map((c) => ({
    id: c.id,
    ativo: false,
  }));
  return [...validas, ...faltantes];
}

export default function ModoTV() {
  const [config, setConfig] = useState(configPadrao);
  const [tela, setTela] = useState<string>("montagens");
  const [segundos, setSegundos] = useState(INTERVALO);
  const [dadosPorTela, setDadosPorTela] = useState<
    Record<string, Record<string, unknown>[]>
  >({});
  const [configAberta, setConfigAberta] = useState(false);
  const [escalaIdx, setEscalaIdx] = useState(0);

  const telasAtivas = config.filter((c) => c.ativo).map((c) => c.id);
  const telasAtivasRef = useRef(telasAtivas);
  telasAtivasRef.current = telasAtivas;

  const tbodyWrapRef = useRef<HTMLDivElement>(null);

  const defAtual = CATALOGO.find((t) => t.id === tela);

  /* Carrega a config persistida no backend. */
  useEffect(() => {
    getTvConfig()
      .then((salva) => setConfig(normalizarConfig(salva)))
      .catch(console.error);
  }, []);

  const carregarTela = useCallback(async (id: string) => {
    const def = CATALOGO.find((t) => t.id === id);
    if (!def) return;
    try {
      const rows = await def.load();
      setDadosPorTela((prev) => ({ ...prev, [id]: rows }));
    } catch (error) {
      console.error(error);
    }
  }, []);

  /* Garante que a tela atual esteja entre as ativas. */
  useEffect(() => {
    if (telasAtivas.length === 0) return;
    if (!telasAtivas.includes(tela)) {
      setTela(telasAtivas[0]);
      setSegundos(INTERVALO);
    }
  }, [telasAtivas, tela]);

  /* Carrega os dados sempre que a tela ativa muda. */
  useEffect(() => {
    if (tela) carregarTela(tela);
  }, [tela, carregarTela]);

  /* Reseta para o mês atual ao entrar na tela de escala. */
  useEffect(() => {
    if (tela !== "escala-plantao") return;
    const escalas = dadosPorTela["escala-plantao"] ?? [];
    if (escalas.length === 0) return;
    const agora = new Date();
    const mes = agora.getMonth() + 1;
    const ano = agora.getFullYear();
    const idx = escalas.findIndex(
      (e) =>
        (e as unknown as Escala).mes === mes &&
        (e as unknown as Escala).ano === ano,
    );
    setEscalaIdx(idx >= 0 ? idx : Math.max(0, escalas.length - 1));
  }, [tela, dadosPorTela]);

  const avancarTela = useCallback(() => {
    const ativas = telasAtivasRef.current;
    if (ativas.length === 0) return;
    setTela((atual) => {
      const idx = ativas.indexOf(atual);
      const proxima = ativas[(idx + 1) % ativas.length];
      carregarTela(proxima);
      return proxima;
    });
  }, [carregarTela]);

  const voltarTela = useCallback(() => {
    const ativas = telasAtivasRef.current;
    if (ativas.length === 0) return;
    setTela((atual) => {
      const idx = ativas.indexOf(atual);
      const anterior = ativas[(idx - 1 + ativas.length) % ativas.length];
      carregarTela(anterior);
      return anterior;
    });
  }, [carregarTela]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setSegundos((prev) => {
        if (prev <= 1) {
          avancarTela();
          return INTERVALO;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [avancarTela]);

  const handleBack = useCallback(() => {
    voltarTela();
    setSegundos(INTERVALO);
  }, [voltarTela]);

  const handleSkip = useCallback(() => {
    avancarTela();
    setSegundos(INTERVALO);
  }, [avancarTela]);

  /* Auto-scroll lento: rola para baixo e volta ao topo ao trocar de tela */
  useEffect(() => {
    if (tbodyWrapRef.current) tbodyWrapRef.current.scrollTop = 0;

    const PAUSE_TICKS = 62; // 62 × 40ms ≈ 2.5s de pausa no fim
    const SCROLL_BACK_TICKS = 75; // 75 × 40ms = 3s de retorno ao topo
    const DELAY_TICKS = 125; // 125 × 40ms = 5s de espera
    let delayTicks = DELAY_TICKS; // Espera inicial
    let pauseTicks = 0;
    let scrollBackTicks = 0;
    let scrollBackStartPos = 0;

    const id = setInterval(() => {
      const el = tbodyWrapRef.current;
      if (!el) return;

      if (delayTicks > 0) {
        delayTicks--;
        return;
      }

      if (scrollBackTicks > 0) {
        scrollBackTicks--;
        el.scrollTop =
          scrollBackStartPos * (scrollBackTicks / SCROLL_BACK_TICKS);
        if (scrollBackTicks === 0) {
          delayTicks = DELAY_TICKS; // Adiciona delay após voltar ao topo
        }
        return;
      }

      if (pauseTicks > 0) {
        pauseTicks--;
        if (pauseTicks === 0) {
          scrollBackStartPos = el.scrollTop;
          scrollBackTicks = SCROLL_BACK_TICKS;
        }
        return;
      }

      const maxScroll = el.scrollHeight - el.clientHeight;
      if (maxScroll <= 0) return;

      if (el.scrollTop >= maxScroll - 1) {
        pauseTicks = PAUSE_TICKS;
      } else {
        el.scrollTop += 1;
      }
    }, 40);

    return () => clearInterval(id);
  }, [tela]);

  /* ─── Painel de configuração ───────────────────────────────────── */
  const toggleTela = (id: string) => {
    setConfig((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ativo: !c.ativo } : c)),
    );
  };

  const moverTela = (id: string, direcao: -1 | 1) => {
    setConfig((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      const alvo = idx + direcao;
      if (idx < 0 || alvo < 0 || alvo >= prev.length) return prev;
      const copia = [...prev];
      [copia[idx], copia[alvo]] = [copia[alvo], copia[idx]];
      return copia;
    });
  };

  const [salvandoConfig, setSalvandoConfig] = useState(false);

  const salvarConfig = async () => {
    setSalvandoConfig(true);
    try {
      await saveTvConfig({ telas: config });
      setConfigAberta(false);
    } catch (error) {
      console.error(error);
    } finally {
      setSalvandoConfig(false);
    }
  };

  const progresso = ((INTERVALO - segundos) / (INTERVALO - 1)) * 100;
  const linhas = defAtual ? (dadosPorTela[tela] ?? []) : [];
  const totalTela = linhas.length;
  const colunas = defAtual?.colunas ?? [];
  const contadorEscala =
    tela === "escala-plantao" && totalTela > 0
      ? `${escalaIdx + 1} / ${totalTela}`
      : null;

  const nomeTela = (id: string) =>
    CATALOGO.find((c) => c.id === id)?.label ?? id;

  return (
    <div className="tv-page">
      <img
        className="tv-watermark"
        src="https://www.gnu.com.br/site/img/logo-gnu.svg"
        alt=""
        aria-hidden="true"
      />

      <div className="tv-topbar">
        {/* esquerda: sair + contador */}
        <div className="tv-topbar-left">
          <Link to="/" className="tv-sair">
            Sair
          </Link>
          <span className="tv-contador">
            {contadorEscala ??
              `${totalTela} ${totalTela === 1 ? "item" : "itens"}`}
          </span>
        </div>

        {/* centro: título + dots */}
        <div className="tv-topbar-center">
          <span className="tv-titulo">{defAtual?.label ?? "MODO TV"}</span>
          <div className="tv-dots">
            {telasAtivas.map((t) => (
              <span
                key={t}
                className={t === tela ? "tv-dot tv-dot-active" : "tv-dot"}
              />
            ))}
          </div>
        </div>

        {/* direita: config + countdown + skip */}
        <div className="tv-topbar-right">
          <button
            className="tv-config-btn"
            onClick={() => setConfigAberta(true)}
            title="Configurar abas"
            aria-label="Configurar abas"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="17" height="17">
              <path
                fillRule="evenodd"
                d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.53 1.53 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <button
            className="tv-skip"
            onClick={handleBack}
            title="Tela anterior"
            aria-label="Tela anterior"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path
                fillRule="evenodd"
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <span className="tv-countdown">{segundos}s</span>
          <button
            className="tv-skip"
            onClick={handleSkip}
            title="Próxima tela"
            aria-label="Próxima tela"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path
                fillRule="evenodd"
                d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="tv-progress">
        <div className="tv-progress-fill" style={{ width: `${progresso}%` }} />
      </div>

      <div className="tv-conteudo">
        <div className="tv-tabela-wrap">
          <div className="tv-tbody-wrap" ref={tbodyWrapRef}>
            {telasAtivas.length === 0 ? (
              <div className="tv-sem-abas">
                Nenhuma aba ativa. Clique na engrenagem para configurar.
              </div>
            ) : tela === "escala-plantao" ? (
              <div className="tv-escala-wrap">
                {linhas.length === 0 ? (
                  <div className="tv-escala-vazio">
                    Nenhuma escala cadastrada.
                  </div>
                ) : (
                  <div className="tv-escala-nav">
                    <button
                      className="tv-escala-arrow"
                      onClick={() => setEscalaIdx((i) => Math.max(0, i - 1))}
                      disabled={escalaIdx <= 0}
                      aria-label="Escala anterior"
                    >
                      ‹
                    </button>
                    <EscalaCard
                      escala={linhas[escalaIdx] as unknown as Escala}
                    />
                    <button
                      className="tv-escala-arrow"
                      onClick={() =>
                        setEscalaIdx((i) => Math.min(linhas.length - 1, i + 1))
                      }
                      disabled={escalaIdx >= linhas.length - 1}
                      aria-label="Próxima escala"
                    >
                      ›
                    </button>
                  </div>
                )}
              </div>
            ) : defAtual?.renderCustom ? (
              <div className="tv-escala-wrap">
                {defAtual.renderCustom(linhas)}
              </div>
            ) : (
              <table
                className={`tv-tabela ${
                  defAtual ? ACCENT_CLASSE[defAtual.accent] : ""
                }`}
              >
                <colgroup>
                  {colunas.map((c, i) => (
                    <col
                      key={i}
                      style={c.largura ? { width: c.largura } : undefined}
                    />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    {colunas.map((c, i) => (
                      <th key={i}>{c.titulo}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhas.length === 0 ? (
                    <tr>
                      <td colSpan={colunas.length} className="tv-empty">
                        {defAtual?.vazioMsg ?? "Sem dados."}
                      </td>
                    </tr>
                  ) : (
                    linhas.map((row, ri) => (
                      <tr
                        key={(row.id as string) ?? ri}
                        className={
                          defAtual?.isUrgent?.(row)
                            ? "tv-linha-urgente"
                            : defAtual?.isOrangeUrgent?.(row)
                              ? "tv-linha-urgente-laranja"
                              : defAtual?.rowClass?.(row)
                        }
                      >
                        {colunas.map((c, ci) => (
                          <td key={ci} className={c.classe}>
                            {c.render(row)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ─── Painel de configuração ────────────────────────────────── */}
      {configAberta && (
        <div className="tv-cfg-overlay" onClick={() => setConfigAberta(false)}>
          <div
            className="tv-cfg-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Configurar abas do Modo TV"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tv-cfg-header">
              <h3>Configurar abas</h3>
              <button
                className="tv-cfg-close"
                onClick={() => setConfigAberta(false)}
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

            <p className="tv-cfg-desc">
              Escolha quais abas aparecem na rotação do Modo TV e em que ordem.
            </p>

            <ul className="tv-cfg-lista">
              {config.map((c, i) => (
                <li key={c.id} className="tv-cfg-item">
                  <label className="tv-cfg-toggle">
                    <input
                      type="checkbox"
                      checked={c.ativo}
                      onChange={() => toggleTela(c.id)}
                    />
                    <span className="tv-cfg-nome">{nomeTela(c.id)}</span>
                  </label>
                  <div className="tv-cfg-ordem">
                    <button
                      className="tv-cfg-mover"
                      onClick={() => moverTela(c.id, -1)}
                      disabled={i === 0}
                      aria-label="Mover para cima"
                    >
                      ▲
                    </button>
                    <button
                      className="tv-cfg-mover"
                      onClick={() => moverTela(c.id, 1)}
                      disabled={i === config.length - 1}
                      aria-label="Mover para baixo"
                    >
                      ▼
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="tv-cfg-footer">
              <button
                className="tv-cfg-cancel"
                onClick={() => setConfigAberta(false)}
              >
                Cancelar
              </button>
              <button
                className="tv-cfg-save"
                onClick={salvarConfig}
                disabled={salvandoConfig}
              >
                {salvandoConfig ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
