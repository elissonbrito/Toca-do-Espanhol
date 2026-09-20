import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { fetchMe, login as loginRequest, logout as logoutRequest, type User } from '@/api/auth';
import { clearTokens, getTokens } from '@/api/client';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { access } = await getTokens();
      if (access) {
        try {
          setUser(await fetchMe());
        } catch {
          await clearTokens();
        }
      }
      setIsLoading(false);
    })();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      signIn: async (email: string, password: string) => {
        setUser(await loginRequest(email, password));
      },
      signOut: async () => {
        const { refresh } = await getTokens();
        await logoutRequest(refresh);
        setUser(null);
      },
    }),
    [user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return ctx;
}
