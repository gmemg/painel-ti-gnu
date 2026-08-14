/**
 * Utilitário de Efeitos Sonoros do Painel TI GNU
 * Sintetizado dinamicamente via Web Audio API (sem arquivos externos).
 */

export type TipoEfeitoSonoro = "chime" | "alerta" | "sonar" | "pop";

export interface OpcaoSom {
  id: TipoEfeitoSonoro;
  nome: string;
  descricao: string;
  icone: string;
}

export const LISTA_EFEITOS_SONOROS: OpcaoSom[] = [
  {
    id: "chime",
    nome: "Chime Digital Suave",
    descricao: "Dois tons ascendentes suaves (C5 -> E5)",
    icone: "🔔",
  },
  {
    id: "alerta",
    nome: "Alerta Triplo",
    descricao: "Três notas rápidas ascendentes (Sol5 -> Do6 -> Mi6)",
    icone: "🚨",
  },
  {
    id: "sonar",
    nome: "Sonar / Ping Cristalino",
    descricao: "Nota pura ressonante com decaimento suave",
    icone: "📡",
  },
  {
    id: "pop",
    nome: "Pop / Blip Amigável",
    descricao: "Efeito rápido de rampa de frequência",
    icone: "💬",
  },
];

/**
 * Toca o efeito sonoro selecionado.
 * @param tipo Opcional. Se omitido, lê do localStorage ou usa 'chime' por padrão.
 */
export function tocarSomNovoChamado(tipo?: TipoEfeitoSonoro) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const agora = ctx.currentTime;
    const tipoEfetivo =
      tipo ||
      (localStorage.getItem("som_novos_chamados_tipo") as TipoEfeitoSonoro) ||
      "chime";

    switch (tipoEfetivo) {
      case "alerta": {
        // Opção 2: Alerta Triplo (G5 -> C6 -> E6)
        const notas = [783.99, 1046.5, 1318.51];
        notas.forEach((freq, idx) => {
          const start = agora + idx * 0.1;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0.001, start);
          gain.gain.exponentialRampToValueAtTime(0.2, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.18);
        });
        break;
      }

      case "sonar": {
        // Opção 3: Sonar / Ping Cristalino (987.77 Hz com fade-out longo)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(987.77, agora);
        gain.gain.setValueAtTime(0.001, agora);
        gain.gain.exponentialRampToValueAtTime(0.25, agora + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, agora + 0.75);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(agora);
        osc.stop(agora + 0.75);
        break;
      }

      case "pop": {
        // Opção 4: Pop / Blip Amigável (Frequência rampa 320Hz -> 920Hz)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(320, agora);
        osc.frequency.exponentialRampToValueAtTime(920, agora + 0.06);
        gain.gain.setValueAtTime(0.001, agora);
        gain.gain.exponentialRampToValueAtTime(0.22, agora + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, agora + 0.09);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(agora);
        osc.stop(agora + 0.09);
        break;
      }

      case "chime":
      default: {
        // Opção 1: Chime Digital Suave (C5 523.25Hz -> E5 659.25Hz)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(523.25, agora);
        gain1.gain.setValueAtTime(0.001, agora);
        gain1.gain.exponentialRampToValueAtTime(0.18, agora + 0.03);
        gain1.gain.exponentialRampToValueAtTime(0.001, agora + 0.28);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(agora);
        osc1.stop(agora + 0.28);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(659.25, agora + 0.12);
        gain2.gain.setValueAtTime(0.001, agora + 0.12);
        gain2.gain.exponentialRampToValueAtTime(0.22, agora + 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.001, agora + 0.48);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(agora + 0.12);
        osc2.stop(agora + 0.48);
        break;
      }
    }
  } catch (err) {
    console.warn("[Áudio] Erro ao emitir sinal sonoro de novo chamado:", err);
  }
}
