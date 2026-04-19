-- 1. machine_assignments
CREATE TABLE public.machine_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL,
  order_item_id UUID NOT NULL,
  machine_id UUID NOT NULL,
  item_id UUID NOT NULL,
  planned_quantity NUMERIC NOT NULL CHECK (planned_quantity > 0),
  produced_quantity NUMERIC NOT NULL DEFAULT 0,
  priority INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  planned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','completed','cancelled')),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ma_order ON public.machine_assignments(order_id);
CREATE INDEX idx_ma_machine_status ON public.machine_assignments(machine_id, status);
CREATE INDEX idx_ma_planned_date ON public.machine_assignments(planned_date);

ALTER TABLE public.machine_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and PM manage machine assignments"
  ON public.machine_assignments FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'production_manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'production_manager'::app_role));

CREATE POLICY "Authenticated users can view machine assignments"
  ON public.machine_assignments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE TRIGGER trg_ma_updated_at
  BEFORE UPDATE ON public.machine_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2. Add machine_id to shift_records (nullable for back-compat)
ALTER TABLE public.shift_records
  ADD COLUMN IF NOT EXISTS machine_id UUID;

-- 3. shift_machine_production
CREATE TABLE public.shift_machine_production (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_record_id UUID NOT NULL,
  machine_assignment_id UUID NOT NULL,
  machine_id UUID NOT NULL,
  order_id UUID NOT NULL,
  item_id UUID NOT NULL,
  operator_id UUID,
  quantity_produced NUMERIC NOT NULL CHECK (quantity_produced > 0),
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_smp_shift ON public.shift_machine_production(shift_record_id);
CREATE INDEX idx_smp_assignment ON public.shift_machine_production(machine_assignment_id);
CREATE INDEX idx_smp_machine ON public.shift_machine_production(machine_id);
CREATE INDEX idx_smp_order ON public.shift_machine_production(order_id);

ALTER TABLE public.shift_machine_production ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins, PM, accountants manage shift machine production"
  ON public.shift_machine_production FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'production_manager'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'production_manager'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
  );

CREATE POLICY "Operators can insert their own shift machine production"
  ON public.shift_machine_production FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.has_role(auth.uid(), 'operator'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.shift_records sr
      WHERE sr.id = shift_machine_production.shift_record_id
        AND sr.operator_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can view shift machine production"
  ON public.shift_machine_production FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE TRIGGER trg_smp_updated_at
  BEFORE UPDATE ON public.shift_machine_production
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 4. production_audit_log
CREATE TABLE public.production_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  changed_by UUID,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pal_entity ON public.production_audit_log(entity_type, entity_id);
CREATE INDEX idx_pal_created ON public.production_audit_log(created_at DESC);

ALTER TABLE public.production_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and PM can view audit log"
  ON public.production_audit_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'production_manager'::app_role));

-- 5. Trigger: when shift_machine_production is inserted -> update assignment, order_item, surplus inventory
CREATE OR REPLACE FUNCTION public.process_shift_machine_production()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assignment RECORD;
  order_item_planned NUMERIC;
  order_item_produced_now NUMERIC;
  surplus_qty NUMERIC := 0;
BEGIN
  -- Lock and read the assignment
  SELECT * INTO assignment
  FROM public.machine_assignments
  WHERE id = NEW.machine_assignment_id
  FOR UPDATE;

  IF assignment IS NULL THEN
    RAISE EXCEPTION 'machine_assignment % not found', NEW.machine_assignment_id;
  END IF;

  -- Update produced_quantity on assignment
  UPDATE public.machine_assignments
  SET produced_quantity = COALESCE(produced_quantity, 0) + NEW.quantity_produced,
      status = CASE
        WHEN COALESCE(produced_quantity, 0) + NEW.quantity_produced >= planned_quantity THEN 'completed'
        WHEN status = 'planned' THEN 'in_progress'
        ELSE status
      END,
      updated_at = now()
  WHERE id = NEW.machine_assignment_id;

  -- Update order_item.produced_quantity
  UPDATE public.order_items
  SET produced_quantity = COALESCE(produced_quantity, 0) + NEW.quantity_produced
  WHERE id = assignment.order_item_id
  RETURNING quantity, produced_quantity INTO order_item_planned, order_item_produced_now;

  -- Surplus detection: if produced now exceeds planned for this order_item, log surplus inventory
  IF order_item_produced_now IS NOT NULL AND order_item_produced_now > order_item_planned THEN
    surplus_qty := LEAST(NEW.quantity_produced, order_item_produced_now - order_item_planned);
    IF surplus_qty > 0 THEN
      INSERT INTO public.inventory (item_id, reference_id, transaction_type, quantity, weight_kg)
      VALUES (NEW.item_id, NEW.id, 'surplus_production', surplus_qty, NULL);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_process_shift_machine_production
  AFTER INSERT ON public.shift_machine_production
  FOR EACH ROW EXECUTE FUNCTION public.process_shift_machine_production();

-- 6. Audit triggers
CREATE OR REPLACE FUNCTION public.log_production_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.production_audit_log(entity_type, entity_id, action, changed_by, old_data, new_data)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    auth.uid(),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_audit_machine_assignments
  AFTER INSERT OR UPDATE OR DELETE ON public.machine_assignments
  FOR EACH ROW EXECUTE FUNCTION public.log_production_audit();

CREATE TRIGGER trg_audit_shift_machine_production
  AFTER INSERT OR UPDATE OR DELETE ON public.shift_machine_production
  FOR EACH ROW EXECUTE FUNCTION public.log_production_audit();