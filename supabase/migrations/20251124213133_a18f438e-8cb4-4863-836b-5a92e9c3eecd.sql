-- Create function to process raw material consumption and reduce inventory
CREATE OR REPLACE FUNCTION public.process_raw_material_consumption()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  source_production_record RECORD;
  consumed_item_id UUID;
BEGIN
  -- Find the source production record by serial number
  SELECT pr.*, pr.item_id 
  INTO source_production_record
  FROM production_records pr
  WHERE pr.serial_number = NEW.consumed_serial_number
  LIMIT 1;

  -- If source production record not found, log warning but don't fail
  IF source_production_record.id IS NULL THEN
    RAISE WARNING 'Source production record not found for serial number: %', NEW.consumed_serial_number;
    RETURN NEW;
  END IF;

  consumed_item_id := source_production_record.item_id;

  -- Create inventory consumption transaction to reduce stock
  INSERT INTO inventory (
    item_id,
    production_record_id,
    reference_id,
    transaction_type,
    quantity,
    weight_kg
  )
  VALUES (
    consumed_item_id,
    source_production_record.id,
    NEW.production_record_id,
    'consumption',
    -1, -- Negative quantity to reduce stock
    -(COALESCE(NEW.consumed_weight_kg, 0)) -- Negative weight to reduce stock
  );

  RAISE LOG 'Inventory reduced for serial %: item=%, weight=%kg, length=%yds', 
    NEW.consumed_serial_number,
    consumed_item_id,
    NEW.consumed_weight_kg,
    NEW.consumed_length_yards;

  RETURN NEW;
END;
$$;

-- Create trigger to automatically process consumption when recorded
DROP TRIGGER IF EXISTS trigger_process_raw_material_consumption ON raw_material_consumption;

CREATE TRIGGER trigger_process_raw_material_consumption
  AFTER INSERT ON raw_material_consumption
  FOR EACH ROW
  EXECUTE FUNCTION process_raw_material_consumption();

-- Add comment for documentation
COMMENT ON FUNCTION process_raw_material_consumption() IS 
  'Automatically reduces inventory stock levels when raw materials (jumbo rolls) are consumed during production. 
   Triggered after insert on raw_material_consumption table.';

-- Create index for faster serial number lookups
CREATE INDEX IF NOT EXISTS idx_production_records_serial_number 
  ON production_records(serial_number);