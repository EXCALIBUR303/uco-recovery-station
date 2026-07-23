'use client';

import { useEffect, useState } from 'react';
import { api, auth, rupees, date, type RentalAgreementRow, type InvoiceStatus } from '../../../lib/api';
import { Badge, Stat } from '../../ui';
import type { Tone } from '../../../lib/status';

const INVOICE_TONE: Record<InvoiceStatus, Tone> = {
  paid: 'ok',
  due: 'muted',
  overdue: 'bad',
  waived: 'muted',
};

export default function RentalsPage() {
  const isAdmin = auth.user()?.role === 'admin';
  const [rows, setRows] = useState<RentalAgreementRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState<string | null>(null);

  const load = () => api.rentals().then(setRows).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  async function pay(invoiceId: string) {
    setPaying(invoiceId);
    try {
      await api.payInvoice(invoiceId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment failed');
    } finally {
      setPaying(null);
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!rows) return <p className="loading">Loading…</p>;

  const totalOutstanding = rows.reduce((s, a) => s + Number(a.outstandingPaise), 0);
  const suspended = rows.filter((a) => a.status === 'suspended').length;
  const monthly = rows
    .filter((a) => a.status !== 'terminated')
    .reduce((s, a) => s + Number(a.monthlyFeePaise), 0);

  return (
    <>
      <div className="page-head">
        <h1>{isAdmin ? 'Rentals' : 'Billing'}</h1>
        <p>
          {rows.length} agreement{rows.length === 1 ? '' : 's'} · flat monthly fee,
          separate from the payout wallet
        </p>
      </div>

      <div className="grid stat-row">
        <Stat k="Monthly recurring" v={rupees(monthly)} small />
        <Stat k="Outstanding" v={rupees(totalOutstanding)} small />
        <Stat k="Suspended" v={suspended} />
      </div>

      {!isAdmin && (
        <div className="warn-note">
          Online payment is coming soon. For now, contact the operator to settle an
          invoice — they will mark it paid here.
        </div>
      )}

      {rows.length === 0 && <p className="faint">No rental agreements.</p>}

      {rows.map((a) => (
        <div key={a.id} className="section">
          <h2>
            {a.machine.serialNo}
            {isAdmin && a.renter ? ` · ${a.renter.displayName}` : ''}{' '}
            {a.status === 'active' ? (
              <Badge tone="ok">Active</Badge>
            ) : a.status === 'suspended' ? (
              <Badge tone="bad">Suspended — arrears</Badge>
            ) : (
              <Badge tone="muted">Terminated</Badge>
            )}
          </h2>
          <p className="faint" style={{ marginTop: -6, marginBottom: 12 }}>
            {rupees(a.monthlyFeePaise)}/month · next bill {date(a.nextBillDate)} ·
            outstanding {rupees(a.outstandingPaise)}
          </p>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Period</th>
                  <th className="num">Amount</th>
                  <th>Due</th>
                  <th>Status</th>
                  {isAdmin && <th />}
                </tr>
              </thead>
              <tbody>
                {a.invoices.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 5 : 4} className="faint">
                      No invoices yet.
                    </td>
                  </tr>
                ) : (
                  a.invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>{date(inv.periodStart)}</td>
                      <td className="num dim">{rupees(inv.amountPaise)}</td>
                      <td className="faint">{date(inv.dueDate)}</td>
                      <td>
                        <Badge tone={INVOICE_TONE[inv.status]}>{inv.status}</Badge>
                      </td>
                      {isAdmin && (
                        <td>
                          {(inv.status === 'due' || inv.status === 'overdue') && (
                            <button
                              className="mini-btn"
                              disabled={paying === inv.id}
                              onClick={() => pay(inv.id)}
                            >
                              {paying === inv.id ? '…' : 'Mark paid'}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
}
