import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface CommissionAgentDialogProps {
  agent?: any;
  onClose: () => void;
}

export const CommissionAgentDialog = ({ agent, onClose }: CommissionAgentDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [agentCode, setAgentCode] = useState(agent?.agent_code || '');
  const [agentName, setAgentName] = useState(agent?.agent_name || '');
  const [contactEmail, setContactEmail] = useState(agent?.contact_email || '');
  const [contactPhone, setContactPhone] = useState(agent?.contact_phone || '');
  const [address, setAddress] = useState(agent?.address || '');

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = {
        agent_code: agentCode,
        agent_name: agentName,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        address,
      };

      if (agent) {
        const { error } = await supabase
          .from('commission_agents')
          .update(data)
          .eq('id', agent.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('commission_agents')
          .insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: agent ? 'Agent updated' : 'Agent created',
        description: 'Commission agent saved successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['commission-agents'] });
      onClose();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{agent ? 'Edit' : 'Add'} Commission Agent</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Agent Code *</Label>
            <Input
              value={agentCode}
              onChange={(e) => setAgentCode(e.target.value)}
              placeholder="CA001"
            />
          </div>

          <div>
            <Label>Agent Name *</Label>
            <Input
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="John Doe"
            />
          </div>

          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="agent@example.com"
            />
          </div>

          <div>
            <Label>Phone</Label>
            <Input
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="+1234567890"
            />
          </div>

          <div>
            <Label>Address</Label>
            <Textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter address..."
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!agentCode || !agentName || saveMutation.isPending}
            >
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
