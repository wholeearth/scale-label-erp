import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Save, Wifi, WifiOff, RefreshCw, CheckCircle2, Activity, Calendar, RotateCcw, Server } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ShiftConfigSettings from './ShiftConfigSettings';
import {
  getScaleAgentUrl,
  setScaleAgentUrl,
  readWeight,
  checkAgentHealth,
  ScaleError,
  type ScaleReading,
} from '@/lib/scaleAgent';

const MONITOR_INTERVAL = 2000; // 2s while monitoring

type ConnectionStatus = 'connected' | 'disconnected' | 'checking' | 'unknown';

const SystemSettings = () => {
  const { toast } = useToast();
  const [agentUrl, setAgentUrlState] = useState<string>(getScaleAgentUrl());
  const [savingUrl, setSavingUrl] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ScaleReading | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [lastTestTime, setLastTestTime] = useState<Date | null>(null);

  // Live monitoring
  const [monitoringEnabled, setMonitoringEnabled] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('unknown');
  const [lastWeight, setLastWeight] = useState<number | null>(null);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);
  const monitorIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkConnection = useCallback(async (silent = true) => {
    if (!silent) setConnectionStatus('checking');
    try {
      const reading = await readWeight();
      setLastCheckTime(new Date());
      setConnectionStatus('connected');
      setConsecutiveFailures(0);
      setLastWeight(reading.weight);
      return true;
    } catch {
      setLastCheckTime(new Date());
      setConnectionStatus('disconnected');
      setConsecutiveFailures((prev) => prev + 1);
      setLastWeight(null);
      return false;
    }
  }, []);

  useEffect(() => {
    if (monitoringEnabled) {
      checkConnection(false);
      monitorIntervalRef.current = setInterval(() => checkConnection(true), MONITOR_INTERVAL);
    } else {
      if (monitorIntervalRef.current) clearInterval(monitorIntervalRef.current);
      monitorIntervalRef.current = null;
      setConnectionStatus('unknown');
    }
    return () => {
      if (monitorIntervalRef.current) clearInterval(monitorIntervalRef.current);
    };
  }, [monitoringEnabled, checkConnection]);

  useEffect(() => {
    if (consecutiveFailures === 3 && monitoringEnabled) {
      toast({
        title: 'Scale Connection Lost',
        description:
          'Three consecutive failed reads. Check that the local scale-agent service is running and the scale is powered on.',
        variant: 'destructive',
      });
    }
  }, [consecutiveFailures, monitoringEnabled, toast]);

  const handleSaveAgentUrl = () => {
    setSavingUrl(true);
    try {
      setScaleAgentUrl(agentUrl);
      toast({
        title: 'Saved',
        description: `Frontend will read weight from ${getScaleAgentUrl()}`,
      });
    } finally {
      setSavingUrl(false);
    }
  };

  const testScaleConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setTestError(null);
    try {
      const reading = await readWeight();
      setTestResult(reading);
      setLastTestTime(new Date());
      toast({
        title: 'Scale Connected',
        description: `Live reading: ${reading.weight.toFixed(2)} ${reading.unit} ${reading.stable ? '(stable)' : '(unstable)'}`,
      });
    } catch (error) {
      const message = error instanceof ScaleError ? error.message : 'Failed to read scale.';
      setTestError(message);
      setLastTestTime(new Date());
      toast({
        title: 'Scale Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'bg-green-500';
      case 'disconnected':
        return 'bg-destructive';
      case 'checking':
        return 'bg-yellow-500 animate-pulse';
      default:
        return 'bg-muted-foreground';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'disconnected':
        return 'Disconnected';
      case 'checking':
        return 'Checking...';
      default:
        return 'Not Monitoring';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                CAS CN1 Scale (Local Agent)
              </CardTitle>
              <CardDescription>
                The frontend reads weight from a small local service running on the weighing PC.
                The agent connects to the scale via TCP and exposes <code className="text-xs bg-muted px-1 rounded">/weight</code>.
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
                <span className="text-sm font-medium">{getStatusText()}</span>
                {connectionStatus === 'connected' && lastWeight !== null && (
                  <Badge variant="outline" className="ml-2">
                    {lastWeight.toFixed(2)} kg
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 border-l pl-4">
                <Label htmlFor="monitoring" className="text-sm cursor-pointer">
                  <Activity className="h-4 w-4 inline mr-1" />
                  Monitor
                </Label>
                <Switch
                  id="monitoring"
                  checked={monitoringEnabled}
                  onCheckedChange={setMonitoringEnabled}
                />
              </div>
            </div>
          </div>
          {monitoringEnabled && (
            <div className="mt-3 p-3 bg-muted rounded-md text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground">Polling every {MONITOR_INTERVAL / 1000}s</span>
                  {lastCheckTime && (
                    <span className="text-muted-foreground">
                      Last check: {lastCheckTime.toLocaleTimeString()}
                    </span>
                  )}
                  {consecutiveFailures > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {consecutiveFailures} failure{consecutiveFailures > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => checkConnection(false)}
                  disabled={connectionStatus === 'checking'}
                >
                  <RefreshCw className={`h-3 w-3 ${connectionStatus === 'checking' ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agentUrl">Scale Agent URL</Label>
            <div className="flex gap-2">
              <Input
                id="agentUrl"
                value={agentUrl}
                onChange={(e) => setAgentUrlState(e.target.value)}
                placeholder="http://localhost:5000"
              />
              <Button onClick={handleSaveAgentUrl} disabled={savingUrl}>
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Default: <code className="bg-muted px-1 rounded">http://localhost:5000</code>. Run{' '}
              <code className="bg-muted px-1 rounded">node scale-agent/server.js</code> on the weighing PC. See{' '}
              <code className="bg-muted px-1 rounded">scale-agent/README.md</code> for setup as a Windows service.
            </p>
          </div>

          <div className="rounded-md border p-3 bg-muted/50 text-xs space-y-1">
            <p className="font-medium text-foreground">Scale TCP target (configured in the agent, not here)</p>
            <p>Default: <code className="bg-background px-1 rounded">192.168.1.239:20304</code></p>
            <p>Override with env vars on the agent: <code className="bg-background px-1 rounded">SCALE_HOST</code>, <code className="bg-background px-1 rounded">SCALE_PORT</code>.</p>
          </div>

          <div className="flex gap-2">
            <Button onClick={testScaleConnection} disabled={testing} variant="outline">
              {testing ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Wifi className="h-4 w-4 mr-2" />
              )}
              Test Connection
            </Button>
          </div>

          {testError && (
            <Alert className="border-destructive">
              <div className="flex items-start gap-3">
                <WifiOff className="h-5 w-5 text-destructive mt-0.5" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">Connection Failed</h4>
                    <Badge variant="destructive">No Reading</Badge>
                  </div>
                  <AlertDescription>
                    <div className="space-y-1 text-sm">
                      <p className="text-destructive">{testError}</p>
                      {lastTestTime && (
                        <div className="flex justify-between text-xs pt-2 border-t mt-2">
                          <span className="text-muted-foreground">Last test:</span>
                          <span>{lastTestTime.toLocaleTimeString()}</span>
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          )}

          {testResult && !testError && (
            <Alert className="border-primary">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">Connection Successful</h4>
                    <Badge variant={testResult.stable ? 'default' : 'secondary'}>
                      {testResult.stable ? 'Stable' : 'Unstable'}
                    </Badge>
                  </div>
                  <AlertDescription>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Weight Reading:</span>
                        <span className="font-medium">
                          {testResult.weight.toFixed(2)} {testResult.unit}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Scale Connected:</span>
                        <span className={testResult.connected ? 'text-primary' : 'text-destructive'}>
                          {testResult.connected ? 'Yes' : 'No'}
                        </span>
                      </div>
                      {lastTestTime && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Last Test:</span>
                          <span>{lastTestTime.toLocaleTimeString()}</span>
                        </div>
                      )}
                      {testResult.raw && (
                        <div className="mt-2 pt-2 border-t">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Raw Frame:</span>
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

      <ShiftConfigSettings />

      <YearlySequenceSettings />
    </div>
  );
};


// Yearly Sequence Settings Component
const YearlySequenceSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();

  // Fetch yearly sequence stats
  const { data: sequenceStats, isLoading: statsLoading } = useQuery({
    queryKey: ['yearly-sequence-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_yearly_sequences')
        .select('*, profiles(full_name, employee_code)')
        .eq('year', currentYear)
        .order('sequence_count', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Reset yearly sequences mutation
  const resetMutation = useMutation({
    mutationFn: async (year: number) => {
      const { data, error } = await supabase.functions.invoke('reset-yearly-sequences', {
        body: { year, manual: true }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['yearly-sequence-stats'] });
      toast({
        title: 'Success',
        description: `Yearly sequences initialized. Created: ${data.sequencesCreated}, Skipped: ${data.sequencesSkipped}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const totalProduction = sequenceStats?.reduce((sum, s) => sum + (s.sequence_count || 0), 0) || 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Yearly Production Sequences
            </CardTitle>
            <CardDescription>
              Track and manage operator production sequences for {currentYear}
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-lg px-3 py-1">
            {totalProduction.toLocaleString()} items this year
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div>
            <h4 className="font-medium">Initialize New Year Sequences</h4>
            <p className="text-sm text-muted-foreground">
              Create sequence records for all operators for the current year. 
              Existing sequences won't be affected.
            </p>
          </div>
          <Button 
            onClick={() => resetMutation.mutate(currentYear)}
            disabled={resetMutation.isPending}
            variant="outline"
          >
            {resetMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4 mr-2" />
            )}
            Initialize {currentYear}
          </Button>
        </div>

        {statsLoading ? (
          <div className="text-center py-4 text-muted-foreground">Loading sequence data...</div>
        ) : sequenceStats && sequenceStats.length > 0 ? (
          <div className="space-y-2">
            <h4 className="font-medium text-sm text-muted-foreground">Operator Production Summary ({currentYear})</h4>
            <div className="border rounded-lg divide-y">
              {sequenceStats.map((stat: any) => (
                <div key={stat.id} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="font-mono">
                      {stat.profiles?.employee_code || 'N/A'}
                    </Badge>
                    <span className="font-medium">{stat.profiles?.full_name || 'Unknown'}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-lg">{stat.sequence_count.toLocaleString()}</span>
                    <span className="text-muted-foreground text-sm ml-1">items</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No production sequences for {currentYear} yet.</p>
            <p className="text-sm">Click "Initialize {currentYear}" to set up sequences for all operators.</p>
          </div>
        )}

        <Alert>
          <AlertDescription className="text-sm">
            <strong>Automatic Reset:</strong> New yearly sequences are automatically created when operators start production in a new year. 
            Use the manual initialization to pre-create sequences for all operators at the start of the year.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default SystemSettings;
