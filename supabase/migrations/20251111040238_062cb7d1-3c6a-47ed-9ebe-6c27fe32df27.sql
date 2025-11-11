-- Add commission_agent role to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'commission_agent';

-- Create commission_agents table
CREATE TABLE IF NOT EXISTS public.commission_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_code TEXT NOT NULL UNIQUE,
  agent_name TEXT NOT NULL,
  contact_phone TEXT,
  contact_email TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create commission_structures table for item-specific commission rates
CREATE TABLE IF NOT EXISTS public.commission_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.commission_agents(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
  commission_type TEXT NOT NULL CHECK (commission_type IN ('percentage', 'per_kg', 'per_yard', 'per_meter', 'fixed')),
  commission_rate NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create commission_transactions table
CREATE TABLE IF NOT EXISTS public.commission_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.commission_agents(id) ON DELETE CASCADE NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('commission_earned', 'commission_paid', 'receipt_collected', 'receipt_paid')),
  reference_type TEXT,
  reference_id UUID,
  reference_number TEXT,
  amount NUMERIC NOT NULL,
  description TEXT,
  transaction_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Add commission_agent_id to customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS commission_agent_id UUID REFERENCES public.commission_agents(id);

-- Create commission_agent_receipts_account table to track money held by agents
CREATE TABLE IF NOT EXISTS public.commission_agent_receipts_account (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.commission_agents(id) ON DELETE CASCADE NOT NULL UNIQUE,
  account_id UUID REFERENCES public.chart_of_accounts(id),
  current_balance NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.commission_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_agent_receipts_account ENABLE ROW LEVEL SECURITY;

-- RLS Policies for commission_agents
CREATE POLICY "Admins can manage commission agents"
ON public.commission_agents FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Commission agents can view own profile"
ON public.commission_agents FOR SELECT
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for commission_structures
CREATE POLICY "Admins can manage commission structures"
ON public.commission_structures FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Commission agents can view own structures"
ON public.commission_structures FOR SELECT
USING (
  agent_id IN (SELECT id FROM commission_agents WHERE user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- RLS Policies for commission_transactions
CREATE POLICY "Admins can manage all commission transactions"
ON public.commission_transactions FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Commission agents can view own transactions"
ON public.commission_transactions FOR SELECT
USING (
  agent_id IN (SELECT id FROM commission_agents WHERE user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Commission agents can create receipt transactions"
ON public.commission_transactions FOR INSERT
WITH CHECK (
  transaction_type IN ('receipt_collected', 'receipt_paid')
  AND agent_id IN (SELECT id FROM commission_agents WHERE user_id = auth.uid())
);

-- RLS Policies for commission_agent_receipts_account
CREATE POLICY "Admins can manage agent receipt accounts"
ON public.commission_agent_receipts_account FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Commission agents can view own receipt account"
ON public.commission_agent_receipts_account FOR SELECT
USING (
  agent_id IN (SELECT id FROM commission_agents WHERE user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Create indexes
CREATE INDEX idx_commission_agents_user_id ON commission_agents(user_id);
CREATE INDEX idx_commission_structures_agent_id ON commission_structures(agent_id);
CREATE INDEX idx_commission_transactions_agent_id ON commission_transactions(agent_id);
CREATE INDEX idx_customers_commission_agent_id ON customers(commission_agent_id);

-- Create triggers for updated_at
CREATE TRIGGER update_commission_agents_updated_at
BEFORE UPDATE ON commission_agents
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_commission_agent_receipts_account_updated_at
BEFORE UPDATE ON commission_agent_receipts_account
FOR EACH ROW EXECUTE FUNCTION update_updated_at();