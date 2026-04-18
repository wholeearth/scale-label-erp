-- Yearly sequence counter for fiber bag IDs (silent yearly reset)
CREATE TABLE public.fiber_bag_yearly_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL UNIQUE,
  sequence_count BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fiber_bag_yearly_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view fiber bag sequences"
  ON public.fiber_bag_yearly_sequences FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage fiber bag sequences"
  ON public.fiber_bag_yearly_sequences FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Fiber bags / bales table
CREATE TABLE public.fiber_bags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unique_id TEXT NOT NULL UNIQUE,
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  purchase_item_id UUID NOT NULL REFERENCES public.purchase_items(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id),
  bag_serial INTEGER NOT NULL,
  pack_type TEXT NOT NULL DEFAULT 'bag' CHECK (pack_type IN ('bag','bale')),
  original_weight_kg NUMERIC NOT NULL CHECK (original_weight_kg > 0),
  consumed_weight_kg NUMERIC NOT NULL DEFAULT 0 CHECK (consumed_weight_kg >= 0),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','partial','used')),
  supplier_name TEXT NOT NULL,
  purchase_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fiber_bags_unique_id ON public.fiber_bags(unique_id);
CREATE INDEX idx_fiber_bags_status ON public.fiber_bags(status);
CREATE INDEX idx_fiber_bags_item_id ON public.fiber_bags(item_id);
CREATE INDEX idx_fiber_bags_purchase_id ON public.fiber_bags(purchase_id);
CREATE INDEX idx_fiber_bags_supplier ON public.fiber_bags(supplier_name);

ALTER TABLE public.fiber_bags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view fiber bags"
  ON public.fiber_bags FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and accountants can manage fiber bags"
  ON public.fiber_bags FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accountant'::app_role));

-- Consumption tracking (used in Phase 2)
CREATE TABLE public.fiber_bag_consumption (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiber_bag_id UUID NOT NULL REFERENCES public.fiber_bags(id) ON DELETE CASCADE,
  production_record_id UUID REFERENCES public.production_records(id) ON DELETE SET NULL,
  shift_record_id UUID REFERENCES public.shift_records(id) ON DELETE SET NULL,
  consumed_weight_kg NUMERIC NOT NULL CHECK (consumed_weight_kg > 0),
  consumed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fbc_bag ON public.fiber_bag_consumption(fiber_bag_id);
CREATE INDEX idx_fbc_production ON public.fiber_bag_consumption(production_record_id);
CREATE INDEX idx_fbc_shift ON public.fiber_bag_consumption(shift_record_id);

ALTER TABLE public.fiber_bag_consumption ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view fiber bag consumption"
  ON public.fiber_bag_consumption FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Operators, PM, accountants, admins can record fiber consumption"
  ON public.fiber_bag_consumption FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'operator'::app_role) OR
      has_role(auth.uid(), 'production_manager'::app_role) OR
      has_role(auth.uid(), 'accountant'::app_role)
    )
  );

CREATE POLICY "Admins can manage fiber bag consumption"
  ON public.fiber_bag_consumption FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Generate next fiber bag unique_id: <6-digit yearly seq><product_code>
CREATE OR REPLACE FUNCTION public.generate_fiber_bag_id(_product_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  next_seq BIGINT;
BEGIN
  INSERT INTO public.fiber_bag_yearly_sequences(year, sequence_count)
  VALUES (current_year, 1)
  ON CONFLICT (year) DO UPDATE
    SET sequence_count = public.fiber_bag_yearly_sequences.sequence_count + 1,
        updated_at = now()
  RETURNING sequence_count INTO next_seq;

  RETURN LPAD(next_seq::TEXT, 6, '0') || _product_code;
END;
$$;

-- Trigger: keep consumed_weight_kg + status in sync on fiber_bags
CREATE OR REPLACE FUNCTION public.sync_fiber_bag_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_consumed NUMERIC;
  original NUMERIC;
BEGIN
  SELECT COALESCE(SUM(consumed_weight_kg), 0) INTO total_consumed
  FROM public.fiber_bag_consumption WHERE fiber_bag_id = NEW.fiber_bag_id;

  SELECT original_weight_kg INTO original
  FROM public.fiber_bags WHERE id = NEW.fiber_bag_id;

  IF total_consumed > original THEN
    RAISE EXCEPTION 'Consumption (%) exceeds original weight (%) for fiber bag', total_consumed, original;
  END IF;

  UPDATE public.fiber_bags
  SET consumed_weight_kg = total_consumed,
      status = CASE
        WHEN total_consumed >= original THEN 'used'
        WHEN total_consumed > 0 THEN 'partial'
        ELSE 'available'
      END,
      updated_at = now()
  WHERE id = NEW.fiber_bag_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_fiber_bag_status
AFTER INSERT ON public.fiber_bag_consumption
FOR EACH ROW EXECUTE FUNCTION public.sync_fiber_bag_status();

-- updated_at trigger for fiber_bags
CREATE TRIGGER trg_fiber_bags_updated_at
BEFORE UPDATE ON public.fiber_bags
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();