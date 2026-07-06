import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const REPLICATE_TOKEN = env.REPLICATE_API_TOKEN || '';

  return {
    plugins: [
      TanStackRouterVite(),
      react(),
      // Custom plugin: Replicate API reverse proxy using native fetch
      // This replaces the built-in http-proxy which has DNS resolution issues
      {
        name: 'replicate-proxy',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (!req.url?.startsWith('/api/replicate')) {
              return next();
            }

            // Strip the /api/replicate prefix
            const apiPath = req.url.replace(/^\/api\/replicate/, '');
            const targetUrl = `https://api.replicate.com${apiPath}`;

            // Collect request body
            const chunks: Buffer[] = [];
            for await (const chunk of req as any) {
              chunks.push(Buffer.from(chunk));
            }
            const bodyBuffer = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

            try {
              console.log(`[Replicate Proxy] ${req.method} ${apiPath}`);

              const fetchOptions: RequestInit = {
                method: req.method || 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${REPLICATE_TOKEN}`,
                  'Prefer': 'wait',
                },
              };

              if (bodyBuffer && req.method !== 'GET' && req.method !== 'HEAD') {
                fetchOptions.body = bodyBuffer;
              }

              const apiRes = await fetch(targetUrl, fetchOptions);
              const responseText = await apiRes.text();

              console.log(`[Replicate Proxy] Response: ${apiRes.status} (${responseText.length} bytes)`);

              // Forward response headers
              res.statusCode = apiRes.status;
              res.setHeader('Content-Type', apiRes.headers.get('content-type') || 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(responseText);
            } catch (err: any) {
              console.error(`[Replicate Proxy] Error:`, err.message);
              res.statusCode = 502;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                error: 'proxy_error',
                detail: err.message,
                hint: 'DNS resolution may have failed. Check your network connection.',
              }));
            }
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3000,
      host: true,
      strictPort: false,
      // No more http-proxy config — handled by the custom plugin above
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'esbuild',
      target: 'es2015',
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'router-vendor': ['@tanstack/react-router', '@tanstack/react-query'],
            'supabase-vendor': ['@supabase/supabase-js'],
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
    optimizeDeps: {
      include: ['react', 'react-dom', '@tanstack/react-router', '@tanstack/react-query', '@supabase/supabase-js'],
    },
  };
});
