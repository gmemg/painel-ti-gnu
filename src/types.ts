/**
 * Representa um evento de montagem no sistema.
 * Mantém campos redundantes como `diaSemana` para facilitar renderização
 * imediata na UI sem recálculo em massa.
 */
export interface Evento {
  id: string;
  nomeEvento: string;
  adicionadoPor: string;
  dataHora: string;
  diaSemana: string;
  localEvento: string;
  funcionarioPlantao: string;
  plantaoEventos: string;
  equipamentosNecessarios: string;
  numeroChamado: string;
  requerente: string;
  removido: boolean;
  concluido?: boolean;
  dataRemocao?: string;
  dataConclusao?: string;
}

/**
 * Representa um item do inventário de montagem.
 */
export type InventarioStatus =
  | "disponivel"
  | "em_uso"
  | "manutencao"
  | "reservado";

export interface InventarioHistoricoEntry {
  id: string;
  data: string;
  descricao: string;
}

export interface InventarioUnidade {
  id: string;
  modelo: string;
  patrimonio: string;
  localizacao: string;
  requerente: string;
  montadoPor: string;
  status: InventarioStatus;
  historico: InventarioHistoricoEntry[];
  updatedAt: string;
}

export interface InventarioItem {
  id: string;
  item: string;
  unidades: InventarioUnidade[];
  updatedAt: string;
}

export interface Impressora {
  id: string;
  local: string;
  sede: string;
  marca: string;
  modelo: string;
  numeroSerie: string;
  ip: string;
  mac: string;
  link: string;
  tonerPreto: number;
  tonerCiano: number;
  tonerMagenta: number;
  tonerAmarelo: number;
  updatedAt: string;
}

export type TarefaPrioridade = "baixa" | "media" | "alta" | "critica";
export type TarefaStatus =
  | "pendente"
  | "em_andamento"
  | "concluida"
  | "cancelada";

export interface Tarefa {
  id: string;
  tarefa: string;
  descricao: string;
  prioridade: TarefaPrioridade;
  status: TarefaStatus;
  responsavel: string;
  prazo: string;
  chamado: string;
  dataCriacao: string;
  updatedAt: string;
}

export type TonerTipo = "solicitado" | "cheio" | "vazio";

export interface TonerRegistro {
  id: string;
  tipo: TonerTipo;
  modelo: string;
  preto: number;
  ciano: number;
  magenta: number;
  amarelo: number;
  updatedAt: string;
}
