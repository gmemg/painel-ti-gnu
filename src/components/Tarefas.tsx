import { useEffect, useMemo, useRef, useState } from "react";
import { Tarefa, TarefaPrioridade, TarefaStatus } from "../types";
import { saveTarefas, reconcileTarefasAutomaticas } from "../utils/storage";
import { formatDateTime } from "../utils/dateUtils";
import "./Tarefas.css";

const PRIORIDADES: Array<{ value: TarefaPrioridade; label: string; cor: string }> = [
  { value: "baixa",   label: "Baixa",   cor: "#22c55e" },
  { value: "media",   label: "Média",   cor: "#f5c200" },
  { value: "alta",    label: "Alta",    cor: "#f97316" },
  { value: "critica", label: "Crítica", cor: "#ef4444" },
];

const STATUS_LIST: Array<{ value: TarefaStatus; label: string; cor: string }> = [
  { value: "pendente",     label: "Pendente",     cor: "#9ca3af" },
  { value: "em_andamento", label: "Em andamento", cor: "#2b8ffb" },
  { value: "concluida",    label: "Concluído",    cor: "#22c55e" },
  { value: "cancelada",    label: "Cancelada",    cor: "#ef4444" },
];

const FORM_VAZIO = {
  tarefa: "",
  descricao: "",
  prioridade: "media" as TarefaPrioridade,
  status: "pendente" as TarefaStatus,
  responsavel: "",
  prazo: "",
  chamado: "",
  dataCriacao: "",
};

function gerarId(): string {
  return `trf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function prazoUrgente(prazo: string): boolean {
  if (!prazo) return false;
  const dataPrazo = new Date(prazo);
  const agora = new Date();
  const diff = dataPrazo.getTime() - agora.getTime();
  return diff >= 0 && diff <= 24 * 60 * 60 * 1000;
}

function toLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

export default function Tarefas() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Tarefa | null>(null);
  const [form, setForm] = useState({ ...FORM_VAZIO });
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [confirmarRemocao, setConfirmarRemocao] = useState<string | null>(null);
  const primeiroInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    reconcileTarefasAutomaticas()
      .then(setTarefas)
      .catch(console.error)
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      reconcileTarefasAutomaticas()
        .then(setTarefas)
        .catch(console.error);
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (modalAberto) {
      const t = setTimeout(() => primeiroInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [modalAberto]);

  const salvarLista = async (lista: Tarefa[]) => {
    const atualizado = await saveTarefas(lista);
    setTarefas(atualizado);
  };

  const adicionarTarefaTeste = async () => {
    const agora = new Date();
    const emUmaSemana = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);
    const tarefaTeste: Tarefa = {
      id: gerarId(),
      tarefa: "Tarefa de Teste",
      descricao: "Descrição da tarefa de teste",
      prioridade: "media",
      status: "pendente",
      responsavel: "Responsável Teste",
      prazo: emUmaSemana.toISOString(),
      chamado: "00001",
      dataCriacao: agora.toISOString(),
      updatedAt: agora.toISOString(),
    };
    await salvarLista([...tarefas, tarefaTeste]);
  };

  const abrirModalNovo = () => {
    setEditando(null);
    setForm({
      ...FORM_VAZIO,
      dataCriacao: toLocalInput(new Date().toISOString()),
    });
    setModalAberto(true);
  };

  const abrirModalEditar = (t: Tarefa) => {
    setEditando(t);
    setForm({
      tarefa: t.tarefa,
      descricao: t.descricao,
      prioridade: t.prioridade,
      status: t.status,
      responsavel: t.responsavel,
      prazo: toLocalInput(t.prazo),
      chamado: t.chamado,
      dataCriacao: toLocalInput(t.dataCriacao),
    });
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setEditando(null);
    setErroSalvar(null);
  };

  const setField = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErroSalvar(null);
    try {
      const agora = new Date().toISOString();
      const tarefa: Tarefa = {
        id: editando?.id ?? gerarId(),
        tarefa: form.tarefa,
        descricao: form.descricao,
        prioridade: form.prioridade,
        status: form.status,
        responsavel: form.responsavel,
        prazo: form.prazo ? new Date(form.prazo).toISOString() : "",
        chamado: form.chamado,
        dataCriacao: form.dataCriacao
          ? new Date(form.dataCriacao).toISOString()
          : agora,
        updatedAt: agora,
      };
      if (editando) {
        await salvarLista(tarefas.map((t) => (t.id === editando.id ? tarefa : t)));
      } else {
        await salvarLista([...tarefas, tarefa]);
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
      await salvarLista(tarefas.filter((t) => t.id !== confirmarRemocao));
    } finally {
      setConfirmarRemocao(null);
    }
  };

  const tarefasView = useMemo(
    () =>
      tarefas.map((t) => ({
          ...t,
          urgente: prazoUrgente(t.prazo),
          prazoFormatado: t.prazo ? formatDateTime(t.prazo) : "—",
          dataCriacaoFormatada: t.dataCriacao ? formatDateTime(t.dataCriacao) : "—",
          prioridadeInfo: PRIORIDADES.find((p) => p.value === t.prioridade) ?? PRIORIDADES[1],
          statusInfo: STATUS_LIST.find((s) => s.value === t.status) ?? STATUS_LIST[0],
        })),
    [tarefas],
  );

  if (carregando) return <div className="trf-loading">Carregando…</div>;

  return (
    <div className="trf-page">
      <div className="trf-header">
        <div className="trf-header-left">
          <button type="button" className="trf-btn-add" onClick={abrirModalNovo}>
            + Adicionar
          </button>
          <button type="button" className="trf-btn-teste" onClick={adicionarTarefaTeste}>
            + Adicionar Teste
          </button>
          <div className="trf-stat">
            Tarefas pendentes:{" "}
            <strong>
              {tarefas.filter((t) => t.status === "pendente" || t.status === "em_andamento").length}
            </strong>
          </div>
        </div>
        <div className="trf-header-center">
          <h2>TAREFAS</h2>
        </div>
        <div className="trf-header-right" />
      </div>

      <div className="trf-table-wrap">
        <table className="trf-table">
          <thead>
            <tr>
              <th>Tarefa</th>
              <th>Descrição</th>
              <th>Status</th>
              <th>Responsável</th>
              <th>Prazo</th>
              <th>Chamado</th>
              <th>Criado em</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {tarefasView.length === 0 ? (
              <tr>
                <td colSpan={8} className="trf-empty">
                  Nenhuma tarefa cadastrada.
                </td>
              </tr>
            ) : (
              tarefasView.map((t) => (
                <tr
                  key={t.id}
                  className={t.urgente ? "trf-linha-urgente" : undefined}
                >
                  <td className="trf-td-tarefa">{t.tarefa}</td>
                  <td className="trf-td-desc">{t.descricao || "—"}</td>
                  <td>
                    <span
                      className="trf-badge"
                      style={{
                        backgroundColor: t.statusInfo.cor + "22",
                        color: t.statusInfo.cor,
                        borderColor: t.statusInfo.cor + "55",
                      }}
                    >
                      {t.statusInfo.label}
                    </span>
                  </td>
                  <td>{t.responsavel || "—"}</td>
                  <td className="trf-td-prazo">{t.prazoFormatado}</td>
                  <td>{t.chamado || "—"}</td>
                  <td>{t.dataCriacaoFormatada}</td>
                  <td className="trf-td-acoes">
                    <div className="trf-acoes-inner">
                      <button
                        type="button"
                        className="trf-btn-editar"
                        onClick={() => abrirModalEditar(t)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="trf-btn-remover"
                        onClick={() => setConfirmarRemocao(t.id)}
                        aria-label="Remover tarefa"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalAberto && (
        <div
          className="trf-modal-overlay"
          onClick={fecharModal}
          onKeyDown={(e) => e.key === "Escape" && fecharModal()}
        >
          <div
            className="trf-modal"
            role="dialog"
            aria-modal="true"
            aria-label={editando ? "Editar tarefa" : "Nova tarefa"}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="trf-modal-header">
              <h3>{editando ? "Editar Tarefa" : "Nova Tarefa"}</h3>
              <button
                type="button"
                className="trf-modal-close"
                onClick={fecharModal}
                aria-label="Fechar"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            <form className="trf-modal-form" onSubmit={handleSubmit}>
              <div className="trf-form-grid">
                <div className="trf-form-field trf-field-full">
                  <label htmlFor="trf-tarefa">Tarefa *</label>
                  <input
                    ref={primeiroInputRef}
                    id="trf-tarefa"
                    type="text"
                    required
                    value={form.tarefa}
                    onChange={(e) => setField("tarefa", e.target.value)}
                    placeholder="Nome da tarefa"
                  />
                </div>
                <div className="trf-form-field trf-field-full">
                  <label htmlFor="trf-desc">Descrição</label>
                  <textarea
                    id="trf-desc"
                    value={form.descricao}
                    onChange={(e) => setField("descricao", e.target.value)}
                    placeholder="Descrição detalhada"
                    rows={3}
                  />
                </div>
                <div className="trf-form-field">
                  <label htmlFor="trf-prioridade">Prioridade</label>
                  <select
                    id="trf-prioridade"
                    value={form.prioridade}
                    onChange={(e) =>
                      setField("prioridade", e.target.value as TarefaPrioridade)
                    }
                  >
                    {PRIORIDADES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="trf-form-field">
                  <label htmlFor="trf-status">Status</label>
                  <select
                    id="trf-status"
                    value={form.status}
                    onChange={(e) =>
                      setField("status", e.target.value as TarefaStatus)
                    }
                  >
                    {STATUS_LIST.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="trf-form-field">
                  <label htmlFor="trf-responsavel">Responsável</label>
                  <input
                    id="trf-responsavel"
                    type="text"
                    value={form.responsavel}
                    onChange={(e) => setField("responsavel", e.target.value)}
                    placeholder="Nome do responsável"
                  />
                </div>
                <div className="trf-form-field">
                  <label htmlFor="trf-chamado">Chamado</label>
                  <input
                    id="trf-chamado"
                    type="text"
                    value={form.chamado}
                    onChange={(e) => setField("chamado", e.target.value)}
                    placeholder="Nº do chamado"
                  />
                </div>
                <div className="trf-form-field">
                  <label htmlFor="trf-prazo">Prazo</label>
                  <input
                    id="trf-prazo"
                    type="datetime-local"
                    value={form.prazo}
                    min="1000-01-01T00:00"
                    max="9999-12-31T23:59"
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v && v.split("-")[0].length > 4) return;
                      setField("prazo", v);
                    }}
                    onBlur={(e) => {
                      const v = e.target.value;
                      if (v && v.split("-")[0].length > 4) setField("prazo", "");
                    }}
                  />
                </div>
                <div className="trf-form-field">
                  <label htmlFor="trf-criacao">Data de Criação</label>
                  <input
                    id="trf-criacao"
                    type="datetime-local"
                    value={form.dataCriacao}
                    min="1000-01-01T00:00"
                    max="9999-12-31T23:59"
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v && v.split("-")[0].length > 4) return;
                      setField("dataCriacao", v);
                    }}
                    onBlur={(e) => {
                      const v = e.target.value;
                      if (v && v.split("-")[0].length > 4) setField("dataCriacao", "");
                    }}
                  />
                </div>
              </div>
              {erroSalvar && <p className="trf-erro">{erroSalvar}</p>}
              <div className="trf-modal-footer">
                <button
                  type="button"
                  className="trf-btn-cancel"
                  onClick={fecharModal}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="trf-btn-save"
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

      {confirmarRemocao && (
        <div
          className="trf-modal-overlay"
          onClick={() => setConfirmarRemocao(null)}
        >
          <div
            className="trf-modal trf-modal-confirm"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="trf-modal-header">
              <h3>Remover tarefa</h3>
            </div>
            <div className="trf-modal-body">
              Tem certeza que deseja remover esta tarefa? Esta ação não pode ser
              desfeita.
            </div>
            <div className="trf-modal-footer">
              <button
                type="button"
                className="trf-btn-cancel"
                onClick={() => setConfirmarRemocao(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="trf-btn-delete"
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
