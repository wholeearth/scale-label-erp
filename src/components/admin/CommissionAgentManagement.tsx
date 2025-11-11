import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Edit, Trash2, Settings } from 'lucide-react';
import { CommissionAgentDialog } from './CommissionAgentDialog';
import { CommissionStructureDialog } from './CommissionStructureDialog';
import type { Tables } from '@/integrations/supabase/types';

type CommissionAgent = Tables<'commission_agents'>;
type AgentWithEmployeeCode = CommissionAgent & { employee_code?: string | null };

export const CommissionAgentManagement = () => {
  const [editingAgent, setEditingAgent] = useState<any>(null);
  const [showAgentDialog, setShowAgentDialog] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const { data: agents, isLoading } = useQuery<AgentWithEmployeeCode[]>({
    queryKey: ['commission-agents'],
    queryFn: async () => {
      const { data: agentsData, error } = await supabase
        .from('commission_agents')
        .select('*')
        .order('agent_name');
      
      if (error) throw error;
      
      // Fetch profiles for agents with user_id
      const agentIds = agentsData?.filter(a => a.user_id).map(a => a.user_id) || [];
      
      if (agentIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, employee_code')
          .in('id', agentIds);
        
        // Merge profile data with agent data
        const agentsWithProfiles: AgentWithEmployeeCode[] = agentsData?.map(agent => ({
          ...agent,
          employee_code: profilesData?.find(p => p.id === agent.user_id)?.employee_code
        }));
        
        return agentsWithProfiles;
      }
      
      return agentsData as AgentWithEmployeeCode[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Commission Agents</CardTitle>
            <Button onClick={() => setShowAgentDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Agent
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent Code</TableHead>
                <TableHead>Agent Name</TableHead>
                <TableHead>Employee Code</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents?.map((agent) => (
                <TableRow key={agent.id}>
                  <TableCell className="font-medium">{agent.agent_code}</TableCell>
                  <TableCell>{agent.agent_name}</TableCell>
                  <TableCell>{agent.employee_code || '-'}</TableCell>
                  <TableCell>{agent.contact_email}</TableCell>
                  <TableCell>{agent.contact_phone || '-'}</TableCell>
                  <TableCell>
                    {agent.user_id ? (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">User Account</span>
                    ) : (
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">Manual</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedAgentId(agent.id)}
                        title="Manage commission structure"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingAgent(agent);
                          setShowAgentDialog(true);
                        }}
                        title="Edit agent details"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {showAgentDialog && (
        <CommissionAgentDialog
          agent={editingAgent}
          onClose={() => {
            setShowAgentDialog(false);
            setEditingAgent(null);
          }}
        />
      )}

      {selectedAgentId && (
        <CommissionStructureDialog
          agentId={selectedAgentId}
          onClose={() => setSelectedAgentId(null)}
        />
      )}
    </>
  );
};
