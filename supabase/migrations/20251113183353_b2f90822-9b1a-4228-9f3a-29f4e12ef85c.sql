-- Update the orders SELECT policy to include commission agents
DROP POLICY IF EXISTS "Users can view relevant orders" ON public.orders;

CREATE POLICY "Users can view relevant orders"
ON public.orders
FOR SELECT
USING (
  -- Admins, sales, and production managers can view all orders
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'sales'::app_role) 
  OR has_role(auth.uid(), 'production_manager'::app_role)
  OR 
  -- Customers can view their own orders
  EXISTS (
    SELECT 1
    FROM customers
    WHERE customers.id = orders.customer_id 
      AND customers.user_id = auth.uid()
  )
  OR
  -- Commission agents can view orders for their associated customers
  EXISTS (
    SELECT 1
    FROM customers c
    JOIN commission_agents a ON a.id = c.commission_agent_id
    WHERE c.id = orders.customer_id
      AND a.user_id = auth.uid()
  )
);