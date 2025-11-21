-- Add 'invoiced' status to orders status check constraint
ALTER TABLE public.orders 
DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders 
ADD CONSTRAINT orders_status_check 
CHECK (status IN ('pending', 'approved', 'rejected', 'in_production', 'completed', 'cancelled', 'invoiced'));