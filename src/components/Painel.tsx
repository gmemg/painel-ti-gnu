import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Evento } from "../types";
import {
  getEventos,
  reconcileEventosAutomaticos,
  saveEventos,
} from "../utils/storage";
import {
  getDiaSemana,
  formatDateTime,
  faltamDoisDiasOuMenos,
} from "../utils/dateUtils";
import FormularioEvento from "./FormularioEvento";
import "./Painel.css";

/**
 * Tela principal que lista eventos ativos e permite criar/editar/remover.
 * Centraliza a lógica de persistência no `localStorage` para manter a UI
 * simples e sem dependência de backend.
 */
const Painel = () => {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [eventoEditando, setEventoEditando] = useState<Evento | null>(null);
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

  const adicionarEventoTeste = useCallback(async () => {
    const agora = new Date();
    const amanha = new Date(agora.getTime() + 24 * 60 * 60 * 1000);
    const eventoTeste: Evento = {
      id: `evt_teste_${Date.now()}`,
      nomeEvento: "Evento de Teste",
      adicionadoPor: "Sistema",
      dataHora: amanha.toISOString(),
      diaSemana: getDiaSemana(amanha.toISOString()),
      localEvento: "Sala de Reunião 1",
      funcionarioPlantao: "Funcionário Teste",
      equipamentosNecessarios: "Notebook, Projetor",
      numeroChamado: "00001",
      requerente: "Requerente Teste",
      removido: false,
      concluido: false,
    };
    const todosEventos = await getEventos();
    await saveEventos([...todosEventos, eventoTeste]);
    refreshEventosAtivos();
  }, [refreshEventosAtivos]);

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
          <button className="btn-adicionar" onClick={handleAdicionar}>
            + Adicionar Evento
          </button>
          <button className="btn-teste" onClick={adicionarEventoTeste}>
            + Adicionar Teste
          </button>
          <span className="painel-stat">
            Montagens pendentes: <strong>{eventos.length}</strong>
          </span>
        </div>
        <div className="painel-header-center">
          <h2>MONTAGENS</h2>
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
              <th>Adicionado por</th>
              <th>Data e Hora</th>
              <th>Dia da Semana</th>
              <th>Local do Evento</th>
              <th>Funcionário de Plantão</th>
              <th>Equipamentos Necessários</th>
              <th>Número do Chamado</th>
              <th>Requerente</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {eventosView.length === 0 ? (
              <tr>
                <td colSpan={10} className="empty-state">
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
                  <td>{evento.adicionadoPor || "-"}</td>
                  <td>{evento.dataHoraFormatada}</td>
                  <td>{evento.diaSemanaFormatado}</td>
                  <td>{evento.localEvento}</td>
                  <td>{evento.funcionarioPlantao}</td>
                  <td>{evento.equipamentosNecessarios}</td>
                  <td className="chamado-cell">{evento.numeroChamado}</td>
                  <td>{evento.requerente || "-"}</td>
                  <td>
                    <button
                      className="btn-editar"
                      onClick={() => handleEditar(evento)}
                    >
                      Editar
                    </button>
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

export default Painel;
