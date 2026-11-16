import { Readable } from 'node:stream';
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http';

export interface RequestOptions {
  method?: string;
  url?: string;
  headers?: IncomingHttpHeaders;
  body?: string;
  remoteAddress?: string;
}

/**
 * Minimal IncomingMessage double backed by a real Readable, so handlers that
 * consume the request stream behave the same as they do under Node.
 */
export function createRequest(options: RequestOptions = {}): IncomingMessage {
  const stream = new Readable({ read() {} });
  const req = stream as unknown as IncomingMessage & { pause: () => void };

  req.method = options.method ?? 'GET';
  req.url = options.url ?? '/';
  req.headers = options.headers ?? {};
  req.socket = { remoteAddress: options.remoteAddress ?? '127.0.0.1' } as IncomingMessage['socket'];

  if (options.body !== undefined) stream.push(Buffer.from(options.body));
  stream.push(null);

  return req;
}

/** A request whose body has not been sent yet, for stream-error tests. */
export function createOpenRequest(options: RequestOptions = {}): IncomingMessage {
  const stream = new Readable({ read() {} });
  const req = stream as unknown as IncomingMessage;
  req.method = options.method ?? 'POST';
  req.url = options.url ?? '/';
  req.headers = options.headers ?? {};
  req.socket = { remoteAddress: options.remoteAddress ?? '127.0.0.1' } as IncomingMessage['socket'];
  return req;
}

/** Records status, headers and body written by a handler. */
export class MockResponse {
  statusCode = 200;
  writableEnded = false;
  readonly headers = new Map<string, string | number>();
  body = '';

  setHeader(name: string, value: string | number): this {
    this.headers.set(name.toLowerCase(), value);
    return this;
  }

  getHeader(name: string): string | number | undefined {
    return this.headers.get(name.toLowerCase());
  }

  end(chunk?: unknown): void {
    if (chunk !== undefined && chunk !== null) this.body += String(chunk);
    this.writableEnded = true;
  }

  /** Parsed JSON body; throws if the handler wrote nothing. */
  json<T = unknown>(): T {
    return JSON.parse(this.body) as T;
  }
}

export function createResponse(): ServerResponse {
  return new MockResponse() as unknown as ServerResponse;
}

export function responseOf(res: ServerResponse): MockResponse {
  return res as unknown as MockResponse;
}
