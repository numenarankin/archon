/**
 * TypeScript shapes mirror Mercury's API responses verbatim.
 * Source: cockpit/docs/mercury/reference/{getaccounts,listtransactions}.md
 *
 * If Mercury changes their schema, update here and propagate.
 */

// ----- Accounts -----

export type MercuryAccountStatus =
  | "active"
  | "deleted"
  | "pending"
  | "archived";
export type MercuryAccountType = "mercury" | "external" | "recipient";

/** Per Mercury, `kind` is a free-form string. These are values observed in practice. */
export type MercuryAccountKind =
  | "checking"
  | "savings"
  | "treasury"
  | "credit"
  | "investment"
  | (string & {}); // allow any string while preserving autocomplete on knowns

export interface MercuryAccount {
  id: string;
  accountNumber: string;
  routingNumber: string;
  name: string;
  nickname: string | null;
  status: MercuryAccountStatus;
  type: MercuryAccountType;
  kind: MercuryAccountKind;
  legalBusinessName: string;
  dashboardLink: string;
  createdAt: string; // ISO
  availableBalance: number;
  currentBalance: number;
  canReceiveTransactions: boolean | null;
}

export interface MercuryAccountsResponse {
  accounts: MercuryAccount[];
  page?: {
    nextPage?: string;
    previousPage?: string;
  };
}

// ----- Transactions -----

export type MercuryTransactionStatus =
  | "pending"
  | "sent"
  | "cancelled"
  | "failed"
  | "reversed"
  | "blocked";

export type MercuryTransactionKind =
  | "externalTransfer"
  | "internalTransfer"
  | "outgoingPayment"
  | "creditCardCredit"
  | "creditCardTransaction"
  | "debitCardCredit"
  | "debitCardTransaction"
  | "incomingDomesticWire"
  | "checkDeposit"
  | "incomingInternationalWire"
  | "treasuryTransfer"
  | "wireFee"
  | "other"
  | (string & {});

export interface MercuryAttachment {
  fileName: string;
  url: string;
  attachmentType: "checkImage" | "receipt" | "other";
}

export interface MercuryTransaction {
  id: string;
  accountId: string;
  /** Signed: negative = outflow, positive = inflow. */
  amount: number;
  status: MercuryTransactionStatus;
  kind: MercuryTransactionKind;
  counterpartyId: string;
  counterpartyName: string;
  counterpartyNickname: string | null;
  createdAt: string;
  postedAt: string | null;
  estimatedDeliveryDate: string;
  failedAt: string | null;
  reasonForFailure: string | null;
  bankDescription: string | null;
  externalMemo: string | null;
  note: string | null;
  mercuryCategory: string | null;
  /** From the upstream `categoryData.name` field. */
  categoryName: string | null;
  checkNumber: string | null;
  trackingNumber: string | null;
  dashboardLink: string;
  hasGeneratedReceipt: boolean;
  attachments: MercuryAttachment[];
}

export interface MercuryTransactionsResponse {
  transactions: MercuryTransaction[];
  /** Mercury's listtransactions uses a `total` count + offset-or-cursor pagination. */
  total?: number;
  page?: {
    nextPage?: string;
    previousPage?: string;
  };
}

// ----- Convenience aggregate the UI consumes -----

export interface CashSnapshot {
  date: string; // ISO date (day)
  cash: number;
}

export interface FinanceData {
  accounts: MercuryAccount[];
  totalAvailable: number;
  totalCurrent: number;
  transactions: MercuryTransaction[];
  moneyIn: MercuryTransaction[];
  moneyOut: MercuryTransaction[];
  cashSeries: CashSnapshot[];
  burnPerMonth: number;
  topCounterparties: { counterparty: string; spend: number }[];
  /** True when this came from real Mercury, false when from mocks. */
  isLive: boolean;
}
