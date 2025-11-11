-- Phase 3: Inventory Integration with Accounting

-- Insert inventory-related accounts into chart_of_accounts
INSERT INTO chart_of_accounts (account_code, account_name, account_type, description, opening_balance, current_balance, is_active)
VALUES
  ('1300', 'Finished Goods Inventory', 'asset', 'Inventory of completed products ready for sale', 0, 0, true),
  ('1310', 'Raw Materials Inventory', 'asset', 'Inventory of raw materials for production', 0, 0, true),
  ('1320', 'Work in Progress', 'asset', 'Cost of partially completed products', 0, 0, true),
  ('5000', 'Cost of Goods Sold', 'expense', 'Direct costs of producing goods sold', 0, 0, true),
  ('4100', 'Sales Returns and Allowances', 'revenue', 'Returns and allowances given to customers', 0, 0, true)
ON CONFLICT (account_code) DO NOTHING;

-- Create function to automatically create journal entries for production
CREATE OR REPLACE FUNCTION public.create_production_journal_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  entry_id UUID;
  entry_num TEXT;
  fg_inventory_account_id UUID;
  wip_account_id UUID;
  inventory_value NUMERIC;
BEGIN
  -- Get account IDs
  SELECT id INTO fg_inventory_account_id FROM chart_of_accounts WHERE account_code = '1300' LIMIT 1;
  SELECT id INTO wip_account_id FROM chart_of_accounts WHERE account_code = '1320' LIMIT 1;
  
  -- Skip if accounts don't exist
  IF fg_inventory_account_id IS NULL OR wip_account_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Calculate inventory value (using weight as proxy for now, can be enhanced with costing later)
  inventory_value := COALESCE(NEW.weight_kg, 0) * 10; -- Placeholder: $10 per kg
  
  -- Skip if no value
  IF inventory_value <= 0 THEN
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
    NEW.production_date,
    'Production Record - Serial ' || NEW.serial_number,
    'production_record',
    NEW.serial_number,
    'posted',
    inventory_value,
    inventory_value
  )
  RETURNING id INTO entry_id;
  
  -- Create debit line for Finished Goods Inventory
  INSERT INTO journal_entry_lines (
    journal_entry_id,
    account_id,
    description,
    debit_amount,
    credit_amount
  )
  VALUES (
    entry_id,
    fg_inventory_account_id,
    'Finished Goods - Production Completion',
    inventory_value,
    0
  );
  
  -- Create credit line for Work in Progress
  INSERT INTO journal_entry_lines (
    journal_entry_id,
    account_id,
    description,
    debit_amount,
    credit_amount
  )
  VALUES (
    entry_id,
    wip_account_id,
    'WIP - Transfer to Finished Goods',
    0,
    inventory_value
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger for production journal entries
DROP TRIGGER IF EXISTS auto_create_production_journal_entry ON production_records;
CREATE TRIGGER auto_create_production_journal_entry
  AFTER INSERT ON production_records
  FOR EACH ROW
  EXECUTE FUNCTION create_production_journal_entry();

-- Create function to handle inventory consumption journal entries
CREATE OR REPLACE FUNCTION public.create_inventory_consumption_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  entry_id UUID;
  entry_num TEXT;
  rm_inventory_account_id UUID;
  wip_account_id UUID;
  consumption_value NUMERIC;
BEGIN
  -- Only process consumption transactions
  IF NEW.transaction_type != 'consumption' THEN
    RETURN NEW;
  END IF;
  
  -- Get account IDs
  SELECT id INTO rm_inventory_account_id FROM chart_of_accounts WHERE account_code = '1310' LIMIT 1;
  SELECT id INTO wip_account_id FROM chart_of_accounts WHERE account_code = '1320' LIMIT 1;
  
  -- Skip if accounts don't exist
  IF rm_inventory_account_id IS NULL OR wip_account_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Calculate consumption value
  consumption_value := COALESCE(NEW.weight_kg, NEW.quantity, 0) * 8; -- Placeholder: $8 per unit
  
  -- Skip if no value
  IF consumption_value <= 0 THEN
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
    'Raw Material Consumption',
    'inventory_transaction',
    NEW.id::text,
    'posted',
    consumption_value,
    consumption_value
  )
  RETURNING id INTO entry_id;
  
  -- Create debit line for WIP
  INSERT INTO journal_entry_lines (
    journal_entry_id,
    account_id,
    description,
    debit_amount,
    credit_amount
  )
  VALUES (
    entry_id,
    wip_account_id,
    'WIP - Raw Material Consumption',
    consumption_value,
    0
  );
  
  -- Create credit line for Raw Materials Inventory
  INSERT INTO journal_entry_lines (
    journal_entry_id,
    account_id,
    description,
    debit_amount,
    credit_amount
  )
  VALUES (
    entry_id,
    rm_inventory_account_id,
    'Raw Materials - Consumed in Production',
    0,
    consumption_value
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger for inventory consumption
DROP TRIGGER IF EXISTS auto_create_consumption_journal_entry ON inventory;
CREATE TRIGGER auto_create_consumption_journal_entry
  AFTER INSERT ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION create_inventory_consumption_entry();

-- Create sales_returns table for tracking product returns
CREATE TABLE IF NOT EXISTS public.sales_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number TEXT NOT NULL UNIQUE,
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  order_id UUID REFERENCES orders(id),
  customer_id UUID REFERENCES customers(id) NOT NULL,
  item_id UUID REFERENCES items(id) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'refunded')),
  refund_amount NUMERIC,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on sales_returns
ALTER TABLE public.sales_returns ENABLE ROW LEVEL SECURITY;

-- RLS policies for sales_returns
CREATE POLICY "Admins and accountants can manage returns"
  ON public.sales_returns
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Customers can view own returns"
  ON public.sales_returns
  FOR SELECT
  USING (
    customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'accountant'::app_role)
  );

-- Create function to generate return number
CREATE OR REPLACE FUNCTION public.generate_return_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  return_num TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(return_number FROM 'RET-(\d+)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM sales_returns;
  
  return_num := 'RET-' || LPAD(next_number::TEXT, 6, '0');
  RETURN return_num;
END;
$$;

-- Create function to handle sales return journal entries
CREATE OR REPLACE FUNCTION public.create_sales_return_journal_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  entry_id UUID;
  entry_num TEXT;
  sales_returns_account_id UUID;
  ar_account_id UUID;
  fg_inventory_account_id UUID;
  cogs_account_id UUID;
  return_value NUMERIC;
BEGIN
  -- Only process when return is approved
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    
    -- Get account IDs
    SELECT id INTO sales_returns_account_id FROM chart_of_accounts WHERE account_code = '4100' LIMIT 1;
    SELECT id INTO ar_account_id FROM chart_of_accounts WHERE account_code = '1200' LIMIT 1;
    SELECT id INTO fg_inventory_account_id FROM chart_of_accounts WHERE account_code = '1300' LIMIT 1;
    SELECT id INTO cogs_account_id FROM chart_of_accounts WHERE account_code = '5000' LIMIT 1;
    
    -- Skip if accounts don't exist
    IF sales_returns_account_id IS NULL OR ar_account_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Get return value
    return_value := COALESCE(NEW.refund_amount, 0);
    
    -- Skip if no amount
    IF return_value <= 0 THEN
      RETURN NEW;
    END IF;
    
    -- Generate entry number
    entry_num := generate_journal_entry_number();
    
    -- Create journal entry for sales return
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
      NEW.return_date,
      'Sales Return - ' || NEW.return_number,
      'sales_return',
      NEW.return_number,
      'posted',
      return_value,
      return_value
    )
    RETURNING id INTO entry_id;
    
    -- Create debit line for Sales Returns
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_id,
      description,
      debit_amount,
      credit_amount
    )
    VALUES (
      entry_id,
      sales_returns_account_id,
      'Sales Returns and Allowances',
      return_value,
      0
    );
    
    -- Create credit line for Accounts Receivable
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
      'Accounts Receivable - Customer Refund',
      0,
      return_value
    );
    
    -- If inventory accounts exist, restore inventory and reverse COGS
    IF fg_inventory_account_id IS NOT NULL AND cogs_account_id IS NOT NULL THEN
      -- Generate another entry for inventory restoration
      entry_num := generate_journal_entry_number();
      
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
        NEW.return_date,
        'Inventory Restoration - ' || NEW.return_number,
        'sales_return',
        NEW.return_number,
        'posted',
        return_value * 0.6, -- Assume 60% cost ratio
        return_value * 0.6
      )
      RETURNING id INTO entry_id;
      
      -- Debit Inventory (restore)
      INSERT INTO journal_entry_lines (
        journal_entry_id,
        account_id,
        description,
        debit_amount,
        credit_amount
      )
      VALUES (
        entry_id,
        fg_inventory_account_id,
        'Inventory Restored from Return',
        return_value * 0.6,
        0
      );
      
      -- Credit COGS (reverse)
      INSERT INTO journal_entry_lines (
        journal_entry_id,
        account_id,
        description,
        debit_amount,
        credit_amount
      )
      VALUES (
        entry_id,
        cogs_account_id,
        'COGS Reversal from Return',
        0,
        return_value * 0.6
      );
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for sales return journal entries
DROP TRIGGER IF EXISTS auto_create_sales_return_journal_entry ON sales_returns;
CREATE TRIGGER auto_create_sales_return_journal_entry
  AFTER INSERT OR UPDATE ON sales_returns
  FOR EACH ROW
  EXECUTE FUNCTION create_sales_return_journal_entry();

-- Create trigger for updated_at on sales_returns
DROP TRIGGER IF EXISTS update_sales_returns_updated_at ON sales_returns;
CREATE TRIGGER update_sales_returns_updated_at
  BEFORE UPDATE ON sales_returns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sales_returns_customer_id ON sales_returns(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_order_id ON sales_returns(order_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_status ON sales_returns(status);
CREATE INDEX IF NOT EXISTS idx_sales_returns_return_date ON sales_returns(return_date);
CREATE INDEX IF NOT EXISTS idx_inventory_transaction_type ON inventory(transaction_type);
CREATE INDEX IF NOT EXISTS idx_production_records_date ON production_records(production_date);