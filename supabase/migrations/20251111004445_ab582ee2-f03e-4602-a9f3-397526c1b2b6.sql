-- Add sales-related accounts if they don't exist
INSERT INTO chart_of_accounts (account_code, account_name, account_type, description, is_active)
VALUES 
  ('4000', 'Sales Revenue', 'revenue', 'Revenue from product sales', true),
  ('1200', 'Accounts Receivable', 'asset', 'Money owed by customers', true),
  ('2100', 'Sales Tax Payable', 'liability', 'Sales tax collected from customers', true)
ON CONFLICT (account_code) DO NOTHING;

-- Create function to automatically generate journal entry for completed orders
CREATE OR REPLACE FUNCTION public.create_sales_journal_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  entry_id UUID;
  entry_num TEXT;
  sales_account_id UUID;
  ar_account_id UUID;
  order_total NUMERIC;
BEGIN
  -- Only process when order status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Get account IDs
    SELECT id INTO sales_account_id FROM chart_of_accounts WHERE account_code = '4000' LIMIT 1;
    SELECT id INTO ar_account_id FROM chart_of_accounts WHERE account_code = '1200' LIMIT 1;
    
    -- Skip if accounts don't exist
    IF sales_account_id IS NULL OR ar_account_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Get order total
    order_total := COALESCE(NEW.total_amount, 0);
    
    -- Skip if no amount
    IF order_total <= 0 THEN
      RETURN NEW;
    END IF;
    
    -- Generate entry number
    entry_num := generate_journal_entry_number();
    
    -- Create journal entry
    INSERT INTO journal_entries (
      entry_number,
      entry_date,
      description,
      reference_type,
      reference_number,
      status,
      total_debit,
      total_credit
    )
    VALUES (
      entry_num,
      CURRENT_DATE,
      'Sales Invoice - Order ' || NEW.order_number,
      'sales_order',
      NEW.order_number,
      'posted',
      order_total,
      order_total
    )
    RETURNING id INTO entry_id;
    
    -- Create debit line for Accounts Receivable
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_id,
      description,
      debit_amount,
      credit_amount
    )
    VALUES (
      entry_id,
      ar_account_id,
      'Accounts Receivable - Customer Sale',
      order_total,
      0
    );
    
    -- Create credit line for Sales Revenue
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_id,
      description,
      debit_amount,
      credit_amount
    )
    VALUES (
      entry_id,
      sales_account_id,
      'Sales Revenue',
      0,
      order_total
    );
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-generate journal entries for completed orders
DROP TRIGGER IF EXISTS auto_create_sales_journal_entry ON orders;
CREATE TRIGGER auto_create_sales_journal_entry
  AFTER INSERT OR UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION create_sales_journal_entry();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_journal_entries_reference ON journal_entries(reference_type, reference_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);