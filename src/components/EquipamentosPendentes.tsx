import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Evento } from "../types";
import {
  getEquipamentosPendentes,
  saveEquipamentosPendentes,
  getEventos,
  saveEventos,
  addToHistorico,
} from "../utils/storage";
import { formatDateTime, getDiaSemana } from "../utils/dateUtils";
import { useAuth } from "../context/AuthContext";
import "./EquipamentosPendentes.css";

export default function EquipamentosPendentes() {
  const { isAdmin } = useAuth();
  const [itens, setItens] = useState<Evento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [confirmarDevolucao, setConfirmarDevolucao] = useState<Evento | null>(
    null,
  );
  const [confirmarConclusao, setConfirmarConclusao] = useState<Evento | null>(
    null,
  );
  const salvandoRef = useRef(false);
  const overlayMouseDownRef = useRef(false);

  const carregar = useCallback(async () => {
    const data = await getEquipamentosPendentes();
    setItens(data);
  }, []);

  useEffect(() => {
    carregar()
      .catch(console.error)
      .finally(() => setCarregando(false));
  }, [carregar]);

  useEffect(() => {
    const id = window.setInterval(
      () => carregar().catch(console.error),
      30_000,
    );
    return () => window.clearInterval(id);
  }, [carregar]);

  const handleDevolver = useCallback(
    async (evento: Evento) => {
      if (salvandoRef.current) return;
      salvandoRef.current = true;
      try {
        const todosEventos = await getEventos();
        const jaExiste = todosEventos.some((e) => e.id === evento.id);
        if (jaExiste) {
          await saveEventos(
            todosEventos.map((e) =>
              e.id === evento.id
                ? { ...e, removido: false, concluido: false }
                : e,
            ),
          );
        } else {
          await saveEventos([
            ...todosEventos,
            { ...evento, removido: false, concluido: false },
          ]);
        }
        const pendentes = await getEquipamentosPendentes();
        await saveEquipamentosPendentes(
          pendentes.filter((e) => e.id !== evento.id),
        );
        await carregar();
        setConfirmarDevolucao(null);
      } finally {
        salvandoRef.current = false;
      }
    },
    [carregar],
  );

  const handleConcluir = useCallback(
    async (evento: Evento) => {
      if (salvandoRef.current) return;
      salvandoRef.current = true;
      try {
        const agora = new Date().toISOString();
        const eventoConcluido: Evento = {
          ...evento,
          concluido: true,
          removido: true,
          dataConclusao: agora,
          dataRemocao: agora,
        };
        await addToHistorico(eventoConcluido);
        const pendentes = await getEquipamentosPendentes();
        await saveEquipamentosPendentes(
          pendentes.filter((e) => e.id !== evento.id),
        );
        await carregar();
        setConfirmarConclusao(null);
      } finally {
        salvandoRef.current = false;
      }
    },
    [carregar],
  );

  const itensView = useMemo(
    () =>
      itens.map((e) => ({
        ...e,
        dataHoraFormatada: formatDateTime(e.dataHora),
        diaSemanaFormatado: getDiaSemana(e.dataHora),
      })),
    [itens],
  );

  if (carregando) return <div className="ep-loading">Carregando…</div>;

  return (
    <div className="ep-page">
      <div className="ep-header">
        <div className="ep-header-left" />
        <div className="ep-header-center">
          <h2>EQUIPAMENTOS PENDENTES</h2>
          <span className="ep-stat">
            Pendentes: <strong>{itens.length}</strong>
          </span>
        </div>
        <div className="ep-header-right" />
      </div>

      <div className="ep-tabela-container">
        <table className="ep-tabela">
          <thead>
            <tr>
              <th>Nome do Evento</th>
              <th>Data e Hora</th>
              <th>Dia da Semana</th>
              <th>Local do Evento</th>
              <th>Plantão TI</th>
              <th>Plantão Eventos</th>
              <th>Equipamentos</th>
              <th>Chamado</th>
              <th>Requerente</th>
              {isAdmin && <th>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {itensView.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 10 : 9} className="ep-empty">
                  Nenhum equipamento pendente.
                </td>
              </tr>
            ) : (
              itensView.map((e) => (
                <tr key={e.id}>
                  <td>{e.nomeEvento}</td>
                  <td>{e.dataHoraFormatada}</td>
                  <td>{e.diaSemanaFormatado}</td>
                  <td>{e.localEvento}</td>
                  <td>{e.funcionarioPlantao || "—"}</td>
                  <td>{e.plantaoEventos || "—"}</td>
                  <td>{e.equipamentosNecessarios || "—"}</td>
                  <td>{e.numeroChamado || "—"}</td>
                  <td>{e.requerente || "—"}</td>
                  {isAdmin && (
                  <td>
                    <div className="ep-acoes">
                      <button
                        className="ep-btn-devolver"
                        onClick={() => setConfirmarDevolucao(e)}
                        title="Devolver para Montagens"
                      >
                        <svg
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          width="21"
                          height="21"
                        >
                          <path
                            fillRule="evenodd"
                            d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                      <button
                        className="ep-btn-concluir"
                        onClick={() => setConfirmarConclusao(e)}
                        title="Concluir e enviar para histórico"
                      >
                        <svg
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          width="21"
                          height="21"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </div>
                  </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {confirmarDevolucao && (
        <div
          className="ep-overlay"
          onMouseDown={(e) => {
            overlayMouseDownRef.current = e.target === e.currentTarget;
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && overlayMouseDownRef.current) {
              setConfirmarDevolucao(null);
            }
            overlayMouseDownRef.current = false;
          }}
        >
          <div
            className="ep-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ep-modal-header">
              <h3>Devolver para Montagens</h3>
            </div>
            <div className="ep-modal-body">
              Devolver <strong>{confirmarDevolucao.nomeEvento}</strong> para a
              lista de Montagens?
            </div>
            <div className="ep-modal-footer">
              <button
                className="ep-btn-cancelar"
                onClick={() => setConfirmarDevolucao(null)}
              >
                Cancelar
              </button>
              <button
                className="ep-btn-confirmar-devolver"
                onClick={() => handleDevolver(confirmarDevolucao)}
              >
                Devolver
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmarConclusao && (
        <div
          className="ep-overlay"
          onMouseDown={(e) => {
            overlayMouseDownRef.current = e.target === e.currentTarget;
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && overlayMouseDownRef.current) {
              setConfirmarConclusao(null);
            }
            overlayMouseDownRef.current = false;
          }}
        >
          <div
            className="ep-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ep-modal-header">
              <h3>Concluir equipamento</h3>
            </div>
            <div className="ep-modal-body">
              Confirmar conclusão de{" "}
              <strong>{confirmarConclusao.nomeEvento}</strong>? O item será
              enviado para o histórico como concluído.
            </div>
            <div className="ep-modal-footer">
              <button
                className="ep-btn-cancelar"
                onClick={() => setConfirmarConclusao(null)}
              >
                Cancelar
              </button>
              <button
                className="ep-btn-confirmar-concluir"
                onClick={() => handleConcluir(confirmarConclusao)}
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
