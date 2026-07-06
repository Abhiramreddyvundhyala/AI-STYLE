-- ============================================================================
-- Marketplace Tables Migration
-- This creates all necessary tables for the style marketplace
-- ============================================================================

-- ─── Sellers Table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sellers (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  upi_id TEXT,
  bank_account TEXT,
  total_earnings NUMERIC DEFAULT 0,
  pending_withdrawal NUMERIC DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;

-- Policies for sellers table
CREATE POLICY "Public can view seller names"
  ON sellers FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can update their own seller profile"
  ON sellers FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own seller profile"
  ON sellers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- ─── Styles Table ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS styles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  price NUMERIC NOT NULL CHECK (price >= 0),
  sample_image_url TEXT NOT NULL,
  prompt_encrypted TEXT NOT NULL,
  description TEXT,
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  sales_count INTEGER DEFAULT 0,
  avg_rating NUMERIC DEFAULT 4.5 CHECK (avg_rating >= 0 AND avg_rating <= 5),
  is_active BOOLEAN DEFAULT true,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_styles_seller_id ON styles(seller_id);
CREATE INDEX IF NOT EXISTS idx_styles_category ON styles(category);
CREATE INDEX IF NOT EXISTS idx_styles_is_active ON styles(is_active);
CREATE INDEX IF NOT EXISTS idx_styles_created_at ON styles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_styles_sales_count ON styles(sales_count DESC);

-- Enable RLS
ALTER TABLE styles ENABLE ROW LEVEL SECURITY;

-- Policies for styles table
CREATE POLICY "Public can view active styles"
  ON styles FOR SELECT
  TO public
  USING (is_active = true);

CREATE POLICY "Sellers can view their own styles"
  ON styles FOR SELECT
  TO authenticated
  USING (seller_id = auth.uid());

CREATE POLICY "Sellers can insert their own styles"
  ON styles FOR INSERT
  TO authenticated
  WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Sellers can update their own styles"
  ON styles FOR UPDATE
  TO authenticated
  USING (seller_id = auth.uid());

CREATE POLICY "Sellers can delete their own styles"
  ON styles FOR DELETE
  TO authenticated
  USING (seller_id = auth.uid());
  ON styles FOR DELETE
  TO authenticated
  USING (seller_id = auth.uid());

-- ─── Purchases Table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  style_id UUID NOT NULL REFERENCES styles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  platform_cut NUMERIC NOT NULL,
  seller_cut NUMERIC NOT NULL,
  razorpay_payment_id TEXT,
  razorpay_order_id TEXT,
  hd_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_purchases_buyer_id ON purchases(buyer_id);
CREATE INDEX IF NOT EXISTS idx_purchases_style_id ON purchases(style_id);
CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases(created_at DESC);

-- Enable RLS
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own purchases"
  ON purchases FOR SELECT
  TO authenticated
  USING (buyer_id = auth.uid());

CREATE POLICY "Users can insert their own purchases"
  ON purchases FOR INSERT
  TO authenticated
  WITH CHECK (buyer_id = auth.uid());

-- ─── Ratings Table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  style_id UUID NOT NULL REFERENCES styles(id) ON DELETE CASCADE,
  stars INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
  review_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(buyer_id, style_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ratings_style_id ON ratings(style_id);
CREATE INDEX IF NOT EXISTS idx_ratings_buyer_id ON ratings(buyer_id);

-- Enable RLS
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public can view ratings"
  ON ratings FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can insert their own ratings"
  ON ratings FOR INSERT
  TO authenticated
  WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "Users can update their own ratings"
  ON ratings FOR UPDATE
  TO authenticated
  USING (buyer_id = auth.uid());

-- ─── Withdrawals Table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  upi_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_withdrawals_seller_id ON withdrawals(seller_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);

-- Enable RLS
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Sellers can view their own withdrawals"
  ON withdrawals FOR SELECT
  TO authenticated
  USING (seller_id = auth.uid());

CREATE POLICY "Sellers can insert their own withdrawals"
  ON withdrawals FOR INSERT
  TO authenticated
  WITH CHECK (seller_id = auth.uid());

-- ─── Functions & Triggers ───────────────────────────────────────────────────

-- Function to update style sales count and avg rating
CREATE OR REPLACE FUNCTION update_style_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Update sales count
    UPDATE styles
    SET sales_count = sales_count + 1
    WHERE id = NEW.style_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for purchases
CREATE TRIGGER update_style_stats_on_purchase
  AFTER INSERT ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION update_style_stats();

-- Function to update avg rating
CREATE OR REPLACE FUNCTION update_style_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE styles
  SET avg_rating = (
    SELECT COALESCE(AVG(stars), 4.5)
    FROM ratings
    WHERE style_id = NEW.style_id
  )
  WHERE id = NEW.style_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for ratings
CREATE TRIGGER update_style_rating_on_rating
  AFTER INSERT OR UPDATE ON ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_style_rating();

-- ============================================================================
-- End of Migration
-- ============================================================================
