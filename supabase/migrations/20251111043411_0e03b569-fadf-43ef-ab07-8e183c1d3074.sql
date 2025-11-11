-- Update orders INSERT policy to include commission agents
DROP POLICY IF EXISTS "Customers can create orders" ON orders;

CREATE POLICY "Customers and commission agents can create orders"
ON orders
FOR INSERT
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM customers 
    WHERE customers.id = orders.customer_id 
    AND customers.user_id = auth.uid()
  ))
  OR (EXISTS (
    SELECT 1 FROM customers 
    WHERE customers.id = orders.customer_id 
    AND customers.commission_agent_id IN (
      SELECT id FROM commission_agents WHERE user_id = auth.uid()
    )
  ))
);

-- Update order_items INSERT policy to include commission agents
DROP POLICY IF EXISTS "Customers can create order items for own orders" ON order_items;

CREATE POLICY "Customers and commission agents can create order items"
ON order_items
FOR INSERT
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM orders
    JOIN customers ON customers.id = orders.customer_id
    WHERE orders.id = order_items.order_id 
    AND customers.user_id = auth.uid()
  ))
  OR (EXISTS (
    SELECT 1 FROM orders
    JOIN customers ON customers.id = orders.customer_id
    WHERE orders.id = order_items.order_id 
    AND customers.commission_agent_id IN (
      SELECT id FROM commission_agents WHERE user_id = auth.uid()
    )
  ))
);