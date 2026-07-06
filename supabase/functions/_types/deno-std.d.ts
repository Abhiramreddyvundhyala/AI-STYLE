/**
 * Type stub for https://deno.land/std@0.168.0/http/server.ts
 * Used by VS Code TypeScript language server to resolve Deno URL imports.
 */

export type ServeHandler = (req: Request) => Response | Promise<Response>;

export function serve(handler: ServeHandler): void;
export function serve(handler: ServeHandler, options?: { port?: number }): void;
