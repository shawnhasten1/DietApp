export type NormalizedFoodItem = {
  name: string;
  brand: string | null;
  upc: string | null;
  serving_size: number | null;
  serving_unit: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  source: "manual" | "edamam" | "open_food_facts" | "other";
  source_ref: string | null;
};

export type UpcDebugResponse = {
  provider: string;
  upc: string;
  normalized_item: NormalizedFoodItem | null;
  raw_payload: unknown;
  debug_summary?: Record<string, unknown>;
};

export interface NutritionProvider {
  lookup_by_upc(upc: string): Promise<NormalizedFoodItem | null>;
  lookup_by_upc_debug?(upc: string): Promise<UpcDebugResponse | null>;
  search_foods(query: string, limit?: number): Promise<NormalizedFoodItem[]>;
}
