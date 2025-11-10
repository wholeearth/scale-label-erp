-- Enable realtime for production_records table
ALTER PUBLICATION supabase_realtime ADD TABLE production_records;

-- Enable realtime for inventory table
ALTER PUBLICATION supabase_realtime ADD TABLE inventory;

-- Enable realtime for operator_assignments table
ALTER PUBLICATION supabase_realtime ADD TABLE operator_assignments;