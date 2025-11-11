-- Drop existing policy
DROP POLICY IF EXISTS "Customers can view assigned products" ON customer_products;

-- Create updated policy that includes commission agents
CREATE POLICY "Customers, sales, and commission agents can view assigned products"
ON customer_products
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'sales'::app_role) 
  OR (EXISTS (
    SELECT 1 FROM customers 
    WHERE customers.id = customer_products.customer_id 
    AND customers.user_id = auth.uid()
  ))
  OR (EXISTS (
    SELECT 1 FROM customers 
    WHERE customers.id = customer_products.customer_id 
    AND customers.commission_agent_id IN (
      SELECT id FROM commission_agents WHERE user_id = auth.uid()
    )
  ))
);