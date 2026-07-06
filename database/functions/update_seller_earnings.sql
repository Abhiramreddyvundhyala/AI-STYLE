-- Function to update seller earnings after purchase
CREATE OR REPLACE FUNCTION update_seller_earnings(
  seller_id UUID,
  amount NUMERIC
)
RETURNS VOID AS $$
BEGIN
  UPDATE sellers
  SET 
    total_earnings = total_earnings + amount,
    pending_withdrawal = pending_withdrawal + amount
  WHERE id = seller_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
