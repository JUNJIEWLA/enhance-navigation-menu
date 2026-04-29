import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../supabase';

export type RolUsuario = 'super_admin' | 'admin_empresa' | 'usuario_empresa';

export interface PerfilUsuario {
  userId: string;
  empresaId: string;
  rol: RolUsuario;
  nombreEmpresa?: string;
  username: string;
}

interface LoginParams {
  username: string;
  password: string;
  rememberUsername: boolean;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  perfil: PerfilUsuario | null;
  loading: boolean;
  perfilLoading: boolean;
  rememberedUsername: string;
  signIn: (params: LoginParams) => Promise<void>;
  signOut: () => Promise<void>;
  refreshPerfil: (userId?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const REMEMBERED_USERNAME_KEY = 'cxp_remembered_username';
const CURRENT_USERNAME_KEY = 'cxp_usuario';

const asRol = (value: string | null | undefined): RolUsuario => {
  if (value === 'super_admin' || value === 'admin_empresa' || value === 'usuario_empresa') {
    return value;
  }
  return 'usuario_empresa';
};

const mapPerfil = (row: any): PerfilUsuario => {
  return {
    userId: row.user_id,
    empresaId: row.empresa_id,
    rol: asRol(row.rol),
    nombreEmpresa: row.nombre_empresa || row.empresas?.nombre,
    username: row.username
  };
};

const fetchPerfilDirecto = async (targetUserId: string): Promise<PerfilUsuario | null> => {
  const { data, error } = await supabase
    .from('perfiles')
    .select('user_id, empresa_id, rol, username, empresas(nombre)')
    .eq('user_id', targetUserId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapPerfil(data);
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [perfilLoading, setPerfilLoading] = useState(false);

  const rememberedUsername = useMemo(
    () => (typeof window === 'undefined' ? '' : localStorage.getItem(REMEMBERED_USERNAME_KEY) || ''),
    []
  );

  const refreshPerfil = async (userId?: string) => {
    const targetUserId = userId || user?.id;

    if (!targetUserId) {
      setPerfil(null);
      return;
    }

    setPerfilLoading(true);
    try {
      const { data, error } = await supabase.rpc('obtener_perfil_actual');
      const perfilData = Array.isArray(data) ? data[0] : data;

      if (!error && perfilData && perfilData.user_id === targetUserId) {
        const nextPerfil = mapPerfil(perfilData);
        setPerfil(nextPerfil);
        localStorage.setItem(CURRENT_USERNAME_KEY, nextPerfil.username);
        return;
      }

      const perfilDirecto = await fetchPerfilDirecto(targetUserId);

      if (perfilDirecto) {
        setPerfil(perfilDirecto);
        localStorage.setItem(CURRENT_USERNAME_KEY, perfilDirecto.username);
        return;
      }

      setPerfil(null);
      localStorage.removeItem(CURRENT_USERNAME_KEY);
    } finally {
      setPerfilLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      const {
        data: { session: currentSession }
      } = await supabase.auth.getSession();

      if (!mounted) return;

      setSession(currentSession);
      setUser(currentSession?.user || null);

      if (currentSession?.user) {
        await refreshPerfil(currentSession.user.id);
      }

      if (mounted) {
        setLoading(false);
      }
    };

    void initialize();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user || null);

      if (nextSession?.user) {
        void refreshPerfil(nextSession.user.id);
      } else {
        setPerfil(null);
        setPerfilLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async ({ username, password, rememberUsername }: LoginParams) => {
    const normalizedUsername = username.trim().toLowerCase();

    if (!normalizedUsername || !password) {
      throw new Error('Debe completar usuario y contraseña.');
    }

    // Login minimalista con campo "usuario": resuelve email interno via RPC controlada.
    const { data: resolvedEmail, error: usernameError } = await supabase.rpc('resolver_email_login', {
      p_username: normalizedUsername
    });

    if (usernameError || !resolvedEmail || typeof resolvedEmail !== 'string') {
      throw new Error('Usuario o contraseña incorrectos.');
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: resolvedEmail,
      password
    });

    if (signInError) {
      throw new Error('Usuario o contraseña incorrectos.');
    }

    if (rememberUsername) {
      localStorage.setItem(REMEMBERED_USERNAME_KEY, normalizedUsername);
    } else {
      localStorage.removeItem(REMEMBERED_USERNAME_KEY);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem(CURRENT_USERNAME_KEY);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        perfil,
        loading,
        perfilLoading,
        rememberedUsername,
        signIn,
        signOut,
        refreshPerfil
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
};
