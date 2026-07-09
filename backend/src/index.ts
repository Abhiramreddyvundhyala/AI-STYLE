/**
 * Style Fusion Backend — Express Server
 * Mirrors all Supabase Edge Functions as HTTP routes.
 * Deployed on Render.
 *
 * Routes:
 *   POST /generate-universal
 *   POST /get-job-status
 *   POST /create-payment-order
 *   POST /verify-payment
 *   POST /razorpay-webhook      ← raw body, HMAC verified
 *   GET  /credits/balance
 *   GET  /credits/transactions
 *   GET  /credits/generations
 *   GET  /admin-config
 *   PUT  /admin-config
 *   POST /style-purchase
 *   POST /verify-style-purchase
 *   GET  /health
 */

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';

// Routes
import generateUniversalRouter from './routes/generateUniversal';
import getJobStatusRouter from './routes/getJobStatus';
import createPaymentOrderRouter from './routes/createPaymentOrder';
import verifyPaymentRouter from './routes/verifyPayment';
import razorpayWebhookRouter from './routes/razorpayWebhook';
import creditsRouter from './routes/credits';
import adminConfigRouter from './routes/adminConfig';
import stylePurchaseRouter from './routes/stylePurchase';
import verifyStylePurchaseRouter from './routes/verifyStylePurchase';

const app = express();
const PORT = parseInt(process.env.PORT ?? '10000', 10);

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_ORIGIN,                // set in Render env vars
  'https://ai-style-two.vercel.app',          // your Vercel frontend
  'http://localhost:5173',                    // Vite dev server
  'http://localhost:3000',
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (Postman, server-to-server, Razorpay webhooks)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-client-info', 'apikey', 'x-razorpay-signature'],
  })
);

// ── Body parsers ──────────────────────────────────────────────────────────────
// IMPORTANT: The Razorpay webhook route MUST receive the raw body for HMAC.
// We apply express.raw() only for that path and capture it as req.rawBody.
app.use('/razorpay-webhook', express.raw({ type: 'application/json' }), (req: Request, _res: Response, next: NextFunction) => {
  (req as Request & { rawBody: string }).rawBody = req.body?.toString('utf8') ?? '';
  next();
});

// All other routes use JSON — limit to 1 MB to prevent DoS via large payloads
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── HTTP Security Headers (H12 fix) ───────────────────────────────────────────
app.use((_req: Request, res: Response, next: NextFunction) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  // Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // HSTS — enforce HTTPS for 1 year, include subdomains
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // Limit referrer info sent to third parties
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Restrict powerful browser features
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  // Minimal CSP for API-only backend
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  // Remove fingerprinting header
  res.removeHeader('X-Powered-By');
  next();
});


// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/generate-universal',    generateUniversalRouter);
app.use('/get-job-status',        getJobStatusRouter);
app.use('/create-payment-order',  createPaymentOrderRouter);
app.use('/verify-payment',        verifyPaymentRouter);
app.use('/razorpay-webhook',      razorpayWebhookRouter);
app.use('/credits',               creditsRouter);
app.use('/admin-config',          adminConfigRouter);
app.use('/style-purchase',        stylePurchaseRouter);
app.use('/verify-style-purchase', verifyStylePurchaseRouter);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[server] Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Style Fusion backend listening on port ${PORT}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV ?? 'development'}`);
  console.log(`   CORS allowed origins: ${allowedOrigins.join(', ')}`);
  // Razorpay key diagnostics (safe — shows prefix only, not full secret)
  const rzpId = process.env.RAZORPAY_KEY_ID ?? '';
  const rzpSecret = process.env.RAZORPAY_KEY_SECRET ?? '';
  console.log(`   RAZORPAY_KEY_ID: ${rzpId ? rzpId.slice(0, 12) + '...' : '❌ NOT SET'}`);
  console.log(`   RAZORPAY_KEY_SECRET: ${rzpSecret ? '✅ set (' + rzpSecret.length + ' chars)' : '❌ NOT SET'}`);
});

export default app;
