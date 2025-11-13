-- Drop the redundant policy that might be causing conflicts
DROP POLICY IF EXISTS "Agents can create orders for their customers" ON public.orders;

-- The "Customers and commission agents can create orders" policy already handles this
-- with the is_customer_of_current_agent function, so we don't need a duplicate policy