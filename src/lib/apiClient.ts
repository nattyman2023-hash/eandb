// Small browser API client backed by the Express + MySQL API.
// It keeps existing screen data access stable while every request is sent to
// the same-origin /api routes.

const API_ROOT = '';
const SESSION_KEY = 'eandb.auth.session';

export type User = {
  id: string;
  email: string;
  user_metadata: { full_name?: string; [key: string]: unknown };
};

export type Session = {
  access_token: string;
  refresh_token: string;
  user: User;
};

type StoredSession = {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; roles: string[] };
};

type AuthListener = (event: string, session: any) => void;
const listeners = new Set<AuthListener>();

function toSession(s: StoredSession | null): Session | null {
  if (!s) return null;
  return {
    access_token: s.accessToken,
    refresh_token: s.refreshToken,
    user: { id: s.user.id, email: s.user.email, user_metadata: {} },
  };
}

function getStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setStoredSession(session: StoredSession | null) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}

function emit(event: string, session: StoredSession | null) {
  const sessionValue = toSession(session);
  listeners.forEach((cb) => cb(event, sessionValue));
}

async function tryRefresh(): Promise<boolean> {
  const current = getStoredSession();
  if (!current?.refreshToken) return false;
  try {
    const res = await fetch(`${API_ROOT}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    });
    const body = await res.json();
    if (!res.ok || !body.data) {
      setStoredSession(null);
      emit('SIGNED_OUT', null);
      return false;
    }
    const session: StoredSession = {
      accessToken: body.data.accessToken,
      refreshToken: body.data.refreshToken,
      user: body.data.user,
    };
    setStoredSession(session);
    emit('TOKEN_REFRESHED', session);
    return true;
  } catch {
    return false;
  }
}

async function apiFetch(path: string, options: RequestInit = {}, allowRetry = true): Promise<Response> {
  const session = getStoredSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as any) };
  if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;

  const res = await fetch(`${API_ROOT}${path}`, { ...options, headers });
  if (res.status === 401 && allowRetry && session?.refreshToken) {
    const refreshed = await tryRefresh();
    if (refreshed) return apiFetch(path, options, false);
  }
  return res;
}

export async function apiRequest<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, options);
  const body = await response.json().catch(() => ({ data: null, error: 'Invalid server response' }));
  if (!response.ok) {
    throw new Error(body?.error?.message || body?.error || `Request failed (${response.status})`);
  }
  return body as T;
}

function toError(message: string) {
  return { message };
}

// ---------------------------------------------------------------------------
// Temporary query compatibility for existing screens. It still talks only to
// the Express /api/query route and can be replaced screen-by-screen later.
// ---------------------------------------------------------------------------

type Filter = { col: string; op: string; val: any };

class QueryBuilder implements PromiseLike<any> {
  private table: string;
  private action: 'select' | 'insert' | 'update' | 'upsert' | 'delete' | null = null;
  private selectCols = '*';
  private selectOpts: any = null;
  private payload: any = null;
  private filters: Filter[] = [];
  private orderSpec: { col: string; asc: boolean }[] = [];
  private limitVal: number | null = null;
  private rangeVal: [number, number] | null = null;
  private singleMode: 'single' | 'maybeSingle' | null = null;
  private _promise: Promise<any> | null = null;

  constructor(table: string) {
    this.table = table;
  }

  select(columns: string = '*', opts?: { count?: 'exact'; head?: boolean }) {
    if (!this.action) this.action = 'select';
    this.selectCols = columns;
    if (opts) this.selectOpts = opts;
    return this;
  }
  insert(values: any) {
    this.action = 'insert';
    this.payload = values;
    return this;
  }
  update(values: any) {
    this.action = 'update';
    this.payload = values;
    return this;
  }
  upsert(values: any, opts?: any) {
    this.action = 'upsert';
    this.payload = values;
    this.selectOpts = { ...(this.selectOpts || {}), upsertOpts: opts };
    return this;
  }
  delete() {
    this.action = 'delete';
    return this;
  }

  eq(col: string, val: any) { this.filters.push({ col, op: 'eq', val }); return this; }
  neq(col: string, val: any) { this.filters.push({ col, op: 'neq', val }); return this; }
  gt(col: string, val: any) { this.filters.push({ col, op: 'gt', val }); return this; }
  gte(col: string, val: any) { this.filters.push({ col, op: 'gte', val }); return this; }
  lt(col: string, val: any) { this.filters.push({ col, op: 'lt', val }); return this; }
  lte(col: string, val: any) { this.filters.push({ col, op: 'lte', val }); return this; }
  like(col: string, val: any) { this.filters.push({ col, op: 'like', val }); return this; }
  ilike(col: string, val: any) { this.filters.push({ col, op: 'ilike', val }); return this; }
  is(col: string, val: any) { this.filters.push({ col, op: 'is', val }); return this; }
  in(col: string, vals: any[]) { this.filters.push({ col, op: 'in', val: vals }); return this; }
  contains(col: string, val: any) { this.filters.push({ col, op: 'contains', val }); return this; }
  not(col: string, op: string, val: any) { this.filters.push({ col, op: `not.${op}`, val }); return this; }
  or(expr: string) { this.filters.push({ col: '', op: 'or', val: expr }); return this; }
  match(obj: Record<string, any>) {
    Object.entries(obj).forEach(([col, val]) => this.eq(col, val));
    return this;
  }

  order(col: string, opts: { ascending?: boolean } = {}) {
    this.orderSpec.push({ col, asc: opts.ascending !== false });
    return this;
  }
  limit(n: number) { this.limitVal = n; return this; }
  range(from: number, to: number) { this.rangeVal = [from, to]; return this; }
  single() { this.singleMode = 'single'; return this; }
  maybeSingle() { this.singleMode = 'maybeSingle'; return this; }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    if (!this._promise) this._promise = this.execute();
    return this._promise.then(onfulfilled, onrejected);
  }

  private async execute() {
    try {
      const res = await apiFetch('/api/query', {
        method: 'POST',
        body: JSON.stringify({
          table: this.table,
          action: this.action || 'select',
          select: this.selectCols,
          selectOpts: this.selectOpts,
          payload: this.payload,
          filters: this.filters,
          order: this.orderSpec,
          limit: this.limitVal,
          range: this.rangeVal,
          single: this.singleMode,
        }),
      });
      const body = await res.json().catch(() => ({ data: null, error: 'Invalid server response' }));
      if (!res.ok) return { data: null, error: toError(body.error || `Request failed (${res.status})`), count: null };
      return body;
    } catch (err: any) {
      return { data: null, error: toError(err.message || 'Network error'), count: null };
    }
  }
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

const auth = {
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    try {
      const res = await fetch(`${API_ROOT}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json();
      if (!res.ok) return { data: { user: null, session: null }, error: toError(body.error || 'Login failed') };
      const session: StoredSession = { accessToken: body.data.accessToken, refreshToken: body.data.refreshToken, user: body.data.user };
      setStoredSession(session);
      emit('SIGNED_IN', session);
      return { data: { user: toSession(session)!.user, session: toSession(session) }, error: null };
    } catch (err: any) {
      return { data: { user: null, session: null }, error: toError(err.message) };
    }
  },

  async signUp({ email, password, options }: { email: string; password: string; options?: { data?: { full_name?: string }; emailRedirectTo?: string } }) {
    try {
      const res = await fetch(`${API_ROOT}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: options?.data?.full_name }),
      });
      const body = await res.json();
      if (!res.ok) return { data: { user: null, session: null }, error: toError(body.error || 'Sign up failed') };
      // Intentionally not auto-storing a session here: the UI sends the user to
      // the login tab, matching the existing application flow.
      return { data: { user: { id: body.data.user.id, email: body.data.user.email }, session: null }, error: null };
    } catch (err: any) {
      return { data: { user: null, session: null }, error: toError(err.message) };
    }
  },

  async signOut() {
    const current = getStoredSession();
    setStoredSession(null);
    emit('SIGNED_OUT', null);
    if (current?.refreshToken) {
      try {
        await fetch(`${API_ROOT}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: current.refreshToken }),
        });
      } catch {
        // best-effort - session is already cleared client-side
      }
    }
    return { error: null };
  },

  async getSession() {
    return { data: { session: toSession(getStoredSession()) } };
  },

  onAuthStateChange(callback: AuthListener) {
    listeners.add(callback);
    setTimeout(() => callback('INITIAL_SESSION', toSession(getStoredSession())), 0);
    return { data: { subscription: { unsubscribe: () => { listeners.delete(callback); } } } };
  },

  async updateUser({ password }: { password: string }) {
    try {
      const res = await apiFetch('/api/auth/update-password', { method: 'POST', body: JSON.stringify({ password }) });
      const body = await res.json();
      if (!res.ok) return { data: { user: null }, error: toError(body.error || 'Could not update password') };
      return { data: { user: toSession(getStoredSession())?.user }, error: null };
    } catch (err: any) {
      return { data: { user: null }, error: toError(err.message) };
    }
  },

  async resetPasswordForEmail(email: string, _options?: { redirectTo?: string }) {
    try {
      const res = await fetch(`${API_ROOT}/api/auth/reset-password-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const body = await res.json();
      if (!res.ok) return { error: toError(body.error || 'Could not send reset email') };
      return { error: null };
    } catch (err: any) {
      return { error: toError(err.message) };
    }
  },

  async getUser() {
    return { data: { user: toSession(getStoredSession())?.user || null }, error: null };
  },

  // Dedicated call for the one-time emailed reset token.
  async confirmPasswordReset(token: string, password: string) {
    try {
      const res = await fetch(`${API_ROOT}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const body = await res.json();
      if (!res.ok) return { error: toError(body.error || 'Could not reset password') };
      return { error: null };
    } catch (err: any) {
      return { error: toError(err.message) };
    }
  },
};

// ---------------------------------------------------------------------------
// Realtime -> polling shim
// ---------------------------------------------------------------------------
// Existing live-refresh call sites use a lightweight polling channel. This
// preserves the current UI behavior without adding a new push dependency.

const POLL_INTERVAL_MS = 20000;

class PollingChannel {
  private callbacks: Array<() => void> = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;

  on(_event: string, _filter: unknown, callback: () => void) {
    this.callbacks.push(callback);
    return this;
  }

  subscribe(statusCallback?: (status: string) => void) {
    this.intervalId = setInterval(() => this.callbacks.forEach((cb) => cb()), POLL_INTERVAL_MS);
    if (statusCallback) setTimeout(() => statusCallback('SUBSCRIBED'), 0);
    return this;
  }

  unsubscribe() {
    if (this.intervalId) clearInterval(this.intervalId);
  }
}

function channel(name: string) {
  return new PollingChannel();
}

function removeChannel(ch: PollingChannel) {
  ch?.unsubscribe();
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

function storageFrom(bucket: string) {
  return {
    async upload(path: string, file: File | Blob, _options?: { upsert?: boolean }) {
      try {
        const form = new FormData();
        form.append('file', file);
        form.append('path', path);
        const session = getStoredSession();
        const headers: Record<string, string> = {};
        if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
        const res = await fetch(`${API_ROOT}/api/storage/${bucket}/upload`, { method: 'POST', headers, body: form });
        const body = await res.json();
        if (!res.ok) return { data: null, error: toError(body.error || 'Upload failed') };
        return { data: { path: body.data.path }, error: null };
      } catch (err: any) {
        return { data: null, error: toError(err.message) };
      }
    },
    getPublicUrl(path: string) {
      return { data: { publicUrl: `${API_ROOT}/api/storage/${bucket}/public/${path}` } };
    },
    async createSignedUrl(path: string, expiresIn: number) {
      try {
        const res = await apiFetch(`/api/storage/${bucket}/sign`, { method: 'POST', body: JSON.stringify({ path, expiresIn }) });
        const body = await res.json();
        if (!res.ok) return { data: null, error: toError(body.error || 'Could not sign URL') };
        return { data: { signedUrl: body.data.signedUrl }, error: null };
      } catch (err: any) {
        return { data: null, error: toError(err.message) };
      }
    },
    async list(path: string = '', _options?: { limit?: number }) {
      try {
        const res = await apiFetch(`/api/storage/${bucket}/list?path=${encodeURIComponent(path)}`);
        const body = await res.json();
        if (!res.ok) return { data: null, error: toError(body.error || 'Could not list files') };
        return { data: body.data, error: null };
      } catch (err: any) {
        return { data: null, error: toError(err.message) };
      }
    },
    async remove(paths: string[]) {
      try {
        const res = await apiFetch(`/api/storage/${bucket}/remove`, { method: 'POST', body: JSON.stringify({ paths }) });
        const body = await res.json();
        if (!res.ok) return { data: null, error: toError(body.error || 'Could not remove files') };
        return { data: body.data, error: null };
      } catch (err: any) {
        return { data: null, error: toError(err.message) };
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Server action routes
// ---------------------------------------------------------------------------

const functions = {
  async invoke(name: string, opts: { body?: any } = {}) {
    try {
      const res = await apiFetch(`/api/functions/${name}`, { method: 'POST', body: JSON.stringify(opts.body || {}) });
      const body = await res.json().catch(() => ({ data: null, error: 'Invalid server response' }));
      if (!res.ok) return { data: null, error: toError(body.error || `Request failed (${res.status})`) };
      return { data: body.data, error: null };
    } catch (err: any) {
      return { data: null, error: toError(err.message) };
    }
  },
};

const storage = { from: storageFrom };

export const apiClient = {
  from(table: string) {
    return new QueryBuilder(table);
  },
  auth,
  storage,
  functions,
  channel,
  removeChannel,
};

export const api = apiClient;
