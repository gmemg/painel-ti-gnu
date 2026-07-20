import { useState, useEffect } from "react";
import { reconcileEventosAutomaticos, getHistorico, getGlpiDashboard } from "../utils/storage";
import "./Dashboard.css";

interface Tecnico {
  id: string;
  nome: string;
  avatar: string;
  role: string;
  resolvidos: number;
}

interface Pessoa {
  id: string;
  nome: string;
  chamados: number;
  cor: string;
}

const DEFAULT_COLORS: Record<string, string> = {
  novos: "#2b8ffb",
  atribuidos: "#6366f1",
  pendentes: "#eab308",
  planejados: "#a855f7",
  fechados: "#9ca3af",
  impressoras: "#14b8a6",
  computadores: "#2b8ffb",
  totens: "#a855f7",
  "montagens-pendentes": "#f97316",
  "montagens-realizadas": "#10b981",
  "equipamentos-pendentes": "#eab308",
};

const PRESET_COLORS = [
  { name: "Azul", value: "#2b8ffb" },
  { name: "Verde", value: "#10b981" },
  { name: "Laranja", value: "#f97316" },
  { name: "Amarelo", value: "#eab308" },
  { name: "Roxo", value: "#a855f7" },
  { name: "Índigo", value: "#6366f1" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Vermelho", value: "#ef4444" },
  { name: "Cinza", value: "#9ca3af" },
];

export default function Dashboard() {
  const [currentTime, setCurrentTime] = useState<string>("");
  
  // Estados do GLPI
  const [kpis, setKpis] = useState<Record<string, number>>({
    novos: 6,
    atribuidos: 14,
    pendentes: 18,
    planejados: 4,
    fechados: 142,
  });
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [carregandoGlpi, setCarregandoGlpi] = useState<boolean>(true);

  // Estados para contagens dinâmicas
  const [montagensPendentes, setMontagensPendentes] = useState<number>(0);
  const [montagensRealizadas, setMontagensRealizadas] = useState<number>(0);
  const [eqPendentes, setEqPendentes] = useState<number>(0);
  const [carregandoDinamicos, setCarregandoDinamicos] = useState<boolean>(true);

  // Estado para controle de cor de cada card
  const [cardColors, setCardColors] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem("dashboard_card_colors");
    if (saved) {
      try {
        return { ...DEFAULT_COLORS, ...JSON.parse(saved) };
      } catch (e) {
        console.error("Erro ao carregar cores salvas do dashboard:", e);
      }
    }
    return DEFAULT_COLORS;
  });

  const [activePickerId, setActivePickerId] = useState<string | null>(null);

  // Efeito para fechar o popover ao clicar fora
  useEffect(() => {
    if (!activePickerId) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".db-color-popover-wrapper")) {
        setActivePickerId(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [activePickerId]);

  // Formatação do relógio em tempo real
  useEffect(() => {
    const formatTime = () => {
      const now = new Date();
      return now.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    };
    setCurrentTime(formatTime());
    const interval = setInterval(() => {
      setCurrentTime(formatTime());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Efeito para carregar as contagens dinâmicas do Storage
  useEffect(() => {
    const carregarDados = async () => {
      try {
        const ativos = await reconcileEventosAutomaticos();
        setMontagensPendentes(ativos.filter((e) => !e.removido).length);

        const historico = await getHistorico();
        setMontagensRealizadas(historico.filter((e) => e.concluido).length);
        setEqPendentes(historico.filter((e) => e.eqPendente && !e.concluido).length);
      } catch (error) {
        console.error("Erro ao carregar dados dinâmicos do Dashboard:", error);
      } finally {
        setCarregandoDinamicos(false);
      }
    };

    carregarDados();
    const interval = setInterval(carregarDados, 30000);
    return () => clearInterval(interval);
  }, []);

  // Efeito para carregar dados da API do GLPI
  useEffect(() => {
    const carregarGlpi = async () => {
      try {
        const data = await getGlpiDashboard();
        if (data.kpis) setKpis(data.kpis);
        if (data.tecnicos && data.tecnicos.length > 0) setTecnicos(data.tecnicos);
        if (data.pessoas && data.pessoas.length > 0) setPessoas(data.pessoas);
      } catch (error) {
        console.error("Erro ao carregar dados do GLPI:", error);
      } finally {
        setCarregandoGlpi(false);
      }
    };
    
    carregarGlpi();
    const interval = setInterval(carregarGlpi, 60000); // Atualiza a cada 1 minuto
    return () => clearInterval(interval);
  }, []);

  const saveColors = (newColors: Record<string, string>) => {
    setCardColors(newColors);
    localStorage.setItem("dashboard_card_colors", JSON.stringify(newColors));
  };

  // Os estados 'tecnicos' e 'pessoas' agora controlam estes dados obtidos via API

  const getCardStyle = (cardId: string) => {
    const accentColor = cardColors[cardId] || DEFAULT_COLORS[cardId];
    return {
      "--card-accent": accentColor,
      "--card-accent-dim": `${accentColor}14`, // ~8% de opacidade
      "--card-accent-glow": `${accentColor}1c`, // ~11% de opacidade
    } as React.CSSProperties;
  };

  const renderColorPicker = (cardId: string) => {
    const isOpened = activePickerId === cardId;
    const currentColor = cardColors[cardId] || DEFAULT_COLORS[cardId];
    
    return (
      <div className="db-color-popover-wrapper">
        <button
          type="button"
          className={`db-card-color-btn ${isOpened ? "active" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            setActivePickerId(isOpened ? null : cardId);
          }}
          title="Personalizar cor do card"
          aria-label="Personalizar cor do card"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 14.7255 3.09032 17.1962 4.85857 19C4.85857 19 4.5 20 5.5 21C6.5 22 8 22 8 22M12 22C11.5 22 10.5 22 10.5 20.5C10.5 19 12 18.5 12 17.5C12 16.5 10.5 16 9.5 16C8.5 16 7.5 16.5 6.5 16C5.5 15.5 5 14 5 12C5 8.13401 8.13401 5 12 5C15.866 5 19 8.13401 19 12C19 15.866 15.866 19 12 19" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="7.5" cy="10.5" r="1.2" fill="currentColor"/>
            <circle cx="11.5" cy="7.5" r="1.2" fill="currentColor"/>
            <circle cx="16.5" cy="9.5" r="1.2" fill="currentColor"/>
            <circle cx="15.5" cy="14.5" r="1.2" fill="currentColor"/>
          </svg>
        </button>
        
        {isOpened && (
          <div className="db-color-popover" onClick={(e) => e.stopPropagation()}>
            <div className="db-color-popover-title">Cor de Destaque</div>
            <div className="db-color-presets">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className={`db-preset-circle ${currentColor === preset.value ? "active" : ""}`}
                  style={{ backgroundColor: preset.value }}
                  onClick={() => {
                     const updated = { ...cardColors, [cardId]: preset.value };
                     saveColors(updated);
                     setActivePickerId(null);
                  }}
                  title={preset.name}
                  aria-label={preset.name}
                />
              ))}
            </div>
            <div className="db-color-picker-custom">
              <label htmlFor={`custom-color-${cardId}`}>Personalizar:</label>
              <input
                id={`custom-color-${cardId}`}
                type="color"
                value={currentColor}
                onChange={(e) => {
                   const updated = { ...cardColors, [cardId]: e.target.value };
                   saveColors(updated);
                }}
              />
            </div>
            <button
              type="button"
              className="db-color-reset-btn"
              onClick={() => {
                 const updated = { ...cardColors, [cardId]: DEFAULT_COLORS[cardId] };
                 saveColors(updated);
                 setActivePickerId(null);
              }}
            >
              Restaurar Padrão
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="db-container">
      {/* Header do Dashboard */}
      <div className="db-header">
        <div className="db-header-left">
          <h2>Dashboard GLPI</h2>
          <p className="db-subtitle">Métricas e Indicadores Gerais do Sistema</p>
        </div>
        <div className="db-header-right">
          <div className="db-update-badge">
            <span className="db-pulse-dot"></span>
            <span>Atualizando ao vivo • {currentTime}</span>
          </div>
        </div>
      </div>

      {/* Grid Principal de Indicadores */}
      <div className="db-kpi-grid">
        {/* Chamados Novos */}
        <div className="db-card kpi-novos" style={getCardStyle("novos")}>
          <div className="db-card-header">
            <div className="db-card-icon-wrap var-accent-bg-dim">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="db-card-icon var-accent-color">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="db-card-header-actions">
              <span className="db-card-trend trend-up">Novo</span>
              {renderColorPicker("novos")}
            </div>
          </div>
          <div className="db-card-body">
            <h3 className="db-card-value">{carregandoGlpi ? "..." : kpis.novos}</h3>
            <p className="db-card-title">Chamados Novos</p>
          </div>
        </div>

        {/* Chamados Atribuídos */}
        <div className="db-card kpi-atribuidos" style={getCardStyle("atribuidos")}>
          <div className="db-card-header">
            <div className="db-card-icon-wrap var-accent-bg-dim">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="db-card-icon var-accent-color">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div className="db-card-header-actions">
              <span className="db-card-trend trend-neutral">Em andamento</span>
              {renderColorPicker("atribuidos")}
            </div>
          </div>
          <div className="db-card-body">
            <h3 className="db-card-value">{carregandoGlpi ? "..." : kpis.atribuidos}</h3>
            <p className="db-card-title">Atribuídos</p>
          </div>
        </div>

        {/* Chamados Pendentes */}
        <div className="db-card kpi-pendentes" style={getCardStyle("pendentes")}>
          <div className="db-card-header">
            <div className="db-card-icon-wrap var-accent-bg-dim">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="db-card-icon var-accent-color">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="db-card-header-actions">
              <span className="db-card-trend trend-warning">Aguardando</span>
              {renderColorPicker("pendentes")}
            </div>
          </div>
          <div className="db-card-body">
            <h3 className="db-card-value">{carregandoGlpi ? "..." : kpis.pendentes}</h3>
            <p className="db-card-title">Chamados Pendentes</p>
          </div>
        </div>

        {/* Chamados Planejados */}
        <div className="db-card kpi-planejados" style={getCardStyle("planejados")}>
          <div className="db-card-header">
            <div className="db-card-icon-wrap var-accent-bg-dim">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="db-card-icon var-accent-color">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div className="db-card-header-actions">
              <span className="db-card-trend trend-neutral">Agendados</span>
              {renderColorPicker("planejados")}
            </div>
          </div>
          <div className="db-card-body">
            <h3 className="db-card-value">{carregandoGlpi ? "..." : kpis.planejados}</h3>
            <p className="db-card-title">Planejados</p>
          </div>
        </div>

        {/* Chamados Fechados */}
        <div className="db-card kpi-fechados" style={getCardStyle("fechados")}>
          <div className="db-card-header">
            <div className="db-card-icon-wrap var-accent-bg-dim">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="db-card-icon var-accent-color">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className="db-card-header-actions">
              <span className="db-card-trend trend-neutral">Arquivados</span>
              {renderColorPicker("fechados")}
            </div>
          </div>
          <div className="db-card-body">
            <h3 className="db-card-value">{carregandoGlpi ? "..." : kpis.fechados}</h3>
            <p className="db-card-title">Chamados Fechados</p>
          </div>
        </div>

        {/* Impressoras */}
        <div className="db-card kpi-impressoras" style={getCardStyle("impressoras")}>
          <div className="db-card-header">
            <div className="db-card-icon-wrap var-accent-bg-dim">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="db-card-icon var-accent-color">
                <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <path d="M6 14h12v8H6z" />
              </svg>
            </div>
            <div className="db-card-header-actions">
              <span className="db-card-trend trend-neutral">Rede</span>
              {renderColorPicker("impressoras")}
            </div>
          </div>
          <div className="db-card-body">
            <h3 className="db-card-value">20</h3>
            <p className="db-card-title">Total Impressoras</p>
          </div>
        </div>

        {/* Total de Computadores */}
        <div className="db-card kpi-computadores" style={getCardStyle("computadores")}>
          <div className="db-card-header">
            <div className="db-card-icon-wrap var-accent-bg-dim">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="db-card-icon var-accent-color">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <div className="db-card-header-actions">
              <span className="db-card-trend trend-neutral">Inventário</span>
              {renderColorPicker("computadores")}
            </div>
          </div>
          <div className="db-card-body">
            <h3 className="db-card-value">245</h3>
            <p className="db-card-title">Total Computadores</p>
          </div>
        </div>

        {/* Total de Totens */}
        <div className="db-card kpi-totens" style={getCardStyle("totens")}>
          <div className="db-card-header">
            <div className="db-card-icon-wrap var-accent-bg-dim">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="db-card-icon var-accent-color">
                <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                <line x1="12" y1="18" x2="12" y2="18.01" strokeWidth="3" />
                <line x1="8" y1="6" x2="16" y2="6" />
              </svg>
            </div>
            <div className="db-card-header-actions">
              <span className="db-card-trend trend-neutral">Ativos</span>
              {renderColorPicker("totens")}
            </div>
          </div>
          <div className="db-card-body">
            <h3 className="db-card-value">14</h3>
            <p className="db-card-title">Total de Totens</p>
          </div>
        </div>

        {/* Total de Montagens Pendentes (DINÂMICO) */}
        <div className="db-card kpi-montagens-pendentes" style={getCardStyle("montagens-pendentes")}>
          <div className="db-card-header">
            <div className="db-card-icon-wrap var-accent-bg-dim">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="db-card-icon var-accent-color">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="db-card-header-actions">
              <span className="db-card-trend trend-warning">Fila</span>
              {renderColorPicker("montagens-pendentes")}
            </div>
          </div>
          <div className="db-card-body">
            <h3 className="db-card-value">{carregandoDinamicos ? "..." : montagensPendentes}</h3>
            <p className="db-card-title">Montagens Pendentes</p>
          </div>
        </div>

        {/* Total de Montagens Realizadas (DINÂMICO) */}
        <div className="db-card kpi-montagens-realizadas" style={getCardStyle("montagens-realizadas")}>
          <div className="db-card-header">
            <div className="db-card-icon-wrap var-accent-bg-dim">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="db-card-icon var-accent-color">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="22 4 12 14.01 9 11.01" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="db-card-header-actions">
              <span className="db-card-trend trend-up">Histórico</span>
              {renderColorPicker("montagens-realizadas")}
            </div>
          </div>
          <div className="db-card-body">
            <h3 className="db-card-value">{carregandoDinamicos ? "..." : montagensRealizadas}</h3>
            <p className="db-card-title">Montagens Realizadas</p>
          </div>
        </div>

        {/* Chamados com Equipamento Pendente (DINÂMICO) */}
        <div className="db-card kpi-equipamentos-pendentes" style={getCardStyle("equipamentos-pendentes")}>
          <div className="db-card-header">
            <div className="db-card-icon-wrap var-accent-bg-dim">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="db-card-icon var-accent-color">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div className="db-card-header-actions">
              <span className="db-card-trend trend-warning">Atenção</span>
              {renderColorPicker("equipamentos-pendentes")}
            </div>
          </div>
          <div className="db-card-body">
            <h3 className="db-card-value">{carregandoDinamicos ? "..." : eqPendentes}</h3>
            <p className="db-card-title">Eq. Pendente (Hist.)</p>
          </div>
        </div>
      </div>

      {/* Seção Inferior: Widgets de Consulta */}
      <div className="db-lower-section">
        {/* Widget 1: Ranking de Produtividade dos Técnicos */}
        <div className="db-tech-widget">
          <div className="db-widget-header">
            <div className="db-widget-title-group">
              <h3>Ranking TI</h3>
              <p>Maior volume de chamados solucionados (GLPI)</p>
            </div>
          </div>

          {carregandoGlpi ? (
            <div className="db-widget-loading">
              <span>Carregando...</span>
              <div className="db-loading-bar-wrap">
                <div className="db-loading-bar-fill" />
              </div>
            </div>
          ) : tecnicos.length === 0 ? (
            <div className="db-widget-empty">Nenhum técnico encontrado no GLPI.</div>
          ) : (
            <div className="db-ranking-list">
              {[...tecnicos]
                .sort((a, b) => b.resolvidos - a.resolvidos)
                .map((tech, index) => {
                  const isTop3 = index < 3;
                  const medalColor = index === 0 ? "gold" : index === 1 ? "silver" : "bronze";
                  return (
                    <div key={tech.id} className="db-ranking-item">
                      <div className="db-ranking-position-wrap">
                        <span className={`db-ranking-position ${isTop3 ? `medal-${medalColor}` : ""}`}>
                          {index + 1}
                        </span>
                      </div>
                      <div className="db-ranking-avatar">{tech.avatar}</div>
                      <div className="db-ranking-info">
                        <span className="db-ranking-name">{tech.nome}</span>
                        <span className="db-ranking-role">{tech.role}</span>
                      </div>
                      <div className="db-ranking-value-wrap">
                        <span className="db-ranking-value">{tech.resolvidos}</span>
                        <span className="db-ranking-label">resolvidos</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Widget 2: Chamados por Pessoa */}
        <div className="db-tech-widget">
          <div className="db-widget-header">
            <div className="db-widget-title-group">
              <h3>Chamados por Pessoa</h3>
              <p>Quem mais abriu chamados (GLPI)</p>
            </div>
          </div>

          {carregandoGlpi ? (
            <div className="db-widget-loading">
              <span>Carregando...</span>
              <div className="db-loading-bar-wrap">
                <div className="db-loading-bar-fill" />
              </div>
            </div>
          ) : pessoas.length === 0 ? (
            <div className="db-widget-empty">Nenhuma pessoa encontrada no GLPI.</div>
          ) : (
            <div className="db-sector-list">
              {[...pessoas]
                .sort((a, b) => b.chamados - a.chamados)
                .map((pessoa) => {
                  const maxChamados = Math.max(...pessoas.map((p) => p.chamados));
                  const percentage = maxChamados > 0 ? (pessoa.chamados / maxChamados) * 100 : 0;
                  return (
                    <div key={pessoa.id} className="db-sector-item">
                      <div className="db-sector-info-row">
                        <span className="db-sector-name">{pessoa.nome}</span>
                        <span className="db-sector-count">
                          <strong>{pessoa.chamados}</strong> chamados
                        </span>
                      </div>
                      <div className="db-sector-bar-bg">
                        <div
                          className="db-sector-bar-fill"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: pessoa.cor,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
