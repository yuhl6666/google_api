import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { api } from '../lib/api';
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const token = await u.getIdTokenResult(true);
        setRole((token.claims.role as Role | undefined) ?? null);
      } else {
        setRole(null);
      }
      setLoading(false);
    });
  }, []);

  async function signUp(email: string, password: string, newRole: Role) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await api.setUserRole(newRole);
    await cred.user.getIdToken(true);
    const token = await cred.user.getIdTokenResult(true);
    setRole((token.claims.role as Role | undefined) ?? null);
  }

  async function signIn(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function signOut() {
    await firebaseSignOut(auth);
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
