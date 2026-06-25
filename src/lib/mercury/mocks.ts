import {
  avgMonthlyBurn,
  deriveCashSeries,
  topCounterpartiesByOutflow,
} from "@/lib/mercury/derive";
import type {
  FinanceData,
  MercuryAccount,
  MercuryTransaction,
  MercuryTransactionKind,
} from "@/lib/mercury/types";

/**
 * Mock data shaped exactly like Mercury's real responses, so a swap to live
 * data is a data-source change, not a UI change.
 *
 * Types and derive helpers live in src/lib/mercury — this file only
 * generates the fixture.
 */

const today = new Date();
today.setHours(0, 0, 0, 0);

function isoDay(d: Date): string {
  return d.toISOString();
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const rand = seededRandom(42);

export const MERCURY_ACCOUNTS: MercuryAccount[] = [
  {
    id: "acct-checking-001",
    accountNumber: "1234567890",
    routingNumber: "084106768",
    name: "Mercury Checking",
    nickname: "Operating",
    status: "active",
    type: "mercury",
    kind: "checking",
    legalBusinessName: "Numena, Inc.",
    dashboardLink: "https://app.mercury.com/accounts/acct-checking-001",
    createdAt: "2024-01-15T00:00:00Z",
    availableBalance: 812_540,
    currentBalance: 821_320,
    canReceiveTransactions: true,
  },
  {
    id: "acct-savings-001",
    accountNumber: "1234567891",
    routingNumber: "084106768",
    name: "Mercury Savings",
    nickname: "Reserve",
    status: "active",
    type: "mercury",
    kind: "savings",
    legalBusinessName: "Numena, Inc.",
    dashboardLink: "https://app.mercury.com/accounts/acct-savings-001",
    createdAt: "2024-01-15T00:00:00Z",
    availableBalance: 480_000,
    currentBalance: 480_000,
    canReceiveTransactions: true,
  },
  {
    id: "acct-treasury-001",
    accountNumber: "1234567892",
    routingNumber: "084106768",
    name: "Mercury Treasury",
    nickname: null,
    status: "active",
    type: "mercury",
    kind: "treasury",
    legalBusinessName: "Numena, Inc.",
    dashboardLink: "https://app.mercury.com/accounts/acct-treasury-001",
    createdAt: "2024-03-01T00:00:00Z",
    availableBalance: 554_780,
    currentBalance: 554_780,
    canReceiveTransactions: false,
  },
];

const OPERATING_ID = "acct-checking-001";

interface VendorSpec {
  name: string;
  category: string;
  kind: MercuryTransactionKind;
}

const SAAS_VENDORS: VendorSpec[] = [
  { name: "AWS", category: "Software & Internet", kind: "debitCardTransaction" },
  { name: "Vercel", category: "Software & Internet", kind: "debitCardTransaction" },
  { name: "Anthropic", category: "Software & Internet", kind: "debitCardTransaction" },
  { name: "OpenAI", category: "Software & Internet", kind: "debitCardTransaction" },
  { name: "Linear", category: "Software & Internet", kind: "debitCardTransaction" },
  { name: "GitHub", category: "Software & Internet", kind: "debitCardTransaction" },
  { name: "Notion", category: "Software & Internet", kind: "debitCardTransaction" },
  { name: "Slack", category: "Software & Internet", kind: "debitCardTransaction" },
  { name: "Figma", category: "Software & Internet", kind: "debitCardTransaction" },
  { name: "Granola", category: "Software & Internet", kind: "debitCardTransaction" },
  { name: "Voyage AI", category: "Software & Internet", kind: "debitCardTransaction" },
  { name: "Supabase", category: "Software & Internet", kind: "debitCardTransaction" },
];

let txnCounter = 0;
function makeTxn(
  partial: Partial<MercuryTransaction> &
    Pick<MercuryTransaction, "amount" | "counterpartyName" | "kind" | "createdAt">
): MercuryTransaction {
  const id = `txn-${++txnCounter}`;
  const created = partial.createdAt;
  return {
    id,
    accountId: partial.accountId ?? OPERATING_ID,
    amount: partial.amount,
    status: partial.status ?? "sent",
    kind: partial.kind,
    counterpartyId: partial.counterpartyId ?? `cp-${partial.counterpartyName}`,
    counterpartyName: partial.counterpartyName,
    counterpartyNickname: partial.counterpartyNickname ?? null,
    createdAt: created,
    postedAt: partial.postedAt === undefined ? created : partial.postedAt,
    estimatedDeliveryDate: partial.estimatedDeliveryDate ?? created,
    failedAt: partial.failedAt ?? null,
    reasonForFailure: partial.reasonForFailure ?? null,
    bankDescription:
      partial.bankDescription ??
      `${partial.counterpartyName.toUpperCase()} PURCHASE ${created.slice(0, 10).replace(/-/g, "")}`,
    externalMemo: partial.externalMemo ?? null,
    note: partial.note ?? null,
    mercuryCategory: partial.mercuryCategory ?? null,
    categoryName: partial.categoryName ?? null,
    checkNumber: partial.checkNumber ?? null,
    trackingNumber: partial.trackingNumber ?? null,
    dashboardLink: `https://app.mercury.com/transactions/${id}`,
    hasGeneratedReceipt: partial.hasGeneratedReceipt ?? false,
    attachments: partial.attachments ?? [],
  };
}

function generateTransactions(days = 180): MercuryTransaction[] {
  const txns: MercuryTransaction[] = [];

  for (let offset = 0; offset < days; offset++) {
    const d = new Date(today);
    d.setDate(today.getDate() - offset);
    const iso = isoDay(d);

    if (d.getDate() === 1 || d.getDate() === 15) {
      txns.push(
        makeTxn({
          amount: -(48_000 + Math.round(rand() * 4_000)),
          counterpartyName: "Gusto",
          counterpartyNickname: "Gusto Payroll",
          kind: "externalTransfer",
          createdAt: iso,
          mercuryCategory: "Payroll",
          externalMemo: "Bi-monthly payroll run",
          bankDescription: "GUSTO PAYROLL ACH DEBIT",
        })
      );
    }

    if (d.getDate() === 3) {
      txns.push(
        makeTxn({
          amount: -(8_200 + Math.round(rand() * 2_400)),
          counterpartyName: "AWS",
          kind: "debitCardTransaction",
          createdAt: iso,
          mercuryCategory: "Software & Internet",
          bankDescription: "AMAZON WEB SERVICES",
          hasGeneratedReceipt: true,
        })
      );
      txns.push(
        makeTxn({
          amount: -(3_100 + Math.round(rand() * 900)),
          counterpartyName: "Anthropic",
          kind: "debitCardTransaction",
          createdAt: iso,
          mercuryCategory: "Software & Internet",
          bankDescription: "ANTHROPIC PBC",
        })
      );
    }

    if (rand() < 0.45) {
      const v = SAAS_VENDORS[Math.floor(rand() * SAAS_VENDORS.length)];
      if (v) {
        txns.push(
          makeTxn({
            amount: -Math.round((40 + rand() * 1_200) * 100) / 100,
            counterpartyName: v.name,
            kind: v.kind,
            createdAt: iso,
            mercuryCategory: v.category,
            bankDescription: `${v.name.toUpperCase()} SUBSCRIPTION`,
          })
        );
      }
    }

    if (offset === 92) {
      txns.push(
        makeTxn({
          amount: 500_000,
          counterpartyName: "Sequoia Capital",
          counterpartyNickname: "Sequoia",
          kind: "incomingDomesticWire",
          createdAt: iso,
          mercuryCategory: "Investor capital",
          externalMemo: "Seed extension - wire received",
          bankDescription: "FEDWIRE CREDIT SEQUOIA CAP",
        })
      );
    }

    if (offset % 7 === 3) {
      txns.push(
        makeTxn({
          amount: Math.round((2_400 + rand() * 1_800) * 100) / 100,
          counterpartyName: "Stripe",
          kind: "externalTransfer",
          createdAt: iso,
          mercuryCategory: "Sales revenue",
          bankDescription: "STRIPE TRANSFER",
        })
      );
    }

    if (rand() < 0.04) {
      txns.push(
        makeTxn({
          amount: Math.round((80 + rand() * 600) * 100) / 100,
          counterpartyName: "AWS",
          kind: "debitCardCredit",
          createdAt: iso,
          mercuryCategory: "Software & Internet",
          bankDescription: "AMAZON WEB SERVICES CREDIT",
        })
      );
    }
  }

  for (let i = 0; i < 2; i++) {
    txns.unshift(
      makeTxn({
        amount: -(120 + Math.round(rand() * 480)),
        counterpartyName: SAAS_VENDORS[i]?.name ?? "Vercel",
        kind: "debitCardTransaction",
        createdAt: isoDay(today),
        postedAt: null,
        status: "pending",
        mercuryCategory: "Software & Internet",
      })
    );
  }

  return txns.sort((a, b) => {
    const aTime = new Date(a.postedAt ?? a.createdAt).getTime();
    const bTime = new Date(b.postedAt ?? b.createdAt).getTime();
    return bTime - aTime;
  });
}

const TRANSACTIONS = generateTransactions(180);

const TOTAL_AVAILABLE = MERCURY_ACCOUNTS.reduce(
  (sum, a) => sum + a.availableBalance,
  0
);
const TOTAL_CURRENT = MERCURY_ACCOUNTS.reduce(
  (sum, a) => sum + a.currentBalance,
  0
);

export const MOCK_FINANCE_DATA: FinanceData = {
  accounts: MERCURY_ACCOUNTS,
  totalAvailable: TOTAL_AVAILABLE,
  totalCurrent: TOTAL_CURRENT,
  transactions: TRANSACTIONS,
  moneyIn: TRANSACTIONS.filter((t) => t.amount > 0),
  moneyOut: TRANSACTIONS.filter((t) => t.amount < 0),
  cashSeries: deriveCashSeries(TRANSACTIONS, TOTAL_AVAILABLE, 180),
  burnPerMonth: avgMonthlyBurn(TRANSACTIONS, 3),
  topCounterparties: topCounterpartiesByOutflow(TRANSACTIONS, 90, 8),
  isLive: false,
};

// Re-export types for the existing component imports
export type {
  MercuryAccount,
  MercuryTransaction,
  CashSnapshot,
} from "@/lib/mercury/types";
