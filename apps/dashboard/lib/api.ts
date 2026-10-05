'use client';

// The dashboard talks to the backend through Next's /api rewrite, so it stays
// same-origin and no CORS or absolute URLs are needed.
const BASE = '/api';
const TOKEN_KEY = 'uco.token';
const USER_KEY = 'uco.user';

export type Role = 'admin' | 'renter';
export type SessionUser = { id: string; role: Role; email: string; displayName?: string };

export const auth = {
  token: () => (typeof window === 'undefined' ? null : localStorage.getItem(TOKEN_KEY)),
  user: (): SessionUser | null => {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  },
  save: (token: string, user: SessionUser) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = auth.token();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401) {
    auth.clear();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new ApiError(401, 'Session expired');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.message ?? res.statusText);
  return body as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: SessionUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (input: { email: string; password: string; displayName: string; phone?: string }) =>
    request<{ token: string; user: SessionUser }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  machines: () => request<Machine[]>('/machines'),
  machine: (id: string) => request<MachineDetail>(`/machines/${id}`),
  depositors: () => request<Depositor[]>('/depositors'),
  depositor: (id: string) => request<DepositorDetail>(`/depositors/${id}`),
  notifications: () => request<Notification[]>('/notifications'),
  dismissAlerts: (ids: string[]) =>
    request<{ resolved: number }>('/notifications/resolve', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
  dismissAllAlerts: () =>
    request<{ resolved: number }>('/notifications/resolve', {
      method: 'POST',
      body: JSON.stringify({ all: true }),
    }),
  rentals: () => request<RentalAgreementRow[]>('/rentals'),
  payInvoice: (id: string) =>
    request<{ paid?: boolean; alreadyPaid?: boolean }>(`/rentals/invoices/${id}/pay`, {
      method: 'POST',
    }),
  activity: (take = 20) => request<ActivityEvent[]>(`/machines/feed/activity?take=${take}`),
  series: (id: string, days = 30) =>
    request<ActivitySeries>(`/machines/${id}/series?days=${days}`),
  renters: () => request<RenterRow[]>('/renters'),
  approveRenter: (id: string) =>
    request<{ approved?: boolean; alreadyApproved?: boolean }>(`/renters/${id}/approve`, {
      method: 'POST',
    }),
  setRenterBranding: (id: string, brandName: string | null, brandAccent: string | null) =>
    request<{ brandName: string | null; brandAccent: string | null }>(
      `/renters/${id}/branding`,
      { method: 'POST', body: JSON.stringify({ brandName, brandAccent }) },
    ),
  assignMachine: (id: string, renterId: string | null, monthlyFeePaise?: number) =>
    request<{ ownership: string }>(`/machines/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ renterId, monthlyFeePaise }),
    }),
  updateMachine: (
    id: string,
    patch: { ratePerKgPaise?: number; minWeightDeltaG?: number | null; label?: string },
  ) =>
    request<{ ratePerKgPaise: string }>(`/machines/${id}/update`, {
      method: 'POST',
      body: JSON.stringify(patch),
    }),
  rotateDeviceSecret: (id: string) =>
    request<{ serialNo: string; deviceSecret: string }>(`/machines/${id}/device-secret`, {
      method: 'POST',
    }),
  reinstateDepositor: (id: string, reason?: string) =>
    request<{ reinstated?: boolean }>(`/depositors/${id}/reinstate`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  settings: () => request<PlatformSettings>('/settings'),
  updateSettings: (patch: Partial<PlatformSettings>) =>
    request<PlatformSettings>('/settings', { method: 'POST', body: JSON.stringify(patch) }),
  wallet: () => request<Wallet>('/wallet'),
  topup: (amountPaise: number) =>
    request<{ topupId: string; orderId: string; isMock: boolean; keyId: string | null }>(
      '/wallet/topup',
      { method: 'POST', body: JSON.stringify({ amountPaise }) },
    ),
  pendingPayouts: () => request<PendingPayout[]>('/payouts/pending'),
  confirmPayout: (id: string) => request<{ ok: boolean }>(`/payouts/${id}/confirm`, { method: 'POST' }),
  failPayout: (id: string) => request<{ ok: boolean }>(`/payouts/${id}/fail`, { method: 'POST' }),
};

export type PendingPayout = {
  id: string;
  upiId: string;
  amountPaise: string;
  status: string;
  createdAt: string;
  machineSerial: string | null;
  machineLabel: string | null;
};

export type Wallet = {
  balancePaise: string;
  heldPaise: string;
  spendablePaise: string;
  ownerType: 'renter' | 'company';
  topups: { id: string; amountPaise: string; status: string; createdAt: string }[];
  payouts: {
    id: string;
    amountPaise: string;
    status: string;
    machineSerial: string | null;
    createdAt: string;
  }[];
};

export type ActivityEvent = {
  id: string;
  machineId: string;
  serialNo: string;
  outcome: 'accepted' | 'rejected' | 'ignored';
  rejectionReason: string | null;
  weightDeltaG: number;
  amountPaise: string | null;
  createdAt: string;
};

export type ActivitySeries = {
  days: number;
  points: { day: string; accepted: number; rejected: number; ignored: number; weightG: number }[];
};

export type RenterRow = {
  id: string;
  displayName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  approvedAt: string | null;
  pending: boolean;
  brandName: string | null;
  brandAccent: string | null;
  createdAt: string;
  balancePaise: string;
  heldPaise: string;
  machines: { id: string; serialNo: string }[];
  monthlyRentPaise: string;
};

export type PlatformSettings = {
  defaultMinWeightDeltaG: number;
  blacklistThreshold: number;
  blacklistMode: string;
  blacklistAutoResetDays: number | null;
  idleAlertDays: number;
  activityCountsRejections: boolean;
  offlineAfterSeconds: number;
  rentalGraceDays: number;
};

export type InvoiceStatus = 'due' | 'paid' | 'overdue' | 'waived';

export type RentalInvoice = {
  id: string;
  periodStart: string;
  periodEnd: string;
  amountPaise: string;
  status: InvoiceStatus;
  dueDate: string;
  paidAt: string | null;
};

export type RentalAgreementRow = {
  id: string;
  machine: { serialNo: string; label: string | null };
  renter: { id: string; displayName: string } | null;
  status: 'active' | 'suspended' | 'terminated';
  monthlyFeePaise: string;
  startDate: string;
  nextBillDate: string;
  outstandingPaise: string;
  invoices: RentalInvoice[];
};

export type NotificationType =
  | 'drum_full'
  | 'reject_full'
  | 'balance_zero'
  | 'idle_7day'
  | 'offline'
  | 'blacklist'
  | 'excessive_ignores'
  | 'rental_overdue'
  | 'payout_failed';

export type Notification = {
  id: string;
  type: NotificationType;
  machine: { serialNo: string; label: string | null } | null;
  depositor: { id: string; phone: string } | null;
  createdAt: string;
};

// ---- shared shapes (money is a string of paise; weight is grams) ----------

export type MachineStatus =
  | 'in_service'
  | 'drum_full'
  | 'reject_full'
  | 'balance_zero'
  | 'offline';

export type Machine = {
  id: string;
  serialNo: string;
  label: string | null;
  locationText: string | null;
  ownership: 'company' | 'rented';
  renter: { id: string; displayName: string } | null;
  effectiveStatus: MachineStatus;
  isIdle: boolean;
  drumFillPct: number | null;
  rejectFillPct: number | null;
  drumCapacityKg: number;
  bucketCapacityL: number;
  drumLevelKg: number;
  bucketLevelL: number;
  totalWeightG: string;
  totalPaidOutPaise: string;
  ratePerKgPaise: string;
  walletBalancePaise: string | null;
  lastTelemetryAt: string | null;
  lastActivityAt: string | null;
};

export type SensorSnapshot = {
  capacitance?: number;
  colorValue?: number;
  weightDeltaG?: number;
  calibration?: Record<string, number>;
};

export type DepositRow = {
  id: string;
  outcome: 'accepted' | 'rejected' | 'ignored';
  rejectionReason: string | null;
  weightDeltaG: number;
  amountPaise: string | null;
  createdAt: string;
  sensorReadings?: SensorSnapshot | null;
  machine?: { serialNo: string };
};

export type MachineDetail = Machine & {
  counts: { accepted: number; rejected: number; ignored: number };
  recent: DepositRow[];
};

export type Depositor = {
  id: string;
  phone: string;
  upiId: string;
  status: 'active' | 'blacklisted';
  offenceCount: number;
  ignoredCount: number;
  blacklistedAt: string | null;
  blacklistReason: string | null;
  createdAt: string;
};

export type DepositorDetail = Depositor & {
  recent: (DepositRow & { isOffence: boolean })[];
  statusEvents: {
    id: string;
    fromStatus: string | null;
    toStatus: string;
    reason: string | null;
    triggeredBy: string;
    createdAt: string;
  }[];
};

// ---- formatting ------------------------------------------------------------

export const rupees = (paise: string | number | null): string => {
  if (paise == null) return '—';
  const n = Number(paise) / 100;
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

export const kg = (grams: string | number | null): string => {
  if (grams == null) return '—';
  return `${(Number(grams) / 1000).toLocaleString('en-IN', { maximumFractionDigits: 1 })} KG`;
};

export const date = (iso: string | null): string => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const ago = (iso: string | null): string => {
  if (!iso) return 'never';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  // A future timestamp (clock skew, or a synthetic billing "now") shouldn't
  // render as a negative age.
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
