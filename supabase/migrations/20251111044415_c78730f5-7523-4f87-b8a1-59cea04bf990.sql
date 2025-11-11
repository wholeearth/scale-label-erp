-- Helper function to check if a customer belongs to the current commission agent
CREATE OR REPLACE FUNCTION public.is_customer_of_current_agent(cust_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.customers c
    JOIN public.commission_agents a ON a.id = c.commission_agent_id
    WHERE c.id = cust_id
      AND a.user_id = auth.uid()
  );
$$;

-- Orders: broaden INSERT policy to use helper function
DROP POLICY IF EXISTS "Customers and commission agents can create orders" ON public.orders;

CREATE POLICY "Customers and commission agents can create orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  -- Customers inserting their own orders
  EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = orders.customer_id
      AND c.user_id = auth.uid()
  )
  OR
  -- Commission agents inserting for their associated customers
  public.is_customer_of_current_agent(orders.customer_id)
);

-- Order items: broaden INSERT policy similarly using helper
DROP POLICY IF EXISTS "Customers and commission agents can create order items" ON public.order_items;

CREATE POLICY "Customers and commission agents can create order items"
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (
  -- Customer creating items for their own order
  EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.customers c ON c.id = o.customer_id
    WHERE o.id = order_items.order_id
      AND c.user_id = auth.uid()
  )
  OR
  -- Commission agent creating items for orders of their associated customers
  EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = order_items.order_id
      AND public.is_customer_of_current_agent(o.customer_id)
  )
);