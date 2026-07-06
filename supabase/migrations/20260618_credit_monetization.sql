-- =============================================================================
-- Credit-Based Monetization System — Database Migration (idempotent — safe to re-run)
-- =============================================================================

-- ─── Enable pgcrypto for gen_random_uuid() ───────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- ADMIN USERS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.admin_users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on admin_users" ON public.admin_users;
CREATE POLICY "Service role full access on admin_users"
  ON public.admin_users FOR ALL
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- PACKAGES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.packages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  credits     INT NOT NULL CHECK (credits > 0),
  price_inr   DECIMAL(10,2) NOT NULL CHECK (price_inr > 0),
  price_usd   DECIMAL(10,2) NOT NULL CHECK (price_usd > 0),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add unique constraint on name (idempotent)
ALTER TABLE public.packages DROP CONSTRAINT IF EXISTS packages_name_key;
ALTER TABLE public.packages ADD CONSTRAINT packages_name_key UNIQUE (name);


ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active packages"   ON public.packages;
DROP POLICY IF EXISTS "Service role full access on packages" ON public.packages;

CREATE POLICY "Anyone can read active packages"
  ON public.packages FOR SELECT
  USING (is_active = true);

CREATE POLICY "Service role full access on packages"
  ON public.packages FOR ALL
  USING (true)
  WITH CHECK (true);

-- Remove duplicate rows first (keep oldest per name)
DELETE FROM public.packages
WHERE id NOT IN (
  SELECT DISTINCT ON (name) id
  FROM public.packages
  ORDER BY name, created_at ASC
);

-- Seed packages (ON CONFLICT (name) — safe to re-run now)
INSERT INTO public.packages (name, credits, price_inr, price_usd) VALUES
  ('Starter Pack', 10,  149.00, 1.79),
  ('Popular Pack', 25,  349.00, 4.19),
  ('Pro Pack',     75,  899.00, 10.79)
ON CONFLICT (name) DO NOTHING;


-- =============================================================================
-- ADMIN CONFIG TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.admin_config (
  key         VARCHAR(100) PRIMARY KEY,
  value       VARCHAR(500) NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read admin_config" ON public.admin_config;
DROP POLICY IF EXISTS "Service role full access on admin_config"  ON public.admin_config;

CREATE POLICY "Authenticated users can read admin_config"
  ON public.admin_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role full access on admin_config"
  ON public.admin_config FOR ALL
  USING (true)
  WITH CHECK (true);

INSERT INTO public.admin_config (key, value) VALUES
  ('free_generations_per_month', '3'),
  ('credits_per_generation', '1')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- USER CREDITS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_credits (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  free_credits_remaining   INT NOT NULL DEFAULT 3 CHECK (free_credits_remaining >= 0),
  paid_credits             INT NOT NULL DEFAULT 0 CHECK (paid_credits >= 0),
  last_credit_reset        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own credits"              ON public.user_credits;
DROP POLICY IF EXISTS "Service role full access on user_credits" ON public.user_credits;

CREATE POLICY "Users can read own credits"
  ON public.user_credits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on user_credits"
  ON public.user_credits FOR ALL
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- TRANSACTIONS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  package_id               UUID REFERENCES public.packages(id) ON DELETE SET NULL,
  package_name_snapshot    VARCHAR(100) NOT NULL,
  credits_added_snapshot   INT NOT NULL,
  amount                   DECIMAL(10,2) NOT NULL,
  currency                 VARCHAR(3) NOT NULL DEFAULT 'INR',
  payment_gateway          VARCHAR(50) NOT NULL DEFAULT 'razorpay',
  payment_id               VARCHAR(255) UNIQUE,
  order_id                 VARCHAR(255) UNIQUE,
  status                   VARCHAR(20) NOT NULL DEFAULT 'created'
                             CHECK (status IN ('created', 'pending', 'captured', 'failed', 'refunded')),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own transactions"          ON public.transactions;
DROP POLICY IF EXISTS "Service role full access on transactions" ON public.transactions;

CREATE POLICY "Users can read own transactions"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on transactions"
  ON public.transactions FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS transactions_user_id_idx    ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS transactions_payment_id_idx ON public.transactions(payment_id);
CREATE INDEX IF NOT EXISTS transactions_order_id_idx   ON public.transactions(order_id);
CREATE INDEX IF NOT EXISTS transactions_status_idx     ON public.transactions(status);

-- =============================================================================
-- GENERATION HISTORY TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.generation_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  style_id     UUID REFERENCES public.styles(id) ON DELETE SET NULL,
  prompt       TEXT,
  image_url    TEXT,
  credit_type  VARCHAR(10) NOT NULL DEFAULT 'free'
                 CHECK (credit_type IN ('free', 'paid')),
  credits_used INT NOT NULL DEFAULT 1,
  status       VARCHAR(20) NOT NULL DEFAULT 'success'
                 CHECK (status IN ('success', 'failed')),
  metadata     JSONB DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.generation_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own generation history"          ON public.generation_history;
DROP POLICY IF EXISTS "Service role full access on generation_history" ON public.generation_history;

CREATE POLICY "Users can read own generation history"
  ON public.generation_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on generation_history"
  ON public.generation_history FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS generation_history_user_id_idx    ON public.generation_history(user_id);
CREATE INDEX IF NOT EXISTS generation_history_created_at_idx ON public.generation_history(created_at DESC);
CREATE INDEX IF NOT EXISTS generation_history_status_idx     ON public.generation_history(status);

-- =============================================================================
-- RATE LIMITS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key           TEXT NOT NULL,
  window_start  TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_count INT NOT NULL DEFAULT 1,
  UNIQUE (key, window_start)
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on rate_limits" ON public.rate_limits;

CREATE POLICY "Service role full access on rate_limits"
  ON public.rate_limits FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS rate_limits_window_start_idx ON public.rate_limits(window_start);

-- =============================================================================
-- AUTO-UPDATE updated_at TRIGGER
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at_ts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['packages', 'user_credits', 'transactions', 'admin_config'] LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS %I_updated_at ON public.%I;
      CREATE TRIGGER %I_updated_at
        BEFORE UPDATE ON public.%I
        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_ts();
    ', tbl, tbl, tbl, tbl);
  END LOOP;
END $$;

-- =============================================================================
-- FUNCTION: ensure_user_credits
-- =============================================================================
CREATE OR REPLACE FUNCTION public.ensure_user_credits(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_free_per_month INT;
BEGIN
  SELECT value::INT INTO v_free_per_month
  FROM public.admin_config
  WHERE key = 'free_generations_per_month';

  IF v_free_per_month IS NULL THEN
    v_free_per_month := 3;
  END IF;

  INSERT INTO public.user_credits (user_id, free_credits_remaining, paid_credits, last_credit_reset)
  VALUES (p_user_id, v_free_per_month, 0, CURRENT_DATE)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

-- =============================================================================
-- FUNCTION: check_and_reset_monthly_credits
-- =============================================================================
CREATE OR REPLACE FUNCTION public.check_and_reset_monthly_credits(p_user_id UUID)
RETURNS TABLE(
  free_credits_remaining INT,
  paid_credits INT,
  was_reset BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_current_ym    TEXT;
  v_reset_ym      TEXT;
  v_credits       public.user_credits;
  v_free_per_month INT;
  v_was_reset     BOOLEAN := false;
BEGIN
  SELECT value::INT INTO v_free_per_month
  FROM public.admin_config
  WHERE key = 'free_generations_per_month';

  IF v_free_per_month IS NULL THEN v_free_per_month := 3; END IF;

  PERFORM public.ensure_user_credits(p_user_id);

  SELECT * INTO v_credits
  FROM public.user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  v_current_ym := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
  v_reset_ym   := TO_CHAR(v_credits.last_credit_reset, 'YYYY-MM');

  IF v_current_ym != v_reset_ym THEN
    UPDATE public.user_credits
    SET
      free_credits_remaining = v_free_per_month,
      last_credit_reset      = CURRENT_DATE,
      updated_at             = now()
    WHERE user_id = p_user_id;

    v_credits.free_credits_remaining := v_free_per_month;
    v_was_reset := true;
  END IF;

  RETURN QUERY SELECT
    v_credits.free_credits_remaining,
    v_credits.paid_credits,
    v_was_reset;
END;
$$;

-- =============================================================================
-- FUNCTION: deduct_credit
-- =============================================================================
CREATE OR REPLACE FUNCTION public.deduct_credit(p_user_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_credits     public.user_credits;
  v_credit_type TEXT;
BEGIN
  PERFORM public.check_and_reset_monthly_credits(p_user_id);

  SELECT * INTO v_credits
  FROM public.user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_credits.free_credits_remaining > 0 THEN
    UPDATE public.user_credits
    SET free_credits_remaining = free_credits_remaining - 1, updated_at = now()
    WHERE user_id = p_user_id;
    v_credit_type := 'free';
  ELSIF v_credits.paid_credits > 0 THEN
    UPDATE public.user_credits
    SET paid_credits = paid_credits - 1, updated_at = now()
    WHERE user_id = p_user_id;
    v_credit_type := 'paid';
  ELSE
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS: You have used all available credits. Purchase credits to continue.';
  END IF;

  RETURN v_credit_type;
END;
$$;

-- =============================================================================
-- FUNCTION: refund_credit
-- =============================================================================
CREATE OR REPLACE FUNCTION public.refund_credit(p_user_id UUID, p_credit_type TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_credit_type = 'free' THEN
    UPDATE public.user_credits
    SET free_credits_remaining = free_credits_remaining + 1, updated_at = now()
    WHERE user_id = p_user_id;
  ELSIF p_credit_type = 'paid' THEN
    UPDATE public.user_credits
    SET paid_credits = paid_credits + 1, updated_at = now()
    WHERE user_id = p_user_id;
  END IF;
END;
$$;

-- =============================================================================
-- FUNCTION: add_credits_after_payment
-- =============================================================================
CREATE OR REPLACE FUNCTION public.add_credits_after_payment(
  p_payment_id TEXT,
  p_order_id   TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_txn        public.transactions;
  v_credits_to_add INT;
  v_user_id    UUID;
  v_result     JSONB;
BEGIN
  SELECT * INTO v_txn
  FROM public.transactions
  WHERE order_id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRANSACTION_NOT_FOUND: No transaction found for order_id %', p_order_id;
  END IF;

  IF v_txn.status = 'captured' THEN
    SELECT jsonb_build_object(
      'already_captured', true,
      'free_credits_remaining', uc.free_credits_remaining,
      'paid_credits', uc.paid_credits
    ) INTO v_result
    FROM public.user_credits uc
    WHERE uc.user_id = v_txn.user_id;
    RETURN v_result;
  END IF;

  v_credits_to_add := v_txn.credits_added_snapshot;
  v_user_id        := v_txn.user_id;

  UPDATE public.user_credits
  SET paid_credits = paid_credits + v_credits_to_add, updated_at = now()
  WHERE user_id = v_user_id;

  UPDATE public.transactions
  SET payment_id = p_payment_id, status = 'captured', updated_at = now()
  WHERE order_id = p_order_id;

  SELECT jsonb_build_object(
    'already_captured', false,
    'credits_added', v_credits_to_add,
    'free_credits_remaining', uc.free_credits_remaining,
    'paid_credits', uc.paid_credits
  ) INTO v_result
  FROM public.user_credits uc
  WHERE uc.user_id = v_user_id;

  RETURN v_result;
END;
$$;

-- =============================================================================
-- FUNCTION: reverse_credits_for_refund
-- =============================================================================
CREATE OR REPLACE FUNCTION public.reverse_credits_for_refund(p_payment_id TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_txn public.transactions;
BEGIN
  SELECT * INTO v_txn
  FROM public.transactions
  WHERE payment_id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND OR v_txn.status = 'refunded' THEN
    RETURN;
  END IF;

  UPDATE public.user_credits
  SET paid_credits = GREATEST(0, paid_credits - v_txn.credits_added_snapshot), updated_at = now()
  WHERE user_id = v_txn.user_id;

  UPDATE public.transactions
  SET status = 'refunded', updated_at = now()
  WHERE payment_id = p_payment_id;
END;
$$;

-- =============================================================================
-- CUSTOM JWT CLAIM FUNCTION: custom_access_token_hook
-- =============================================================================
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  claims       JSONB;
  is_admin_val BOOLEAN;
  user_id_val  UUID;
BEGIN
  claims      := event -> 'claims';
  user_id_val := (event ->> 'user_id')::UUID;

  SELECT EXISTS (
    SELECT 1 FROM public.admin_users WHERE id = user_id_val
  ) INTO is_admin_val;

  IF is_admin_val THEN
    claims := jsonb_set(claims, '{role}', '"admin"');
  ELSE
    claims := jsonb_set(claims, '{role}', '"user"');
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- =============================================================================
-- FUNCTION: get_user_balance
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_user_balance(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_credits public.user_credits;
BEGIN
  PERFORM public.ensure_user_credits(p_user_id);
  PERFORM public.check_and_reset_monthly_credits(p_user_id);

  SELECT * INTO v_credits
  FROM public.user_credits
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'free_credits_remaining', v_credits.free_credits_remaining,
    'paid_credits', v_credits.paid_credits,
    'total_credits', v_credits.free_credits_remaining + v_credits.paid_credits,
    'last_credit_reset', v_credits.last_credit_reset
  );
END;
$$;

-- =============================================================================
-- FUNCTION: cleanup_rate_limits
-- =============================================================================
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.rate_limits
  WHERE window_start < now() - INTERVAL '2 hours';
END;
$$;
