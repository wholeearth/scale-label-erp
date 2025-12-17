import { TraceabilityNode } from '@/hooks/useTraceability';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Package, 
  User, 
  Calendar, 
  Clock, 
  Scale, 
  Ruler, 
  Settings2,
  ArrowDown,
  ArrowUp,
  Boxes
} from 'lucide-react';

interface TraceabilityViewerProps {
  node: TraceabilityNode | null;
  children?: TraceabilityNode[];
  showChildren?: boolean;
}

const getItemTypeBadge = (type: string) => {
  switch (type) {
    case 'raw_material':
      return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">Raw Material</Badge>;
    case 'intermediate_type_1':
      return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">Intermediate Type 1</Badge>;
    case 'intermediate_type_2':
      return <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30">Intermediate Type 2</Badge>;
    case 'finished_product':
      return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Finished Product</Badge>;
    default:
      return <Badge variant="outline">{type}</Badge>;
  }
};

const TraceabilityNodeCard = ({ 
  node, 
  isRoot = false, 
  direction = 'parent' 
}: { 
  node: TraceabilityNode; 
  isRoot?: boolean; 
  direction?: 'parent' | 'child';
}) => {
  return (
    <div className={`space-y-3 ${!isRoot ? 'ml-8 border-l-2 border-muted pl-4' : ''}`}>
      <Card className={isRoot ? 'border-primary border-2' : ''}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">{node.itemName}</CardTitle>
            </div>
            {getItemTypeBadge(node.itemType)}
          </div>
          <p className="text-sm font-mono text-muted-foreground">{node.serialNumber}</p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Boxes className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Code:</span>
              <span className="font-medium">{node.itemCode}</span>
            </div>
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Weight:</span>
              <span className="font-medium">{node.weightKg.toFixed(2)} kg</span>
            </div>
            {node.lengthYards && (
              <div className="flex items-center gap-2">
                <Ruler className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Length:</span>
                <span className="font-medium">{node.lengthYards} yards</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Date:</span>
              <span className="font-medium">{node.productionDate}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Time:</span>
              <span className="font-medium">{node.productionTime}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Operator:</span>
              <span className="font-medium">{node.operatorName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Machine:</span>
              <span className="font-medium">{node.machineName} ({node.machineCode})</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Render parents recursively */}
      {node.parents && node.parents.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground ml-2">
            <ArrowUp className="h-4 w-4" />
            <span>Produced From ({node.parents.length} input{node.parents.length > 1 ? 's' : ''})</span>
          </div>
          {node.parents.map((parent) => (
            <TraceabilityNodeCard key={parent.id} node={parent} direction="parent" />
          ))}
        </div>
      )}
    </div>
  );
};

const ChildNodeCard = ({ node }: { node: TraceabilityNode }) => {
  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">{node.itemName}</CardTitle>
          </div>
          {getItemTypeBadge(node.itemType)}
        </div>
        <p className="text-xs font-mono text-muted-foreground">{node.serialNumber}</p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-4 text-xs">
          <span><Scale className="h-3 w-3 inline mr-1" />{node.weightKg.toFixed(2)} kg</span>
          <span><Calendar className="h-3 w-3 inline mr-1" />{node.productionDate}</span>
          <span><User className="h-3 w-3 inline mr-1" />{node.operatorName}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export const TraceabilityViewer = ({ node, children, showChildren = true }: TraceabilityViewerProps) => {
  if (!node) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No traceability data found for this item.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main lineage tree */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <ArrowUp className="h-5 w-5 text-blue-500" />
          Production Lineage (Inputs)
        </h3>
        <TraceabilityNodeCard node={node} isRoot />
      </div>

      {/* Children/Products made from this */}
      {showChildren && children && children.length > 0 && (
        <>
          <Separator />
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ArrowDown className="h-5 w-5 text-green-500" />
              Products Made From This Item ({children.length})
            </h3>
            <div className="grid gap-3">
              {children.map((child) => (
                <ChildNodeCard key={child.id} node={child} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
