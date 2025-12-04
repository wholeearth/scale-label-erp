import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Save, Wifi, WifiOff, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ScaleTestResult {
  weight: number;
  unit: string;
  mock?: boolean;
  error?: string;
  raw?: string;
}

const SystemSettings = () => {
  const [connectionType, setConnectionType] = useState<'tcp' | 'serial'>('tcp');
  const [ipAddress, setIpAddress] = useState('192.168.1.239');
  const [port, setPort] = useState('20301');
  const [serialPort, setSerialPort] = useState('');
  const [baudRate, setBaudRate] = useState('9600');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ScaleTestResult | null>(null);
  const [lastTestTime, setLastTestTime] = useState<Date | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchScaleConfig();
  }, []);

  const fetchScaleConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('scale_config')
        .select('*')
        .single();

      if (error) throw error;

      if (data) {
        setConnectionType((data.connection_type as 'tcp' | 'serial') || 'tcp');
        setIpAddress(data.ip_address || '192.168.1.239');
        setPort(data.port?.toString() || '20301');
        setSerialPort(data.serial_port || '');
        setBaudRate(data.baud_rate?.toString() || '9600');
      }
    } catch (error) {
      console.error('Error fetching scale config:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: existing } = await supabase
        .from('scale_config')
        .select('id')
        .limit(1)
        .maybeSingle();

      const configData = {
        connection_type: connectionType,
        ip_address: connectionType === 'tcp' ? ipAddress : null,
        port: connectionType === 'tcp' ? parseInt(port) : null,
        serial_port: connectionType === 'serial' ? serialPort : null,
        baud_rate: connectionType === 'serial' ? parseInt(baudRate) : null,
        updated_at: new Date().toISOString(),
      };

      let error;
      if (existing) {
        const result = await supabase
          .from('scale_config')
          .update(configData)
          .eq('id', existing.id);
        error = result.error;
      } else {
        const result = await supabase
          .from('scale_config')
          .insert([configData]);
        error = result.error;
      }

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Scale configuration saved successfully'
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const testScaleConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('read-scale-weight', {
        body: {}
      });

      if (error) throw error;

      setTestResult(data as ScaleTestResult);
      setLastTestTime(new Date());

      if (data.mock) {
        toast({
          title: 'Connection Failed',
          description: 'Scale not accessible. Mock data returned.',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Connection Successful',
          description: `Scale connected. Weight: ${data.weight} ${data.unit}`,
        });
      }
    } catch (error: any) {
      toast({
        title: 'Test Failed',
        description: error.message || 'Failed to test scale connection',
        variant: 'destructive'
      });
      setTestResult({ 
        weight: 0, 
        unit: 'kg', 
        error: error.message,
        mock: true 
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>CAS CN1 Scale Configuration</CardTitle>
          <CardDescription>Configure connection settings for the weighing scale</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="connectionType">Connection Type</Label>
            <select
              id="connectionType"
              className="w-full p-2 border rounded-md bg-background"
              value={connectionType}
              onChange={(e) => setConnectionType(e.target.value as 'tcp' | 'serial')}
            >
              <option value="tcp">TCP/IP</option>
              <option value="serial">Serial Port</option>
            </select>
          </div>

          {connectionType === 'tcp' ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ip">IP Address</Label>
                <Input
                  id="ip"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  placeholder="192.168.1.239"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">Port</Label>
                <Input
                  id="port"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="20301"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="serialPort">Serial Port</Label>
                <select
                  id="serialPort"
                  className="w-full p-2 border rounded-md bg-background"
                  value={serialPort}
                  onChange={(e) => setSerialPort(e.target.value)}
                >
                  <option value="">Select a port...</option>
                  <optgroup label="Windows">
                    <option value="COM1">COM1</option>
                    <option value="COM2">COM2</option>
                    <option value="COM3">COM3</option>
                    <option value="COM4">COM4</option>
                    <option value="COM5">COM5</option>
                    <option value="COM6">COM6</option>
                    <option value="COM7">COM7</option>
                    <option value="COM8">COM8</option>
                    <option value="COM9">COM9</option>
                    <option value="COM10">COM10</option>
                  </optgroup>
                  <optgroup label="Linux">
                    <option value="/dev/ttyUSB0">/dev/ttyUSB0</option>
                    <option value="/dev/ttyUSB1">/dev/ttyUSB1</option>
                    <option value="/dev/ttyUSB2">/dev/ttyUSB2</option>
                    <option value="/dev/ttyS0">/dev/ttyS0</option>
                    <option value="/dev/ttyS1">/dev/ttyS1</option>
                    <option value="/dev/ttyACM0">/dev/ttyACM0</option>
                    <option value="/dev/ttyACM1">/dev/ttyACM1</option>
                  </optgroup>
                  <optgroup label="Mac">
                    <option value="/dev/tty.usbserial">/dev/tty.usbserial</option>
                    <option value="/dev/tty.usbmodem">/dev/tty.usbmodem</option>
                    <option value="/dev/cu.usbserial">/dev/cu.usbserial</option>
                  </optgroup>
                </select>
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    placeholder="Or enter custom port..."
                    className="flex-1"
                    onChange={(e) => {
                      if (e.target.value) setSerialPort(e.target.value);
                    }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="baudRate">Baud Rate</Label>
                <select
                  id="baudRate"
                  className="w-full p-2 border rounded-md bg-background"
                  value={baudRate}
                  onChange={(e) => setBaudRate(e.target.value)}
                >
                  <option value="9600">9600</option>
                  <option value="19200">19200</option>
                  <option value="38400">38400</option>
                  <option value="57600">57600</option>
                  <option value="115200">115200</option>
                </select>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              Save Configuration
            </Button>
            <Button 
              onClick={testScaleConnection} 
              disabled={testing}
              variant="outline"
            >
              {testing ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Wifi className="h-4 w-4 mr-2" />
              )}
              Test Connection
            </Button>
          </div>

          {testResult && (
            <Alert className={testResult.mock || testResult.error ? 'border-destructive' : 'border-primary'}>
              <div className="flex items-start gap-3">
                {testResult.mock || testResult.error ? (
                  <WifiOff className="h-5 w-5 text-destructive mt-0.5" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                )}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">
                      {testResult.mock || testResult.error ? 'Connection Failed' : 'Connection Successful'}
                    </h4>
                    <Badge variant={testResult.mock || testResult.error ? 'destructive' : 'default'}>
                      {testResult.mock || testResult.error ? 'Using Mock Data' : 'Live Data'}
                    </Badge>
                  </div>
                  <AlertDescription>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Weight Reading:</span>
                        <span className="font-medium">{testResult.weight} {testResult.unit}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Connection Status:</span>
                        <span className={testResult.mock || testResult.error ? 'text-destructive' : 'text-primary'}>
                          {testResult.mock || testResult.error ? 'Disconnected' : 'Connected'}
                        </span>
                      </div>
                      {lastTestTime && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Last Test:</span>
                          <span>{lastTestTime.toLocaleTimeString()}</span>
                        </div>
                      )}
                      {testResult.error && (
                        <div className="mt-2 pt-2 border-t">
                          <span className="text-destructive text-xs">{testResult.error}</span>
                        </div>
                      )}
                      {testResult.mock && !testResult.error && (
                        <div className="mt-2 pt-2 border-t">
                          <p className="text-xs text-muted-foreground">
                            The scale at {connectionType === 'tcp' ? `${ipAddress}:${port}` : serialPort} is not accessible. 
                            Production can continue using generated weight values for testing purposes.
                          </p>
                        </div>
                      )}
                      {testResult.raw && !testResult.mock && (
                        <div className="mt-2 pt-2 border-t">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Raw Data:</span>
                            <code className="text-xs bg-muted px-1 rounded">{testResult.raw}</code>
                          </div>
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
          <CardDescription>System-wide configuration options</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Additional settings coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemSettings;
