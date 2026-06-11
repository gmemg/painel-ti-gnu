import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Evento, Tarefa } from "../types";
import {
  reconcileEventosAutomaticos,
  reconcileTarefasAutomaticas,
  getEquipamentosPendentes,
} from "../utils/storage";
import { formatDateTime } from "../utils/dateUtils";
import "./ModoTV.css";

const INTERVALO = 30;

function dentroDeVinteQuatroHoras(dataHora: string): boolean {
  if (!dataHora) return false;
  const diff = new Date(dataHora).getTime() - Date.now();
  return diff >= 0 && diff <= 24 * 60 * 60 * 1000;
}

type Tela = "montagens" | "tarefas" | "equipamentos";
const TELAS: Tela[] = ["montagens", "tarefas", "equipamentos"];

const TELA_LABEL: Record<Tela, string> = {
  montagens: "MONTAGENS",
  tarefas: "TAREFAS",
  equipamentos: "EQUIPAMENTOS PENDENTES",
};

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluído",
  cancelada: "Cancelada",
};

const STATUS_COR: Record<string, string> = {
  pendente: "#9ca3af",
  em_andamento: "#2b8ffb",
  concluida: "#22c55e",
  cancelada: "#ef4444",
};

/* colunas com largura igual — table-layout:fixed distribui automaticamente */
const ColgroupEvento = () => (
  <colgroup>
    {/* Nome  DataHora  Dia    Local  PlantãoTI  PlantãoEv  Equipamentos  Chamado  Requerente */}
    <col style={{ width: "13%" }} />
    <col style={{ width: "9%" }} />
    <col style={{ width: "7%" }} />
    <col style={{ width: "11%" }} />
    <col style={{ width: "8%" }} />
    <col style={{ width: "8%" }} />
    <col style={{ width: "24%" }} />
    <col style={{ width: "8%" }} />
    <col style={{ width: "12%" }} />
  </colgroup>
);

const ColgroupTarefa = () => (
  <colgroup>
    <col /><col /><col /><col /><col /><col /><col />
  </colgroup>
);

export default function ModoTV() {
  const [tela, setTela] = useState<Tela>("montagens");
  const [segundos, setSegundos] = useState(INTERVALO);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [equipamentos, setEquipamentos] = useState<Evento[]>([]);

  const carregarDados = useCallback(async () => {
    const [ativas, todosEventos, pendentes] = await Promise.all([
      reconcileTarefasAutomaticas(),
      reconcileEventosAutomaticos(),
      getEquipamentosPendentes(),
    ]);
    setTarefas(ativas);
    setEventos(todosEventos.filter((e) => !e.removido));
    setEquipamentos(pendentes);
  }, []);

  useEffect(() => {
    carregarDados().catch(console.error);
  }, [carregarDados]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setSegundos((prev) => {
        if (prev <= 1) {
          setTela((t) => TELAS[(TELAS.indexOf(t) + 1) % TELAS.length]);
          carregarDados().catch(console.error);
          return INTERVALO;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [carregarDados]);

  const handleSkip = useCallback(() => {
    setTela((t) => TELAS[(TELAS.indexOf(t) + 1) % TELAS.length]);
    setSegundos(INTERVALO);
    carregarDados().catch(console.error);
  }, [carregarDados]);

  const progresso = ((INTERVALO - segundos) / (INTERVALO - 1)) * 100;
  const isTarefas = tela === "tarefas";
  const Colgroup = isTarefas ? ColgroupTarefa : ColgroupEvento;

  const totalTela =
    tela === "montagens"
      ? eventos.length
      : tela === "tarefas"
      ? tarefas.length
      : equipamentos.length;

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
          <Link to="/" className="tv-sair">Sair</Link>
          <span className="tv-contador">{totalTela} item{totalTela !== 1 ? "s" : ""}</span>
        </div>

        {/* centro: título + dots */}
        <div className="tv-topbar-center">
          <span className="tv-titulo">{TELA_LABEL[tela]}</span>
          <div className="tv-dots">
            {TELAS.map((t) => (
              <span
                key={t}
                className={t === tela ? "tv-dot tv-dot-active" : "tv-dot"}
              />
            ))}
          </div>
        </div>

        {/* direita: countdown + skip */}
        <div className="tv-topbar-right">
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
          <div className="tv-tbody-wrap">
            <table className="tv-tabela">
              <Colgroup />
              <thead>
                {isTarefas ? (
                  <tr>
                    <th>Tarefa</th>
                    <th>Descrição</th>
                    <th>Status</th>
                    <th>Responsável</th>
                    <th>Prazo</th>
                    <th>Chamado</th>
                    <th>Criado em</th>
                  </tr>
                ) : (
                  <tr>
                    <th>Nome do Evento</th>
                    <th>Data e Hora</th>
                    <th>Dia</th>
                    <th>Local</th>
                    <th>Plantão TI</th>
                    <th>Plantão Eventos</th>
                    <th>Equipamentos</th>
                    <th>Chamado</th>
                    <th>Requerente</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {tela === "equipamentos" ? (
                  equipamentos.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="tv-empty">
                        Nenhum equipamento pendente.
                      </td>
                    </tr>
                  ) : (
                    equipamentos.map((e) => (
                      <tr key={e.id}>
                        <td className="tv-td-destaque">{e.nomeEvento}</td>
                        <td>{formatDateTime(e.dataHora)}</td>
                        <td>{e.diaSemana || "—"}</td>
                        <td>{e.localEvento || "—"}</td>
                        <td>{e.funcionarioPlantao || "—"}</td>
                        <td>{e.plantaoEventos || "—"}</td>
                        <td className="tv-td-desc">{e.equipamentosNecessarios || "—"}</td>
                        <td>{e.numeroChamado || "—"}</td>
                        <td>{e.requerente || "—"}</td>
                      </tr>
                    ))
                  )
                ) : tela === "montagens" ? (
                  eventos.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="tv-empty">
                        Nenhuma montagem cadastrada.
                      </td>
                    </tr>
                  ) : (
                    eventos.map((e) => (
                      <tr
                        key={e.id}
                        className={
                          dentroDeVinteQuatroHoras(e.dataHora)
                            ? "tv-linha-urgente"
                            : undefined
                        }
                      >
                        <td className="tv-td-destaque">{e.nomeEvento}</td>
                        <td>{formatDateTime(e.dataHora)}</td>
                        <td>{e.diaSemana || "—"}</td>
                        <td>{e.localEvento || "—"}</td>
                        <td>{e.funcionarioPlantao || "—"}</td>
                        <td>{e.plantaoEventos || "—"}</td>
                        <td className="tv-td-desc">{e.equipamentosNecessarios || "—"}</td>
                        <td>{e.numeroChamado || "—"}</td>
                        <td>{e.requerente || "—"}</td>
                      </tr>
                    ))
                  )
                ) : (
                  tarefas.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="tv-empty">
                        Nenhuma tarefa pendente.
                      </td>
                    </tr>
                  ) : (
                    tarefas.map((t) => (
                      <tr
                        key={t.id}
                        className={
                          dentroDeVinteQuatroHoras(t.prazo)
                            ? "tv-linha-urgente"
                            : undefined
                        }
                      >
                        <td className="tv-td-destaque">{t.tarefa}</td>
                        <td className="tv-td-desc">{t.descricao || "—"}</td>
                        <td>
                          <span
                            className="tv-status-badge"
                            style={{
                              backgroundColor:
                                (STATUS_COR[t.status] ?? "#9ca3af") + "26",
                              color: STATUS_COR[t.status] ?? "#9ca3af",
                              borderColor:
                                (STATUS_COR[t.status] ?? "#9ca3af") + "77",
                            }}
                          >
                            {STATUS_LABEL[t.status] ?? t.status}
                          </span>
                        </td>
                        <td>{t.responsavel || "—"}</td>
                        <td>{t.prazo ? formatDateTime(t.prazo) : "—"}</td>
                        <td>{t.chamado || "—"}</td>
                        <td>{t.dataCriacao ? formatDateTime(t.dataCriacao) : "—"}</td>
                      </tr>
                    ))
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
