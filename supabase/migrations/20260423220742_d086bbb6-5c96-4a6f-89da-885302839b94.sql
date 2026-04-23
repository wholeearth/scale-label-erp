-- Helper: determine current shift window ('day' or 'night') based on shift_config
CREATE OR REPLACE FUNCTION public.get_shift_window(_ts timestamptz DEFAULT now())
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg RECORD;
  t time;
BEGIN
  SELECT day_shift_start, day_shift_end INTO cfg FROM public.shift_config LIMIT 1;
  IF NOT FOUND THEN
    -- sensible default: 06:00 - 18:00 = day
    RETURN CASE WHEN (_ts AT TIME ZONE 'UTC')::time BETWEEN time '06:00' AND time '18:00' THEN 'day' ELSE 'night' END;
  END IF;
  t := (_ts AT TIME ZONE 'UTC')::time;
  IF cfg.day_shift_start <= cfg.day_shift_end THEN
    RETURN CASE WHEN t >= cfg.day_shift_start AND t < cfg.day_shift_end THEN 'day' ELSE 'night' END;
  ELSE
    -- wrap-around (unlikely for day shift, defensive)
    RETURN CASE WHEN t >= cfg.day_shift_start OR t < cfg.day_shift_end THEN 'day' ELSE 'night' END;
  END IF;
END;
$$;

-- Helper: check if machine is already locked by another operator's open shift in the same window
CREATE OR REPLACE FUNCTION public.is_machine_locked(_machine_id uuid, _shift_date date, _window text, _exclude_shift_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shift_records sr
    WHERE sr.machine_id = _machine_id
      AND sr.shift_date = _shift_date
      AND sr.shift_end IS NULL
      AND public.get_shift_window(sr.shift_start) = _window
      AND (_exclude_shift_id IS NULL OR sr.id <> _exclude_shift_id)
  );
$$;

-- Trigger: block insert/update of shift_records that would create a conflict
CREATE OR REPLACE FUNCTION public.enforce_machine_shift_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  win text;
BEGIN
  IF NEW.machine_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.shift_end IS NOT NULL THEN
    RETURN NEW; -- closed shift, no lock needed
  END IF;
  win := public.get_shift_window(COALESCE(NEW.shift_start, now()));
  IF public.is_machine_locked(NEW.machine_id, NEW.shift_date, win, NEW.id) THEN
    RAISE EXCEPTION 'MACHINE_LOCKED: This machine is already in use by another operator for the % shift on %', win, NEW.shift_date
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_machine_shift_lock ON public.shift_records;
CREATE TRIGGER trg_enforce_machine_shift_lock
BEFORE INSERT OR UPDATE OF machine_id, shift_end, shift_date, shift_start
ON public.shift_records
FOR EACH ROW
EXECUTE FUNCTION public.enforce_machine_shift_lock();