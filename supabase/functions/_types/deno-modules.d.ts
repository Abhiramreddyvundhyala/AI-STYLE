/**
 * Ambient module declarations for Deno edge function URL imports.
 * These tell the VS Code TypeScript language server that these URL imports
 * are valid modules with known types — without needing Deno installed.
 */

declare module 'https://deno.land/std@0.168.0/http/server.ts' {
  export type ServeHandler = (req: Request) => Response | Promise<Response>;
  export function serve(handler: ServeHandler): void;
  export function serve(handler: ServeHandler, options: { port?: number }): void;
}

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  export {
    createClient,
    SupabaseClient,
    type PostgrestError,
    type PostgrestResponse,
    type PostgrestSingleResponse,
  } from '@supabase/supabase-js';
}
