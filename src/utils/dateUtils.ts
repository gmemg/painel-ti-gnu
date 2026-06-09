/**
 * Converte um ISO date/time em rótulo de dia da semana.
 * A decisão de usar o `getDay()` mantém o cálculo local (fuso do usuário),
 * alinhado ao uso da UI que mostra datas no contexto local.
 *
 * @param dataHora Data/hora em formato compatível com `Date`.
 * @returns Nome do dia da semana em pt-BR.
 */
export const getDiaSemana = (dataHora: string): string => {
  const diasSemana = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado'
  ];
  
  const data = new Date(dataHora);
  return diasSemana[data.getDay()];
};

/**
 * Formata uma data em padrão legível pt-BR.
 * Usa `toLocaleString` para respeitar o locale do usuário e evitar
 * regras manuais de formatação.
 *
 * @param dataHora Data/hora em formato compatível com `Date`.
 * @returns Data formatada em `dd/mm/aaaa hh:mm`.
 */
export const formatDateTime = (dataHora: string): string => {
  const data = new Date(dataHora);
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Indica se o evento está a até dois dias a partir de hoje.
 * O cálculo zera as horas para comparar apenas datas, reduzindo ruído
 * por diferenças de horário quando a UI destaca eventos próximos.
 *
 * @param dataHora Data/hora do evento.
 * @returns `true` quando faltam 0-2 dias e o evento ainda não passou.
 */
export const faltamDoisDiasOuMenos = (dataHora: string): boolean => {
  const dataEvento = new Date(dataHora);
  const hoje = new Date();
  
  // Resetar horas para comparar apenas as datas
  hoje.setHours(0, 0, 0, 0);
  dataEvento.setHours(0, 0, 0, 0);
  
  // Calcular diferença em milissegundos
  const diferencaMs = dataEvento.getTime() - hoje.getTime();
  
  // Converter para dias
  const diferencaDias = Math.ceil(diferencaMs / (1000 * 60 * 60 * 24));
  
  // Retornar true se faltam 2 dias ou menos e o evento ainda não passou
  return diferencaDias >= 0 && diferencaDias <= 2;
};
