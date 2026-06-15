import { useEffect, useRef, useState } from "react";
import { Escala, EscalaDia, Feriado, MembroEquipe } from "../types";
import {
  getEscalas,
  saveEscalas,
  getEquipe,
  saveEquipe,
  getFeriados,
  saveFeriados,
} from "../utils/storage";
import { useAuth } from "../context/AuthContext";
import "./EscalaPlantao.css";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const MESES_ABREV = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function gerarId(prefixo: string): string {
  return `${prefixo}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Data local de hoje no formato ISO "YYYY-MM-DD" (sem deslocamento de fuso). */
function hojeISO(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

const DIAS_SEMANA_ABREV = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

/** "2026-06-04" → "QUI". Datas inválidas retornam string vazia. */
function diaDaSemana(iso: string): string {
  if (!iso) return "";
  const [ano, mes, dia] = iso.split("-").map(Number);
  if (!ano || !mes || !dia) return "";
  return DIAS_SEMANA_ABREV[new Date(ano, mes - 1, dia).getDay()];
}

/** "2026-06-04" → "04/jun". Datas inválidas/vazias retornam string vazia. */
function formatDiaCurto(iso: string): string {
  if (!iso) return "";
  const [, m, d] = iso.split("-");
  const mesIdx = Number(m) - 1;
  if (!d || mesIdx < 0 || mesIdx > 11) return iso;
  return `${d}/${MESES_ABREV[mesIdx]}`;
}

/** Quantos dias tem o mês (1-12) no ano informado. */
function diasNoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate();
}

/** Primeiro dia do mês em ISO: (2026, 6) → "2026-06-01". */
function primeiroDiaISO(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}-01`;
}

/** Último dia do mês em ISO: (2026, 6) → "2026-06-30". */
function ultimoDiaISO(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}-${String(diasNoMes(ano, mes)).padStart(2, "0")}`;
}

type StatusFerias = "ativas" | "agendadas" | "encerradas" | "nenhuma";

/** Situação atual das férias do membro em relação à data de hoje. */
function statusFerias(m: MembroEquipe): StatusFerias {
  if (!m.feriasInicio && !m.feriasFim) return "nenhuma";
  const hoje = hojeISO();
  const inicio = m.feriasInicio || "0000-01-01";
  const fim = m.feriasFim || "9999-12-31";
  if (hoje < inicio) return "agendadas";
  if (hoje > fim) return "encerradas";
  return "ativas";
}

const STATUS_FERIAS_LABEL: Record<StatusFerias, string> = {
  ativas: "Em férias",
  agendadas: "Agendadas",
  encerradas: "Encerradas",
  nenhuma: "Sem férias",
};

const STATUS_FERIAS_ORDEM: Record<StatusFerias, number> = {
  ativas: 0,
  agendadas: 1,
  encerradas: 2,
  nenhuma: 3,
};

/** Retorna true se hoje cai dentro do período de férias do membro. */
function membroEmFeriasHoje(m: MembroEquipe): boolean {
  if (!m.feriasInicio && !m.feriasFim) return false;
  const hoje = hojeISO();
  return hoje >= (m.feriasInicio || "0000-01-01") && hoje <= (m.feriasFim || "9999-12-31");
}

/**
 * Retorna true se o período de férias do membro sobrepõe ao mês simulado.
 * Usado apenas para normalização cross-month (ver simularDias).
 */
function membroEmFeriasNoMes(m: MembroEquipe, ano: number, mes: number): boolean {
  if (!m.feriasInicio && !m.feriasFim) return false;
  const inicio = m.feriasInicio || "0000-01-01";
  const fim = m.feriasFim || "9999-12-31";
  return inicio <= ultimoDiaISO(ano, mes) && fim >= primeiroDiaISO(ano, mes);
}

const CARGOS_SEM_ESCALA = new Set(["Estagiário", "Aprendiz", "Gerente de TI"]);

/** Estagiários e aprendizes aparecem na equipe mas não entram na escala. */
function membroNaoEscalavel(m: MembroEquipe): boolean {
  return CARGOS_SEM_ESCALA.has(m.cargo);
}

/** Ordem de exibição pelo status do dot: verde → amarelo → vermelho → cinza. */
function ordemDot(m: MembroEquipe): number {
  if (membroNaoEscalavel(m)) return 3;
  if (membroEmFeriasHoje(m)) return 2;
  if (m.feriasInicio || m.feriasFim) return 1;
  return 0;
}

/** Verifica se o membro está de férias em uma data ISO específica. */
function membroEmFeriasNoDia(m: MembroEquipe, data: string): boolean {
  if (!m.feriasInicio && !m.feriasFim) return false;
  return data >= (m.feriasInicio || "0000-01-01") && data <= (m.feriasFim || "9999-12-31");
}

/** Todos os sábados e domingos do mês, em ISO, ordenados cronologicamente. */
function fimDeSemanaDoMes(ano: number, mes: number): string[] {
  const total = diasNoMes(ano, mes);
  const dias: string[] = [];
  for (let d = 1; d <= total; d++) {
    const diaSemana = new Date(ano, mes - 1, d).getDay();
    if (diaSemana === 0 || diaSemana === 6) {
      dias.push(
        `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      );
    }
  }
  return dias;
}

/** Identifica o membro da equipe correspondente a um dia já cadastrado. */
function acharMembroId(
  equipe: MembroEquipe[],
  dia: EscalaDia,
): string | null {
  const mat = dia.matricula?.trim();
  if (mat) {
    const porMat = equipe.find((m) => m.matricula.trim() === mat);
    if (porMat) return porMat.id;
  }
  const nome = dia.nome?.trim().toLowerCase();
  if (nome) {
    const porNome = equipe.find((m) => m.nome.trim().toLowerCase() === nome);
    if (porNome) return porNome.id;
  }
  return null;
}

/**
 * Gera os dias de plantão de um mês distribuindo a equipe em rodízio justo:
 * 1 pessoa por dia de fim de semana, priorizando quem tem menos plantões e
 * evitando a mesma pessoa em dias consecutivos. Ignora quem está de férias.
 *
 * Quando `escalaAnterior` é informada, o rodízio começa considerando a carga do
 * mês anterior: quem já fez mais plantões (inclusive dias extras como feriados)
 * entra por último, e quem fechou o mês anterior não é escalado logo no início.
 *
 * Os `feriados` do mês ajustam os dias a escalar: um feriado "sem plantão" sai
 * da lista (mesmo num fim de semana) e um feriado "com plantão" entra (mesmo num
 * dia de semana).
 */
function simularDias(
  equipe: MembroEquipe[],
  ano: number,
  mes: number,
  escalaAnterior?: Escala,
  feriados: Feriado[] = [],
): EscalaDia[] {
  // Sai cedo se nenhum membro escalável tem disponibilidade no mês
  if (equipe.every((m) => membroNaoEscalavel(m) || membroEmFeriasNoMes(m, ano, mes))) return [];

  const prefixoMes = `${ano}-${String(mes).padStart(2, "0")}-`;
  const feriadosMes = feriados.filter((f) => f.data.startsWith(prefixoMes));
  const semPlantao = new Set(
    feriadosMes.filter((f) => !f.comPlantao).map((f) => f.data),
  );

  const dias = fimDeSemanaDoMes(ano, mes).filter((d) => !semPlantao.has(d));
  for (const f of feriadosMes) {
    if (f.comPlantao && !dias.includes(f.data)) dias.push(f.data);
  }
  dias.sort();
  if (dias.length === 0) return [];

  // Contagem para TODOS os membros: o filtro de férias é feito por dia,
  // não por mês, para que um membro que entra ou sai de férias no meio do
  // mês trabalhe normalmente nos dias em que está disponível.
  const contagem = new Map<string, number>(equipe.map((m) => [m.id, 0]));
  let ultimoId: string | null = null;

  if (escalaAnterior) {
    const anoAnterior = mes > 1 ? ano : ano - 1;
    const mesAnterior = mes > 1 ? mes - 1 : 12;

    const anteriores = [...escalaAnterior.dias]
      .filter((d) => d.data)
      .sort((a, b) => a.data.localeCompare(b.data));
    for (const d of anteriores) {
      const id = acharMembroId(equipe, d);
      if (id == null) continue;
      if (contagem.has(id)) contagem.set(id, (contagem.get(id) ?? 0) + 1);
      ultimoId = id;
    }

    // Funcionários que voltam de férias este mês recebem a média dos que
    // trabalharam no mês anterior para não serem escalados seguido.
    const retornando = equipe.filter(
      (m) =>
        !membroNaoEscalavel(m) &&
        membroEmFeriasNoMes(m, anoAnterior, mesAnterior) &&
        !membroEmFeriasNoMes(m, ano, mes),
    );
    if (retornando.length > 0) {
      const ativos = equipe.filter(
        (m) =>
          !membroNaoEscalavel(m) &&
          !membroEmFeriasNoMes(m, anoAnterior, mesAnterior),
      );
      if (ativos.length > 0) {
        const media =
          ativos.reduce((s, m) => s + (contagem.get(m.id) ?? 0), 0) /
          ativos.length;
        for (const m of retornando) {
          contagem.set(m.id, Math.round(media));
        }
      }
    }
  }

  const resultado: EscalaDia[] = [];

  for (const data of dias) {
    // Filtra quem está disponível NESTA DATA ESPECÍFICA (excluindo não-escaláveis)
    const disponivelNoDia = equipe.filter(
      (m) => !membroNaoEscalavel(m) && !membroEmFeriasNoDia(m, data),
    );
    if (disponivelNoDia.length === 0) continue;

    const ordenados = [...disponivelNoDia].sort(
      (a, b) =>
        (contagem.get(a.id) ?? 0) - (contagem.get(b.id) ?? 0) ||
        a.ordem - b.ordem,
    );
    // Evita repetir a mesma pessoa em dias consecutivos quando há alternativa.
    let escolhido = ordenados[0];
    if (ordenados.length > 1 && escolhido.id === ultimoId) {
      escolhido = ordenados[1];
    }
    contagem.set(escolhido.id, (contagem.get(escolhido.id) ?? 0) + 1);
    ultimoId = escolhido.id;
    resultado.push({
      id: gerarId("dia"),
      data,
      nome: escolhido.nome,
      matricula: escolhido.matricula,
    });
  }
  return resultado;
}

/** Retorna a escala cujo mês/ano corresponde à data de referência (default: hoje). */
export function escalaDoMes(
  escalas: Escala[],
  ref: Date = new Date(),
): Escala | undefined {
  return escalas.find(
    (e) => e.ano === ref.getFullYear() && e.mes === ref.getMonth() + 1,
  );
}

/**
 * Ordena os dias por data e os agrupa: inicia um novo grupo sempre que o intervalo
 * entre dias consecutivos é maior que 1 dia. Assim, sábado+domingo ficam juntos e
 * dias isolados formam grupos próprios.
 */
export function agruparDias(dias: EscalaDia[]): EscalaDia[][] {
  const ordenados = [...dias]
    .filter((d) => d.data)
    .sort((a, b) => a.data.localeCompare(b.data));

  const grupos: EscalaDia[][] = [];
  let anterior: number | null = null;

  for (const dia of ordenados) {
    const [ano, mes, d] = dia.data.split("-").map(Number);
    const ts = new Date(ano, mes - 1, d).getTime();
    const umDia = 24 * 60 * 60 * 1000;

    if (anterior !== null && ts - anterior <= umDia) {
      grupos[grupos.length - 1].push(dia);
    } else {
      grupos.push([dia]);
    }
    anterior = ts;
  }

  return grupos;
}

/** Card de UM mês de escala. Reaproveitado pela página e pelo Modo TV. */
export function EscalaCard({ escala }: { escala: Escala }) {
  const grupos = agruparDias(escala.dias);
  const hoje = hojeISO();

  return (
    <div className="esc-card">
      <div className="esc-card-header">{escala.titulo}</div>
      <div className="esc-card-body">
        {grupos.length === 0 ? (
          <div className="esc-card-vazio">Nenhum dia cadastrado.</div>
        ) : (
          grupos.map((grupo, gi) => (
            <div key={gi} className="esc-grupo">
              {grupo.map((p) => (
                <div
                  key={p.id}
                  className={
                    p.data === hoje ? "esc-row esc-row-hoje" : "esc-row"
                  }
                >
                  <span className="esc-dia">{formatDiaCurto(p.data)}</span>
                  <span className="esc-diasemana">{diaDaSemana(p.data)}</span>
                  <span className="esc-nome">{p.nome}</span>
                  <span className="esc-matricula">{p.matricula}</span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** Grade de cards reaproveitável (vários meses). */
export function EscalaCards({ escalas }: { escalas: Escala[] }) {
  return (
    <div className="esc-grid">
      {escalas.map((escala) => (
        <EscalaCard key={escala.id} escala={escala} />
      ))}
    </div>
  );
}

/**
 * Cada dia guarda a data ISO completa. O input nativo de calendário fica preso
 * ao mês/ano da escala (via min/max), então o ano nunca passa de 4 dígitos.
 */
type FormDia = EscalaDia;
type FormState = { titulo: string; ano: number; mes: number; dias: FormDia[] };

function formVazio(): FormState {
  const agora = new Date();
  const mes = agora.getMonth() + 1;
  return {
    titulo: `Plantão ${MESES[mes - 1]}`,
    ano: agora.getFullYear(),
    mes,
    dias: [],
  };
}

export default function EscalaPlantao() {
  const { isAdmin } = useAuth();
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Escala | null>(null);
  const [form, setForm] = useState<FormState>(formVazio);
  const [confirmarRemocao, setConfirmarRemocao] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const primeiroInputRef = useRef<HTMLInputElement>(null);

  // Equipe T.I
  const [equipe, setEquipe] = useState<MembroEquipe[]>([]);
  const [membroMenuId, setMembroMenuId] = useState<string | null>(null);
  const [pessoaModal, setPessoaModal] = useState<{
    id: string | null;
    nome: string;
    matricula: string;
    cargo: string;
    feriasInicio: string;
    feriasFim: string;
  } | null>(null);
  const [salvandoEquipe, setSalvandoEquipe] = useState(false);
  const equipeRef = useRef<HTMLElement>(null);

  // Feriados
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [feriadosAberto, setFeriadosAberto] = useState(false);
  const [feriasResumoAberto, setFeriasResumoAberto] = useState(false);
  const [feriadosForm, setFeriadosForm] = useState<Feriado[]>([]);
  const [salvandoFeriados, setSalvandoFeriados] = useState(false);

  useEffect(() => {
    Promise.all([getEscalas(), getEquipe(), getFeriados()])
      .then(([esc, eq, fer]) => {
        setEscalas(esc);
        setEquipe(eq);
        setFeriados(fer);
      })
      .catch(() => setErro("Não foi possível carregar as escalas."))
      .finally(() => setCarregando(false));
  }, []);

  // Fecha o menu da pessoa ao clicar fora do painel da equipe.
  useEffect(() => {
    if (!membroMenuId) return;
    const handler = (e: MouseEvent) => {
      if (equipeRef.current && !equipeRef.current.contains(e.target as Node)) {
        setMembroMenuId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [membroMenuId]);

  useEffect(() => {
    if (modalAberto) {
      const t = setTimeout(() => primeiroInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [modalAberto]);

  const salvarLista = async (lista: Escala[]) => {
    const atualizado = await saveEscalas(lista);
    setEscalas(atualizado);
  };

  const abrirModalNovo = () => {
    setEditando(null);
    setForm(formVazio());
    setErroSalvar(null);
    setModalAberto(true);
  };

  const abrirModalEditar = (escala: Escala) => {
    setEditando(escala);
    setForm({
      titulo: escala.titulo,
      ano: escala.ano,
      mes: escala.mes,
      dias: escala.dias.map((d) => ({ ...d })),
    });
    setErroSalvar(null);
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setEditando(null);
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const adicionarDia = () => {
    setForm((f) => ({
      ...f,
      dias: [
        ...f.dias,
        { id: gerarId("dia"), data: "", nome: "", matricula: "" },
      ],
    }));
  };

  const alterarDia = (id: string, campo: keyof EscalaDia, valor: string) => {
    setForm((f) => ({
      ...f,
      dias: f.dias.map((d) => (d.id === id ? { ...d, [campo]: valor } : d)),
    }));
  };

  const removerDia = (id: string) => {
    setForm((f) => ({ ...f, dias: f.dias.filter((d) => d.id !== id) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroSalvar(null);

    const ano = Number(form.ano);
    const mes = Number(form.mes);
    const minISO = primeiroDiaISO(ano, mes);
    const maxISO = ultimoDiaISO(ano, mes);

    // Mantém só linhas com algum conteúdo e valida a data escolhida.
    const preenchidos = form.dias.filter(
      (d) => d.data || d.nome.trim() || d.matricula.trim(),
    );
    const dias: EscalaDia[] = [];
    for (const d of preenchidos) {
      if (!d.data || d.data < minISO || d.data > maxISO) {
        setErroSalvar(
          `Escolha uma data dentro de ${MESES[mes - 1]}/${ano} para todas as linhas de plantão.`,
        );
        return;
      }
      dias.push({
        id: d.id,
        data: d.data,
        nome: d.nome.trim(),
        matricula: d.matricula.trim(),
      });
    }

    setSalvando(true);
    try {
      const agora = new Date().toISOString();
      const base = {
        titulo: form.titulo.trim() || `Plantão ${MESES[form.mes - 1]}`,
        ano,
        mes,
        dias,
        updatedAt: agora,
      };
      if (editando) {
        await salvarLista(
          escalas.map((esc) =>
            esc.id === editando.id ? { ...base, id: editando.id } : esc,
          ),
        );
      } else {
        await salvarLista([...escalas, { ...base, id: gerarId("esc") }]);
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
      await salvarLista(escalas.filter((esc) => esc.id !== confirmarRemocao));
    } finally {
      setConfirmarRemocao(null);
    }
  };

  // ─── Equipe T.I ──────────────────────────────────────────────────
  const persistirEquipe = async (lista: MembroEquipe[]) => {
    setSalvandoEquipe(true);
    try {
      const atualizado = await saveEquipe(lista);
      setEquipe(atualizado);
    } finally {
      setSalvandoEquipe(false);
    }
  };

  const abrirNovaPessoa = () =>
    setPessoaModal({ id: null, nome: "", matricula: "", cargo: "", feriasInicio: "", feriasFim: "" });

  const abrirEditarPessoa = (m: MembroEquipe) => {
    setMembroMenuId(null);
    setPessoaModal({
      id: m.id,
      nome: m.nome,
      matricula: m.matricula,
      cargo: m.cargo,
      feriasInicio: m.feriasInicio,
      feriasFim: m.feriasFim,
    });
  };

  const salvarPessoa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pessoaModal) return;
    const nome = pessoaModal.nome.trim();
    if (!nome) return;
    const matricula = pessoaModal.matricula.trim();
    const cargo = pessoaModal.cargo;
    const feriasInicio = pessoaModal.feriasInicio.trim();
    const feriasFim = pessoaModal.feriasFim.trim();
    const agora = new Date().toISOString();
    const lista = pessoaModal.id
      ? equipe.map((m) =>
          m.id === pessoaModal.id
            ? { ...m, nome, matricula, cargo, feriasInicio, feriasFim, updatedAt: agora }
            : m,
        )
      : [
          ...equipe,
          {
            id: gerarId("mem"),
            nome,
            matricula,
            cargo,
            feriasInicio,
            feriasFim,
            ordem: equipe.length,
            updatedAt: agora,
          },
        ];
    await persistirEquipe(lista);
    setPessoaModal(null);
  };

  const removerMembro = async (m: MembroEquipe) => {
    setMembroMenuId(null);
    await persistirEquipe(
      equipe.filter((x) => x.id !== m.id).map((x, i) => ({ ...x, ordem: i })),
    );
  };

  // ─── Feriados ────────────────────────────────────────────────────
  const abrirFeriados = () => {
    setFeriadosForm(feriados.map((f) => ({ ...f })));
    setFeriadosAberto(true);
  };

  const adicionarFeriado = () => {
    setFeriadosForm((l) => [
      ...l,
      { id: gerarId("fer"), data: "", nome: "", comPlantao: false, updatedAt: "" },
    ]);
  };

  const alterarFeriadoData = (id: string, valor: string) => {
    setFeriadosForm((l) =>
      l.map((f) => (f.id === id ? { ...f, data: valor } : f)),
    );
  };

  const alterarFeriadoNome = (id: string, valor: string) => {
    setFeriadosForm((l) =>
      l.map((f) => (f.id === id ? { ...f, nome: valor } : f)),
    );
  };

  const alterarFeriadoPlantao = (id: string, comPlantao: boolean) => {
    setFeriadosForm((l) =>
      l.map((f) => (f.id === id ? { ...f, comPlantao } : f)),
    );
  };

  const removerFeriadoRow = (id: string) => {
    setFeriadosForm((l) => l.filter((f) => f.id !== id));
  };

  const salvarFeriados = async () => {
    const agora = new Date().toISOString();
    const lista = feriadosForm
      .filter((f) => f.data)
      .map((f) => ({ ...f, nome: f.nome.trim(), updatedAt: agora }));
    setSalvandoFeriados(true);
    try {
      const atualizado = await saveFeriados(lista);
      setFeriados(atualizado);
      setFeriadosAberto(false);
    } finally {
      setSalvandoFeriados(false);
    }
  };

  // ─── Simulação da escala ─────────────────────────────────────────
  const simularDiasNoModal = () => {
    const ano = Number(form.ano);
    const mes = Number(form.mes);
    const anterior = escalaDoMes(escalas, new Date(ano, mes - 2, 1));
    const dias = simularDias(equipe, ano, mes, anterior, feriados);
    if (dias.length === 0) {
      setErroSalvar(
        "Cadastre pessoas na Equipe T.I (e tire alguém de férias) para simular.",
      );
      return;
    }
    setForm((f) => ({ ...f, dias }));
    setErroSalvar(null);
  };

  if (carregando) {
    return (
      <div className="esc-loading">
        <div className="esc-loading-spinner" />
        <span>Carregando escalas…</span>
      </div>
    );
  }

  if (erro) {
    return <div className="esc-erro">{erro}</div>;
  }

  return (
    <div className="esc-page">
      <div className="esc-layout">
        <div className="esc-main">
          <div className="esc-toolbar">
            <div className="esc-toolbar-title-group">
              <h2 className="esc-toolbar-title">Escala de Plantão</h2>
              <span className="esc-toolbar-sub">
                {escalas.length}{" "}
                {escalas.length === 1 ? "mês" : "meses"} cadastrados
              </span>
            </div>
            {isAdmin && (
              <div className="esc-toolbar-actions">
                <button
                  type="button"
                  className="esc-btn-add"
                  onClick={abrirModalNovo}
                >
                  + Adicionar
                </button>
                <button
                  type="button"
                  className="esc-btn-sim"
                  onClick={abrirFeriados}
                >
                  Feriados
                </button>
                <button
                  type="button"
                  className="esc-btn-sim"
                  onClick={() => setFeriasResumoAberto(true)}
                >
                  Férias
                </button>
              </div>
            )}
          </div>

          {escalas.length === 0 ? (
            <div className="esc-vazio">
              <p>Nenhuma escala cadastrada.</p>
            </div>
          ) : (
            <div className="esc-grid">
              {escalas.map((escala) => (
                <div key={escala.id} className="esc-card-wrap">
              <EscalaCard escala={escala} />
              {isAdmin && (
                <div className="esc-card-actions">
                  <button
                    type="button"
                    className="esc-btn-icon"
                    onClick={() => abrirModalEditar(escala)}
                    title="Editar escala"
                    aria-label="Editar escala"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="esc-btn-icon esc-btn-icon-danger"
                    onClick={() => setConfirmarRemocao(escala.id)}
                    title="Remover escala"
                    aria-label="Remover escala"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                      <path
                        fillRule="evenodd"
                        d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          ))}
            </div>
          )}
        </div>

        <aside className="esc-equipe" ref={equipeRef}>
          <div className="esc-equipe-header">
            <span className="esc-equipe-title">Equipe T.I</span>
            {isAdmin && (
              <button
                type="button"
                className="esc-equipe-add"
                onClick={abrirNovaPessoa}
                title="Adicionar pessoa"
                aria-label="Adicionar pessoa"
              >
                +
              </button>
            )}
          </div>

          {equipe.length === 0 ? (
            <div className="esc-equipe-vazio">Nenhuma pessoa cadastrada.</div>
          ) : (
            <ul className="esc-equipe-lista">
              {[...equipe].sort((a, b) => ordemDot(a) - ordemDot(b)).map((m) => (
                <li key={m.id} className="esc-membro-wrap">
                  <button
                    type="button"
                    className={[
                      "esc-membro",
                      membroEmFeriasHoje(m) || membroNaoEscalavel(m)
                        ? "esc-membro-ferias"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() =>
                      isAdmin &&
                      setMembroMenuId((id) => (id === m.id ? null : m.id))
                    }
                    disabled={!isAdmin}
                  >
                    <span
                      className={
                        membroEmFeriasHoje(m)
                          ? "esc-membro-dot esc-membro-dot-em-ferias"
                          : membroNaoEscalavel(m)
                            ? "esc-membro-dot esc-membro-dot-sem-escala"
                            : m.feriasInicio || m.feriasFim
                              ? "esc-membro-dot esc-membro-dot-ferias"
                              : "esc-membro-dot esc-membro-dot-ativo"
                      }
                    />
                    <span className="esc-membro-info">
                      <span className="esc-membro-nome">{m.nome}</span>
                      {m.cargo && (
                        <span className="esc-membro-cargo">{m.cargo}</span>
                      )}
                    </span>
                    {membroEmFeriasHoje(m) && (
                      <span
                        className="esc-membro-badge"
                        title={
                          m.feriasInicio
                            ? `${formatDiaCurto(m.feriasInicio)} – ${formatDiaCurto(m.feriasFim)}`
                            : ""
                        }
                      >
                        Férias
                      </span>
                    )}
                  </button>
                  {isAdmin && membroMenuId === m.id && (
                    <div className="esc-membro-menu">
                      <button type="button" onClick={() => abrirEditarPessoa(m)}>
                        Editar
                      </button>
                      <button
                        type="button"
                        className="esc-membro-menu-danger"
                        onClick={() => removerMembro(m)}
                      >
                        Remover
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      {/* Modal: Adicionar / Editar */}
      {modalAberto && (
        <div
          className="esc-modal-overlay"
          onClick={fecharModal}
          onKeyDown={(e) => e.key === "Escape" && fecharModal()}
        >
          <div
            className="esc-modal"
            role="dialog"
            aria-modal="true"
            aria-label={editando ? "Editar escala" : "Adicionar escala"}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="esc-modal-header">
              <h3>{editando ? "Editar Escala" : "Adicionar Escala"}</h3>
              <button
                type="button"
                className="esc-modal-close"
                onClick={fecharModal}
                aria-label="Fechar"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            <form className="esc-modal-form" onSubmit={handleSubmit}>
              <div className="esc-form-grid">
                <div className="esc-form-field esc-form-field-full">
                  <label htmlFor="esc-titulo">Título</label>
                  <input
                    ref={primeiroInputRef}
                    id="esc-titulo"
                    type="text"
                    value={form.titulo}
                    onChange={(e) => setField("titulo", e.target.value)}
                    placeholder="Ex: Plantão Junho"
                  />
                </div>
                <div className="esc-form-field">
                  <label htmlFor="esc-mes">Mês</label>
                  <select
                    id="esc-mes"
                    value={form.mes}
                    onChange={(e) => setField("mes", Number(e.target.value))}
                  >
                    {MESES.map((nome, i) => (
                      <option key={nome} value={i + 1}>
                        {nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="esc-form-field">
                  <label htmlFor="esc-ano">Ano</label>
                  <input
                    id="esc-ano"
                    type="number"
                    value={form.ano}
                    min={1000}
                    max={9999}
                    onChange={(e) => {
                      const val = Math.min(9999, Math.max(0, Number(e.target.value)));
                      setField("ano", val);
                    }}
                    placeholder="2026"
                  />
                </div>
              </div>

              <div className="esc-form-dias">
                <div className="esc-form-dias-header">
                  <span className="esc-form-dias-title">Dias de plantão</span>
                  <div className="esc-form-dias-acoes">
                    <button
                      type="button"
                      className="esc-btn-sim-dias"
                      onClick={simularDiasNoModal}
                      title="Preencher os fins de semana com a equipe (rodízio)"
                    >
                      Simular dias
                    </button>
                    <button
                      type="button"
                      className="esc-btn-add-dia"
                      onClick={adicionarDia}
                    >
                      + Adicionar dia
                    </button>
                  </div>
                </div>

                {form.dias.length === 0 ? (
                  <div className="esc-form-dias-vazio">
                    Nenhum dia adicionado.
                  </div>
                ) : (
                  <div className="esc-form-dias-lista">
                    <div className="esc-form-dia-row esc-form-dia-head">
                      <span>Data</span>
                      <span>Funcionário</span>
                      <span>Matrícula</span>
                      <span />
                    </div>
                    {form.dias.map((dia) => (
                      <div key={dia.id} className="esc-form-dia-row">
                        <input
                          type="date"
                          value={dia.data}
                          min={primeiroDiaISO(form.ano, form.mes)}
                          max={ultimoDiaISO(form.ano, form.mes)}
                          onChange={(e) => {
                            let v = e.target.value;
                            // Chrome deixa digitar ano com 5+ dígitos no campo;
                            // forçamos de volta o ano (4 dígitos) da escala.
                            const partes = v.split("-");
                            if (v && partes[0].length > 4) {
                              const ano4 = String(form.ano).padStart(4, "0");
                              v = `${ano4}-${partes[1]}-${partes[2]}`;
                              e.target.value = v;
                            }
                            alterarDia(dia.id, "data", v);
                          }}
                        />
                        <input
                          type="text"
                          value={dia.nome}
                          placeholder="Nome"
                          onChange={(e) =>
                            alterarDia(dia.id, "nome", e.target.value)
                          }
                        />
                        <input
                          type="text"
                          value={dia.matricula}
                          placeholder="Matrícula"
                          onChange={(e) =>
                            alterarDia(dia.id, "matricula", e.target.value)
                          }
                        />
                        <button
                          type="button"
                          className="esc-btn-remove-dia"
                          onClick={() => removerDia(dia.id)}
                          aria-label="Remover dia"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {erroSalvar && <p className="esc-modal-erro">{erroSalvar}</p>}
              <div className="esc-modal-footer">
                <button
                  type="button"
                  className="esc-btn-cancel"
                  onClick={fecharModal}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="esc-btn-save"
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

      {/* Modal: Nova / Editar pessoa */}
      {pessoaModal && (
        <div
          className="esc-modal-overlay"
          onClick={() => setPessoaModal(null)}
        >
          <div
            className="esc-modal esc-modal-confirm"
            role="dialog"
            aria-modal="true"
            aria-label={pessoaModal.id ? "Editar pessoa" : "Nova pessoa"}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="esc-modal-header">
              <h3>{pessoaModal.id ? "Editar pessoa" : "Nova pessoa"}</h3>
              <button
                type="button"
                className="esc-modal-close"
                onClick={() => setPessoaModal(null)}
                aria-label="Fechar"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
            <form className="esc-modal-form" onSubmit={salvarPessoa}>
              <div className="esc-pessoa-campos">
                <div className="esc-form-field">
                  <label htmlFor="esc-pessoa-nome">Nome</label>
                  <input
                    id="esc-pessoa-nome"
                    type="text"
                    autoFocus
                    value={pessoaModal.nome}
                    placeholder="Nome do colaborador"
                    onChange={(e) =>
                      setPessoaModal((p) =>
                        p ? { ...p, nome: e.target.value } : p,
                      )
                    }
                  />
                </div>
                <div className="esc-form-field">
                  <label htmlFor="esc-pessoa-matricula">Matrícula</label>
                  <input
                    id="esc-pessoa-matricula"
                    type="text"
                    value={pessoaModal.matricula}
                    placeholder="Matrícula"
                    onChange={(e) =>
                      setPessoaModal((p) =>
                        p ? { ...p, matricula: e.target.value } : p,
                      )
                    }
                  />
                </div>
                <div className="esc-form-field">
                  <label htmlFor="esc-pessoa-cargo">Cargo</label>
                  <select
                    id="esc-pessoa-cargo"
                    value={pessoaModal.cargo}
                    onChange={(e) =>
                      setPessoaModal((p) =>
                        p ? { ...p, cargo: e.target.value } : p,
                      )
                    }
                  >
                    <option value="">Selecione um cargo</option>
                    <optgroup label="Assistente de TI">
                      <option value="Assistente de TI I">Assistente de TI I</option>
                      <option value="Assistente de TI II">Assistente de TI II</option>
                      <option value="Assistente de TI III">Assistente de TI III</option>
                    </optgroup>
                    <optgroup label="Analista de TI">
                      <option value="Analista de TI I">Analista de TI I</option>
                      <option value="Analista de TI II">Analista de TI II</option>
                      <option value="Analista de TI III">Analista de TI III</option>
                    </optgroup>
<option value="Estagiário">Estagiário</option>
                    <option value="Aprendiz">Aprendiz</option>
                    <option value="Gerente de TI">Gerente de TI</option>
                  </select>
                </div>
                <div className="esc-ferias-titulo-row">
                  <span className="esc-ferias-titulo">Período de férias</span>
                  {(pessoaModal.feriasInicio || pessoaModal.feriasFim) && (
                    <button
                      type="button"
                      className="esc-btn-remover-ferias"
                      onClick={() =>
                        setPessoaModal((p) =>
                          p ? { ...p, feriasInicio: "", feriasFim: "" } : p,
                        )
                      }
                    >
                      Remover férias
                    </button>
                  )}
                </div>
                <div className="esc-ferias-row">
                  <div className="esc-form-field">
                    <label htmlFor="esc-ferias-inicio">Início</label>
                    <input
                      id="esc-ferias-inicio"
                      type="date"
                      value={pessoaModal.feriasInicio}
                      onChange={(e) =>
                        setPessoaModal((p) =>
                          p ? { ...p, feriasInicio: e.target.value } : p,
                        )
                      }
                    />
                  </div>
                  <div className="esc-form-field">
                    <label htmlFor="esc-ferias-fim">Fim</label>
                    <input
                      id="esc-ferias-fim"
                      type="date"
                      value={pessoaModal.feriasFim}
                      min={pessoaModal.feriasInicio || undefined}
                      onChange={(e) =>
                        setPessoaModal((p) =>
                          p ? { ...p, feriasFim: e.target.value } : p,
                        )
                      }
                    />
                  </div>
                </div>
                <p className="esc-feriados-dica">
                  Deixe em branco se não estiver de férias. A simulação exclui automaticamente quem estiver de férias no mês escalado.
                </p>
              </div>
              <div className="esc-modal-footer">
                <button
                  type="button"
                  className="esc-btn-cancel"
                  onClick={() => setPessoaModal(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="esc-btn-save"
                  disabled={salvandoEquipe || !pessoaModal.nome.trim()}
                >
                  {salvandoEquipe ? "Salvando…" : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Feriados */}
      {feriadosAberto && (
        <div
          className="esc-modal-overlay"
          onClick={() => setFeriadosAberto(false)}
        >
          <div
            className="esc-modal esc-modal-wide"
            role="dialog"
            aria-modal="true"
            aria-label="Configurar feriados"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="esc-modal-header">
              <h3>Feriados</h3>
              <button
                type="button"
                className="esc-modal-close"
                onClick={() => setFeriadosAberto(false)}
                aria-label="Fechar"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            <div className="esc-modal-form">
              <div className="esc-form-dias">
                <div className="esc-form-dias-header">
                  <span className="esc-form-dias-title">Dias de feriado</span>
                  <button
                    type="button"
                    className="esc-btn-add-dia"
                    onClick={adicionarFeriado}
                  >
                    + Adicionar feriado
                  </button>
                </div>

                {feriadosForm.length === 0 ? (
                  <div className="esc-form-dias-vazio">
                    Nenhum feriado cadastrado.
                  </div>
                ) : (
                  <div className="esc-form-dias-lista">
                    <div className="esc-form-fer-row esc-form-dia-head">
                      <span>Data</span>
                      <span>Descrição</span>
                      <span>Plantão</span>
                      <span />
                    </div>
                    {feriadosForm.map((f) => (
                      <div key={f.id} className="esc-form-fer-row">
                        <input
                          type="date"
                          value={f.data}
                          min="1000-01-01"
                          max="9999-12-31"
                          onChange={(e) => {
                            let v = e.target.value;
                            const partes = v.split("-");
                            if (v && partes[0].length > 4) {
                              v = `${partes[0].slice(0, 4)}-${partes[1]}-${partes[2]}`;
                              e.target.value = v;
                            }
                            alterarFeriadoData(f.id, v);
                          }}
                        />
                        <input
                          type="text"
                          value={f.nome}
                          placeholder="Ex: Corpus Christi"
                          onChange={(e) =>
                            alterarFeriadoNome(f.id, e.target.value)
                          }
                        />
                        <select
                          value={f.comPlantao ? "com" : "sem"}
                          onChange={(e) =>
                            alterarFeriadoPlantao(f.id, e.target.value === "com")
                          }
                        >
                          <option value="sem">Sem plantão</option>
                          <option value="com">Com plantão</option>
                        </select>
                        <button
                          type="button"
                          className="esc-btn-remove-dia"
                          onClick={() => removerFeriadoRow(f.id)}
                          aria-label="Remover feriado"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <p className="esc-feriados-dica">
                Feriados <strong>com plantão</strong> entram na simulação (mesmo
                em dia de semana); <strong>sem plantão</strong> saem dos dias a
                escalar, mesmo caindo num fim de semana.
              </p>

              <div className="esc-modal-footer">
                <button
                  type="button"
                  className="esc-btn-cancel"
                  onClick={() => setFeriadosAberto(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="esc-btn-save"
                  onClick={salvarFeriados}
                  disabled={salvandoFeriados}
                >
                  {salvandoFeriados ? "Salvando…" : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Férias da Equipe */}
      {feriasResumoAberto && (
        <div
          className="esc-modal-overlay"
          onClick={() => setFeriasResumoAberto(false)}
        >
          <div
            className="esc-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Férias da equipe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="esc-modal-header">
              <h3>Férias da Equipe</h3>
              <button
                type="button"
                className="esc-modal-close"
                onClick={() => setFeriasResumoAberto(false)}
                aria-label="Fechar"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            <div className="esc-modal-form">
              {equipe.length === 0 ? (
                <div className="esc-form-dias-vazio">
                  Nenhuma pessoa cadastrada na equipe.
                </div>
              ) : (
                <ul className="esc-ferias-lista">
                  {[...equipe]
                    .sort(
                      (a, b) =>
                        STATUS_FERIAS_ORDEM[statusFerias(a)] -
                        STATUS_FERIAS_ORDEM[statusFerias(b)],
                    )
                    .map((m) => {
                      const status = statusFerias(m);
                      return (
                        <li
                          key={m.id}
                          className={`esc-ferias-item esc-ferias-item-${status}`}
                        >
                          <span className="esc-ferias-nome">{m.nome}</span>
                          <span className="esc-ferias-datas">
                            {m.feriasInicio || m.feriasFim
                              ? `${formatDiaCurto(m.feriasInicio)} – ${formatDiaCurto(m.feriasFim)}`
                              : "—"}
                          </span>
                          <span
                            className={`esc-ferias-badge esc-ferias-badge-${status}`}
                          >
                            {STATUS_FERIAS_LABEL[status]}
                          </span>
                        </li>
                      );
                    })}
                </ul>
              )}

              <div className="esc-modal-footer">
                <button
                  type="button"
                  className="esc-btn-save"
                  onClick={() => setFeriasResumoAberto(false)}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmar remoção */}
      {confirmarRemocao && (
        <div
          className="esc-modal-overlay"
          onClick={() => setConfirmarRemocao(null)}
        >
          <div
            className="esc-modal esc-modal-confirm"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="esc-modal-header">
              <h3>Remover escala</h3>
            </div>
            <div className="esc-modal-body">
              Tem certeza que deseja remover esta escala? Esta ação não pode ser
              desfeita.
            </div>
            <div className="esc-modal-footer">
              <button
                type="button"
                className="esc-btn-cancel"
                onClick={() => setConfirmarRemocao(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="esc-btn-delete"
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
