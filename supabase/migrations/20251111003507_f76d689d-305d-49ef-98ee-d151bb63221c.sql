-- Retry the accounting core migration now that 'accountant' role exists
-- Create account_types enum
DO $$ BEGIN
  CREATE TYPE account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Create chart_of_accounts table
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_code TEXT NOT NULL UNIQUE,
  account_name TEXT NOT NULL,
  account_type account_type NOT NULL,
  parent_account_id UUID REFERENCES public.chart_of_accounts(id),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  opening_balance NUMERIC DEFAULT 0,
  current_balance NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create journal_entries table
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_number TEXT NOT NULL UNIQUE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  reference_number TEXT,
  reference_type TEXT,
  total_debit NUMERIC NOT NULL DEFAULT 0,
  total_credit NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create journal_entry_lines table
CREATE TABLE IF NOT EXISTS public.journal_entry_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id),
  description TEXT,
  debit_amount NUMERIC DEFAULT 0,
  credit_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Check constraints (conditional add)
DO $$ BEGIN
  ALTER TABLE public.journal_entries ADD CONSTRAINT journal_entries_status_check 
    CHECK (status IN ('draft', 'posted', 'void'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.journal_entry_lines ADD CONSTRAINT journal_lines_debit_or_credit_check
    CHECK ((debit_amount > 0 AND credit_amount = 0) OR (credit_amount > 0 AND debit_amount = 0));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Enable RLS
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;

-- RLS Policies (conditional)
DO $$ BEGIN
  CREATE POLICY "Admins and accountants can manage accounts" ON public.chart_of_accounts
    FOR ALL USING (
      has_role(auth.uid(), 'admin') OR 
      has_role(auth.uid(), 'accountant')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "All authenticated users can view accounts" ON public.chart_of_accounts
    FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins and accountants can manage journal entries" ON public.journal_entries
    FOR ALL USING (
      has_role(auth.uid(), 'admin') OR 
      has_role(auth.uid(), 'accountant')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can view posted journal entries" ON public.journal_entries
    FOR SELECT USING (
      status = 'posted' OR 
      has_role(auth.uid(), 'admin') OR 
      has_role(auth.uid(), 'accountant')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins and accountants can manage journal lines" ON public.journal_entry_lines
    FOR ALL USING (
      has_role(auth.uid(), 'admin') OR 
      has_role(auth.uid(), 'accountant')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Triggers for updated_at
DO $$ BEGIN
  CREATE TRIGGER update_chart_of_accounts_updated_at
    BEFORE UPDATE ON public.chart_of_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER update_journal_entries_updated_at
    BEFORE UPDATE ON public.journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_type ON public.chart_of_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_parent ON public.chart_of_accounts(parent_account_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON public.journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON public.journal_entries(status);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account ON public.journal_entry_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_entry ON public.journal_entry_lines(journal_entry_id);

-- Function to generate journal entry number
CREATE OR REPLACE FUNCTION generate_journal_entry_number()
RETURNS TEXT 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  entry_num TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(entry_number FROM 'JE-(\d+)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM journal_entries;
  
  entry_num := 'JE-' || LPAD(next_number::TEXT, 6, '0');
  RETURN entry_num;
END;
$$;

-- Function to update account balances when journal entry is posted
CREATE OR REPLACE FUNCTION update_account_balances()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'posted' AND OLD.status != 'posted' THEN
    UPDATE chart_of_accounts coa
    SET current_balance = coa.current_balance + 
      COALESCE((
        SELECT SUM(
          CASE 
            WHEN coa.account_type IN ('asset', 'expense') 
            THEN jel.debit_amount - jel.credit_amount
            ELSE jel.credit_amount - jel.debit_amount
          END
        )
        FROM journal_entry_lines jel
        WHERE jel.journal_entry_id = NEW.id
        AND jel.account_id = coa.id
      ), 0)
    WHERE coa.id IN (
      SELECT account_id FROM journal_entry_lines WHERE journal_entry_id = NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for account balance updates
DO $$ BEGIN
  CREATE TRIGGER update_balances_on_post
    AFTER UPDATE ON public.journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_account_balances();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed default accounts only if empty
INSERT INTO public.chart_of_accounts (account_code, account_name, account_type, description, opening_balance)
SELECT account_code, account_name, account_type, description, opening_balance
FROM (
  VALUES
  ('1000', 'Assets', 'asset'::account_type, 'Main Asset Account', 0),
  ('1100', 'Current Assets', 'asset'::account_type, 'Assets convertible to cash within one year', 0),
  ('1110', 'Cash', 'asset'::account_type, 'Cash on hand', 0),
  ('1120', 'Bank Accounts', 'asset'::account_type, 'Cash in bank', 0),
  ('1130', 'Accounts Receivable', 'asset'::account_type, 'Money owed by customers', 0),
  ('1140', 'Inventory', 'asset'::account_type, 'Stock and goods for sale', 0),
  ('1200', 'Fixed Assets', 'asset'::account_type, 'Long-term assets', 0),
  ('1210', 'Equipment', 'asset'::account_type, 'Machinery and equipment', 0),
  ('1220', 'Furniture', 'asset'::account_type, 'Office furniture', 0),
  ('1230', 'Vehicles', 'asset'::account_type, 'Company vehicles', 0),
  ('2000', 'Liabilities', 'liability'::account_type, 'Main Liability Account', 0),
  ('2100', 'Current Liabilities', 'liability'::account_type, 'Obligations due within one year', 0),
  ('2110', 'Accounts Payable', 'liability'::account_type, 'Money owed to suppliers', 0),
  ('2120', 'Short-term Loans', 'liability'::account_type, 'Loans due within one year', 0),
  ('2200', 'Long-term Liabilities', 'liability'::account_type, 'Obligations due after one year', 0),
  ('2210', 'Long-term Loans', 'liability'::account_type, 'Loans due after one year', 0),
  ('3000', 'Equity', 'equity'::account_type, 'Owner''s equity', 0),
  ('3100', 'Capital', 'equity'::account_type, 'Owner''s capital investment', 0),
  ('3200', 'Retained Earnings', 'equity'::account_type, 'Accumulated profits', 0),
  ('3300', 'Drawings', 'equity'::account_type, 'Owner withdrawals', 0),
  ('4000', 'Revenue', 'revenue'::account_type, 'Main Revenue Account', 0),
  ('4100', 'Sales Revenue', 'revenue'::account_type, 'Income from sales', 0),
  ('4200', 'Service Revenue', 'revenue'::account_type, 'Income from services', 0),
  ('4300', 'Other Income', 'revenue'::account_type, 'Miscellaneous income', 0),
  ('5000', 'Expenses', 'expense'::account_type, 'Main Expense Account', 0),
  ('5100', 'Cost of Goods Sold', 'expense'::account_type, 'Direct costs of production', 0),
  ('5200', 'Operating Expenses', 'expense'::account_type, 'Business operating costs', 0),
  ('5210', 'Salaries and Wages', 'expense'::account_type, 'Employee compensation', 0),
  ('5220', 'Rent Expense', 'expense'::account_type, 'Rental payments', 0),
  ('5230', 'Utilities', 'expense'::account_type, 'Water, electricity, etc', 0),
  ('5240', 'Office Supplies', 'expense'::account_type, 'Office materials and supplies', 0),
  ('5300', 'Administrative Expenses', 'expense'::account_type, 'Administrative costs', 0),
  ('5400', 'Depreciation', 'expense'::account_type, 'Asset depreciation', 0)
) AS v(account_code, account_name, account_type, description, opening_balance)
WHERE NOT EXISTS (SELECT 1 FROM public.chart_of_accounts);

-- Set parent relationships if not already set
UPDATE public.chart_of_accounts SET parent_account_id = (SELECT id FROM chart_of_accounts WHERE account_code = '1000') WHERE account_code IN ('1100','1200') AND parent_account_id IS NULL;
UPDATE public.chart_of_accounts SET parent_account_id = (SELECT id FROM chart_of_accounts WHERE account_code = '1100') WHERE account_code IN ('1110','1120','1130','1140') AND parent_account_id IS NULL;
UPDATE public.chart_of_accounts SET parent_account_id = (SELECT id FROM chart_of_accounts WHERE account_code = '1200') WHERE account_code IN ('1210','1220','1230') AND parent_account_id IS NULL;
UPDATE public.chart_of_accounts SET parent_account_id = (SELECT id FROM chart_of_accounts WHERE account_code = '2000') WHERE account_code IN ('2100','2200') AND parent_account_id IS NULL;
UPDATE public.chart_of_accounts SET parent_account_id = (SELECT id FROM chart_of_accounts WHERE account_code = '2100') WHERE account_code IN ('2110','2120') AND parent_account_id IS NULL;
UPDATE public.chart_of_accounts SET parent_account_id = (SELECT id FROM chart_of_accounts WHERE account_code = '2200') WHERE account_code IN ('2210') AND parent_account_id IS NULL;
UPDATE public.chart_of_accounts SET parent_account_id = (SELECT id FROM chart_of_accounts WHERE account_code = '3000') WHERE account_code IN ('3100','3200','3300') AND parent_account_id IS NULL;
UPDATE public.chart_of_accounts SET parent_account_id = (SELECT id FROM chart_of_accounts WHERE account_code = '4000') WHERE account_code IN ('4100','4200','4300') AND parent_account_id IS NULL;
UPDATE public.chart_of_accounts SET parent_account_id = (SELECT id FROM chart_of_accounts WHERE account_code = '5000') WHERE account_code IN ('5100','5200','5300','5400') AND parent_account_id IS NULL;
UPDATE public.chart_of_accounts SET parent_account_id = (SELECT id FROM chart_of_accounts WHERE account_code = '5200') WHERE account_code IN ('5210','5220','5230','5240') AND parent_account_id IS NULL;