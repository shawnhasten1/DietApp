import type {
  NormalizedFoodItem,
  NutritionProvider,
  UpcDebugResponse,
} from "@/server/nutrition/types";

const USDA_API_BASE_URL = "https://api.nal.usda.gov/fdc/v1";

type UsdaFoodSearchRequest = {
  query: string;
  pageSize: number;
  pageNumber?: number;
  dataType?: string[];
};

type UsdaLabelNutrient = {
  value?: number;
};

type UsdaFoodNutrient = {
  nutrientNumber?: string;
  nutrientName?: string;
  value?: number;
  amount?: number;
  unitName?: string;
};

type UsdaFood = {
  fdcId?: number;
  description?: string;
  brandOwner?: string;
  gtinUpc?: string | number;
  dataType?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  labelNutrients?: {
    calories?: UsdaLabelNutrient;
    protein?: UsdaLabelNutrient;
    carbohydrates?: UsdaLabelNutrient;
    fat?: UsdaLabelNutrient;
    fiber?: UsdaLabelNutrient;
    sugars?: UsdaLabelNutrient;
    sodium?: UsdaLabelNutrient;
  };
  foodNutrients?: UsdaFoodNutrient[];
};

type UsdaFoodSearchResponse = {
  totalHits?: number;
  currentPage?: number;
  totalPages?: number;
  foods?: UsdaFood[];
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

function round_to_tenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function round_optional_to_tenth(value: number | null): number | null {
  if (value === null) {
    return null;
  }

  return round_to_tenth(value);
}

function normalize_upc(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const as_string = String(value).replace(/\D/g, "");
  return as_string.length > 0 ? as_string : null;
}

function nutrient_value_from_label(food: UsdaFood, key: keyof NonNullable<UsdaFood["labelNutrients"]>) {
  return get_number(food.labelNutrients?.[key]?.value);
}

function convert_value_by_unit(value: number, unit_name: string | null, target: "g" | "mg" | "kcal"): number {
  const unit = (unit_name ?? "").trim().toLowerCase();

  if (target === "kcal") {
    if (unit === "kj") {
      return value / 4.184;
    }

    return value;
  }

  if (target === "g") {
    if (unit === "mg") {
      return value / 1000;
    }

    if (unit === "mcg" || unit === "ug") {
      return value / 1_000_000;
    }

    return value;
  }

  if (unit === "g") {
    return value * 1000;
  }

  if (unit === "mcg" || unit === "ug") {
    return value / 1000;
  }

  return value;
}

function nutrient_value_from_array(
  food: UsdaFood,
  nutrient_numbers: string[],
  nutrient_name_fragments: string[],
  target: "g" | "mg" | "kcal",
): number | null {
  const nutrients = food.foodNutrients ?? [];

  for (const nutrient of nutrients) {
    const nutrient_number = get_string(nutrient.nutrientNumber);

    if (nutrient_number && nutrient_numbers.includes(nutrient_number)) {
      const raw_value = get_number(nutrient.amount) ?? get_number(nutrient.value);

      if (raw_value !== null) {
        return convert_value_by_unit(raw_value, get_string(nutrient.unitName), target);
      }
    }
  }

  for (const nutrient of nutrients) {
    const nutrient_name = get_string(nutrient.nutrientName)?.toLowerCase();

    if (!nutrient_name) {
      continue;
    }

    if (!nutrient_name_fragments.some((fragment) => nutrient_name.includes(fragment))) {
      continue;
    }

    const raw_value = get_number(nutrient.amount) ?? get_number(nutrient.value);

    if (raw_value !== null) {
      return convert_value_by_unit(raw_value, get_string(nutrient.unitName), target);
    }
  }

  return null;
}

function normalize_usda_food(food: UsdaFood, forced_upc: string | null = null): NormalizedFoodItem | null {
  const name = get_string(food.description);

  if (!name) {
    return null;
  }

  const calories =
    nutrient_value_from_label(food, "calories") ??
    nutrient_value_from_array(food, ["1008"], ["energy"], "kcal") ??
    0;
  const protein =
    nutrient_value_from_label(food, "protein") ??
    nutrient_value_from_array(food, ["1003"], ["protein"], "g") ??
    0;
  const carbs =
    nutrient_value_from_label(food, "carbohydrates") ??
    nutrient_value_from_array(food, ["1005"], ["carbohydrate"], "g") ??
    0;
  const fat =
    nutrient_value_from_label(food, "fat") ??
    nutrient_value_from_array(food, ["1004"], ["total lipid", "fat"], "g") ??
    0;
  const fiber =
    nutrient_value_from_label(food, "fiber") ??
    nutrient_value_from_array(food, ["1079"], ["fiber"], "g");
  const sugar =
    nutrient_value_from_label(food, "sugars") ??
    nutrient_value_from_array(food, ["2000", "269"], ["sugar"], "g");
  const sodium =
    nutrient_value_from_label(food, "sodium") ??
    nutrient_value_from_array(food, ["1093"], ["sodium"], "mg");

  const serving_size = get_number(food.servingSize);
  const serving_unit = get_string(food.servingSizeUnit);
  const serving_size_label =
    get_string(food.householdServingFullText) ??
    (serving_size !== null && serving_unit ? `${serving_size} ${serving_unit}` : null);
  const upc = forced_upc ?? normalize_upc(food.gtinUpc);
  const fdc_id = get_number(food.fdcId);

  return {
    name,
    brand: get_string(food.brandOwner),
    upc,
    serving_size,
    serving_unit,
    serving_size_label,
    calories: Math.max(0, Math.round(calories)),
    protein_g: round_to_tenth(Math.max(0, protein)),
    carbs_g: round_to_tenth(Math.max(0, carbs)),
    fat_g: round_to_tenth(Math.max(0, fat)),
    fiber_g: round_optional_to_tenth(fiber !== null ? Math.max(0, fiber) : null),
    sugar_g: round_optional_to_tenth(sugar !== null ? Math.max(0, sugar) : null),
    sodium_mg: round_optional_to_tenth(sodium !== null ? Math.max(0, sodium) : null),
    source: "usda",
    source_ref: fdc_id !== null ? `fdc:${Math.trunc(fdc_id)}` : null,
  };
}

function dedupe_foods(items: NormalizedFoodItem[]): NormalizedFoodItem[] {
  const seen = new Set<string>();
  const result: NormalizedFoodItem[] = [];

  for (const item of items) {
    const key = item.source_ref ?? item.upc ?? `${item.name.toLowerCase()}::${item.brand ?? ""}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return result;
}

function score_search_item(item: NormalizedFoodItem, query: string): number {
  const query_lower = query.trim().toLowerCase();
  const tokens = query_lower.split(/\s+/).filter(Boolean);
  const haystack = `${item.name} ${item.brand ?? ""}`.toLowerCase();
  let score = 0;

  if (haystack.startsWith(query_lower)) {
    score += 200;
  }

  if (item.name.toLowerCase().includes(query_lower)) {
    score += 120;
  }

  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += 30;
    }
  }

  if (item.upc) {
    score += 10;
  }

  if (item.serving_size !== null) {
    score += 5;
  }

  return score;
}

export class UsdaProvider implements NutritionProvider {
  private readonly api_key: string | null;

  constructor() {
    this.api_key = process.env.USDA_API_KEY ?? null;
  }

  private has_credentials(): boolean {
    return Boolean(this.api_key);
  }

  private async search_with_payload(
    payload: UsdaFoodSearchRequest,
    revalidate_seconds: number,
  ): Promise<UsdaFoodSearchResponse | null> {
    if (!this.has_credentials()) {
      return null;
    }

    const response = await fetch(
      `${USDA_API_BASE_URL}/foods/search?api_key=${encodeURIComponent(this.api_key ?? "")}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        next: { revalidate: revalidate_seconds },
      },
    );

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as UsdaFoodSearchResponse;
  }

  async lookup_by_upc(upc: string): Promise<NormalizedFoodItem | null> {
    const payload = await this.search_with_payload(
      {
        query: upc,
        pageSize: 25,
        dataType: ["Branded"],
      },
      3600,
    );

    if (!payload?.foods) {
      return null;
    }

    const normalized_upc = normalize_upc(upc);

    if (!normalized_upc) {
      return null;
    }

    const exact_match = payload.foods.find((food) => normalize_upc(food.gtinUpc) === normalized_upc);

    if (!exact_match) {
      return null;
    }

    return normalize_usda_food(exact_match, normalized_upc);
  }

  async lookup_by_upc_debug(upc: string): Promise<UpcDebugResponse | null> {
    if (!this.has_credentials()) {
      return {
        provider: "usda",
        upc,
        normalized_item: null,
        raw_payload: null,
        debug_summary: {
          error: "Missing USDA API key in server environment.",
        },
      };
    }

    const payload = await this.search_with_payload(
      {
        query: upc,
        pageSize: 25,
        dataType: ["Branded"],
      },
      0,
    );

    if (!payload) {
      return null;
    }

    const normalized_upc = normalize_upc(upc);
    const exact_match =
      normalized_upc && payload.foods
        ? payload.foods.find((food) => normalize_upc(food.gtinUpc) === normalized_upc)
        : null;

    return {
      provider: "usda",
      upc,
      normalized_item: exact_match ? normalize_usda_food(exact_match, normalized_upc) : null,
      raw_payload: payload,
      debug_summary: {
        total_hits: payload.totalHits ?? 0,
        foods_returned: payload.foods?.length ?? 0,
        had_exact_gtin_match: Boolean(exact_match),
      },
    };
  }

  async search_foods(query: string, limit = 20): Promise<NormalizedFoodItem[]> {
    const payload = await this.search_with_payload(
      {
        query,
        pageSize: Math.min(Math.max(limit * 3, 20), 80),
      },
      900,
    );

    if (!payload?.foods) {
      return [];
    }

    const normalized = payload.foods
      .map((food) => normalize_usda_food(food))
      .filter((item): item is NormalizedFoodItem => Boolean(item));

    const deduped = dedupe_foods(normalized);

    return deduped
      .sort((a, b) => score_search_item(b, query) - score_search_item(a, query))
      .slice(0, limit);
  }
}
