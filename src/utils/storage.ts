import {
  Camera,
  Escala,
  Evento,
  Feriado,
  Impressora,
  InventarioItem,
  ManutencaoRegistro,
  MembroEquipe,
  Tarefa,
  TonerRegistro,
} from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

export type UserRole = "admin" | "viewer";
export interface AuthUser {
  username: string;
  role: UserRole;
}

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);

export const getStoredUser = (): AuthUser | null => {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
};

export const setAuth = (token: string, user: AuthUser): void => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearAuth = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

/** Erro de requisição que carrega o status HTTP para tratamento fino (401/403). */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

/** Disparado quando uma requisição retorna 401 — o AuthContext escuta e desloga. */
const notifyUnauthorized = () => {
  clearAuth();
  window.dispatchEvent(new Event("auth:unauthorized"));
};

const requestJson = async <T>(
  path: string,
  options?: RequestInit,
): Promise<T> => {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const message = await response.text();
    if (response.status === 401) {
      notifyUnauthorized();
    }
    throw new ApiError(response.status, message || `Erro na API: ${response.status}`);
  }

  return response.json() as Promise<T>;
};

export const login = (
  username: string,
  password: string,
): Promise<{ token: string; user: AuthUser }> =>
  requestJson<{ token: string; user: AuthUser }>("/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

export const getMe = (): Promise<AuthUser> => requestJson<AuthUser>("/me");

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

  // Viewer não tem permissão de escrita: mantém a atualização só na UI.
  if (getStoredUser()?.role !== "admin") {
    return eventosAtualizados;
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

  // Viewer não tem permissão de escrita: mantém a atualização só na UI.
  if (getStoredUser()?.role !== "admin") {
    return tarefasAtualizadas;
  }

  return saveTarefas(tarefasAtualizadas);
};

/** Configuração das abas exibidas no Modo TV (quais aparecem e em que ordem). */
export interface TvConfig {
  telas: Array<{ id: string; ativo: boolean }>;
}

export const getTvConfig = (): Promise<TvConfig | null> =>
  requestJson<TvConfig | null>("/tv-config");

export const saveTvConfig = (config: TvConfig): Promise<TvConfig> =>
  requestJson<TvConfig>("/tv-config", {
    method: "PUT",
    body: JSON.stringify(config),
  });

export const getEscalas = (): Promise<Escala[]> =>
  requestJson<Escala[]>("/escalas");

export const saveEscalas = (escalas: Escala[]): Promise<Escala[]> =>
  requestJson<Escala[]>("/escalas", {
    method: "PUT",
    body: JSON.stringify(escalas),
  });

export const getEquipe = (): Promise<MembroEquipe[]> =>
  requestJson<MembroEquipe[]>("/equipe");

export const saveEquipe = (lista: MembroEquipe[]): Promise<MembroEquipe[]> =>
  requestJson<MembroEquipe[]>("/equipe", {
    method: "PUT",
    body: JSON.stringify(lista),
  });

export const getFeriados = (): Promise<Feriado[]> =>
  requestJson<Feriado[]>("/feriados");

export const saveFeriados = (lista: Feriado[]): Promise<Feriado[]> =>
  requestJson<Feriado[]>("/feriados", {
    method: "PUT",
    body: JSON.stringify(lista),
  });

export const getCameras = (): Promise<Camera[]> =>
  requestJson<Camera[]>("/cameras");

export const saveCameras = (cameras: Camera[]): Promise<Camera[]> =>
  requestJson<Camera[]>("/cameras", {
    method: "PUT",
    body: JSON.stringify(cameras),
  });

export const getManutencao = (): Promise<ManutencaoRegistro[]> =>
  requestJson<ManutencaoRegistro[]>("/manutencao");

export const saveManutencao = (
  registros: ManutencaoRegistro[],
): Promise<ManutencaoRegistro[]> =>
  requestJson<ManutencaoRegistro[]>("/manutencao", {
    method: "PUT",
    body: JSON.stringify(registros),
  });

export const getToners = (): Promise<TonerRegistro[]> =>
  requestJson<TonerRegistro[]>("/toners");

export const saveToners = (
  registros: TonerRegistro[],
): Promise<TonerRegistro[]> =>
  requestJson<TonerRegistro[]>("/toners", {
    method: "PUT",
    body: JSON.stringify(registros),
  });
