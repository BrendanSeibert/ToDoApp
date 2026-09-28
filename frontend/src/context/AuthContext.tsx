import { createContext, createSignal, useContext, type Accessor, type JSX } from "solid-js";
import type { User } from "~/api/auth";

interface AuthContextValue {
  user: Accessor<User | null>;
  setCurrentUser: (user: User | null) => void;
  initializing: Accessor<boolean>;
  finishInitializing: () => void;
}

const AuthContext = createContext<AuthContextValue>();

interface AuthProviderProps {
  children: JSX.Element;
}

export function AuthProvider(props: AuthProviderProps) {
  const [user, setUser] = createSignal<User | null>(null);
  const [initializing, setInitializing] = createSignal(true);

  const value: AuthContextValue = {
    user,
    setCurrentUser: setUser,
    initializing,
    finishInitializing: () => setInitializing(false),
  };

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
