-- Create function to generate invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_number INTEGER;
  invoice_num TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 'INV-(\d+)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM sales_invoices;
  
  invoice_num := 'INV-' || LPAD(next_number::TEXT, 6, '0');
  RETURN invoice_num;
END;
$$;

-- Create sales_invoices table
CREATE TABLE IF NOT EXISTS sales_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT sales_invoices_status_check CHECK (status IN ('draft', 'posted', 'cancelled'))
);

-- Create trigger to auto-generate invoice numbers
CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := generate_invoice_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER before_insert_sales_invoices
  BEFORE INSERT ON sales_invoices
  FOR EACH ROW
  EXECUTE FUNCTION set_invoice_number();

-- Create trigger for updated_at
CREATE TRIGGER update_sales_invoices_updated_at
  BEFORE UPDATE ON sales_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Create index for performance
CREATE INDEX idx_sales_invoices_order_id ON sales_invoices(order_id);
CREATE INDEX idx_sales_invoices_customer_id ON sales_invoices(customer_id);
CREATE INDEX idx_sales_invoices_invoice_date ON sales_invoices(invoice_date);

-- Enable RLS
ALTER TABLE sales_invoices ENABLE ROW LEVEL SECURITY;

-- RLS policies for sales_invoices
CREATE POLICY "Admins and accountants can manage invoices"
  ON sales_invoices
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Customers can view own invoices"
  ON sales_invoices
  FOR SELECT
  USING (
    customer_id IN (
      SELECT id FROM customers WHERE user_id = auth.uid()
    ) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'accountant'::app_role)
  );

CREATE POLICY "Commission agents can view customer invoices"
  ON sales_invoices
  FOR SELECT
  USING (
    customer_id IN (
      SELECT c.id 
      FROM customers c
      JOIN commission_agents a ON a.id = c.commission_agent_id
      WHERE a.user_id = auth.uid()
    ) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'accountant'::app_role)
  );