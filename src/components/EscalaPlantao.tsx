import "./EscalaPlantao.css";

type Plantao = { dia: string; nome: string; matricula: string };

export type MesEscala = {
  titulo: string;
  mes: string;
  grupos: Plantao[][];
};

// Pessoas em rodízio (mesma ordem da escala de junho).
// A rotação segue contínua de junho até dezembro: cada dia de plantão
// recebe a próxima pessoa da lista, sem reiniciar a cada mês.
export const ESCALAS: MesEscala[] = [
  {
    titulo: "Plantão Jun",
    mes: "jun",
    grupos: [
      [{ dia: "04/jun", nome: "Guilherme S.", matricula: "3555" }],
      [
        { dia: "06/jun", nome: "Igor", matricula: "3844" },
        { dia: "07/jun", nome: "Guilherme M.", matricula: "3877" },
      ],
      [
        { dia: "13/jun", nome: "Roger", matricula: "3919" },
        { dia: "14/jun", nome: "Gabriel", matricula: "3923" },
      ],
      [
        { dia: "20/jun", nome: "Orrana", matricula: "3498" },
        { dia: "21/jun", nome: "Andressa", matricula: "3127" },
      ],
      [
        { dia: "27/jun", nome: "Evair", matricula: "3774" },
        { dia: "28/jun", nome: "Guilherme S.", matricula: "3555" },
      ],
    ],
  },
  {
    titulo: "Plantão Jul",
    mes: "jul",
    grupos: [
      [
        { dia: "04/jul", nome: "Igor", matricula: "3844" },
        { dia: "05/jul", nome: "Guilherme M.", matricula: "3877" },
      ],
      [
        { dia: "11/jul", nome: "Roger", matricula: "3919" },
        { dia: "12/jul", nome: "Gabriel", matricula: "3923" },
      ],
      [
        { dia: "18/jul", nome: "Orrana", matricula: "3498" },
        { dia: "19/jul", nome: "Andressa", matricula: "3127" },
      ],
      [
        { dia: "25/jul", nome: "Evair", matricula: "3774" },
        { dia: "26/jul", nome: "Guilherme S.", matricula: "3555" },
      ],
    ],
  },
  {
    titulo: "Plantão Ago",
    mes: "ago",
    grupos: [
      [
        { dia: "01/ago", nome: "Igor", matricula: "3844" },
        { dia: "02/ago", nome: "Guilherme M.", matricula: "3877" },
      ],
      [
        { dia: "08/ago", nome: "Roger", matricula: "3919" },
        { dia: "09/ago", nome: "Gabriel", matricula: "3923" },
      ],
      [
        { dia: "15/ago", nome: "Orrana", matricula: "3498" },
        { dia: "16/ago", nome: "Andressa", matricula: "3127" },
      ],
      [
        { dia: "22/ago", nome: "Evair", matricula: "3774" },
        { dia: "23/ago", nome: "Guilherme S.", matricula: "3555" },
      ],
      [
        { dia: "29/ago", nome: "Igor", matricula: "3844" },
        { dia: "30/ago", nome: "Guilherme M.", matricula: "3877" },
      ],
    ],
  },
  {
    titulo: "Plantão Set",
    mes: "set",
    grupos: [
      [
        { dia: "05/set", nome: "Roger", matricula: "3919" },
        { dia: "06/set", nome: "Gabriel", matricula: "3923" },
      ],
      [
        { dia: "12/set", nome: "Orrana", matricula: "3498" },
        { dia: "13/set", nome: "Andressa", matricula: "3127" },
      ],
      [
        { dia: "19/set", nome: "Evair", matricula: "3774" },
        { dia: "20/set", nome: "Guilherme S.", matricula: "3555" },
      ],
      [
        { dia: "26/set", nome: "Igor", matricula: "3844" },
        { dia: "27/set", nome: "Guilherme M.", matricula: "3877" },
      ],
    ],
  },
  {
    titulo: "Plantão Out",
    mes: "out",
    grupos: [
      [
        { dia: "03/out", nome: "Roger", matricula: "3919" },
        { dia: "04/out", nome: "Gabriel", matricula: "3923" },
      ],
      [
        { dia: "10/out", nome: "Orrana", matricula: "3498" },
        { dia: "11/out", nome: "Andressa", matricula: "3127" },
      ],
      [
        { dia: "17/out", nome: "Evair", matricula: "3774" },
        { dia: "18/out", nome: "Guilherme S.", matricula: "3555" },
      ],
      [
        { dia: "24/out", nome: "Igor", matricula: "3844" },
        { dia: "25/out", nome: "Guilherme M.", matricula: "3877" },
      ],
      [{ dia: "31/out", nome: "Roger", matricula: "3919" }],
    ],
  },
  {
    titulo: "Plantão Nov",
    mes: "nov",
    grupos: [
      [{ dia: "01/nov", nome: "Gabriel", matricula: "3923" }],
      [
        { dia: "07/nov", nome: "Orrana", matricula: "3498" },
        { dia: "08/nov", nome: "Andressa", matricula: "3127" },
      ],
      [
        { dia: "14/nov", nome: "Evair", matricula: "3774" },
        { dia: "15/nov", nome: "Guilherme S.", matricula: "3555" },
      ],
      [
        { dia: "21/nov", nome: "Igor", matricula: "3844" },
        { dia: "22/nov", nome: "Guilherme M.", matricula: "3877" },
      ],
      [
        { dia: "28/nov", nome: "Roger", matricula: "3919" },
        { dia: "29/nov", nome: "Gabriel", matricula: "3923" },
      ],
    ],
  },
  {
    titulo: "Plantão Dez",
    mes: "dez",
    grupos: [
      [
        { dia: "05/dez", nome: "Orrana", matricula: "3498" },
        { dia: "06/dez", nome: "Andressa", matricula: "3127" },
      ],
      [
        { dia: "12/dez", nome: "Evair", matricula: "3774" },
        { dia: "13/dez", nome: "Guilherme S.", matricula: "3555" },
      ],
      [
        { dia: "19/dez", nome: "Igor", matricula: "3844" },
        { dia: "20/dez", nome: "Guilherme M.", matricula: "3877" },
      ],
      [
        { dia: "26/dez", nome: "Roger", matricula: "3919" },
        { dia: "27/dez", nome: "Gabriel", matricula: "3923" },
      ],
    ],
  },
];

const MES_ORDEM = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/**
 * Retorna o card do mês atual e os próximos, limitado a `qtd` meses.
 * Se o mês atual não estiver na escala, começa do primeiro disponível.
 */
export function escalasVisiveis(qtd = 5, ref = new Date()): MesEscala[] {
  const atual = MES_ORDEM[ref.getMonth()];
  const idx = ESCALAS.findIndex((e) => e.mes === atual);
  const inicio = idx >= 0 ? idx : 0;
  return ESCALAS.slice(inicio, inicio + qtd);
}

/** Grade de cards reaproveitável (usada na página e no Modo TV). */
export function EscalaCards({ escalas }: { escalas: MesEscala[] }) {
  return (
    <div className="esc-grid">
      {escalas.map((escala) => (
        <div key={escala.mes} className="esc-card">
          <div className="esc-card-header">{escala.titulo}</div>
          <div className="esc-card-body">
            {escala.grupos.map((grupo, gi) => (
              <div key={gi} className="esc-grupo">
                {grupo.map((p) => (
                  <div key={p.dia} className="esc-row">
                    <span className="esc-dia">{p.dia}</span>
                    <span className="esc-nome">{p.nome}</span>
                    <span className="esc-matricula">{p.matricula}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function EscalaPlantao() {
  return (
    <div className="esc-page">
      <div className="esc-toolbar">
        <h2 className="esc-toolbar-title">Escala de Plantão</h2>
        <span className="esc-toolbar-sub">Jun · Dez 2026</span>
      </div>

      <EscalaCards escalas={ESCALAS} />
    </div>
  );
}
