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
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const MESES_ABREV = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

/** Título padrão sugerido para um mês (ex.: 7 → "Plantão Julho"). */
function tituloAutomatico(mes: number): string {
  return `Plantão ${MESES[mes - 1]}`;
}

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
  return (
    hoje >= (m.feriasInicio || "0000-01-01") &&
    hoje <= (m.feriasFim || "9999-12-31")
  );
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
function acharMembroId(equipe: MembroEquipe[], dia: EscalaDia): string | null {
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
 * Membros escaláveis cujas férias cruzam o mês da escala — usado para avisar
 * no card que alguém está/esteve de férias naquele mês, esteja ou não incluso
 * nos dias já cadastrados dela.
 */
function membrosDeFeriasNoMes(
  equipe: MembroEquipe[],
  escala: Escala,
): MembroEquipe[] {
  const inicioMes = primeiroDiaISO(escala.ano, escala.mes);
  const fimMes = ultimoDiaISO(escala.ano, escala.mes);
  return equipe.filter((m) => {
    if (membroNaoEscalavel(m)) return false;
    if (!m.feriasInicio && !m.feriasFim) return false;
    const inicio = m.feriasInicio || "0000-01-01";
    const fim = m.feriasFim || "9999-12-31";
    return inicio <= fimMes && fim >= inicioMes;
  });
}

/** true se o membro aparece em algum dia já cadastrado da escala. */
function membroNaEscala(
  equipe: MembroEquipe[],
  escala: Escala,
  membroId: string,
): boolean {
  return escala.dias.some((d) => acharMembroId(equipe, d) === membroId);
}


/**
 * Gera os dias de plantão de um mês seguindo a ordem fixa da fila (regras 1-6).
 *
 * 1. Fila fixa e contínua: a equipe é percorrida na ordem definida (`ordem`);
 *    depois do último volta-se ao primeiro.
 * 2. Continuidade entre meses: a fila nunca reinicia. É reconstruída replayando,
 *    em ordem cronológica, quem foi REALMENTE escalado no histórico (cada
 *    escalado vai para o fim da fila), então o 1º plantão do mês cai no próximo
 *    da fila depois do último escalado.
 * 3. Ordem é prioridade: não há tentativa de equilibrar a quantidade de plantões.
 * 4. Indisponibilidade: para cada fim de semana de plantão considera-se a janela
 *    [sexta, sábado, domingo, segunda]. Qualquer indisponibilidade nessa janela
 *    impede a pessoa de assumir o fim de semana. Quem está indisponível perde a
 *    vez e vai para o fim da fila (volta só depois que todos passarem).
 * 5. Sem repetição em plantões consecutivos: ninguém assume dois plantões
 *    seguidos; nesse caso procura-se o próximo elegível da fila.
 * 6. Sem ninguém disponível: o dia é criado com nome "A DEFINIR" (a fila fica
 *    inalterada) para edição manual posterior.
 *
 * Os `feriados` do mês ajustam os dias a escalar: um feriado "sem plantão" sai
 * da lista (mesmo num fim de semana) e um feriado "com plantão" entra (mesmo num
 * dia de semana).
 */
function gerarEscalaRoundRobin(
  equipe: MembroEquipe[],
  ano: number,
  mes: number,
  escalas: Escala[],
  feriados: Feriado[],
  filaInicialIds?: string[],
  foraIds?: string[],
): EscalaDia[] {
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

  const ordenada = [...equipe]
    .filter((m) => !membroNaoEscalavel(m))
    .sort((a, b) => a.ordem - b.ordem);
  if (ordenada.length === 0) return [];

  // ── Fila inicial ───────────────────────────────────────────────────────
  // Se filaInicialIds for fornecida (modo manual), usa-a diretamente.
  // Novos membros ainda não na lista são acrescentados ao final pela ordem.
  // Caso contrário, reconstrói via replay cronológico do histórico.
  let fila: MembroEquipe[];
  let prevAssigneeId: string | null = null;

  if (filaInicialIds && filaInicialIds.length > 0) {
    const existentes = filaInicialIds
      .map((id) => ordenada.find((m) => m.id === id))
      .filter((m): m is MembroEquipe => m !== undefined);
    const idsNaLista = new Set(filaInicialIds);
    const extras = ordenada.filter((m) => !idsNaLista.has(m.id));
    fila = [...existentes, ...extras];
  } else {
    fila = [...ordenada];
    const historico = escalas
      .filter((e) => e.ano < ano || (e.ano === ano && e.mes < mes))
      .sort((a, b) => a.ano - b.ano || a.mes - b.mes);
    const diasHistorico = historico
      .flatMap((esc) => esc.dias)
      .filter((d) => d.data)
      .sort((a, b) => a.data.localeCompare(b.data));
    for (const d of diasHistorico) {
      const id = acharMembroId(equipe, d);
      prevAssigneeId = id;
      if (id == null) continue;
      const idx = fila.findIndex((m) => m.id === id);
      if (idx === -1) continue;
      const [pessoa] = fila.splice(idx, 1);
      fila.push(pessoa);
    }
  }

  const resultado: EscalaDia[] = [];

  for (const data of dias) {
    // Procura o primeiro elegível: disponível no dia (regra 4) e diferente
    // de quem fez o plantão anterior (regra 5). A ordem da fila é prioridade
    // absoluta — sem balanceamento (regra 3).
    let escolhidoIdx = -1;
    for (let i = 0; i < fila.length; i++) {
      const m = fila[i];
      if (foraIds && foraIds.includes(m.id)) continue;
      if (m.feriasInicio || m.feriasFim) {
        const ini = m.feriasInicio || "0000-01-01";
        const fim = m.feriasFim || "9999-12-31";
        if (data >= ini && data <= fim) continue;
      }
      if (m.id === prevAssigneeId) continue;
      escolhidoIdx = i;
      break;
    }

    // Regra 6: ninguém disponível → "A DEFINIR", fila inalterada.
    if (escolhidoIdx === -1) {
      resultado.push({
        id: gerarId("dia"),
        data,
        nome: "A DEFINIR",
        matricula: "",
      });
      prevAssigneeId = null;
      continue;
    }

    // Regra 4 (rotação): só o escolhido vai para o fim da fila; quem foi pulado
    // permanece na frente e terá prioridade no próximo plantão.
    const escolhido = fila[escolhidoIdx];
    fila.splice(escolhidoIdx, 1);
    fila.push(escolhido);

    prevAssigneeId = escolhido.id;
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

/**
 * Reconstrói a fila atual replaying todo o histórico de escalas, retornando
 * os IDs dos membros escaláveis na ordem em que estão na fila.
 */
function computarFilaAtual(equipe: MembroEquipe[], escalas: Escala[]): string[] {
  const ordenada = [...equipe]
    .filter((m) => !membroNaoEscalavel(m))
    .sort((a, b) => a.ordem - b.ordem);
  const fila = [...ordenada];
  const dias = [...escalas]
    .flatMap((esc) => esc.dias)
    .filter((d) => d.data)
    .sort((a, b) => a.data.localeCompare(b.data));
  for (const d of dias) {
    const id = acharMembroId(equipe, d);
    if (id == null) continue;
    const idx = fila.findIndex((m) => m.id === id);
    if (idx === -1) continue;
    const [pessoa] = fila.splice(idx, 1);
    fila.push(pessoa);
  }
  return fila.map((m) => m.id);
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
    titulo: tituloAutomatico(mes),
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

  // Fila manual
  const [verFila, setVerFila] = useState(false);
  const [filaManual, setFilaManual] = useState<string[] | null>(null);
  const [foraIds, setForaIds] = useState<string[]>([]);
  const [arrastandoId, setArrastandoId] = useState<string | null>(null);
  const [sobreId, setSobreId] = useState<string | null>(null);

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
  const [avisoFeriasEscala, setAvisoFeriasEscala] = useState<Escala | null>(
    null,
  );

  useEffect(() => {
    Promise.all([getEscalas(), getEquipe(), getFeriados()])
      .then(([esc, eq, fer]) => {
        setEscalas(esc);
        setEquipe(eq);
        setFeriados(fer);
        const raw = localStorage.getItem("esc_fila_manual");
        if (raw) {
          try { setFilaManual(JSON.parse(raw) as string[]); } catch { /* ignore */ }
        }
        const rawFora = localStorage.getItem("esc_fora_ids");
        if (rawFora) {
          try { setForaIds(JSON.parse(rawFora) as string[]); } catch { /* ignore */ }
        }
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

  /**
   * Troca o mês selecionado. Se o título ainda for o padrão automático do mês
   * atual (ou estiver vazio), atualiza-o junto para o novo mês; se o usuário já
   * personalizou o título, mantém o texto digitado.
   */
  const selecionarMes = (novoMes: number) => {
    setForm((f) => {
      const eraAutomatico =
        !f.titulo.trim() || f.titulo === tituloAutomatico(f.mes);
      return {
        ...f,
        mes: novoMes,
        titulo: eraAutomatico ? tituloAutomatico(novoMes) : f.titulo,
      };
    });
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

  /**
   * Atualiza o nome do dia e, se o texto digitado bater com alguém da Equipe
   * T.I (seleção via datalist), já preenche a matrícula automaticamente.
   */
  const alterarNomeDia = (id: string, valor: string) => {
    const membro = equipe.find(
      (m) => m.nome.trim().toLowerCase() === valor.trim().toLowerCase(),
    );
    setForm((f) => ({
      ...f,
      dias: f.dias.map((d) =>
        d.id === id
          ? {
              ...d,
              nome: valor,
              matricula: membro ? membro.matricula : d.matricula,
            }
          : d,
      ),
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
        titulo: form.titulo.trim() || tituloAutomatico(form.mes),
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
    setPessoaModal({
      id: null,
      nome: "",
      matricula: "",
      cargo: "",
      feriasInicio: "",
      feriasFim: "",
    });

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
            ? {
                ...m,
                nome,
                matricula,
                cargo,
                feriasInicio,
                feriasFim,
                updatedAt: agora,
              }
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

  /** Remove só o período de férias do membro, sem abrir o modal de edição. */
  const removerFeriasMembro = async (m: MembroEquipe) => {
    const agora = new Date().toISOString();
    await persistirEquipe(
      equipe.map((x) =>
        x.id === m.id
          ? { ...x, feriasInicio: "", feriasFim: "", updatedAt: agora }
          : x,
      ),
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
      {
        id: gerarId("fer"),
        data: "",
        nome: "",
        comPlantao: false,
        updatedAt: "",
      },
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

  // ─── Exportar para Excel (.xls HTML-table) ───────────────────────
  const exportarExcel = () => {
    if (escalas.length === 0) return;

    const ordenadas = [...escalas].sort((a, b) => a.ano - b.ano || a.mes - b.mes);

    // Para cada mês, constrói linhas igual ao EscalaCard: grupos separados por null
    const blocos = ordenadas.map((escala) => {
      const grupos = agruparDias(escala.dias);
      const linhas: Array<{ data: string; nome: string; matricula: string } | null> = [];
      grupos.forEach((grupo, gi) => {
        if (gi > 0) linhas.push(null);
        for (const dia of grupo) {
          linhas.push({ data: dia.data, nome: dia.nome, matricula: dia.matricula });
        }
      });
      return { titulo: escala.titulo, linhas };
    });

    const maxLinhas = Math.max(...blocos.map((b) => b.linhas.length), 0);

    const S = {
      titulo: "font-family:Calibri,Arial,sans-serif;font-size:11pt;font-weight:bold;background:#1e3a5f;color:#ffffff;text-align:center;padding:5px 10px;",
      data: "font-family:Calibri,Arial,sans-serif;font-size:10pt;color:#555;white-space:nowrap;padding:2px 8px;",
      nome: "font-family:Calibri,Arial,sans-serif;font-size:10pt;padding:2px 8px;",
      mat: "font-family:Calibri,Arial,sans-serif;font-size:10pt;color:#888;padding:2px 8px;",
      sep: "width:18px;",
    };

    const td = (content: string, style: string) =>
      `<td style="${style}">${content}</td>`;

    let rows = "";

    // Linha de títulos
    rows += "<tr>";
    blocos.forEach(({ titulo }, i) => {
      rows += td(titulo, S.titulo) + td("", S.titulo) + td("", S.titulo);
      if (i < blocos.length - 1) rows += td("", S.sep);
    });
    rows += "</tr>";

    // Linhas de dados
    for (let r = 0; r < maxLinhas; r++) {
      rows += "<tr>";
      blocos.forEach(({ linhas }, i) => {
        const linha = r < linhas.length ? linhas[r] : undefined;
        if (!linha) {
          // null = separador de grupo; undefined = mês sem mais linhas
          rows += td("", "") + td("", "") + td("", "");
        } else {
          rows += td(formatDiaCurto(linha.data), S.data);
          rows += td(linha.nome, S.nome);
          rows += td(linha.matricula, S.mat);
        }
        if (i < blocos.length - 1) rows += td("", S.sep);
      });
      rows += "</tr>";
    }

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:x="urn:schemas-microsoft-com:office:excel"
xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets>
<x:ExcelWorksheet><x:Name>Escala Plantão</x:Name>
<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
</head><body>
<table border="0" cellspacing="0" cellpadding="0">${rows}</table>
</body></html>`;

    const blob = new Blob(["﻿" + html], {
      type: "application/vnd.ms-excel;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "escala-plantao.xls";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Fila manual ─────────────────────────────────────────────────
  const escalaveisIds = new Set(
    equipe.filter((m) => !membroNaoEscalavel(m)).map((m) => m.id),
  );

  // IDs dos membros escaláveis na ordem atual da fila (manual ou automática).
  // Membros adicionados depois da última gravação manual aparecem ao final.
  const filaAtualIds: string[] = (() => {
    if (filaManual) {
      const existentes = filaManual.filter((id) => escalaveisIds.has(id));
      const novos = [...equipe]
        .filter((m) => !membroNaoEscalavel(m) && !existentes.includes(m.id))
        .sort((a, b) => a.ordem - b.ordem)
        .map((m) => m.id);
      return [...existentes, ...novos];
    }
    return computarFilaAtual(equipe, escalas);
  })();

  const filaAtual = filaAtualIds
    .map((id) => equipe.find((m) => m.id === id))
    .filter((m): m is MembroEquipe => m !== undefined);

  const salvarFilaManual = (ids: string[] | null) => {
    if (ids) {
      localStorage.setItem("esc_fila_manual", JSON.stringify(ids));
    } else {
      localStorage.removeItem("esc_fila_manual");
    }
    setFilaManual(ids);
  };

  const moverParaPosicao = (id: string, destIdx: number) => {
    const nova = [...filaAtualIds];
    const origIdx = nova.indexOf(id);
    if (origIdx === -1 || origIdx === destIdx) return;
    nova.splice(origIdx, 1);
    nova.splice(destIdx, 0, id);
    salvarFilaManual(nova);
  };

  const toggleFora = (id: string) => {
    const nova = foraIds.includes(id)
      ? foraIds.filter((x) => x !== id)
      : [...foraIds, id];
    localStorage.setItem("esc_fora_ids", JSON.stringify(nova));
    setForaIds(nova);
  };

  // ─── Simulação da escala ─────────────────────────────────────────
  const simularDiasNoModal = () => {
    const ano = Number(form.ano);
    const mes = Number(form.mes);
    const dias = gerarEscalaRoundRobin(equipe, ano, mes, escalas, feriados, filaManual ?? undefined, foraIds.length ? foraIds : undefined);
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
                {escalas.length} {escalas.length === 1 ? "mês" : "meses"}{" "}
                cadastrados
              </span>
            </div>
            <div className="esc-toolbar-actions">
              {isAdmin && (
                <>
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
                </>
              )}
              {escalas.length > 0 && (
                <button
                  type="button"
                  className="esc-btn-sim"
                  onClick={exportarExcel}
                  title="Exportar escala para Excel"
                >
                  Exportar Excel
                </button>
              )}
            </div>
          </div>

          {escalas.length === 0 ? (
            <div className="esc-vazio">
              <p>Nenhuma escala cadastrada.</p>
            </div>
          ) : (
            <div className="esc-grid">
              {escalas.map((escala) => {
                const deFerias = membrosDeFeriasNoMes(equipe, escala);
                return (
                  <div key={escala.id} className="esc-card-wrap">
                    <EscalaCard escala={escala} />
                    {deFerias.length > 0 && (
                      <div className="esc-card-actions-left">
                        <button
                          type="button"
                          className="esc-btn-icon esc-btn-icon-ferias"
                          onClick={() => setAvisoFeriasEscala(escala)}
                          title={`De férias neste mês: ${deFerias.map((m: MembroEquipe) => m.nome).join(", ")}`}
                          aria-label="Funcionário de férias neste mês"
                        >
                          !
                        </button>
                      </div>
                    )}
                    {isAdmin && (
                      <div className="esc-card-actions">
                        <button
                          type="button"
                          className="esc-btn-icon"
                          onClick={() => abrirModalEditar(escala)}
                          title="Editar escala"
                          aria-label="Editar escala"
                        >
                          <svg
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            width="14"
                            height="14"
                          >
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
                          <svg
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            width="14"
                            height="14"
                          >
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
                );
              })}
            </div>
          )}
        </div>

        <aside className="esc-equipe" ref={equipeRef}>
          <div className="esc-equipe-header">
            <div className="esc-sidebar-tabs">
              <button
                type="button"
                className={`esc-sidebar-tab${!verFila ? " esc-sidebar-tab-ativo" : ""}`}
                onClick={() => setVerFila(false)}
              >
                Equipe
              </button>
              <button
                type="button"
                className={`esc-sidebar-tab${verFila ? " esc-sidebar-tab-ativo" : ""}`}
                onClick={() => setVerFila(true)}
              >
                Fila
              </button>
            </div>
            {!verFila && isAdmin && (
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

          {!verFila ? (
            equipe.length === 0 ? (
              <div className="esc-equipe-vazio">Nenhuma pessoa cadastrada.</div>
            ) : (
              <ul className="esc-equipe-lista">
                {[...equipe]
                  .sort((a, b) => ordemDot(a) - ordemDot(b))
                  .map((m) => (
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
                        {isAdmin && (
                          <svg
                            className="esc-membro-edit-icon"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            width="13"
                            height="13"
                            aria-hidden="true"
                          >
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                        )}
                      </button>
                      {isAdmin && membroMenuId === m.id && (
                        <div className="esc-membro-menu">
                          <button
                            type="button"
                            onClick={() => abrirEditarPessoa(m)}
                          >
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
            )
          ) : (
            <>
              {filaAtual.length === 0 ? (
                <div className="esc-equipe-vazio">Nenhum membro escalável.</div>
              ) : (
                <ul className="esc-fila-lista">
                  {(() => {
                    const primeiroAtivoIdx = filaAtual.findIndex(
                      (m) => !foraIds.includes(m.id),
                    );
                    return filaAtual.map((m, i) => {
                      const eFora = foraIds.includes(m.id);
                      const podeArrastar = isAdmin && !eFora;
                      return (
                        <li
                          key={m.id}
                          draggable={podeArrastar}
                          onDragStart={(e) => {
                            setArrastandoId(m.id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragOver={(e) => {
                            if (!arrastandoId || arrastandoId === m.id) return;
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                            setSobreId(m.id);
                          }}
                          onDragLeave={() =>
                            setSobreId((cur) => (cur === m.id ? null : cur))
                          }
                          onDrop={(e) => {
                            e.preventDefault();
                            if (arrastandoId && arrastandoId !== m.id) {
                              moverParaPosicao(arrastandoId, i);
                            }
                            setArrastandoId(null);
                            setSobreId(null);
                          }}
                          onDragEnd={() => {
                            setArrastandoId(null);
                            setSobreId(null);
                          }}
                          className={[
                            "esc-fila-row",
                            i === primeiroAtivoIdx
                              ? "esc-fila-row-primeiro"
                              : "",
                            eFora ? "esc-fila-row-fora" : "",
                            arrastandoId === m.id ? "esc-fila-row-arrastando" : "",
                            sobreId === m.id && arrastandoId !== m.id
                              ? "esc-fila-row-sobre"
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {podeArrastar && (
                            <span
                              className="esc-fila-handle"
                              title="Arraste para reordenar"
                            >
                              ⠿
                            </span>
                          )}
                          <span className="esc-fila-pos">{i + 1}</span>
                          <span className="esc-fila-nome">{m.nome}</span>
                          {eFora && (
                            <span className="esc-fila-badge-fora">Fora</span>
                          )}
                          {isAdmin && (
                            <div className="esc-fila-actions">
                              <button
                                type="button"
                                className={`esc-fila-btn-fora${eFora ? " esc-fila-btn-fora-ativo" : ""}`}
                                onClick={() => toggleFora(m.id)}
                                title={
                                  eFora
                                    ? "Colocar de volta na fila"
                                    : "Retirar do mês"
                                }
                              >
                                {eFora ? "↩" : "×"}
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    });
                  })()}
                </ul>
              )}
              {isAdmin && (
                <div className="esc-fila-footer">
                  <span
                    className={`esc-fila-status${filaManual ? " esc-fila-status-manual" : ""}`}
                  >
                    {filaManual ? "Manual" : "Automático"}
                  </span>
                  {filaManual && (
                    <button
                      type="button"
                      className="esc-btn-fila-reset"
                      onClick={() => salvarFilaManual(null)}
                    >
                      Usar automático
                    </button>
                  )}
                </div>
              )}
            </>
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
                    onChange={(e) => selecionarMes(Number(e.target.value))}
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
                      const val = Math.min(
                        9999,
                        Math.max(0, Number(e.target.value)),
                      );
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
                          list="esc-dia-equipe-nomes"
                          onChange={(e) =>
                            alterarNomeDia(dia.id, e.target.value)
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
                <datalist id="esc-dia-equipe-nomes">
                  {equipe.map((m) => (
                    <option key={m.id} value={m.nome} />
                  ))}
                </datalist>
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
        <div className="esc-modal-overlay" onClick={() => setPessoaModal(null)}>
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
                      <option value="Assistente de TI I">
                        Assistente de TI I
                      </option>
                      <option value="Assistente de TI II">
                        Assistente de TI II
                      </option>
                      <option value="Assistente de TI III">
                        Assistente de TI III
                      </option>
                    </optgroup>
                    <optgroup label="Analista de TI">
                      <option value="Analista de TI I">Analista de TI I</option>
                      <option value="Analista de TI II">
                        Analista de TI II
                      </option>
                      <option value="Analista de TI III">
                        Analista de TI III
                      </option>
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
                  Deixe em branco se não estiver de férias. A simulação exclui
                  automaticamente quem estiver de férias no mês escalado.
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
                            alterarFeriadoPlantao(
                              f.id,
                              e.target.value === "com",
                            )
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
                          {isAdmin && status !== "nenhuma" && (
                            <button
                              type="button"
                              className="esc-ferias-remover"
                              onClick={() => removerFeriasMembro(m)}
                              disabled={salvandoEquipe}
                              title="Remover férias deste funcionário"
                              aria-label={`Remover férias de ${m.nome}`}
                            >
                              ✕
                            </button>
                          )}
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

      {/* Modal: Aviso de funcionário(s) de férias fora da escala */}
      {avisoFeriasEscala && (
        <div
          className="esc-modal-overlay"
          onClick={() => setAvisoFeriasEscala(null)}
        >
          <div
            className="esc-modal esc-modal-confirm"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="esc-modal-header">
              <h3>Aviso de férias</h3>
            </div>
            <div className="esc-modal-body">
              {membrosDeFeriasNoMes(equipe, avisoFeriasEscala).map(
                (m: MembroEquipe) => {
                  const naEscala = membroNaEscala(
                    equipe,
                    avisoFeriasEscala,
                    m.id,
                  );
                  return (
                    <p key={m.id}>
                      <strong>{m.nome}</strong> está de férias de{" "}
                      {formatDiaCurto(m.feriasInicio)} até{" "}
                      {formatDiaCurto(m.feriasFim)}
                      {naEscala
                        ? " neste mês."
                        : " e não está incluso(a) na escala deste mês."}
                    </p>
                  );
                },
              )}
            </div>
            <div className="esc-modal-footer">
              <button
                type="button"
                className="esc-btn-cancel"
                onClick={() => setAvisoFeriasEscala(null)}
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
