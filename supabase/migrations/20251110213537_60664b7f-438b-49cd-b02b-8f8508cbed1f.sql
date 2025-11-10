-- Drop the old constraint
ALTER TABLE orders DROP CONSTRAINT orders_status_check;

-- Add new constraint with all status values including approved and rejected
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'in_production'::text, 'completed'::text, 'cancelled'::text]));