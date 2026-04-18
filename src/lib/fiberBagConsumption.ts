import { supabase } from '@/integrations/supabase/client';

export interface FiberConsumptionInput {
  serialNumber: string;
  weightKg: number;
  productionRecordId?: string | null;
  shiftRecordId?: string | null;
}

/**
 * For each input serial number that matches a row in `fiber_bags.unique_id`,
 * insert a corresponding `fiber_bag_consumption` row. Non-matching serials
 * (production-record serials) are silently ignored — they're handled by the
 * existing production/shift consumption tables.
 *
 * Hyphen-insensitive: incoming serials are normalised before comparison
 * because fiber bag IDs are stored without hyphens.
 */
export async function recordFiberBagConsumption(
  entries: FiberConsumptionInput[],
  consumedBy: string | null,
): Promise<void> {
  if (!entries.length) return;

  const normalised = entries
    .map((e) => ({ ...e, key: (e.serialNumber || '').replace(/-/g, '').toUpperCase() }))
    .filter((e) => e.key.length > 0 && (e.weightKg || 0) > 0);

  if (!normalised.length) return;

  // Look up matching fiber bags in one query
  const { data: bags, error } = await supabase
    .from('fiber_bags')
    .select('id, unique_id')
    .in('unique_id', normalised.map((e) => e.key));

  if (error || !bags || bags.length === 0) return;

  const bagByKey = new Map(bags.map((b) => [b.unique_id.toUpperCase(), b.id]));

  const rows = normalised
    .map((e) => {
      const bagId = bagByKey.get(e.key);
      if (!bagId) return null;
      return {
        fiber_bag_id: bagId,
        consumed_weight_kg: e.weightKg,
        consumed_by: consumedBy,
        production_record_id: e.productionRecordId ?? null,
        shift_record_id: e.shiftRecordId ?? null,
      };
    })
    .filter(Boolean) as any[];

  if (!rows.length) return;

  const { error: insertError } = await supabase.from('fiber_bag_consumption').insert(rows);
  if (insertError) {
    console.error('Failed to record fiber bag consumption:', insertError);
  }
}
