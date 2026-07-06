-- =============================================================================
-- Security Hardening Migration (idempotent — safe to re-run)
-- Run AFTER 20260618_credit_monetization.sql
-- =============================================================================

-- ─── style_purchases: records every paid style download/purchase ──────────────
CREATE TABLE IF NOT EXISTS public.style_purchases (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  style_id         UUID NOT NULL REFERENCES public.styles(id) ON DELETE CASCADE,
  purchase_amount  DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency         VARCHAR(3) NOT NULL DEFAULT 'INR',
  payment_gateway  VARCHAR(50) NOT NULL DEFAULT 'razorpay',
  payment_id       VARCHAR(255),
  order_id         VARCHAR(255) UNIQUE,
  status           VARCHAR(20) NOT NULL DEFAULT 'completed'
                   CHECK (status IN ('pending','completed','refunded','failed')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.style_purchases ENABLE ROW LEVEL SECURITY;

-- Drop before recreate (idempotent)
DROP POLICY IF EXISTS "Users can read own style purchases"           ON public.style_purchases;
DROP POLICY IF EXISTS "Service role full access on style_purchases"  ON public.style_purchases;

CREATE POLICY "Users can read own style purchases"
  ON public.style_purchases FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on style_purchases"
  ON public.style_purchases FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS style_purchases_user_style_idx
  ON public.style_purchases (user_id, style_id);

CREATE INDEX IF NOT EXISTS style_purchases_order_id_idx
  ON public.style_purchases (order_id);

-- ─── check_style_purchased function ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_style_purchased(
  p_user_id UUID,
  p_style_id UUID
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  v_price DECIMAL;
  v_owned BOOLEAN;
BEGIN
  SELECT price INTO v_price FROM public.styles WHERE id = p_style_id;

  IF v_price IS NULL OR v_price = 0 THEN
    RETURN TRUE;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.style_purchases
    WHERE user_id = p_user_id
      AND style_id = p_style_id
      AND status = 'completed'
  ) INTO v_owned;

  RETURN v_owned;
END;
$$;

-- ─── generation_jobs hardening ────────────────────────────────────────────────
ALTER TABLE public.generation_jobs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on generation_jobs"                ON public.generation_jobs;
DROP POLICY IF EXISTS "Public read generation_jobs"                 ON public.generation_jobs;
DROP POLICY IF EXISTS "Users can read own generation_jobs"          ON public.generation_jobs;
DROP POLICY IF EXISTS "Service role full access on generation_jobs" ON public.generation_jobs;

CREATE POLICY "Users can read own generation_jobs"
  ON public.generation_jobs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on generation_jobs"
  ON public.generation_jobs FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS generation_jobs_user_id_idx
  ON public.generation_jobs (user_id);

-- ─── Harden existing RLS policies ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Public read user_credits"       ON public.user_credits;
DROP POLICY IF EXISTS "Public read transactions"       ON public.transactions;
DROP POLICY IF EXISTS "Public read generation_history" ON public.generation_history;

-- ─── Rate limits index ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS rate_limits_key_window_idx
  ON public.rate_limits (key, window_start);

-- ─── add_style_purchase_atomic ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_style_purchase(
  p_user_id      UUID,
  p_seller_id    UUID,
  p_style_id     UUID,
  p_amount       DECIMAL,
  p_currency     VARCHAR,
  p_payment_id   VARCHAR,
  p_order_id     VARCHAR
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_existing_id UUID;
  v_purchase    public.style_purchases;
BEGIN
  SELECT id INTO v_existing_id
  FROM public.style_purchases
  WHERE order_id = p_order_id;

  IF FOUND THEN
    SELECT * INTO v_purchase FROM public.style_purchases WHERE id = v_existing_id;
    RETURN jsonb_build_object(
      'already_purchased', true,
      'purchase_id', v_existing_id,
      'status', v_purchase.status
    );
  END IF;

  INSERT INTO public.style_purchases (
    user_id, seller_id, style_id, purchase_amount,
    currency, payment_id, order_id, status
  ) VALUES (
    p_user_id, p_seller_id, p_style_id, p_amount,
    p_currency, p_payment_id, p_order_id, 'completed'
  ) RETURNING * INTO v_purchase;

  RETURN jsonb_build_object(
    'already_purchased', false,
    'purchase_id', v_purchase.id,
    'status', v_purchase.status
  );
END;
$$;
