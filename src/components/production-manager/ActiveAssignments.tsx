import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserCheck, Package, TrendingUp } from 'lucide-react';

interface Assignment {
  id: string;
  quantity_assigned: number;
  quantity_produced: number;
  status: string;
  assigned_at: string;
  profiles: {
    full_name: string;
    employee_code: string | null;
  };
  items: {
    product_code: string;
    product_name: string;
    color: string | null;
  };
}

export const ActiveAssignments = () => {
  const { data: assignments, isLoading } = useQuery({
    queryKey: ['operator-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_assignments')
        .select(`
          id,
          quantity_assigned,
          quantity_produced,
          status,
          assigned_at,
          profiles!operator_assignments_operator_id_fkey (
            full_name,
            employee_code
          ),
          items (
            product_code,
            product_name,
            color
          )
        `)
        .eq('status', 'active')
        .order('assigned_at', { ascending: false });

      if (error) throw error;
      return data as Assignment[];
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Active Assignments
        </CardTitle>
        <CardDescription>Current production assignments to operators</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {assignments?.map((assignment) => (
            <div
              key={assignment.id}
              className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <UserCheck className="h-4 w-4 text-primary" />
                  <span className="font-medium">
                    {assignment.profiles.full_name}
                    {assignment.profiles.employee_code && 
                      ` (${assignment.profiles.employee_code})`
                    }
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Package className="h-3 w-3" />
                  {assignment.items.product_code} - {assignment.items.product_name}
                  {assignment.items.color && ` (${assignment.items.color})`}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Assigned: {new Date(assignment.assigned_at).toLocaleDateString()}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold">
                  {assignment.quantity_produced} / {assignment.quantity_assigned}
                </div>
                <div className="text-xs text-muted-foreground">units produced</div>
                <Badge 
                  variant="outline" 
                  className="mt-1"
                >
                  {Math.round((assignment.quantity_produced / assignment.quantity_assigned) * 100)}%
                </Badge>
              </div>
            </div>
          ))}

          {assignments?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No active assignments
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
