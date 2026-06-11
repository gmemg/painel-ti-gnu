import { Evento, Impressora, InventarioItem, Tarefa, TonerRegistro } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

const requestJson = async <T>(
  path: string,
  options?: RequestInit,
): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Erro na API: ${response.status}`);
  }

  return response.json() as Promise<T>;
};

export const getEventos = (): Promise<Evento[]> =>
  requestJson<Evento[]>("/eventos");

export const saveEventos = (eventos: Evento[]): Promise<Evento[]> =>
  requestJson<Evento[]>("/eventos", {
    method: "PUT",
    body: JSON.stringify(eventos),
  });

export const getHistorico = (): Promise<Evento[]> =>
  requestJson<Evento[]>("/historico");

export const saveHistorico = (eventos: Evento[]): Promise<Evento[]> =>
  requestJson<Evento[]>("/historico", {
    method: "PUT",
    body: JSON.stringify(eventos),
  });

export const addToHistorico = async (evento: Evento): Promise<Evento[]> => {
  const historico = await getHistorico();
  const indiceExistente = historico.findIndex((e) => e.id === evento.id);

  if (indiceExistente >= 0) {
    historico[indiceExistente] = evento;
  } else {
    historico.push(evento);
  }

  return saveHistorico(historico);
};

export const reconcileEventosAutomaticos = async (): Promise<Evento[]> => {
  const agora = Date.now();
  const eventos = await getEventos();
  let houveMudanca = false;

  const eventosAtualizados = eventos.map((evento) => {
    if (evento.removido || evento.concluido) {
      return evento;
    }

    if (new Date(evento.dataHora).getTime() > agora) {
      return evento;
    }

    houveMudanca = true;

    return {
      ...evento,
      concluido: true,
      removido: true,
      dataConclusao: evento.dataConclusao || new Date().toISOString(),
      dataRemocao: evento.dataRemocao || new Date().toISOString(),
    };
  });

  if (!houveMudanca) {
    return eventos;
  }

  await saveEventos(eventosAtualizados);
  await Promise.all(
    eventosAtualizados
      .filter((evento) => evento.concluido && evento.removido)
      .map(addToHistorico),
  );

  return eventosAtualizados;
};

export const getHistoricoRemovidosCount = (): Promise<number> =>
  requestJson<{ valor: number }>("/historico-contadores/removidos").then(
    (data) => data.valor,
  );

export const incrementHistoricoRemovidosCount = (): Promise<number> =>
  requestJson<{ valor: number }>("/historico-contadores/removidos/increment", {
    method: "POST",
  }).then((data) => data.valor);

export const getEquipamentosPendentes = (): Promise<Evento[]> =>
  requestJson<Evento[]>("/equipamentos-pendentes");

export const saveEquipamentosPendentes = (eventos: Evento[]): Promise<Evento[]> =>
  requestJson<Evento[]>("/equipamentos-pendentes", {
    method: "PUT",
    body: JSON.stringify(eventos),
  });

export const getInventario = (): Promise<InventarioItem[]> =>
  requestJson<InventarioItem[]>("/inventario");

export const saveInventario = (
  itens: InventarioItem[],
): Promise<InventarioItem[]> =>
  requestJson<InventarioItem[]>("/inventario", {
    method: "PUT",
    body: JSON.stringify(itens),
  });

export const getImpressoras = (): Promise<Impressora[]> =>
  requestJson<Impressora[]>("/impressoras");

export const saveImpressoras = (
  impressoras: Impressora[],
): Promise<Impressora[]> =>
  requestJson<Impressora[]>("/impressoras", {
    method: "PUT",
    body: JSON.stringify(impressoras),
  });

export const getTarefas = (): Promise<Tarefa[]> =>
  requestJson<Tarefa[]>("/tarefas");

export const getHistoricoTarefas = (): Promise<Tarefa[]> =>
  requestJson<Tarefa[]>("/historico-tarefas");

export const saveTarefas = (tarefas: Tarefa[]): Promise<Tarefa[]> =>
  requestJson<Tarefa[]>("/tarefas", {
    method: "PUT",
    body: JSON.stringify(tarefas),
  });

export const reconcileTarefasAutomaticas = async (): Promise<Tarefa[]> => {
  const agora = Date.now();
  const tarefas = await getTarefas();
  let houveMudanca = false;

  const tarefasAtualizadas = tarefas.map((tarefa) => {
    if (
      tarefa.status !== "pendente" &&
      tarefa.status !== "em_andamento"
    ) {
      return tarefa;
    }

    if (!tarefa.prazo || new Date(tarefa.prazo).getTime() > agora) {
      return tarefa;
    }

    houveMudanca = true;
    return {
      ...tarefa,
      status: "concluida" as const,
      updatedAt: new Date().toISOString(),
    };
  });

  if (!houveMudanca) {
    return tarefas;
  }

  return saveTarefas(tarefasAtualizadas);
};

export const getToners = (): Promise<TonerRegistro[]> =>
  requestJson<TonerRegistro[]>("/toners");

export const saveToners = (
  registros: TonerRegistro[],
): Promise<TonerRegistro[]> =>
  requestJson<TonerRegistro[]>("/toners", {
    method: "PUT",
    body: JSON.stringify(registros),
  });
