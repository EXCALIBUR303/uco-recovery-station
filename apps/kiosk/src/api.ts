/** Thin wrapper over the backend. The kiosk holds no decision logic itself. */

export type Outcome = 'accepted' | 'rejected' | 'ignored';
export type Reason =
  | 'not_oil'
  | 'water_contaminated'
  | 'low_quality'
  | 'below_threshold'
  | null;

export type StartResponse =
  | { blocked: true; machineStatus: string; serialNo: string }
  | {
      blocked: false;
      sessionId: string;
      machineStatus: string;
      serialNo: string;
      ratePerKgPaise: string;
      pairUrl: string;
      pairToken: string;
      expiresAt: string;
    };

export type SessionState = {
  sessionId: string;
  state: 'awaiting_pair' | 'paired' | 'processing' | 'complete' | 'expired';
  machineStatus: string;
  depositor: { id: string; phone: string } | null;
  result: {
    outcome: Outcome;
    reason: Reason;
    amountPaise: string | null;
    weightDeltaG: number;
  } | null;
};

export type DepositResult = {
  depositId: string;
  outcome: Outcome;
  reason: Reason;
  weightDeltaG: number;
  amountPaise: string | null;
  blacklisted: boolean;
  /** null unless accepted; 'processing' once the payout is initiated */
  payoutStatus: string | null;
  /** true when the mock Razorpay client is in use — no real money moved */
  payoutIsMock: boolean;
};

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.message ?? res.statusText), { body });
  return body as T;
}

export const startSession = (serialNo: string, language: string) =>
  req<StartResponse>(`/kiosk/machines/${serialNo}/sessions`, {
    method: 'POST',
    body: JSON.stringify({ language }),
  });

export const getSession = (id: string) => req<SessionState>(`/kiosk/sessions/${id}`);

export const submitDeposit = (
  id: string,
  readings: { capacitance: number; colorValue: number; weightDeltaG: number },
) =>
  req<DepositResult>(`/kiosk/sessions/${id}/deposit`, {
    method: 'POST',
    body: JSON.stringify(readings),
  });

/** Stands in for a phone scanning the QR, so the flow is testable on one device. */
export const simulatePair = (pairToken: string, phone: string, upiId: string) =>
  req<{ sessionId: string; deviceToken?: string; returning: boolean }>(
    `/pair/${pairToken}`,
    { method: 'POST', body: JSON.stringify({ phone, upiId }) },
  );
