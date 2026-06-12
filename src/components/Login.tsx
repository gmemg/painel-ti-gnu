import { FormEvent, useState } from "react";
import { useAuth } from "../context/AuthContext";
import "./Login.css";

/**
 * Tela de autenticação. Exibida quando não há sessão ativa.
 * Em caso de credencial inválida, mostra a mensagem retornada pela API.
 */
export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const aoEnviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      await login(username.trim(), password);
    } catch {
      setErro("Usuário ou senha inválidos.");
      setPassword("");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={aoEnviar}>
        <img
          className="login-logo"
          src="https://www.gnu.com.br/site/img/logo-gnu.svg"
          alt="Logo GNU"
        />
        <h1 className="login-title">PAINEL T.I. GNU</h1>
        <p className="login-subtitle">Faça login para continuar</p>

        <label className="login-field">
          <span>Usuário</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
        </label>

        <label className="login-field">
          <span>Senha</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {erro && <div className="login-erro">{erro}</div>}

        <button type="submit" className="login-btn" disabled={carregando}>
          {carregando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
