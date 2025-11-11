-- Create purchases table for purchase invoices
CREATE TABLE public.purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_number TEXT NOT NULL UNIQUE,
  supplier_name TEXT NOT NULL,
  supplier_contact TEXT,
  supplier_address TEXT,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create purchase_items table for individual items in a purchase
CREATE TABLE public.purchase_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id),
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add check constraint for purchase status
ALTER TABLE public.purchases ADD CONSTRAINT purchases_status_check 
  CHECK (status IN ('pending', 'approved', 'received', 'cancelled'));

-- Enable RLS on purchases table
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- Admins can manage all purchases
CREATE POLICY "Admins can manage purchases" ON public.purchases
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Enable RLS on purchase_items table
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;

-- Admins can manage all purchase items
CREATE POLICY "Admins can manage purchase items" ON public.purchase_items
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Create trigger for updating updated_at timestamp
CREATE TRIGGER update_purchases_updated_at
  BEFORE UPDATE ON public.purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Create index for faster queries
CREATE INDEX idx_purchases_purchase_number ON public.purchases(purchase_number);
CREATE INDEX idx_purchases_status ON public.purchases(status);
CREATE INDEX idx_purchases_purchase_date ON public.purchases(purchase_date);
CREATE INDEX idx_purchase_items_purchase_id ON public.purchase_items(purchase_id);

-- Create function to generate purchase number
CREATE OR REPLACE FUNCTION generate_purchase_number()
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
  purchase_num TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(purchase_number FROM 'PO-(\d+)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM purchases;
  
  purchase_num := 'PO-' || LPAD(next_number::TEXT, 6, '0');
  RETURN purchase_num;
END;
$$ LANGUAGE plpgsql;