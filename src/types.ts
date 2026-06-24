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
  eqPendente?: boolean;
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
  problema: string;
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

/**
 * Escala de plantão: cada `Escala` representa um mês (titulo + mes/ano) e contém
 * os dias de plantão com data, funcionário e matrícula. O Modo TV exibe apenas a
 * escala cujo mês/ano corresponde à data atual.
 */
export interface EscalaDia {
  id: string;
  data: string; // ISO "YYYY-MM-DD"
  nome: string;
  matricula: string;
}

export interface Escala {
  id: string;
  titulo: string;
  ano: number;
  mes: number; // 1-12
  dias: EscalaDia[];
  updatedAt: string;
}

/**
 * Membro da Equipe de T.I. usado para montar a escala de plantão de forma
 * automatizada. `ferias` marca quem deve ser ignorado na simulação; `ordem`
 * mantém a ordem de exibição no painel.
 */
export interface MembroEquipe {
  id: string;
  nome: string;
  matricula: string;
  cargo: string;
  feriasInicio: string; // ISO "YYYY-MM-DD" ou ""
  feriasFim: string;    // ISO "YYYY-MM-DD" ou ""
  ordem: number;
  updatedAt: string;
}

/**
 * Feriado configurável usado pela simulação da escala. `comPlantao` indica se o
 * dia precisa de alguém de plantão (entra no rodízio) ou não (é removido dos
 * dias a escalar, mesmo caindo num fim de semana).
 */
export interface Feriado {
  id: string;
  data: string; // ISO "YYYY-MM-DD"
  nome: string;
  comPlantao: boolean;
  updatedAt: string;
}

export interface ManutencaoRegistro {
  id: string;
  equipamento: string;
  nm: string;
  local: string;
  patrimonio: string;
  fornecedor: string;
  sede: string;
  updatedAt: string;
}

export type CameraStatus = "online" | "offline" | "reposicionar" | "reposicionada";

export type RatStatus = "Aguardando assinatura" | "Assinado" | "Criar" | "Criado" | "Imprimir" | "";

export interface Camera {
  id: string;
  local: string;
  sede: string;
  marca: string;
  modelo: string;
  ip: string;
  rat: RatStatus;
  chamado: string;
  status: CameraStatus;
  historico: InventarioHistoricoEntry[];
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
