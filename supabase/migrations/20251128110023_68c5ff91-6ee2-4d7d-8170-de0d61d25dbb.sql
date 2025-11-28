-- Add item_id to shift_raw_material_consumption to track which item was consumed
ALTER TABLE shift_raw_material_consumption
ADD COLUMN item_id uuid REFERENCES items(id);

-- Add index for better query performance
CREATE INDEX idx_shift_raw_material_consumption_item_id 
ON shift_raw_material_consumption(item_id);