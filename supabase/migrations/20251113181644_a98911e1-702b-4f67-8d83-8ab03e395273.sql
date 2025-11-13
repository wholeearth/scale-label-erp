-- Add explicit policy to allow commission agents to create orders for their associated customers
CREATE POLICY "Agents can create orders for their customers"
ON public.orders
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.customers c
    JOIN public.commission_agents a ON a.id = c.commission_agent_id
    WHERE c.id = orders.customer_id
      AND a.user_id = auth.uid()
  )
);