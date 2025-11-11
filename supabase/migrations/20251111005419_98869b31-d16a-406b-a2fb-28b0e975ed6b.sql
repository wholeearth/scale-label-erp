-- Phase 4: Transactions - Cash Receipts, Supplier Payments, and Expenses

-- Insert transaction-related accounts into chart_of_accounts
INSERT INTO chart_of_accounts (account_code, account_name, account_type, description, opening_balance, current_balance, is_active)
VALUES
  ('1000', 'Cash', 'asset', 'Cash on hand and in bank', 0, 0, true),
  ('1010', 'Petty Cash', 'asset', 'Small cash fund for minor expenses', 0, 0, true),
  ('2000', 'Accounts Payable', 'liability', 'Amounts owed to suppliers', 0, 0, true),
  ('5100', 'Office Supplies Expense', 'expense', 'Cost of office supplies', 0, 0, true),
  ('5200', 'Utilities Expense', 'expense', 'Cost of utilities (electricity, water, etc.)', 0, 0, true),
  ('5300', 'Rent Expense', 'expense', 'Cost of rent for facilities', 0, 0, true),
  ('5400', 'Salaries Expense', 'expense', 'Employee salaries and wages', 0, 0, true),
  ('5500', 'Transportation Expense', 'expense', 'Transportation and vehicle costs', 0, 0, true),
  ('5600', 'Maintenance Expense', 'expense', 'Maintenance and repairs', 0, 0, true),
  ('5700', 'Insurance Expense', 'expense', 'Insurance premiums', 0, 0, true),
  ('5800', 'Miscellaneous Expense', 'expense', 'Other general expenses', 0, 0, true)
ON CONFLICT (account_code) DO NOTHING;

-- Create cash_receipts table for customer payments
CREATE TABLE IF NOT EXISTS public.cash_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT NOT NULL UNIQUE,
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_id UUID REFERENCES customers(id) NOT NULL,
  order_id UUID REFERENCES orders(id),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'check', 'bank_transfer', 'credit_card')),
  reference_number TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'posted', 'cancelled')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create supplier_payments table
CREATE TABLE IF NOT EXISTS public.supplier_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number TEXT NOT NULL UNIQUE,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier_name TEXT NOT NULL,
  supplier_contact TEXT,
  purchase_id UUID REFERENCES purchases(id),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'check', 'bank_transfer', 'credit_card')),
  reference_number TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'posted', 'cancelled')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_number TEXT NOT NULL UNIQUE,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expense_type TEXT NOT NULL CHECK (expense_type IN ('office_supplies', 'utilities', 'rent', 'salaries', 'transportation', 'maintenance', 'insurance', 'miscellaneous')),
  vendor_name TEXT,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'check', 'bank_transfer', 'credit_card', 'petty_cash')),
  reference_number TEXT,
  receipt_attached BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  created_by UUID,
  approved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.cash_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- RLS policies for cash_receipts
CREATE POLICY "Admins and accountants can manage cash receipts"
  ON public.cash_receipts
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accountant'::app_role));

-- RLS policies for supplier_payments
CREATE POLICY "Admins and accountants can manage supplier payments"
  ON public.supplier_payments
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accountant'::app_role));

-- RLS policies for expenses
CREATE POLICY "Admins and accountants can manage expenses"
  ON public.expenses
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accountant'::app_role));

-- Function to generate receipt number
CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  receipt_num TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(receipt_number FROM 'CR-(\d+)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM cash_receipts;
  
  receipt_num := 'CR-' || LPAD(next_number::TEXT, 6, '0');
  RETURN receipt_num;
END;
$$;

-- Function to generate payment number
CREATE OR REPLACE FUNCTION public.generate_payment_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  payment_num TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(payment_number FROM 'PAY-(\d+)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM supplier_payments;
  
  payment_num := 'PAY-' || LPAD(next_number::TEXT, 6, '0');
  RETURN payment_num;
END;
$$;

-- Function to generate expense number
CREATE OR REPLACE FUNCTION public.generate_expense_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  expense_num TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(expense_number FROM 'EXP-(\d+)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM expenses;
  
  expense_num := 'EXP-' || LPAD(next_number::TEXT, 6, '0');
  RETURN expense_num;
END;
$$;

-- Function to create journal entry for cash receipt
CREATE OR REPLACE FUNCTION public.create_cash_receipt_journal_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  entry_id UUID;
  entry_num TEXT;
  cash_account_id UUID;
  ar_account_id UUID;
BEGIN
  -- Only process when receipt is posted
  IF NEW.status = 'posted' AND (OLD.status IS NULL OR OLD.status != 'posted') THEN
    
    -- Get account IDs
    SELECT id INTO cash_account_id FROM chart_of_accounts WHERE account_code = '1000' LIMIT 1;
    SELECT id INTO ar_account_id FROM chart_of_accounts WHERE account_code = '1200' LIMIT 1;
    
    -- Skip if accounts don't exist
    IF cash_account_id IS NULL OR ar_account_id IS NULL THEN
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
      NEW.receipt_date,
      'Cash Receipt - ' || NEW.receipt_number,
      'cash_receipt',
      NEW.receipt_number,
      'posted',
      NEW.amount,
      NEW.amount
    )
    RETURNING id INTO entry_id;
    
    -- Create debit line for Cash
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_id,
      description,
      debit_amount,
      credit_amount
    )
    VALUES (
      entry_id,
      cash_account_id,
      'Cash received from customer',
      NEW.amount,
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
      'Accounts Receivable payment',
      0,
      NEW.amount
    );
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function to create journal entry for supplier payment
CREATE OR REPLACE FUNCTION public.create_supplier_payment_journal_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  entry_id UUID;
  entry_num TEXT;
  cash_account_id UUID;
  ap_account_id UUID;
BEGIN
  -- Only process when payment is posted
  IF NEW.status = 'posted' AND (OLD.status IS NULL OR OLD.status != 'posted') THEN
    
    -- Get account IDs
    SELECT id INTO cash_account_id FROM chart_of_accounts WHERE account_code = '1000' LIMIT 1;
    SELECT id INTO ap_account_id FROM chart_of_accounts WHERE account_code = '2000' LIMIT 1;
    
    -- Skip if accounts don't exist
    IF cash_account_id IS NULL OR ap_account_id IS NULL THEN
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
      NEW.payment_date,
      'Supplier Payment - ' || NEW.payment_number,
      'supplier_payment',
      NEW.payment_number,
      'posted',
      NEW.amount,
      NEW.amount
    )
    RETURNING id INTO entry_id;
    
    -- Create debit line for Accounts Payable
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_id,
      description,
      debit_amount,
      credit_amount
    )
    VALUES (
      entry_id,
      ap_account_id,
      'Payment to supplier: ' || NEW.supplier_name,
      NEW.amount,
      0
    );
    
    -- Create credit line for Cash
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_id,
      description,
      debit_amount,
      credit_amount
    )
    VALUES (
      entry_id,
      cash_account_id,
      'Cash paid to supplier',
      0,
      NEW.amount
    );
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function to create journal entry for expense
CREATE OR REPLACE FUNCTION public.create_expense_journal_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  entry_id UUID;
  entry_num TEXT;
  cash_account_id UUID;
  expense_account_id UUID;
  expense_account_code TEXT;
BEGIN
  -- Only process when expense is paid
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    
    -- Map expense type to account code
    expense_account_code := CASE NEW.expense_type
      WHEN 'office_supplies' THEN '5100'
      WHEN 'utilities' THEN '5200'
      WHEN 'rent' THEN '5300'
      WHEN 'salaries' THEN '5400'
      WHEN 'transportation' THEN '5500'
      WHEN 'maintenance' THEN '5600'
      WHEN 'insurance' THEN '5700'
      WHEN 'miscellaneous' THEN '5800'
      ELSE '5800'
    END;
    
    -- Get account IDs
    SELECT id INTO cash_account_id FROM chart_of_accounts WHERE account_code = '1000' LIMIT 1;
    SELECT id INTO expense_account_id FROM chart_of_accounts WHERE account_code = expense_account_code LIMIT 1;
    
    -- Skip if accounts don't exist
    IF cash_account_id IS NULL OR expense_account_id IS NULL THEN
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
      NEW.expense_date,
      'Expense - ' || NEW.expense_number || ': ' || NEW.description,
      'expense',
      NEW.expense_number,
      'posted',
      NEW.amount,
      NEW.amount
    )
    RETURNING id INTO entry_id;
    
    -- Create debit line for Expense
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_id,
      description,
      debit_amount,
      credit_amount
    )
    VALUES (
      entry_id,
      expense_account_id,
      NEW.description,
      NEW.amount,
      0
    );
    
    -- Create credit line for Cash
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_id,
      description,
      debit_amount,
      credit_amount
    )
    VALUES (
      entry_id,
      cash_account_id,
      'Cash paid for expense',
      0,
      NEW.amount
    );
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers for transaction journal entries
DROP TRIGGER IF EXISTS auto_create_cash_receipt_journal_entry ON cash_receipts;
CREATE TRIGGER auto_create_cash_receipt_journal_entry
  AFTER INSERT OR UPDATE ON cash_receipts
  FOR EACH ROW
  EXECUTE FUNCTION create_cash_receipt_journal_entry();

DROP TRIGGER IF EXISTS auto_create_supplier_payment_journal_entry ON supplier_payments;
CREATE TRIGGER auto_create_supplier_payment_journal_entry
  AFTER INSERT OR UPDATE ON supplier_payments
  FOR EACH ROW
  EXECUTE FUNCTION create_supplier_payment_journal_entry();

DROP TRIGGER IF EXISTS auto_create_expense_journal_entry ON expenses;
CREATE TRIGGER auto_create_expense_journal_entry
  AFTER INSERT OR UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION create_expense_journal_entry();

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_cash_receipts_updated_at ON cash_receipts;
CREATE TRIGGER update_cash_receipts_updated_at
  BEFORE UPDATE ON cash_receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_supplier_payments_updated_at ON supplier_payments;
CREATE TRIGGER update_supplier_payments_updated_at
  BEFORE UPDATE ON supplier_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cash_receipts_customer_id ON cash_receipts(customer_id);
CREATE INDEX IF NOT EXISTS idx_cash_receipts_order_id ON cash_receipts(order_id);
CREATE INDEX IF NOT EXISTS idx_cash_receipts_status ON cash_receipts(status);
CREATE INDEX IF NOT EXISTS idx_cash_receipts_date ON cash_receipts(receipt_date);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_purchase_id ON supplier_payments(purchase_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_status ON supplier_payments(status);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_date ON supplier_payments(payment_date);

CREATE INDEX IF NOT EXISTS idx_expenses_type ON expenses(expense_type);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);