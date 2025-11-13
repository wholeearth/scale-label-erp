-- Create function to calculate and record commission for sales orders
CREATE OR REPLACE FUNCTION public.calculate_order_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  agent_id_val UUID;
  item_record RECORD;
  commission_structure RECORD;
  commission_amount NUMERIC;
  item_data RECORD;
BEGIN
  -- Only process when order is approved or completed
  IF NEW.status IN ('approved', 'completed') AND 
     (OLD.status IS NULL OR OLD.status NOT IN ('approved', 'completed')) THEN
    
    -- Get commission agent ID for this customer
    SELECT commission_agent_id INTO agent_id_val
    FROM customers
    WHERE id = NEW.customer_id;
    
    -- Skip if no commission agent
    IF agent_id_val IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Process each order item
    FOR item_record IN 
      SELECT oi.*, i.weight_kg, i.length_yards, i.product_code, i.product_name
      FROM order_items oi
      JOIN items i ON i.id = oi.item_id
      WHERE oi.order_id = NEW.id
    LOOP
      -- Get commission structure for this agent and item
      SELECT * INTO commission_structure
      FROM commission_structures
      WHERE agent_id = agent_id_val
        AND (item_id = item_record.item_id OR item_id IS NULL)
      ORDER BY item_id NULLS LAST
      LIMIT 1;
      
      -- Skip if no commission structure defined
      IF commission_structure IS NULL THEN
        CONTINUE;
      END IF;
      
      -- Calculate commission based on type
      commission_amount := 0;
      
      IF commission_structure.commission_type = 'weight' THEN
        -- Commission per kg: rate * quantity * weight_kg
        commission_amount := commission_structure.commission_rate * 
                            item_record.quantity * 
                            COALESCE(item_record.weight_kg, 0);
                            
      ELSIF commission_structure.commission_type = 'length' THEN
        -- Commission per yard/meter: rate * quantity * length
        commission_amount := commission_structure.commission_rate * 
                            item_record.quantity * 
                            COALESCE(item_record.length_yards, 0);
                            
      ELSIF commission_structure.commission_type = 'percentage' THEN
        -- Commission as percentage of sales value: (rate/100) * (quantity * unit_price)
        commission_amount := (commission_structure.commission_rate / 100) * 
                            (item_record.quantity * item_record.unit_price);
                            
      ELSIF commission_structure.commission_type = 'flat' THEN
        -- Flat commission per item: rate * quantity
        commission_amount := commission_structure.commission_rate * item_record.quantity;
      END IF;
      
      -- Create commission transaction if amount > 0
      IF commission_amount > 0 THEN
        INSERT INTO commission_transactions (
          agent_id,
          transaction_type,
          amount,
          transaction_date,
          reference_type,
          reference_id,
          reference_number,
          description,
          created_by
        )
        VALUES (
          agent_id_val,
          'commission_earned',
          commission_amount,
          CURRENT_DATE,
          'order',
          NEW.id,
          NEW.order_number,
          'Commission on ' || item_record.product_name || ' - Order ' || NEW.order_number,
          auth.uid()
        );
      END IF;
    END LOOP;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for commission calculation
DROP TRIGGER IF EXISTS trigger_calculate_order_commission ON public.orders;
CREATE TRIGGER trigger_calculate_order_commission
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_order_commission();