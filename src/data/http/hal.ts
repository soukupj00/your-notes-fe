import type { z } from 'zod';
import { Problem, RootResponse } from '@/contract/index.ts';

/** An error answer from the server, read from its `application/problem+json` body (RFC 9457). */
export class ProblemError extends Error {
  readonly status: number;
  readonly title: string;
  readonly detail?: string;

  constructor(status: number, title: string, detail?: string) {
    super(detail ?? title);
    this.name = 'ProblemError';
    this.status = status;
    this.title = title;
    if (detail !== undefined) this.detail = detail;
  }
}

export type Rel = keyof RootResponse['_links'];

/**
 * The one door to the Self-hosted Server. It starts at the HAL root (`GET /api`)
 * and follows its links, so no route is written down twice; every body is
 * parsed with the vendored contract, which makes a drift between the repos a
 * thrown `ZodError` at the boundary rather than a wrong value inside the app.
 */
export type HalClient = {
  /** The root's `rel` link, with a templated link's `{name}`s filled in. */
  link(rel: Rel, params?: Record<string, string>): Promise<string>;
  /** The HAL root, read afresh: its `setup` link is present only until an Owner exists. */
  root(): Promise<RootResponse>;
  /** A JSON request whose answer `schema` must parse. */
  json<S extends z.ZodType>(schema: S, url: string, init?: JsonInit): Promise<z.infer<S>>;
  /** Any other request; answers the Response when it is 2xx. */
  send(url: string, init?: RequestInit): Promise<Response>;
};

export type JsonInit = { method?: string; body?: unknown };

const ROOT = '/api';

async function problemFrom(response: Response): Promise<ProblemError> {
  const body = await response.json().catch(() => null);
  const problem = Problem.safeParse(body);
  return problem.success
    ? new ProblemError(response.status, problem.data.title, problem.data.detail)
    : new ProblemError(response.status, response.statusText || `HTTP ${response.status}`);
}

/** `fetch` is a parameter so tests can hand in a fake server; the app passes nothing. */
export function createHalClient(fetchImpl: typeof fetch = (...args) => fetch(...args)): HalClient {
  let cachedRoot: Promise<RootResponse> | null = null;

  async function send(url: string, init: RequestInit = {}): Promise<Response> {
    const response = await fetchImpl(url, { credentials: 'same-origin', ...init });
    if (!response.ok) throw await problemFrom(response);
    return response;
  }

  async function json<S extends z.ZodType>(
    schema: S,
    url: string,
    init: JsonInit = {}
  ): Promise<z.infer<S>> {
    const response = await send(url, {
      method: init.method ?? 'GET',
      headers: {
        accept: 'application/hal+json, application/json',
        ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    return schema.parse(await response.json());
  }

  function root(): Promise<RootResponse> {
    const fresh = json(RootResponse, ROOT);
    cachedRoot = fresh;
    // A failed read is not remembered, so the next call asks again.
    fresh.catch(() => {
      if (cachedRoot === fresh) cachedRoot = null;
    });
    return fresh;
  }

  async function link(rel: Rel, params: Record<string, string> = {}): Promise<string> {
    const found = (await (cachedRoot ?? root()))._links[rel];
    if (!found) throw new ProblemError(404, `The server offers no ${rel} link`);
    return found.href.replace(/\{(\w+)\}/g, (_, name: string) =>
      encodeURIComponent(params[name] ?? '')
    );
  }

  return { link, root, json, send };
}
