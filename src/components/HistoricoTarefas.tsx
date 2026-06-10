import { useCallback, useEffect, useMemo, useState } from "react";
import { Tarefa, TarefaStatus } from "../types";
import { getHistoricoTarefas } from "../utils/storage";
import { formatDateTime } from "../utils/dateUtils";
import "./HistoricoTarefas.css";

const STATUS_LIST: Array<{
  value: TarefaStatus;
  label: string;
  cor: string;
  classe: string;
}> = [
  {
    value: "concluida",
    label: "Concluído",
    cor: "#22c55e",
    classe: "concluida",
  },
  {
    value: "cancelada",
    label: "Cancelada",
    cor: "#ef4444",
    classe: "cancelada",
  },
];

export default function HistoricoTarefas() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);

  const carregarDados = useCallback(async () => {
    const finalizadas = await getHistoricoTarefas();
    setTarefas(finalizadas);
  }, []);

  useEffect(() => {
    carregarDados().catch(console.error);
  }, [carregarDados]);

  useEffect(() => {
    const id = window.setInterval(() => {
      carregarDados().catch(console.error);
    }, 30000);
    return () => window.clearInterval(id);
  }, [carregarDados]);

  const tarefasView = useMemo(
    () =>
      tarefas.map((t) => ({
        ...t,
        statusInfo:
          STATUS_LIST.find((s) => s.value === t.status) ?? STATUS_LIST[0],
        prazoFormatado: t.prazo ? formatDateTime(t.prazo) : "—",
        dataCriacaoFormatada: t.dataCriacao
          ? formatDateTime(t.dataCriacao)
          : "—",
      })),
    [tarefas],
  );

  return (
    <div className="htrf-page">
      <div className="htrf-header">
        <div className="htrf-header-left" />
        <div className="htrf-header-center">
          <h2>HISTÓRICO TAREFAS</h2>
          <div className="htrf-stats">
            <span className="htrf-stat-item">
              Total de tarefas: <strong>{tarefas.length}</strong>
            </span>
          </div>
        </div>
        <div className="htrf-header-right" />
      </div>

      <div className="htrf-tabela-container">
        <table className="htrf-tabela">
          <thead>
            <tr>
              <th>Tarefa</th>
              <th>Descrição</th>
              <th>Responsável</th>
              <th>Chamado</th>
              <th>Criado em</th>
              <th>Prazo</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {tarefasView.length === 0 ? (
              <tr>
                <td colSpan={7} className="htrf-empty">
                  Nenhuma tarefa no histórico.
                </td>
              </tr>
            ) : (
              tarefasView.map((t) => (
                <tr key={t.id} className={`htrf-linha-${t.statusInfo.classe}`}>
                  <td className="htrf-td-tarefa">{t.tarefa}</td>
                  <td className="htrf-td-desc">{t.descricao || "—"}</td>
                  <td>{t.responsavel || "—"}</td>
                  <td>{t.chamado || "—"}</td>
                  <td>{t.dataCriacaoFormatada}</td>
                  <td>{t.prazoFormatado}</td>
                  <td>
                    <span
                      className={`htrf-status-badge htrf-status-${t.statusInfo.classe}`}
                    >
                      {t.statusInfo.label}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
