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
  passwordHash: string;
  displayName: string;
}

interface SeedAccount {
  email: string;
  password: string;
  displayName: string;
}

type StoredAccountRecord = StoredAccount & { password?: string };

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeAccount(account: StoredAccount): StoredAccount {
  return {
    ...account,
    email: normalizeEmail(account.email),
    passwordHash: account.passwordHash,
  };
}

interface AuthContextType {
  user: LocalAuthUser | null;
  actor: ActorContext | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  resetPassword: (input: { email: string; displayName: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8080';
const ACCOUNTS_STORAGE_KEY = 'ledger_local_accounts_v1';
const SESSION_STORAGE_KEY = 'ledger_local_session_v1';
const DEFAULT_TEST_ACCOUNTS: SeedAccount[] = [
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

async function hashPassword(password: string) {
  const data = new TextEncoder().encode(password);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

async function buildStoredAccount(input: SeedAccount) {
  return normalizeAccount({
    email: input.email,
    passwordHash: await hashPassword(input.password),
    displayName: input.displayName,
  });
}

async function mergeAccounts(accounts: StoredAccountRecord[]) {
  const merged = new Map<string, StoredAccount>();

  for (const account of DEFAULT_TEST_ACCOUNTS) {
    const normalized = await buildStoredAccount(account);
    merged.set(normalized.email, normalized);
  }

  for (const account of accounts) {
    const normalized = 'passwordHash' in account && account.passwordHash
      ? normalizeAccount(account as StoredAccount)
      : await buildStoredAccount({
          email: account.email,
          password: account.password ?? '1234',
          displayName: account.displayName,
        });
    merged.set(normalized.email, normalized);
  }

  return Array.from(merged.values());
}

async function seedAvailableAccounts() {
  const merged = await mergeAccounts(readStoredAccounts());
  writeStoredAccounts(merged);
  return merged;
}

async function getAvailableAccounts() {
  if (typeof window === 'undefined') {
    return [];
  }

  return seedAvailableAccounts();
}

function readStoredAccounts(): StoredAccountRecord[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredAccountRecord[]) : [];
  } catch {
    return [];
  }
}

function writeStoredAccounts(accounts: StoredAccount[]) {
  window.localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
}

async function upsertStoredAccount(input: SeedAccount) {
  const existingAccounts = await seedAvailableAccounts();
  const nextAccounts = [
    ...existingAccounts.filter((entry) => entry.email !== normalizeEmail(input.email)),
    await buildStoredAccount(input),
  ];

  writeStoredAccounts(nextAccounts);
}

function readStoredSession() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.sessionStorage.getItem(SESSION_STORAGE_KEY);
}

function writeStoredSession(email: string) {
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, email);
}

function clearStoredSession() {
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
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
      await seedAvailableAccounts();
      const sessionEmail = readStoredSession();
      if (!sessionEmail) {
        setLoading(false);
        return;
      }

      const account = (await getAvailableAccounts()).find((entry) => entry.email === sessionEmail);
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
    const email = normalizeEmail(input.email);
    const passwordHash = await hashPassword(input.password.trim());
    let account = (await getAvailableAccounts()).find(
      (entry) => entry.email === email && entry.passwordHash === passwordHash
    );

    const resolvedActor = await fetchActorFromApi(email);
    if (!account && resolvedActor && input.password.trim() === '1234') {
      await upsertStoredAccount({
        email,
        password: '1234',
        displayName: resolvedActor.fullName,
      });
      account = (await getAvailableAccounts()).find(
        (entry) => entry.email === email && entry.passwordHash === passwordHash
      ) ?? null;
    }

    if (!account) {
      throw new Error('Email or password is incorrect.');
    }

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
    const email = normalizeEmail(input.email);
    const accounts = await seedAvailableAccounts();
    if (accounts.some((entry) => entry.email === email)) {
      throw new Error('Email is already registered on this browser.');
    }

    const actor = await registerActor({
      ...input,
      email,
    });

    const nextAccounts = [
      ...accounts,
      await buildStoredAccount({
        email,
        password: '1234',
        displayName: input.fullName.trim(),
      }),
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

  const resetPassword = async (input: { email: string; displayName: string; password: string }) => {
    const email = normalizeEmail(input.email);
    const password = input.password.trim();
    if (password.length < 4) {
      throw new Error('Password must be at least 4 characters.');
    }

    const existingAccounts = (await seedAvailableAccounts()).filter((entry) => entry.email !== email);
    const nextAccounts = [
      ...existingAccounts,
      await buildStoredAccount({
        email,
        password,
        displayName: input.displayName.trim(),
      }),
    ];

    writeStoredAccounts(nextAccounts);
  };

  const logout = async () => {
    clearStoredSession();
    setUser(null);
    setActor(null);
  };

  return (
    <AuthContext.Provider value={{ user, actor, loading, login, register, resetPassword, logout }}>
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
