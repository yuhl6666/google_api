import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Role } from '../types';

interface AuthContextValue {
  user: User | null;
  role: Role | null;
  loading: boolean;
  signUp: (email: string, password: string, role: Role) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchRole(uid: string): Promise<Role | null> {
  const { data, error } = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle();
  if (error || !data) return null;
  return data.role as Role;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Supabase not configured yet: skip all auth wiring so the app can still
    // boot and render (e.g. the login page) instead of hanging in "loading".
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      setRole(session?.user ? await fetchRole(session.user.id) : null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      setRole(session?.user ? await fetchRole(session.user.id) : null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signUp(email: string, password: string, newRole: Role) {
    if (!isSupabaseConfigured) {
      throw new Error('Supabaseが設定されていないため、この操作は実行できません。');
    }
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    if (!data.user) {
      throw new Error(
        'サインアップにはメール確認が必要な設定になっています。確認メールのリンクを開いてからログインしてください。'
      );
    }
    const { error: profileError } = await supabase.from('profiles').insert({ id: data.user.id, role: newRole });
    if (profileError) throw profileError;
    setRole(newRole);
  }

  async function signIn(email: string, password: string) {
    if (!isSupabaseConfigured) {
      throw new Error('Supabaseが設定されていないため、この操作は実行できません。');
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signOut() {
    if (!isSupabaseConfigured) return;
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, role, loading, signUp, signIn, signOut }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
