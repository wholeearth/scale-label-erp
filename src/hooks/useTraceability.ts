import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TraceabilityNode {
  id: string;
  serialNumber: string;
  itemName: string;
  itemCode: string;
  itemType: string;
  weightKg: number;
  lengthYards: number | null;
  productionDate: string;
  productionTime: string;
  operatorName: string;
  machineName: string;
  machineCode: string;
  parents: TraceabilityNode[];
}

export interface LineageData {
  serial: string;
  code: string;
  type: string;
  weight: number;
  length?: number;
  date: string;
  parents?: LineageData[];
}

// Recursively fetch parent production records
async function fetchParentLineage(serialNumber: string, depth = 0, maxDepth = 5): Promise<TraceabilityNode | null> {
  if (depth >= maxDepth) return null;

  // Find production record by serial number
  const { data: productionRecord, error } = await supabase
    .from('production_records')
    .select(`
      id,
      serial_number,
      weight_kg,
      length_yards,
      production_date,
      production_time,
      items!inner (
        id,
        product_name,
        product_code,
        item_type
      ),
      profiles!production_records_operator_id_fkey (
        full_name
      ),
      machines (
        machine_name,
        machine_code
      )
    `)
    .eq('serial_number', serialNumber)
    .maybeSingle();

  if (error || !productionRecord) return null;

  // Fetch consumed materials (parents)
  const { data: consumedMaterials } = await supabase
    .from('raw_material_consumption')
    .select('consumed_serial_number')
    .eq('production_record_id', productionRecord.id);

  const parents: TraceabilityNode[] = [];
  if (consumedMaterials && consumedMaterials.length > 0) {
    for (const material of consumedMaterials) {
      const parent = await fetchParentLineage(material.consumed_serial_number, depth + 1, maxDepth);
      if (parent) {
        parents.push(parent);
      }
    }
  }

  return {
    id: productionRecord.id,
    serialNumber: productionRecord.serial_number,
    itemName: (productionRecord.items as any)?.product_name || 'Unknown',
    itemCode: (productionRecord.items as any)?.product_code || 'N/A',
    itemType: (productionRecord.items as any)?.item_type || 'unknown',
    weightKg: productionRecord.weight_kg,
    lengthYards: productionRecord.length_yards,
    productionDate: productionRecord.production_date,
    productionTime: productionRecord.production_time,
    operatorName: (productionRecord.profiles as any)?.full_name || 'Unknown',
    machineName: productionRecord.machines?.machine_name || 'Unknown',
    machineCode: productionRecord.machines?.machine_code || 'N/A',
    parents,
  };
}

// Fetch children (products made from this item)
async function fetchChildLineage(serialNumber: string, depth = 0, maxDepth = 3): Promise<TraceabilityNode[]> {
  if (depth >= maxDepth) return [];

  // Find production records that consumed this serial number
  const { data: consumptions, error } = await supabase
    .from('raw_material_consumption')
    .select('production_record_id')
    .eq('consumed_serial_number', serialNumber);

  if (error || !consumptions || consumptions.length === 0) return [];

  const children: TraceabilityNode[] = [];
  
  for (const consumption of consumptions) {
    const { data: productionRecord } = await supabase
      .from('production_records')
      .select(`
        id,
        serial_number,
        weight_kg,
        length_yards,
        production_date,
        production_time,
        items!inner (
          id,
          product_name,
          product_code,
          item_type
        ),
        profiles!production_records_operator_id_fkey (
          full_name
        ),
        machines (
          machine_name,
          machine_code
        )
      `)
      .eq('id', consumption.production_record_id)
      .maybeSingle();

    if (productionRecord) {
      children.push({
        id: productionRecord.id,
        serialNumber: productionRecord.serial_number,
        itemName: (productionRecord.items as any)?.product_name || 'Unknown',
        itemCode: (productionRecord.items as any)?.product_code || 'N/A',
        itemType: (productionRecord.items as any)?.item_type || 'unknown',
        weightKg: productionRecord.weight_kg,
        lengthYards: productionRecord.length_yards,
        productionDate: productionRecord.production_date,
        productionTime: productionRecord.production_time,
        operatorName: (productionRecord.profiles as any)?.full_name || 'Unknown',
        machineName: productionRecord.machines?.machine_name || 'Unknown',
        machineCode: productionRecord.machines?.machine_code || 'N/A',
        parents: [],
      });
    }
  }

  return children;
}

// Build compact lineage data for QR code
export async function buildLineageForQR(serialNumber: string): Promise<LineageData | null> {
  const node = await fetchParentLineage(serialNumber, 0, 5);
  if (!node) return null;

  const buildCompact = (n: TraceabilityNode): LineageData => ({
    serial: n.serialNumber,
    code: n.itemCode,
    type: n.itemType,
    weight: n.weightKg,
    length: n.lengthYards || undefined,
    date: n.productionDate,
    parents: n.parents.length > 0 ? n.parents.map(buildCompact) : undefined,
  });

  return buildCompact(node);
}

export function useTraceability(serialNumber: string | null) {
  return useQuery({
    queryKey: ['traceability', serialNumber],
    queryFn: async () => {
      if (!serialNumber) return null;
      
      const lineage = await fetchParentLineage(serialNumber);
      const children = await fetchChildLineage(serialNumber);
      
      return {
        lineage,
        children,
      };
    },
    enabled: !!serialNumber,
  });
}

export function useProductionRecord(serialNumber: string | null) {
  return useQuery({
    queryKey: ['production-record', serialNumber],
    queryFn: async () => {
      if (!serialNumber) return null;
      
      const { data, error } = await supabase
        .from('production_records')
        .select(`
          *,
          items!inner (
            product_name,
            product_code,
            item_type
          ),
          profiles!production_records_operator_id_fkey (
            full_name
          ),
          machines (
            machine_name,
            machine_code
          )
        `)
        .eq('serial_number', serialNumber)
        .maybeSingle();
        
      if (error) throw error;
      return data;
    },
    enabled: !!serialNumber,
  });
}
