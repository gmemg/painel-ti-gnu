import { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  NavLink,
  Link,
  useLocation,
} from "react-router-dom";
import Painel from "./components/Painel";
import Historico from "./components/Historico";
import InventarioMontagem from "./components/InventarioMontagem";
import Impressoras from "./components/Impressoras";
import Tarefas from "./components/Tarefas";
import HistoricoTarefas from "./components/HistoricoTarefas";
import ModoTV from "./components/ModoTV";
import EquipamentosPendentes from "./components/EquipamentosPendentes";
import "./App.css";

/**
 * Componente raiz de layout e rotas.
 * O Router fica aqui para que a navegação e o topo sejam persistentes
 * entre as telas de Painel e Histórico.
 */
function AppLayout() {
  const location = useLocation();
  const [tema, setTema] = useState<"dark" | "light">("dark");
  const [menuAberto, setMenuAberto] = useState(true);
  const isTVMode = location.pathname === "/tv";

  useEffect(() => {
    const salvo = localStorage.getItem("tema_app");
    if (salvo === "light" || salvo === "dark") {
      setTema(salvo);
      return;
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = tema;
    localStorage.setItem("tema_app", tema);
  }, [tema]);

  if (isTVMode) {
    return (
      <Routes>
        <Route path="/tv" element={<ModoTV />} />
      </Routes>
    );
  }

  return (
      <div className="app">
        <header className="app-header">
          <div className="header-content">
            <button
              type="button"
              className="nav-toggle"
              onClick={() => setMenuAberto((prev) => !prev)}
              aria-label={
                menuAberto ? "Recolher menu lateral" : "Abrir menu lateral"
              }
              aria-expanded={menuAberto}
              aria-controls="side-nav"
              title={
                menuAberto ? "Recolher menu lateral" : "Abrir menu lateral"
              }
            >
              <span className="nav-toggle-icon" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>
            <img
              className="header-logo"
              src="https://www.gnu.com.br/site/img/logo-gnu.svg"
              alt="Logo GNU"
            />
            <h1 className="header-title">PAINEL T.I. GNU</h1>
            <div className="header-actions">
              <Link to="/tv" className="tv-btn" title="Modo TV" aria-label="Modo TV">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </Link>
              <button
                type="button"
                className="theme-toggle"
                onClick={() =>
                  setTema((prev) => (prev === "dark" ? "light" : "dark"))
                }
                aria-label={
                  tema === "dark" ? "Ativar modo claro" : "Ativar modo escuro"
                }
                title={
                  tema === "dark" ? "Ativar modo claro" : "Ativar modo escuro"
                }
              >
                <span className="theme-toggle-icon" aria-hidden="true">
                  {tema === "dark" ? (
                    <svg
                      viewBox="0 0 24 24"
                      focusable="false"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="4" />
                      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      focusable="false"
                      aria-hidden="true"
                    >
                      <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
                    </svg>
                  )}
                </span>
              </button>
            </div>
          </div>
        </header>
        <div className={`app-body${menuAberto ? " nav-open" : ""}`}>
          <aside
            id="side-nav"
            className={`side-nav${menuAberto ? " is-open" : ""}`}
          >
            <div className="side-nav-inner">
              <div className="side-nav-title">Navegação</div>
              <nav className="side-nav-links">
                <NavLink
                  to="/"
                  className={({ isActive }) =>
                    `side-nav-link${isActive ? " active" : ""}`
                  }
                >
                  Montagens
                </NavLink>
                <NavLink
                  to="/equipamentos-pendentes"
                  className={({ isActive }) =>
                    `side-nav-link${isActive ? " active" : ""}`
                  }
                >
                  Equipamento Pendente
                </NavLink>
                <NavLink
                  to="/historico"
                  className={({ isActive }) =>
                    `side-nav-link${isActive ? " active" : ""}`
                  }
                >
                  Histórico
                </NavLink>
                <NavLink
                  to="/inventario"
                  className={({ isActive }) =>
                    `side-nav-link${isActive ? " active" : ""}`
                  }
                >
                  Inventário
                </NavLink>
                <NavLink
                  to="/impressoras"
                  className={({ isActive }) =>
                    `side-nav-link${isActive ? " active" : ""}`
                  }
                >
                  Impressoras
                </NavLink>
                <NavLink
                  to="/tarefas"
                  className={({ isActive }) =>
                    `side-nav-link${isActive ? " active" : ""}`
                  }
                >
                  Lista de Tarefas
                </NavLink>
                <NavLink
                  to="/historico-tarefas"
                  className={({ isActive }) =>
                    `side-nav-link${isActive ? " active" : ""}`
                  }
                >
                  Histórico de Tarefas
                </NavLink>
              </nav>
            </div>
          </aside>
          <main className="main-content">
            {/* Rotas separadas para manter cada tela isolada e simples */}
            <Routes>
              <Route path="/" element={<Painel />} />
              <Route path="/equipamentos-pendentes" element={<EquipamentosPendentes />} />
              <Route path="/historico" element={<Historico />} />
              <Route path="/inventario" element={<InventarioMontagem />} />
              <Route path="/impressoras" element={<Impressoras />} />
              <Route path="/tarefas" element={<Tarefas />} />
              <Route path="/historico-tarefas" element={<HistoricoTarefas />} />
            </Routes>
          </main>
        </div>
      </div>
  );
}

function App() {
  return (
    <Router>
      <AppLayout />
    </Router>
  );
}

export default App;
