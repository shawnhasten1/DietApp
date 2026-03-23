import type { QuickPickFoodItem } from "@/lib/food-item-types";
import { normalize_meal_type, type MealTypeValue } from "@/lib/meal-types";

type FoodSourceValue = "MANUAL" | "EDAMAM" | "OPEN_FOOD_FACTS" | "OTHER";

type FoodLogWithFoodItem = {
  food_item_id: string;
  consumed_at: Date;
  meal_type: string | null;
  food_item: {
    name: string;
    brand: string | null;
    upc: string | null;
    serving_size: unknown;
    serving_unit: string | null;
    calories: number;
    protein_g: unknown;
    carbs_g: unknown;
    fat_g: unknown;
    fiber_g: unknown | null;
    sugar_g: unknown | null;
    sodium_mg: unknown | null;
    source: FoodSourceValue;
    source_ref: string | null;
  };
};

function to_provider_source(source: FoodSourceValue): QuickPickFoodItem["source"] {
  switch (source) {
    case "EDAMAM":
      return "edamam";
    case "OPEN_FOOD_FACTS":
      return "open_food_facts";
    case "OTHER":
      return "other";
    default:
      return "manual";
  }
}

export function build_quick_pick_items(
  food_logs: FoodLogWithFoodItem[],
  limit = 12,
): QuickPickFoodItem[] {
  const by_food_item_id = new Map<
    string,
    {
      log_count: number;
      latest_consumed_at: Date;
      suggested_meal_type: MealTypeValue;
      item: FoodLogWithFoodItem["food_item"];
    }
  >();

  for (const log of food_logs) {
    const existing = by_food_item_id.get(log.food_item_id);
    const normalized_meal_type = normalize_meal_type(log.meal_type) ?? "snack";

    if (!existing) {
      by_food_item_id.set(log.food_item_id, {
        log_count: 1,
        latest_consumed_at: log.consumed_at,
        suggested_meal_type: normalized_meal_type,
        item: log.food_item,
      });
      continue;
    }

    existing.log_count += 1;

    if (log.consumed_at > existing.latest_consumed_at) {
      existing.latest_consumed_at = log.consumed_at;
      existing.suggested_meal_type = normalized_meal_type;
    }
  }

  return Array.from(by_food_item_id.values())
    .sort((a, b) => {
      if (b.log_count !== a.log_count) {
        return b.log_count - a.log_count;
      }

      return b.latest_consumed_at.getTime() - a.latest_consumed_at.getTime();
    })
    .slice(0, limit)
    .map((entry) => ({
      name: entry.item.name,
      brand: entry.item.brand,
      upc: entry.item.upc,
      serving_size: entry.item.serving_size !== null ? Number(entry.item.serving_size) : null,
      serving_unit: entry.item.serving_unit,
      serving_size_label:
        entry.item.serving_size !== null && entry.item.serving_unit
          ? `${Number(entry.item.serving_size)} ${entry.item.serving_unit}`
          : null,
      calories: entry.item.calories,
      protein_g: Number(entry.item.protein_g),
      carbs_g: Number(entry.item.carbs_g),
      fat_g: Number(entry.item.fat_g),
      fiber_g: entry.item.fiber_g !== null ? Number(entry.item.fiber_g) : null,
      sugar_g: entry.item.sugar_g !== null ? Number(entry.item.sugar_g) : null,
      sodium_mg: entry.item.sodium_mg !== null ? Number(entry.item.sodium_mg) : null,
      source: to_provider_source(entry.item.source),
      source_ref: entry.item.source_ref,
      times_logged: entry.log_count,
      last_logged_at: entry.latest_consumed_at.toISOString(),
      suggested_meal_type: entry.suggested_meal_type,
    }));
}
