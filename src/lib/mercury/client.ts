import "server-only";

import type {
  MercuryAccountsResponse,
  MercuryTransaction,
  MercuryTransactionsResponse,
  MercuryTransactionStatus,
} from "./types";

const DEFAULT_PROD_BASE = "https://api.mercury.com/api/v1";
const DEFAULT_SANDBOX_BASE = "https://api-sandbox.mercury.com/api/v1";

export class MercuryError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message);
    this.name = "MercuryError";
  }
}

export interface MercuryClientOptions {
  apiKey: string;
  /** Override base URL. Defaults to production. */
  baseUrl?: string;
  /** Use sandbox base URL (ignored when baseUrl is set). */
  sandbox?: boolean;
  /**
   * fetch cache hint for Next.js. 'no-store' = always fresh.
   * Set a positive integer (seconds) to enable ISR-style revalidation.
   */
  revalidate?: number | "no-store";
}

export interface ListTransactionsParams {
  status?: MercuryTransactionStatus[];
  search?: string;
  /** Filter by createdAt earliest (YYYY-MM-DD or ISO). */
  start?: string;
  /** Filter by createdAt latest (YYYY-MM-DD or ISO). */
  end?: string;
  /** Filter by postedAt earliest. */
  postedStart?: string;
  /** Filter by postedAt latest. */
  postedEnd?: string;
  accountId?: string[];
  /** 1..1000, default 1000. */
  limit?: number;
  order?: "asc" | "desc";
  start_after?: string;
  end_before?: string;
}

export class MercuryClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchCache: number | "no-store";

  constructor(opts: MercuryClientOptions) {
    if (!opts.apiKey) {
      throw new Error("MercuryClient: apiKey is required");
    }
    this.apiKey = opts.apiKey;
    this.baseUrl =
      opts.baseUrl ??
      (opts.sandbox ? DEFAULT_SANDBOX_BASE : DEFAULT_PROD_BASE);
    this.fetchCache = opts.revalidate ?? "no-store";
  }

  private async request<T>(
    path: string,
    params?: Record<string, string | string[] | number | undefined>
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v === undefined) continue;
        if (Array.isArray(v)) {
          for (const item of v) url.searchParams.append(k, item);
        } else {
          url.searchParams.set(k, String(v));
        }
      }
    }

    const init: RequestInit = {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
      },
    };

    // Next.js fetch extensions
    if (this.fetchCache === "no-store") {
      (init as RequestInit & { cache?: string }).cache = "no-store";
    } else {
      (init as RequestInit & { next?: { revalidate: number } }).next = {
        revalidate: this.fetchCache,
      };
    }

    const res = await fetch(url.toString(), init);

    if (!res.ok) {
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        body = await res.text();
      }
      throw new MercuryError(
        `Mercury ${res.status} ${res.statusText} for ${path}`,
        res.status,
        body
      );
    }

    return (await res.json()) as T;
  }

  listAccounts(): Promise<MercuryAccountsResponse> {
    return this.request<MercuryAccountsResponse>("/accounts");
  }

  /**
   * Single-page transaction fetch. Use `listAllTransactions` to auto-paginate.
   */
  listTransactions(
    params: ListTransactionsParams = {}
  ): Promise<MercuryTransactionsResponse> {
    return this.request<MercuryTransactionsResponse>("/transactions", {
      ...params,
    });
  }

  /**
   * Auto-paginate /transactions until exhausted or `maxPages` reached.
   * Defaults: limit 500/page, max 10 pages = up to 5000 txns.
   */
  async listAllTransactions(
    params: ListTransactionsParams = {},
    maxPages = 10
  ): Promise<MercuryTransaction[]> {
    const all: MercuryTransaction[] = [];
    let cursor: string | undefined = params.start_after;
    for (let page = 0; page < maxPages; page++) {
      const res = await this.listTransactions({
        ...params,
        limit: params.limit ?? 500,
        start_after: cursor,
      });
      all.push(...res.transactions);
      const next = res.page?.nextPage;
      if (!next || res.transactions.length === 0) break;
      cursor = next;
    }
    return all;
  }
}
