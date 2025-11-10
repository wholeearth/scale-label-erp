import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

const ItemManagement = () => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Item Master Management</CardTitle>
            <CardDescription>Manage products, raw materials, and item specifications</CardDescription>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Item management features coming soon...</p>
      </CardContent>
    </Card>
  );
};

export default ItemManagement;
