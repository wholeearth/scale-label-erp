-- Drop the old check constraint
ALTER TABLE public.items DROP CONSTRAINT items_item_type_check;

-- Add new check constraint with intermediate product types
ALTER TABLE public.items ADD CONSTRAINT items_item_type_check 
CHECK (item_type = ANY (ARRAY['raw_material'::text, 'finished_good'::text, 'intermediate_type_1'::text, 'intermediate_type_2'::text]));