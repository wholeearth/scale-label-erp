-- Atomic sequence allocators to prevent duplicate serials under concurrency

-- 1) Global production serial
CREATE OR REPLACE FUNCTION public.next_global_serial()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_next bigint;
BEGIN
  SELECT id INTO v_id FROM public.production_counters LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.production_counters (global_serial, last_updated)
    VALUES (1, now())
    RETURNING global_serial INTO v_next;
    RETURN v_next;
  END IF;

  UPDATE public.production_counters
     SET global_serial = global_serial + 1,
         last_updated  = now()
   WHERE id = v_id
   RETURNING global_serial INTO v_next;

  RETURN v_next;
END;
$$;

-- 2) Per-item serial
CREATE OR REPLACE FUNCTION public.next_item_serial(_item_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next bigint;
BEGIN
  INSERT INTO public.item_counters (item_id, item_serial)
  VALUES (_item_id, 1)
  ON CONFLICT (item_id)
  DO UPDATE SET item_serial = public.item_counters.item_serial + 1
  RETURNING item_serial INTO v_next;

  RETURN v_next;
END;
$$;

-- Ensure unique constraint exists for ON CONFLICT (item_counters.item_id is already unique via FK constraint, but enforce explicitly)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.item_counters'::regclass
      AND contype = 'u'
      AND conname = 'item_counters_item_id_key'
  ) THEN
    BEGIN
      ALTER TABLE public.item_counters ADD CONSTRAINT item_counters_item_id_key UNIQUE (item_id);
    EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
    END;
  END IF;
END$$;

-- 3) Per-operator yearly sequence
CREATE OR REPLACE FUNCTION public.next_operator_yearly_sequence(_operator_id uuid, _year integer)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next bigint;
BEGIN
  INSERT INTO public.operator_yearly_sequences (operator_id, year, sequence_count)
  VALUES (_operator_id, _year, 1)
  ON CONFLICT (operator_id, year)
  DO UPDATE SET sequence_count = public.operator_yearly_sequences.sequence_count + 1,
                updated_at = now()
  RETURNING sequence_count INTO v_next;

  RETURN v_next;
END;
$$;

-- Ensure composite unique constraint for ON CONFLICT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.operator_yearly_sequences'::regclass
      AND contype = 'u'
      AND conname = 'operator_yearly_sequences_operator_year_key'
  ) THEN
    ALTER TABLE public.operator_yearly_sequences
      ADD CONSTRAINT operator_yearly_sequences_operator_year_key UNIQUE (operator_id, year);
  END IF;
END$$;

GRANT EXECUTE ON FUNCTION public.next_global_serial() TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_item_serial(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_operator_yearly_sequence(uuid, integer) TO authenticated;