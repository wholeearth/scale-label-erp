-- Add connection type and serial port configuration to scale_config
ALTER TABLE scale_config 
ADD COLUMN connection_type TEXT DEFAULT 'tcp' CHECK (connection_type IN ('tcp', 'serial')),
ADD COLUMN serial_port TEXT,
ADD COLUMN baud_rate INTEGER DEFAULT 9600,
ADD COLUMN data_bits INTEGER DEFAULT 8 CHECK (data_bits IN (7, 8)),
ADD COLUMN stop_bits INTEGER DEFAULT 1 CHECK (stop_bits IN (1, 2)),
ADD COLUMN parity TEXT DEFAULT 'none' CHECK (parity IN ('none', 'even', 'odd'));

COMMENT ON COLUMN scale_config.connection_type IS 'Connection type: tcp or serial';
COMMENT ON COLUMN scale_config.serial_port IS 'Serial port path (e.g., /dev/ttyUSB0, COM3)';
COMMENT ON COLUMN scale_config.baud_rate IS 'Serial baud rate (default: 9600)';
COMMENT ON COLUMN scale_config.data_bits IS 'Serial data bits (7 or 8)';
COMMENT ON COLUMN scale_config.stop_bits IS 'Serial stop bits (1 or 2)';
COMMENT ON COLUMN scale_config.parity IS 'Serial parity (none, even, odd)';