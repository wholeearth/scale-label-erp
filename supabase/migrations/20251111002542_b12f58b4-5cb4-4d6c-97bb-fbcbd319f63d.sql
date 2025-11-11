-- Fix search path for generate_purchase_number function
CREATE OR REPLACE FUNCTION generate_purchase_number()
RETURNS TEXT 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;