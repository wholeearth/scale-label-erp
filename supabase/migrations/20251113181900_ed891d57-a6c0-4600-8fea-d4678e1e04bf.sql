-- Replace the insert policy to avoid any function evaluation issues
DROP POLICY IF EXISTS "Customers and commission agents can create orders" ON public.orders;

CREATE POLICY "Customers and agents can create orders"
ON public.orders
FOR INSERT
WITH CHECK (
  -- Customers creating orders for themselves
  EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.id = orders.customer_id
      AND c.user_id = auth.uid()
  )
  OR
  -- Commission agents creating orders for their associated customers
  EXISTS (
    SELECT 1
    FROM public.customers c
    JOIN public.commission_agents a ON a.id = c.commission_agent_id
    WHERE c.id = orders.customer_id
      AND a.user_id = auth.uid()
  )
);