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
  faltam12HorasOuMenos,
  faltam24HorasOuMenos,
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
  const [confirmarConclusao, setConfirmarConclusao] = useState<Evento | null>(
    null,
  );
  const [confirmarPendente, setConfirmarPendente] = useState<Evento | null>(
    null,
  );
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

  const handleAdicionarTeste = useCallback(async () => {
    if (salvandoRef.current) return;
    salvandoRef.current = true;
    try {
      const NOMES = [
        "Formatura FATEC",
        "Congresso Municipal de Saúde",
        "Workshop de Inovação",
        "Seminário Jurídico OAB",
        "Palestra Corporativa IBM",
        "Reunião Plenária Câmara",
        "Evento SENAC TI",
        "Fórum de Educação 2026",
        "Conferência Regional SEBRAE",
        "Simpósio de Engenharia",
      ];
      const LOCAIS = [
        "Auditório Principal - Bloco A",
        "Sala de Reuniões 3 - 2º Andar",
        "Centro de Convenções - Hall B",
        "Anfiteatro Paulo Freire",
        "Salão Nobre - Térreo",
        "Sala Multiuso 104",
        "Teatro Municipal",
        "Plenário - Câmara Municipal",
      ];
      const FUNCIONARIOS_TI = [
        "Carlos Souza",
        "Ana Lima",
        "Rafael Mendes",
        "Juliana Costa",
        "Bruno Alves",
        "Patrícia Nunes",
      ];
      const FUNCIONARIOS_EVENTOS = [
        "Fernanda Rocha",
        "Diego Martins",
        "Larissa Pinto",
        "Thiago Barros",
        "Camila Ferreira",
        "",
      ];
      const EQUIPAMENTOS = [
        "Notebook Dell, Projetor Epson 4000lm, Cabo HDMI, Mesa de som",
        "TV 65\" Samsung, Suporte de TV, Notebook Lenovo, Controle remoto",
        "Projetor Optoma, Tela de projeção 100\", Microfone sem fio, Caixa de som JBL",
        "Notebook HP, Switch 8 portas, 2x Cabo HDMI, Câmera Logitech",
        "2x Monitor 27\", Dock station, Webcam HD, Microfone condensador",
        "Televisão 55\" + Suporte, HDMI 10m, Notebook Acer, Extensão elétrica",
        "Projetor laser, Microfone lapela, Caixa ativa, Notebook i7",
      ];
      const REQUERENTES = [
        "Secretaria de Educação",
        "Depto. de RH",
        "Prefeitura Municipal",
        "Associação Comercial",
        "Faculdade Unip",
        "Sindicato dos Servidores",
        "OAB Subsecção Local",
      ];

      const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

      const diasOffset = Math.floor(Math.random() * 30) + 1;
      const data = new Date();
      data.setDate(data.getDate() + diasOffset);
      const horas = [8, 9, 10, 13, 14, 15, 18, 19][Math.floor(Math.random() * 8)];
      data.setHours(horas, 0, 0, 0);
      const dataHora = data.toISOString();

      const novoEvento: Evento = {
        id: Date.now().toString(),
        nomeEvento: pick(NOMES),
        adicionadoPor: "Teste",
        dataHora,
        diaSemana: getDiaSemana(dataHora),
        localEvento: pick(LOCAIS),
        funcionarioPlantao: pick(FUNCIONARIOS_TI),
        plantaoEventos: pick(FUNCIONARIOS_EVENTOS),
        equipamentosNecessarios: pick(EQUIPAMENTOS),
        numeroChamado: `CHM-${Math.floor(10000 + Math.random() * 90000)}`,
        requerente: pick(REQUERENTES),
        removido: false,
        concluido: false,
      };

      const todosEventos = await getEventos();
      await saveEventos([...todosEventos, novoEvento]);
      refreshEventosAtivos();
    } finally {
      salvandoRef.current = false;
    }
  }, [refreshEventosAtivos]);

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
        urgencia:
          evento.prioridade === "urgente"
            ? "critica"
            : faltam12HorasOuMenos(evento.dataHora)
              ? "critica"
              : faltam24HorasOuMenos(evento.dataHora)
                ? "alta"
                : null,
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
          {isAdmin && (
            <button className="btn-adicionar-teste" onClick={handleAdicionarTeste}>
              Adicionar teste
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
                  className={
                    evento.urgencia === "critica"
                      ? "linha-urgente"
                      : evento.urgencia === "alta"
                        ? "linha-urgente-laranja"
                        : undefined
                  }
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
                        <button
                          className="btn-editar"
                          onClick={() => handleEditar(evento)}
                          title="Editar evento"
                          aria-label="Editar evento"
                        >
                          <svg
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            width="21"
                            height="21"
                          >
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                        </button>
                        <button
                          className="btn-remover"
                          onClick={() => setConfirmarRemocao(evento)}
                          title="Remover evento"
                          aria-label="Remover evento"
                        >
                          <svg
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            width="21"
                            height="21"
                          >
                            <path
                              fillRule="evenodd"
                              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                        <button
                          className="btn-pendente"
                          onClick={() => setConfirmarPendente(evento)}
                          title="Marcar como equipamento pendente"
                          aria-label="Marcar como pendente"
                        >
                          <svg
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            width="21"
                            height="21"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
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
      {confirmarConclusao && (
        <div
          className="popup-overlay"
          onClick={() => setConfirmarConclusao(null)}
        >
          <div
            className="popup-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="popup-header">
              <h3>Concluir montagem</h3>
            </div>
            <div className="popup-body">
              Confirmar conclusão de{" "}
              <strong>{confirmarConclusao.nomeEvento}</strong>? O evento será
              enviado para o histórico como concluído.
            </div>
            <div className="popup-actions">
              <button
                className="popup-btn popup-btn-cancelar"
                onClick={() => setConfirmarConclusao(null)}
              >
                Cancelar
              </button>
              <button
                className="popup-btn popup-btn-concluir"
                onClick={() => handleConcluirEvento(confirmarConclusao)}
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmarPendente && (
        <div
          className="popup-overlay"
          onClick={() => setConfirmarPendente(null)}
        >
          <div
            className="popup-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="popup-header">
              <h3>Equipamento pendente</h3>
            </div>
            <div className="popup-body">
              Mover <strong>{confirmarPendente.nomeEvento}</strong> para a aba{" "}
              <strong>Equipamento Pendente</strong>?
            </div>
            <div className="popup-actions">
              <button
                className="popup-btn popup-btn-cancelar"
                onClick={() => setConfirmarPendente(null)}
              >
                Cancelar
              </button>
              <button
                className="popup-btn popup-btn-pendente"
                onClick={() => handleMarcarPendente(confirmarPendente)}
              >
                Mover
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmarRemocao && (
        <div
          className="popup-overlay"
          onClick={() => setConfirmarRemocao(null)}
        >
          <div
            className="popup-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="popup-header">
              <h3>Remover montagem</h3>
            </div>
            <div className="popup-body">
              Remover <strong>{confirmarRemocao.nomeEvento}</strong>? O evento
              sairá da lista e será registrado no histórico como removido.
            </div>
            <div className="popup-actions">
              <button
                className="popup-btn popup-btn-cancelar"
                onClick={() => setConfirmarRemocao(null)}
              >
                Cancelar
              </button>
              <button
                className="popup-btn popup-btn-remover"
                onClick={() => handleRemoverEvento(confirmarRemocao)}
              >
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
