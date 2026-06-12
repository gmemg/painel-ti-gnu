import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Evento } from "../types";
import {
  getEventos,
  reconcileEventosAutomaticos,
  saveEventos,
  addToHistorico,
  getEquipamentosPendentes,
  saveEquipamentosPendentes,
} from "../utils/storage";
import {
  getDiaSemana,
  formatDateTime,
  faltamDoisDiasOuMenos,
} from "../utils/dateUtils";
import FormularioEvento from "./FormularioEvento";
import { useAuth } from "../context/AuthContext";
import "./Painel.css";

/**
 * Tela principal que lista eventos ativos e permite criar/editar/remover.
 * Centraliza a lógica de persistência no `localStorage` para manter a UI
 * simples e sem dependência de backend.
 */
const Painel = () => {
  const { isAdmin } = useAuth();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [eventoEditando, setEventoEditando] = useState<Evento | null>(null);
  const [confirmarConclusao, setConfirmarConclusao] = useState<Evento | null>(null);
  const [confirmarPendente, setConfirmarPendente] = useState<Evento | null>(null);
  const [confirmarRemocao, setConfirmarRemocao] = useState<Evento | null>(null);
  const salvandoRef = useRef(false);

  useEffect(() => {
    // Carrega apenas eventos ativos para reduzir ruído na tela principal.
    reconcileEventosAutomaticos()
      .then((eventosAtualizados) => {
        setEventos(eventosAtualizados.filter((e) => !e.removido));
      })
      .catch((error) => {
        console.error("Erro ao carregar eventos", error);
      });
  }, []);

  const refreshEventosAtivos = useCallback(() => {
    reconcileEventosAutomaticos()
      .then((eventosAtualizados) => {
        setEventos(eventosAtualizados.filter((e) => !e.removido));
      })
      .catch((error) => {
        console.error("Erro ao atualizar eventos", error);
      });
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(refreshEventosAtivos, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshEventosAtivos]);

  /**
   * Abre o formulário em modo de criação.
   * O evento em edição é limpo para evitar preenchimento acidental.
   */
  const handleAdicionar = useCallback(() => {
    setEventoEditando(null);
    setMostrarFormulario(true);
  }, []);

  /**
   * Abre o formulário preenchido para edição.
   *
   * @param evento Evento selecionado na tabela.
   */
  const handleEditar = useCallback((evento: Evento) => {
    setEventoEditando(evento);
    setMostrarFormulario(true);
  }, []);

  /**
   * Salva o evento vindo do formulário, criando ou atualizando.
   *
   * @param evento Evento já validado no formulário.
   */
  const handleSalvar = useCallback(
    async (evento: Evento) => {
      if (salvandoRef.current) return;
      salvandoRef.current = true;
      try {
        const todosEventos = await getEventos();

        if (eventoEditando) {
          const eventosAtualizados = todosEventos.map((e) =>
            e.id === evento.id ? evento : e,
          );
          await saveEventos(eventosAtualizados);
        } else {
          const novoEvento = {
            ...evento,
            id: Date.now().toString(),
            removido: false,
            concluido: false,
          };
          await saveEventos([...todosEventos, novoEvento]);
        }

        refreshEventosAtivos();
        setMostrarFormulario(false);
        setEventoEditando(null);
      } finally {
        salvandoRef.current = false;
      }
    },
    [eventoEditando, refreshEventosAtivos],
  );

  /**
   * Fecha o formulário sem persistir alterações.
   */
  const handleCancelar = useCallback(() => {
    setMostrarFormulario(false);
    setEventoEditando(null);
  }, []);

  const handleConcluirEvento = useCallback(
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
        const todosEventos = await getEventos();
        const eventosAtualizados = todosEventos.map((e) =>
          e.id === evento.id ? eventoConcluido : e,
        );
        await saveEventos(eventosAtualizados);
        await addToHistorico(eventoConcluido);
        refreshEventosAtivos();
        setConfirmarConclusao(null);
      } finally {
        salvandoRef.current = false;
      }
    },
    [refreshEventosAtivos],
  );

  const handleRemoverEvento = useCallback(
    async (evento: Evento) => {
      if (salvandoRef.current) return;
      salvandoRef.current = true;
      try {
        const agora = new Date().toISOString();
        const eventoRemovido: Evento = {
          ...evento,
          removido: true,
          concluido: false,
          dataRemocao: agora,
        };
        const todosEventos = await getEventos();
        const eventosAtualizados = todosEventos.map((e) =>
          e.id === evento.id ? eventoRemovido : e,
        );
        await saveEventos(eventosAtualizados);
        await addToHistorico(eventoRemovido);
        refreshEventosAtivos();
        setConfirmarRemocao(null);
      } finally {
        salvandoRef.current = false;
      }
    },
    [refreshEventosAtivos],
  );

  const handleMarcarPendente = useCallback(
    async (evento: Evento) => {
      if (salvandoRef.current) return;
      salvandoRef.current = true;
      try {
        const pendentes = await getEquipamentosPendentes();
        if (!pendentes.find((e) => e.id === evento.id)) {
          await saveEquipamentosPendentes([...pendentes, evento]);
        }
        const todosEventos = await getEventos();
        await saveEventos(todosEventos.filter((e) => e.id !== evento.id));
        refreshEventosAtivos();
        setConfirmarPendente(null);
      } finally {
        salvandoRef.current = false;
      }
    },
    [refreshEventosAtivos],
  );

  const eventosView = useMemo(
    () =>
      eventos.map((evento) => ({
        ...evento,
        dataHoraFormatada: formatDateTime(evento.dataHora),
        diaSemanaFormatado: getDiaSemana(evento.dataHora),
        urgente: faltamDoisDiasOuMenos(evento.dataHora),
      })),
    [eventos],
  );

  return (
    <div className="painel">
      <div className="painel-header">
        <div className="painel-header-left">
          {isAdmin && (
            <button className="btn-adicionar" onClick={handleAdicionar}>
              + Adicionar Evento
            </button>
          )}
        </div>
        <div className="painel-header-center">
          <h2>MONTAGENS</h2>
          <span className="painel-stat">
            Montagens pendentes: <strong>{eventos.length}</strong>
          </span>
        </div>
        <div className="painel-header-right" />
      </div>

      {mostrarFormulario && (
        <FormularioEvento
          evento={eventoEditando}
          onSalvar={handleSalvar}
          onCancelar={handleCancelar}
        />
      )}

      <div className="tabela-container">
        <table className="tabela-eventos">
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
              <th>Requerente</th>
              {isAdmin && <th>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {eventosView.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 10 : 9} className="empty-state">
                  Nenhum evento cadastrado.
                </td>
              </tr>
            ) : (
              eventosView.map((evento) => (
                <tr
                  key={evento.id}
                  className={evento.urgente ? "linha-urgente" : undefined}
                >
                  <td>{evento.nomeEvento}</td>
                  <td>{evento.dataHoraFormatada}</td>
                  <td>{evento.diaSemanaFormatado}</td>
                  <td>{evento.localEvento}</td>
                  <td>{evento.funcionarioPlantao}</td>
                  <td>{evento.plantaoEventos || "-"}</td>
                  <td>{evento.equipamentosNecessarios}</td>
                  <td className="chamado-cell">{evento.numeroChamado}</td>
                  <td>{evento.requerente || "-"}</td>
                  {isAdmin && (
                  <td>
                    <div className="acoes-buttons">
                      <button
                        className="btn-concluir"
                        onClick={() => setConfirmarConclusao(evento)}
                        title="Concluir e enviar para histórico"
                        aria-label="Concluir evento"
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor" width="21" height="21">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button
                        className="btn-editar"
                        onClick={() => handleEditar(evento)}
                        title="Editar evento"
                        aria-label="Editar evento"
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor" width="21" height="21">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </button>
                      <button
                        className="btn-remover"
                        onClick={() => setConfirmarRemocao(evento)}
                        title="Remover evento"
                        aria-label="Remover evento"
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor" width="21" height="21">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button
                        className="btn-pendente"
                        onClick={() => setConfirmarPendente(evento)}
                        title="Marcar como equipamento pendente"
                        aria-label="Marcar como pendente"
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor" width="21" height="21">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
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
      {confirmarConclusao && (
        <div className="popup-overlay" onClick={() => setConfirmarConclusao(null)}>
          <div className="popup-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="popup-header">
              <h3>Concluir montagem</h3>
            </div>
            <div className="popup-body">
              Confirmar conclusão de <strong>{confirmarConclusao.nomeEvento}</strong>?
              O evento será enviado para o histórico como concluído.
            </div>
            <div className="popup-actions">
              <button className="popup-btn popup-btn-cancelar" onClick={() => setConfirmarConclusao(null)}>
                Cancelar
              </button>
              <button className="popup-btn popup-btn-concluir" onClick={() => handleConcluirEvento(confirmarConclusao)}>
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmarPendente && (
        <div className="popup-overlay" onClick={() => setConfirmarPendente(null)}>
          <div className="popup-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="popup-header">
              <h3>Equipamento pendente</h3>
            </div>
            <div className="popup-body">
              Mover <strong>{confirmarPendente.nomeEvento}</strong> para a aba{" "}
              <strong>Equipamento Pendente</strong>?
            </div>
            <div className="popup-actions">
              <button className="popup-btn popup-btn-cancelar" onClick={() => setConfirmarPendente(null)}>
                Cancelar
              </button>
              <button className="popup-btn popup-btn-pendente" onClick={() => handleMarcarPendente(confirmarPendente)}>
                Mover
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmarRemocao && (
        <div className="popup-overlay" onClick={() => setConfirmarRemocao(null)}>
          <div className="popup-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="popup-header">
              <h3>Remover montagem</h3>
            </div>
            <div className="popup-body">
              Remover <strong>{confirmarRemocao.nomeEvento}</strong>? O evento
              sairá da lista e será registrado no histórico como removido.
            </div>
            <div className="popup-actions">
              <button className="popup-btn popup-btn-cancelar" onClick={() => setConfirmarRemocao(null)}>
                Cancelar
              </button>
              <button className="popup-btn popup-btn-remover" onClick={() => handleRemoverEvento(confirmarRemocao)}>
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Painel;
