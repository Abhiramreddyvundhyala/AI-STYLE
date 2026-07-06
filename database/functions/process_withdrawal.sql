-- Function to process withdrawal and update seller balance
CREATE OR REPLACE FUNCTION process_withdrawal(
  withdrawal_id UUID,
  new_status TEXT
)
RETURNS VOID AS $$
DECLARE
  v_seller_id UUID;
  v_amount NUMERIC;
BEGIN
  -- Get withdrawal details
  SELECT seller_id, amount INTO v_seller_id, v_amount
  FROM withdrawals
  WHERE id = withdrawal_id;

  -- Update withdrawal status
  UPDATE withdrawals
  SET status = new_status
  WHERE id = withdrawal_id;

  -- If completed, deduct from pending withdrawal
  IF new_status = 'completed' THEN
    UPDATE sellers
    SET pending_withdrawal = pending_withdrawal - v_amount
    WHERE id = v_seller_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
