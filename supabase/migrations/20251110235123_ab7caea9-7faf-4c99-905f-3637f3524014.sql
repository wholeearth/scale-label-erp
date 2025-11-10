-- Safely add UPDATE policy for operators
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'operator_assignments' 
      AND policyname = 'Operators can update own assignment progress'
  ) THEN
    CREATE POLICY "Operators can update own assignment progress"
    ON public.operator_assignments
    FOR UPDATE
    USING (
      operator_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'production_manager'::app_role)
    )
    WITH CHECK (
      operator_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'production_manager'::app_role)
    );
  END IF;
END $$;

-- Validation trigger to keep progress bounded and monotonic for operators
CREATE OR REPLACE FUNCTION public.validate_assignment_progress()
RETURNS trigger AS $$
BEGIN
  -- Admins/PMs can change anything
  IF public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'production_manager'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Only the owner can update their row
  IF NEW.operator_id <> auth.uid() THEN
    RAISE EXCEPTION 'Operators can only update their own assignments';
  END IF;

  -- Only quantity_produced can change
  IF NEW.item_id <> OLD.item_id OR NEW.operator_id <> OLD.operator_id OR NEW.quantity_assigned <> OLD.quantity_assigned OR NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'Only quantity_produced can be updated by operators';
  END IF;

  -- Enforce 0 <= quantity_produced <= quantity_assigned and non-decreasing
  IF COALESCE(NEW.quantity_produced,0) < COALESCE(OLD.quantity_produced,0) THEN
    RAISE EXCEPTION 'quantity_produced cannot decrease';
  END IF;
  IF COALESCE(NEW.quantity_produced,0) > COALESCE(NEW.quantity_assigned,0) THEN
    RAISE EXCEPTION 'quantity_produced cannot exceed quantity_assigned';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_validate_assignment_progress ON public.operator_assignments;
CREATE TRIGGER trg_validate_assignment_progress
BEFORE UPDATE ON public.operator_assignments
FOR EACH ROW
EXECUTE FUNCTION public.validate_assignment_progress();