
-- =========================================================
-- PHASE B: Deliveries, surplus allocation, smart suggestions
-- =========================================================

-- 1) Deliveries
CREATE TABLE IF NOT EXISTS public.deliveries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_number TEXT NOT NULL UNIQUE,
  delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_id UUID NOT NULL,
  order_id UUID,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | delivered | cancelled
  total_amount NUMERIC NOT NULL DEFAULT 0,
  invoice_id UUID,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.delivery_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  item_id UUID NOT NULL,
  order_item_id UUID,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View deliveries" ON public.deliveries
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Manage deliveries" ON public.deliveries
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
    OR public.has_role(auth.uid(), 'sales'::app_role)
    OR public.has_role(auth.uid(), 'production_manager'::app_role)
  ) WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
    OR public.has_role(auth.uid(), 'sales'::app_role)
    OR public.has_role(auth.uid(), 'production_manager'::app_role)
  );

CREATE POLICY "View delivery items" ON public.delivery_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Manage delivery items" ON public.delivery_items
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
    OR public.has_role(auth.uid(), 'sales'::app_role)
    OR public.has_role(auth.uid(), 'production_manager'::app_role)
  ) WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
    OR public.has_role(auth.uid(), 'sales'::app_role)
    OR public.has_role(auth.uid(), 'production_manager'::app_role)
  );

-- Delivery number generator
CREATE OR REPLACE FUNCTION public.generate_delivery_number()
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(delivery_number FROM 'DN-(\d+)') AS INTEGER)), 0) + 1
  INTO next_number FROM deliveries;
  RETURN 'DN-' || LPAD(next_number::TEXT, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.set_delivery_number()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.delivery_number IS NULL OR NEW.delivery_number = '' THEN
    NEW.delivery_number := public.generate_delivery_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_delivery_number ON public.deliveries;
CREATE TRIGGER trg_set_delivery_number
  BEFORE INSERT ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.set_delivery_number();

-- updated_at
DROP TRIGGER IF EXISTS trg_deliveries_updated ON public.deliveries;
CREATE TRIGGER trg_deliveries_updated
  BEFORE UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2) Surplus allocations
CREATE TABLE IF NOT EXISTS public.surplus_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL,
  source_shift_machine_production_id UUID,
  source_order_id UUID,
  target_order_id UUID,
  target_order_item_id UUID,
  quantity NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'suggested', -- suggested | applied | cancelled
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.surplus_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View surplus allocations" ON public.surplus_allocations
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Manage surplus allocations" ON public.surplus_allocations
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'production_manager'::app_role)
  ) WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'production_manager'::app_role)
  );

DROP TRIGGER IF EXISTS trg_surplus_alloc_updated ON public.surplus_allocations;
CREATE TRIGGER trg_surplus_alloc_updated
  BEFORE UPDATE ON public.surplus_allocations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3) Extend shift_machine_production trigger to suggest surplus allocations
CREATE OR REPLACE FUNCTION public.process_shift_machine_production()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  assignment RECORD;
  order_item_planned NUMERIC;
  order_item_produced_now NUMERIC;
  surplus_qty NUMERIC := 0;
  candidate RECORD;
  remaining NUMERIC;
  alloc_qty NUMERIC;
BEGIN
  SELECT * INTO assignment
  FROM public.machine_assignments
  WHERE id = NEW.machine_assignment_id
  FOR UPDATE;

  IF assignment IS NULL THEN
    RAISE EXCEPTION 'machine_assignment % not found', NEW.machine_assignment_id;
  END IF;

  UPDATE public.machine_assignments
  SET produced_quantity = COALESCE(produced_quantity, 0) + NEW.quantity_produced,
      status = CASE
        WHEN COALESCE(produced_quantity, 0) + NEW.quantity_produced >= planned_quantity THEN 'completed'
        WHEN status = 'planned' THEN 'in_progress'
        ELSE status
      END,
      updated_at = now()
  WHERE id = NEW.machine_assignment_id;

  UPDATE public.order_items
  SET produced_quantity = COALESCE(produced_quantity, 0) + NEW.quantity_produced
  WHERE id = assignment.order_item_id
  RETURNING quantity, produced_quantity INTO order_item_planned, order_item_produced_now;

  IF order_item_produced_now IS NOT NULL AND order_item_produced_now > order_item_planned THEN
    surplus_qty := LEAST(NEW.quantity_produced, order_item_produced_now - order_item_planned);
    IF surplus_qty > 0 THEN
      INSERT INTO public.inventory (item_id, reference_id, transaction_type, quantity, weight_kg)
      VALUES (NEW.item_id, NEW.id, 'surplus_production', surplus_qty, NULL);

      remaining := surplus_qty;

      -- Suggest allocation to oldest pending orders for same item (excluding source order)
      FOR candidate IN
        SELECT oi.id AS order_item_id, oi.order_id, oi.quantity, COALESCE(oi.produced_quantity,0) AS produced_quantity, o.created_at
        FROM public.order_items oi
        JOIN public.orders o ON o.id = oi.order_id
        WHERE oi.item_id = NEW.item_id
          AND oi.order_id <> assignment.order_id
          AND o.status IN ('pending','approved')
          AND COALESCE(oi.produced_quantity,0) < oi.quantity
        ORDER BY o.created_at ASC
      LOOP
        EXIT WHEN remaining <= 0;
        alloc_qty := LEAST(remaining, candidate.quantity - candidate.produced_quantity);
        IF alloc_qty > 0 THEN
          INSERT INTO public.surplus_allocations (
            item_id, source_shift_machine_production_id, source_order_id,
            target_order_id, target_order_item_id, quantity, status, notes
          ) VALUES (
            NEW.item_id, NEW.id, assignment.order_id,
            candidate.order_id, candidate.order_item_id, alloc_qty, 'suggested',
            'Auto-suggested from surplus production'
          );
          remaining := remaining - alloc_qty;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 4) Trigger: when delivery is marked delivered, create draft invoice + reduce stock
CREATE OR REPLACE FUNCTION public.process_delivery_completion()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  inv_id UUID;
  inv_num TEXT;
  di RECORD;
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status <> 'delivered') THEN
    -- Create draft sales invoice
    inv_num := public.generate_invoice_number();
    INSERT INTO public.sales_invoices (
      invoice_number, invoice_date, customer_id, order_id,
      status, total_amount, notes, created_by
    ) VALUES (
      inv_num, NEW.delivery_date, NEW.customer_id, NEW.order_id,
      'draft', NEW.total_amount,
      'Auto-generated from delivery ' || NEW.delivery_number,
      NEW.created_by
    ) RETURNING id INTO inv_id;

    UPDATE public.deliveries SET invoice_id = inv_id WHERE id = NEW.id;

    -- Reduce inventory per delivery item
    FOR di IN SELECT * FROM public.delivery_items WHERE delivery_id = NEW.id LOOP
      INSERT INTO public.inventory (item_id, reference_id, transaction_type, quantity, weight_kg)
      VALUES (di.item_id, NEW.id, 'delivery', -di.quantity, NULL);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_delivery_completion ON public.deliveries;
CREATE TRIGGER trg_delivery_completion
  AFTER UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.process_delivery_completion();

-- 5) Helper: surplus stock available for an item
CREATE OR REPLACE FUNCTION public.get_item_surplus_stock(_item_id UUID)
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(SUM(
    CASE
      WHEN transaction_type = 'surplus_production' THEN quantity
      WHEN transaction_type = 'delivery' THEN quantity  -- already negative
      ELSE 0
    END
  ), 0)
  - COALESCE((
    SELECT SUM(quantity) FROM public.surplus_allocations
    WHERE item_id = _item_id AND status = 'applied'
  ), 0)
  FROM public.inventory
  WHERE item_id = _item_id;
$$;

-- 6) Helper: suggested production for next order
CREATE OR REPLACE FUNCTION public.get_suggested_production(_item_id UUID, _order_qty NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  surplus NUMERIC;
  suggested NUMERIC;
BEGIN
  surplus := GREATEST(public.get_item_surplus_stock(_item_id), 0);
  suggested := GREATEST(_order_qty - surplus, 0);
  RETURN jsonb_build_object('surplus_available', surplus, 'suggested_qty', suggested);
END;
$$;

-- 7) Machine performance aggregator
CREATE OR REPLACE FUNCTION public.get_machine_performance(_from DATE, _to DATE)
RETURNS TABLE (
  machine_id UUID,
  machine_name TEXT,
  machine_code TEXT,
  total_produced NUMERIC,
  shifts_count BIGINT,
  assignments_count BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.id, m.machine_name, m.machine_code,
    COALESCE(SUM(smp.quantity_produced), 0) AS total_produced,
    COUNT(DISTINCT smp.shift_record_id) AS shifts_count,
    COUNT(DISTINCT smp.machine_assignment_id) AS assignments_count
  FROM public.machines m
  LEFT JOIN public.shift_machine_production smp
    ON smp.machine_id = m.id
   AND smp.created_at::date BETWEEN _from AND _to
  GROUP BY m.id, m.machine_name, m.machine_code
  ORDER BY total_produced DESC;
$$;

-- Audit log triggers for new tables
DROP TRIGGER IF EXISTS trg_audit_deliveries ON public.deliveries;
CREATE TRIGGER trg_audit_deliveries
  AFTER INSERT OR UPDATE OR DELETE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.log_production_audit();

DROP TRIGGER IF EXISTS trg_audit_surplus_alloc ON public.surplus_allocations;
CREATE TRIGGER trg_audit_surplus_alloc
  AFTER INSERT OR UPDATE OR DELETE ON public.surplus_allocations
  FOR EACH ROW EXECUTE FUNCTION public.log_production_audit();
