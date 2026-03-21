import type { NormalizedFoodItem, NutritionProvider } from "@/server/nutrition/types";

const EDAMAM_PARSER_URL = "https://api.edamam.com/api/food-database/v2/parser";

type EdamamFood = {
  foodId?: string;
  label?: string;
  brand?: string;
  brandLabel?: string;
  nutrients?: Record<string, unknown>;
};

type EdamamMeasure = {
  label?: string;
  weight?: number;
};

type EdamamParsedItem = {
  food?: EdamamFood;
  measure?: EdamamMeasure;
};

type EdamamHintItem = {
  food?: EdamamFood;
  measures?: EdamamMeasure[];
};

type EdamamParserResponse = {
  parsed?: EdamamParsedItem[];
  hints?: EdamamHintItem[];
};

function get_string(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function get_number(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalize_edamam_food(
  food: EdamamFood | undefined,
  measure: EdamamMeasure | undefined,
  upc: string | null,
): NormalizedFoodItem | null {
  if (!food) {
    return null;
  }

  const nutrients = food.nutrients ?? {};

  return {
    name: get_string(food.label) ?? "Unknown Food Item",
    brand: get_string(food.brandLabel) ?? get_string(food.brand),
    upc,
    serving_size: get_number(measure?.weight),
    serving_unit: get_string(measure?.label) ?? "g",
    calories: Math.round(get_number(nutrients.ENERC_KCAL) ?? 0),
    protein_g: get_number(nutrients.PROCNT) ?? 0,
    carbs_g: get_number(nutrients.CHOCDF) ?? 0,
    fat_g: get_number(nutrients.FAT) ?? 0,
    fiber_g: get_number(nutrients.FIBTG),
    sugar_g: get_number(nutrients.SUGAR),
    sodium_mg: get_number(nutrients.NA),
    source: "edamam",
    source_ref: get_string(food.foodId),
  };
}

function dedupe_foods(items: NormalizedFoodItem[]): NormalizedFoodItem[] {
  const seen = new Set<string>();
  const result: NormalizedFoodItem[] = [];

  for (const item of items) {
    const key = item.source_ref ?? `${item.name.toLowerCase()}::${item.brand ?? ""}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return result;
}

export class EdamamProvider implements NutritionProvider {
  private readonly app_id: string | null;
  private readonly app_key: string | null;

  constructor() {
    this.app_id = process.env.EDAMAM_APPID ?? process.env.EDAMAM_APP_ID ?? null;
    this.app_key = process.env.EDAMAM_APIKEY ?? process.env.EDAMAM_APP_KEY ?? null;
  }

  private has_credentials(): boolean {
    return Boolean(this.app_id && this.app_key);
  }

  private get_auth_params(): URLSearchParams {
    return new URLSearchParams({
      app_id: this.app_id ?? "",
      app_key: this.app_key ?? "",
    });
  }

  async lookup_by_upc(upc: string): Promise<NormalizedFoodItem | null> {
    if (!this.has_credentials()) {
      return null;
    }

    const params = this.get_auth_params();
    params.set("upc", upc);

    const response = await fetch(`${EDAMAM_PARSER_URL}?${params.toString()}`, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as EdamamParserResponse;
    const first_parsed = payload.parsed?.[0];
    const first_hint = payload.hints?.[0];

    const normalized =
      normalize_edamam_food(first_parsed?.food, first_parsed?.measure, upc) ??
      normalize_edamam_food(first_hint?.food, first_hint?.measures?.[0], upc);

    return normalized;
  }

  async search_foods(query: string, limit = 20): Promise<NormalizedFoodItem[]> {
    if (!this.has_credentials()) {
      return [];
    }

    const params = this.get_auth_params();
    params.set("ingr", query);

    const response = await fetch(`${EDAMAM_PARSER_URL}?${params.toString()}`, {
      next: { revalidate: 900 },
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as EdamamParserResponse;

    const parsed_items =
      payload.parsed
        ?.map((item) => normalize_edamam_food(item.food, item.measure, null))
        .filter((item): item is NormalizedFoodItem => Boolean(item)) ?? [];

    const hint_items =
      payload.hints
        ?.map((item) => normalize_edamam_food(item.food, item.measures?.[0], null))
        .filter((item): item is NormalizedFoodItem => Boolean(item)) ?? [];

    return dedupe_foods([...parsed_items, ...hint_items]).slice(0, limit);
  }
}
