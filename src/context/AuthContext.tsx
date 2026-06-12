import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  AuthUser,
  clearAuth,
  getStoredUser,
  login as apiLogin,
  setAuth,
} from "../utils/storage";

interface AuthContextValue {
  user: AuthUser | null;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Provê o estado de autenticação para toda a aplicação.
 * O token e o usuário são persistidos em localStorage (via storage.ts),
 * então uma sessão sobrevive ao reload da página.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const { token, user: usuario } = await apiLogin(username, password);
    setAuth(token, usuario);
    setUser(usuario);
  }, []);

  // Quando uma requisição retorna 401 (token expirado/inválido), desloga.
  useEffect(() => {
    const aoExpirar = () => setUser(null);
    window.addEventListener("auth:unauthorized", aoExpirar);
    return () => window.removeEventListener("auth:unauthorized", aoExpirar);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAdmin: user?.role === "admin",
      login,
      logout,
    }),
    [user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  }
  return ctx;
}
