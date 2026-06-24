import { useCallback, useEffect, useMemo, useState } from "react";
import { Evento } from "../types";
import {
  getHistorico,
  reconcileEventosAutomaticos,
  saveHistorico,
  getStoredUser,
} from "../utils/storage";
import { getDiaSemana, formatDateTime } from "../utils/dateUtils";
import "./Historico.css";

const Historico = () => {
  const [totalMontagens, setTotalMontagens] = useState(0);
  const [todosEventos, setTodosEventos] = useState<Evento[]>([]);
  const [carregando, setCarregando] = useState<string | null>(null);
  const isAdmin = getStoredUser()?.role === "admin";

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

  const handleStatusChange = useCallback(
    async (id: string, novoStatus: string) => {
      setCarregando(id);
      try {
        const historico = await getHistorico();
        const atualizado = historico.map((e) => {
          if (e.id !== id) return e;
          if (novoStatus === "concluido") {
            return {
              ...e,
              eqPendente: false,
              concluido: true,
              dataConclusao: e.dataConclusao || new Date().toISOString(),
            };
          }
          return {
            ...e,
            eqPendente: true,
            concluido: false,
            dataConclusao: undefined,
          };
        });
        await saveHistorico(atualizado);
        await carregarDados();
      } catch (error) {
        console.error("Erro ao atualizar status", error);
      } finally {
        setCarregando(null);
      }
    },
    [carregarDados],
  );

  const eventosView = useMemo(
    () =>
      todosEventos.map((evento) => {
        let statusClass: string;
        let statusLabel: string;
        let statusValue: string;

        if (evento.eqPendente && !evento.concluido) {
          statusClass = "eq-pendente";
          statusLabel = "Eq Pendente";
          statusValue = "eq-pendente";
        } else if (evento.concluido) {
          statusClass = "concluido";
          statusLabel = "Concluído";
          statusValue = "concluido";
        } else if (evento.removido) {
          statusClass = "removido";
          statusLabel = "Removido";
          statusValue = "concluido";
        } else {
          statusClass = "ativo";
          statusLabel = "Ativo";
          statusValue = "concluido";
        }

        return {
          ...evento,
          statusClass,
          statusLabel,
          statusValue,
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
                    {isAdmin ? (
                      <div className={`status-select-wrapper ${evento.statusValue}`}>
                        <select
                          className="status-select"
                          value={evento.statusValue}
                          disabled={carregando === evento.id}
                          onChange={(e) =>
                            handleStatusChange(evento.id, e.target.value)
                          }
                        >
                          <option value="eq-pendente">Eq Pendente</option>
                          <option value="concluido">Concluído</option>
                        </select>
                      </div>
                    ) : (
                      <span className={`status-badge ${evento.statusClass}`}>
                        {evento.statusLabel}
                      </span>
                    )}
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
