-- Make consumed_serial_number nullable since some raw materials don't have serial numbers
ALTER TABLE public.shift_raw_material_consumption ALTER COLUMN consumed_serial_number DROP NOT NULL;
ALTER TABLE public.shift_raw_material_consumption ALTER COLUMN consumed_serial_number SET DEFAULT '';