import type { MealTypeValue } from "@/lib/meal-types";

export type ProviderFoodItem = {
  name: string;
  brand: string | null;
  upc: string | null;
  selection_ref?: string | null;
  serving_size: number | null;
  serving_unit: string | null;
  serving_size_label: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  source: "manual" | "edamam" | "open_food_facts" | "usda" | "other";
  source_ref: string | null;
};

export type QuickPickFoodItem = ProviderFoodItem & {
  quick_pick_id: string;
  times_logged: number;
  last_logged_at: string;
  suggested_meal_type: MealTypeValue;
};
