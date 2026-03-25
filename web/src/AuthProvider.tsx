import React, { createContext, useContext, useEffect, useState } from 'react';

export interface LocalAuthUser {
  email: string;
  displayName: string;
  photoURL?: string | null;
}

export interface ActorContext {
  userId: string;
  fullName: string;
  email: string;
  departmentId: string | null;
  permissions: string[];
}

interface LoginInput {
  email: string;
  password: string;
}

interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
  departmentId: string;
  roleCode: string;
}

interface StoredAccount {
  email: string;
  password: string;
  displayName: string;
}

interface AuthContextType {
  user: LocalAuthUser | null;
  actor: ActorContext | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8080';
const ACCOUNTS_STORAGE_KEY = 'ledger_local_accounts_v1';
const SESSION_STORAGE_KEY = 'ledger_local_session_v1';
const DEFAULT_TEST_ACCOUNTS: StoredAccount[] = [
  {
    email: 'requester1@example.com',
    password: '1234',
    displayName: 'Nguyen Van A',
  },
  {
    email: 'approver1@example.com',
    password: '1234',
    displayName: 'Approver One',
  },
  {
    email: 'financeops@example.com',
    password: '1234',
    displayName: 'Finance Operations',
  },
  {
    email: 'sysadmin@example.com',
    password: '1234',
    displayName: 'System Admin',
  },
];

function getAvailableAccounts() {
  const customAccounts = readStoredAccounts();
  const merged = new Map<string, StoredAccount>();

  for (const account of DEFAULT_TEST_ACCOUNTS) {
    merged.set(account.email, account);
  }

  for (const account of customAccounts) {
    merged.set(account.email, account);
  }

  return Array.from(merged.values());
}

function readStoredAccounts(): StoredAccount[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredAccounts(accounts: StoredAccount[]) {
  window.localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
}

function readStoredSession() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(SESSION_STORAGE_KEY);
}

function writeStoredSession(email: string) {
  window.localStorage.setItem(SESSION_STORAGE_KEY, email);
}

function clearStoredSession() {
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

async function fetchActorFromApi(email: string): Promise<ActorContext | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/me`, {
      headers: { 'x-user-email': email },
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    return payload.data as ActorContext;
  } catch {
    return null;
  }
}

async function registerActor(input: RegisterInput): Promise<ActorContext> {
  const response = await fetch(`${API_BASE_URL}/api/register`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message ?? 'Unable to register account.');
  }

  return payload.data as ActorContext;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<LocalAuthUser | null>(null);
  const [actor, setActor] = useState<ActorContext | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restore = async () => {
      const sessionEmail = readStoredSession();
      if (!sessionEmail) {
        setLoading(false);
        return;
      }

      const account = getAvailableAccounts().find((entry) => entry.email === sessionEmail);
      const resolvedActor = await fetchActorFromApi(sessionEmail);

      if (!account || !resolvedActor) {
        clearStoredSession();
        setUser(null);
        setActor(null);
        setLoading(false);
        return;
      }

      setUser({
        email: account.email,
        displayName: account.displayName,
        photoURL: null,
      });
      setActor(resolvedActor);
      setLoading(false);
    };

    void restore();
  }, []);

  const login = async (input: LoginInput) => {
    const email = input.email.trim().toLowerCase();
    const account = getAvailableAccounts().find((entry) => entry.email === email && entry.password === input.password);
    if (!account) {
      throw new Error('Email or password is incorrect.');
    }

    const resolvedActor = await fetchActorFromApi(email);
    if (!resolvedActor) {
      throw new Error('Account exists locally but is not provisioned in backend.');
    }

    writeStoredSession(email);
    setUser({
      email,
      displayName: account.displayName,
      photoURL: null,
    });
    setActor(resolvedActor);
  };

  const register = async (input: RegisterInput) => {
    const email = input.email.trim().toLowerCase();
    const accounts = readStoredAccounts();
    if (accounts.some((entry) => entry.email === email)) {
      throw new Error('Email is already registered on this browser.');
    }

    const actor = await registerActor({
      ...input,
      email,
    });

    const nextAccounts = [
      ...accounts,
      {
        email,
        password: input.password,
        displayName: input.fullName.trim(),
      },
    ];

    writeStoredAccounts(nextAccounts);
    writeStoredSession(email);
    setUser({
      email,
      displayName: input.fullName.trim(),
      photoURL: null,
    });
    setActor(actor);
  };

  const logout = async () => {
    clearStoredSession();
    setUser(null);
    setActor(null);
  };

  return (
    <AuthContext.Provider value={{ user, actor, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
