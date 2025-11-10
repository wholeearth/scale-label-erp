import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Save } from 'lucide-react';

const SystemSettings = () => {
  const [ipAddress, setIpAddress] = useState('192.168.1.239');
  const [port, setPort] = useState('20301');
  const [loading, setLoading] = useState(false);
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
        setIpAddress(data.ip_address);
        setPort(data.port.toString());
      }
    } catch (error) {
      console.error('Error fetching scale config:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('scale_config')
        .update({
          ip_address: ipAddress,
          port: parseInt(port),
          updated_at: new Date().toISOString()
        })
        .eq('ip_address', ipAddress);

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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>CAS CN1 Scale Configuration</CardTitle>
          <CardDescription>Configure connection settings for the weighing scale</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
          <Button onClick={handleSave} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            Save Configuration
          </Button>
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
