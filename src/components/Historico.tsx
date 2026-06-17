import { useCallback, useEffect, useMemo, useState } from "react";
import { Evento } from "../types";
import {
  getHistorico,
  reconcileEventosAutomaticos,
} from "../utils/storage";
import { getDiaSemana, formatDateTime } from "../utils/dateUtils";
import "./Historico.css";

/**
 * Tela de histórico: exibe apenas eventos removidos ou concluídos.
 * O objetivo é oferecer rastreabilidade sem misturar itens ainda ativos.
 */
const Historico = () => {
  const [totalMontagens, setTotalMontagens] = useState(0);
  const [todosEventos, setTodosEventos] = useState<Evento[]>([]);

  /**
   * Recarrega e reconcilia dados do histórico.
   * A união por `id` evita duplicidade quando um evento está em mais de um lugar.
   */
  const carregarDados = useCallback(async () => {
    await reconcileEventosAutomaticos();
    const historico = await getHistorico();

    const todosEventosArray = [...historico].sort(
      (a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime(),
    );

    setTotalMontagens(historico.length);
    setTodosEventos(todosEventosArray);
  }, []);

  useEffect(() => {
    // Carregamento inicial para evitar render vazio com estado incompleto.
    carregarDados().catch((error) => {
      console.error("Erro ao carregar histórico", error);
    });
  }, [carregarDados]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      carregarDados().catch((error) => {
        console.error("Erro ao atualizar histórico", error);
      });
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [carregarDados]);

  /**
   * Resolve a classe CSS baseada no estado do evento.
   *
   * @param evento Evento avaliado.
   * @returns Classe CSS correspondente.
   */
  const eventosView = useMemo(
    () =>
      todosEventos.map((evento) => {
        const statusClass = evento.concluido
          ? "concluido"
          : evento.removido
            ? "removido"
            : "ativo";
        const statusLabel = evento.concluido
          ? "Concluído"
          : evento.removido
            ? "Removido"
            : "Ativo";

        return {
          ...evento,
          statusClass,
          statusLabel,
          dataHoraFormatada: formatDateTime(evento.dataHora),
          diaSemanaFormatado: getDiaSemana(evento.dataHora),
        };
      }),
    [todosEventos],
  );

  return (
    <div className="historico">
      <div className="historico-header">
        <div className="historico-header-left" />
        <div className="historico-header-center">
          <h2>HISTÓRICO MONTAGENS</h2>
          <div className="historico-stats">
            <span className="stat-item">
              Total de montagens: <strong>{totalMontagens}</strong>
            </span>
          </div>
        </div>
        <div className="historico-header-right" />
      </div>

      <div className="tabela-container">
        <table className="tabela-historico">
          <thead>
            <tr>
              <th>Nome do Evento</th>
              <th>Data e Hora</th>
              <th>Dia da Semana</th>
              <th>Local do Evento</th>
              <th>Plantão TI</th>
              <th>Plantão Eventos</th>
              <th>Equipamentos Necessários</th>
              <th>Número do Chamado</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {eventosView.length === 0 ? (
              <tr>
                <td colSpan={9} className="empty-state">
                  Nenhum evento no histórico.
                </td>
              </tr>
            ) : (
              eventosView.map((evento) => (
                <tr key={evento.id} className={evento.statusClass}>
                  <td>{evento.nomeEvento}</td>
                  <td>{evento.dataHoraFormatada}</td>
                  <td>{evento.diaSemanaFormatado}</td>
                  <td>{evento.localEvento}</td>
                  <td>{evento.funcionarioPlantao}</td>
                  <td>{evento.plantaoEventos || "-"}</td>
                  <td>{evento.equipamentosNecessarios}</td>
                  <td>{evento.numeroChamado}</td>
                  <td>
                    <span className={`status-badge ${evento.statusClass}`}>
                      {evento.statusLabel}
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
};

export default Historico;
