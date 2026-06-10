import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Evento, Tarefa } from "../types";
import {
  reconcileEventosAutomaticos,
  reconcileTarefasAutomaticas,
} from "../utils/storage";
import { formatDateTime } from "../utils/dateUtils";
import "./ModoTV.css";

const INTERVALO = 30;

function prazoUrgente(prazo: string): boolean {
  if (!prazo) return false;
  const diff = new Date(prazo).getTime() - Date.now();
  return diff >= 0 && diff <= 24 * 60 * 60 * 1000;
}

type Tela = "tarefas" | "montagens";

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

export default function ModoTV() {
  const [tela, setTela] = useState<Tela>("montagens");
  const [segundos, setSegundos] = useState(INTERVALO);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);

  const carregarDados = useCallback(async () => {
    const [ativas, todosEventos] = await Promise.all([
      reconcileTarefasAutomaticas(),
      reconcileEventosAutomaticos(),
    ]);
    setTarefas(ativas);
    setEventos(todosEventos.filter((e) => !e.removido));
  }, []);

  useEffect(() => {
    carregarDados().catch(console.error);
  }, [carregarDados]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setSegundos((prev) => {
        if (prev <= 1) {
          setTela((t) => {
            const proxima = t === "montagens" ? "tarefas" : "montagens";
            return proxima;
          });
          carregarDados().catch(console.error);
          return INTERVALO;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [carregarDados]);

  // reaches 100% when segundos === 1 (last tick before reset)
  const progresso = ((INTERVALO - segundos) / (INTERVALO - 1)) * 100;

  return (
    <div className="tv-page">
      <img
        className="tv-watermark"
        src="https://www.gnu.com.br/site/img/logo-gnu.svg"
        alt=""
        aria-hidden="true"
      />
      <div className="tv-topbar">
        <div className="tv-topbar-left">
          <span className="tv-contador">
            {tela === "montagens" ? eventos.length : tarefas.length} item(s)
          </span>
          <Link to="/" className="tv-sair">Sair</Link>
        </div>
        <div className="tv-topbar-center">
          <span className="tv-titulo">{tela === "montagens" ? "MONTAGENS" : "TAREFAS"}</span>
          <span className="tv-countdown">{segundos}s</span>
        </div>
        <div className="tv-topbar-right" />
      </div>

      <div className="tv-progress">
        <div className="tv-progress-fill" style={{ width: `${progresso}%` }} />
      </div>

      <div className="tv-conteudo">
        {tela === "montagens" ? (
          <table className="tv-tabela">
            <thead>
              <tr>
                <th>Nome do Evento</th>
                <th>Adicionado por</th>
                <th>Data e Hora</th>
                <th>Dia da Semana</th>
                <th>Local do Evento</th>
                <th>Func. de Plantão</th>
                <th>Equipamentos</th>
                <th>Chamado</th>
                <th>Requerente</th>
              </tr>
            </thead>
            <tbody>
              {eventos.length === 0 ? (
                <tr>
                  <td colSpan={9} className="tv-empty">Nenhuma montagem cadastrada.</td>
                </tr>
              ) : (
                eventos.map((e) => (
                  <tr key={e.id}>
                    <td className="tv-td-destaque">{e.nomeEvento}</td>
                    <td>{e.adicionadoPor || "—"}</td>
                    <td>{formatDateTime(e.dataHora)}</td>
                    <td>{e.diaSemana || "—"}</td>
                    <td>{e.localEvento || "—"}</td>
                    <td>{e.funcionarioPlantao || "—"}</td>
                    <td className="tv-td-desc">{e.equipamentosNecessarios || "—"}</td>
                    <td>{e.numeroChamado || "—"}</td>
                    <td>{e.requerente || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <table className="tv-tabela">
            <thead>
              <tr>
                <th>Tarefa</th>
                <th>Descrição</th>
                <th>Status</th>
                <th>Responsável</th>
                <th>Prazo</th>
                <th>Chamado</th>
                <th>Criado em</th>
              </tr>
            </thead>
            <tbody>
              {tarefas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="tv-empty">Nenhuma tarefa pendente.</td>
                </tr>
              ) : (
                tarefas.map((t) => (
                  <tr key={t.id} className={t.prazo && prazoUrgente(t.prazo) ? "tv-linha-urgente" : undefined}>
                    <td className="tv-td-destaque">{t.tarefa}</td>
                    <td className="tv-td-desc">{t.descricao || "—"}</td>
                    <td>
                      <span
                        className="tv-status-badge"
                        style={{
                          backgroundColor: (STATUS_COR[t.status] ?? "#9ca3af") + "33",
                          color: STATUS_COR[t.status] ?? "#9ca3af",
                          borderColor: (STATUS_COR[t.status] ?? "#9ca3af") + "88",
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
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
