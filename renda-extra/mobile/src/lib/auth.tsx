import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, session } from './api';
import { billing } from './billing';
import type { Profile, User } from './types';

type AuthState = {
  ready: boolean;
  user: User | null;
  profile: Profile | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  setUser: (u: User) => void;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const refreshMe = useCallback(async () => {
    const data = await api<{ user: User; profile: Profile | null }>('/me');
    setUser(data.user);
    setProfile(data.profile);
  }, []);

  useEffect(() => {
    session.onExpired(() => {
      setUser(null);
      setProfile(null);
      qc.clear();
    });
    (async () => {
      try {
        if (await session.load()) await refreshMe();
      } catch {
        await session.clear();
      } finally {
        setReady(true);
      }
    })();
  }, [qc, refreshMe]);

  const userId = user?.id;
  useEffect(() => {
    if (userId) billing.init(userId).catch(() => {});
  }, [userId]);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      user,
      profile,
      refreshMe,
      setUser,
      async login(email, password) {
        const data = await api<{ user: User; accessToken: string; refreshToken: string }>('/auth/login', {
          method: 'POST',
          body: { email, password },
        });
        await session.save(data);
        await refreshMe();
      },
      async register(name, email, password) {
        const data = await api<{ user: User; accessToken: string; refreshToken: string }>('/auth/register', {
          method: 'POST',
          body: { name, email, password },
        });
        await session.save(data);
        setUser(data.user);
        setProfile(null);
      },
      async logout() {
        const refreshToken = await session.refreshToken();
        await api('/auth/logout', { method: 'POST', body: { refreshToken } }).catch(() => {});
        await billing.logout();
        await session.clear();
        qc.clear();
        setUser(null);
        setProfile(null);
      },
    }),
    [ready, user, profile, refreshMe, qc],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth fora do AuthProvider');
  return v;
}
