import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma, LedgerReason } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Raised when a wallet cannot cover a reservation. */
export class InsufficientFundsError extends BadRequestException {
  constructor() {
    super('Insufficient wallet balance');
  }
}

type Tx = Prisma.TransactionClient;

/**
 * The money core. Every rupee that moves through a wallet goes through here,
 * always inside a caller-supplied transaction and always after locking the
 * wallet row, so concurrent payouts can't overspend.
 *
 * Balance model (DESIGN.md §1.4, §3.6):
 *   spendable = balance - held
 *   reserve  : held += amount           (funds earmarked for an in-flight payout)
 *   capture  : held -= amount; balance -= amount   (payout settled — money left)
 *   release  : held -= amount           (payout failed — earmark returned)
 *   credit   : balance += amount        (top-up)
 *
 * The DB CHECK constraints (held >= 0, held <= balance, balance >= 0) are the
 * backstop: even a logic bug cannot persist an impossible wallet.
 *
 * Postings are recorded for money that actually moves (capture, credit), not
 * for holds — a hold is a reservation, not a ledger event. The counter-leg of a
 * payout is an external UPI and of a top-up an external card, so each such
 * journal has a single wallet posting; balance_after gives the running balance.
 */
@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  private async lock(tx: Tx, walletId: string) {
    // Row lock; the returned aggregate is authoritative for this transaction.
    const rows = await tx.$queryRaw<
      { balance_paise: bigint; held_paise: bigint }[]
    >`SELECT balance_paise, held_paise FROM wallets WHERE id = ${walletId}::uuid FOR UPDATE`;
    if (rows.length === 0) throw new BadRequestException('Unknown wallet');
    return { balance: rows[0].balance_paise, held: rows[0].held_paise };
  }

  spendable(balance: bigint, held: bigint): bigint {
    return balance - held;
  }

  /** Earmark funds for an in-flight payout. Throws if unspendable. */
  async reserve(tx: Tx, walletId: string, amount: bigint): Promise<void> {
    const { balance, held } = await this.lock(tx, walletId);
    if (this.spendable(balance, held) < amount) throw new InsufficientFundsError();
    await tx.wallet.update({
      where: { id: walletId },
      data: { heldPaise: { increment: amount } },
    });
  }

  /** Return a reservation to spendable (payout failed / reversed). */
  async release(tx: Tx, walletId: string, amount: bigint): Promise<void> {
    await this.lock(tx, walletId);
    await tx.wallet.update({
      where: { id: walletId },
      data: { heldPaise: { decrement: amount } },
    });
  }

  /** Turn a reservation into a real debit (payout settled). Writes a posting. */
  async capture(
    tx: Tx,
    walletId: string,
    amount: bigint,
    ref: { reason: LedgerReason; refType: string; refId: string },
  ): Promise<void> {
    const { balance } = await this.lock(tx, walletId);
    await tx.wallet.update({
      where: { id: walletId },
      data: { heldPaise: { decrement: amount }, balancePaise: { decrement: amount } },
    });
    await this.post(tx, walletId, -amount, balance - amount, ref);
  }

  /** Add funds to a wallet (top-up). Writes a posting. */
  async credit(
    tx: Tx,
    walletId: string,
    amount: bigint,
    ref: { reason: LedgerReason; refType: string; refId: string },
  ): Promise<void> {
    const { balance } = await this.lock(tx, walletId);
    await tx.wallet.update({
      where: { id: walletId },
      data: { balancePaise: { increment: amount } },
    });
    await this.post(tx, walletId, amount, balance + amount, ref);
  }

  private async post(
    tx: Tx,
    walletId: string,
    delta: bigint,
    balanceAfter: bigint,
    ref: { reason: LedgerReason; refType: string; refId: string },
  ): Promise<void> {
    const journal = await tx.ledgerJournal.create({
      data: { reason: ref.reason, refType: ref.refType, refId: ref.refId },
    });
    await tx.ledgerPosting.create({
      data: {
        journalId: journal.id,
        walletId,
        amountPaise: delta,
        balanceAfter,
      },
    });
  }
}
