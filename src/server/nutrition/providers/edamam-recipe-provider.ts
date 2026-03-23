const EDAMAM_RECIPE_SEARCH_URL = "https://api.edamam.com/api/recipes/v2";

export type EdamamRecipeSearchItem = {
  id: string;
  name: string;
  source: string | null;
  url: string | null;
  image: string | null;
  yield_servings: number | null;
  total_time_minutes: number | null;
  ingredient_lines: string[];
  calories_total: number | null;
  calories_per_serving: number | null;
  protein_g_per_serving: number | null;
  carbs_g_per_serving: number | null;
  fat_g_per_serving: number | null;
};

type EdamamRecipeTotalNutrient = {
  quantity?: unknown;
};

type EdamamRecipe = {
  uri?: unknown;
  label?: unknown;
  source?: unknown;
  url?: unknown;
  image?: unknown;
  yield?: unknown;
  totalTime?: unknown;
  ingredientLines?: unknown;
  calories?: unknown;
  totalNutrients?: Record<string, EdamamRecipeTotalNutrient | undefined>;
};

type EdamamRecipeSearchResponse = {
  hits?: Array<{
    recipe?: EdamamRecipe;
  }>;
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

function to_positive_number(value: number | null): number | null {
  if (value === null || value <= 0) {
    return null;
  }

  return value;
}

function to_ingredient_lines(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((line) => get_string(line))
    .filter((line): line is string => Boolean(line));
}

function nutrient_quantity(
  nutrients: Record<string, EdamamRecipeTotalNutrient | undefined> | undefined,
  key: string,
): number | null {
  if (!nutrients) {
    return null;
  }

  return get_number(nutrients[key]?.quantity);
}

function normalize_recipe(hit: { recipe?: EdamamRecipe } | undefined): EdamamRecipeSearchItem | null {
  const recipe = hit?.recipe;

  if (!recipe) {
    return null;
  }

  const id = get_string(recipe.uri);
  const name = get_string(recipe.label);

  if (!id || !name) {
    return null;
  }

  const yield_servings = to_positive_number(get_number(recipe.yield));
  const calories_total = to_positive_number(get_number(recipe.calories));
  const protein_total = nutrient_quantity(recipe.totalNutrients, "PROCNT");
  const carbs_total = nutrient_quantity(recipe.totalNutrients, "CHOCDF");
  const fat_total = nutrient_quantity(recipe.totalNutrients, "FAT");
  const serving_divisor = yield_servings ?? 1;

  return {
    id,
    name,
    source: get_string(recipe.source),
    url: get_string(recipe.url),
    image: get_string(recipe.image),
    yield_servings,
    total_time_minutes: to_positive_number(get_number(recipe.totalTime)),
    ingredient_lines: to_ingredient_lines(recipe.ingredientLines),
    calories_total,
    calories_per_serving:
      calories_total !== null ? Math.round(calories_total / serving_divisor) : null,
    protein_g_per_serving:
      protein_total !== null ? Math.round((protein_total / serving_divisor) * 10) / 10 : null,
    carbs_g_per_serving:
      carbs_total !== null ? Math.round((carbs_total / serving_divisor) * 10) / 10 : null,
    fat_g_per_serving:
      fat_total !== null ? Math.round((fat_total / serving_divisor) * 10) / 10 : null,
  };
}

function get_recipe_credentials() {
  const app_id =
    process.env.EDAMAM_RECIPE_APP_ID ??
    process.env.EDAMAM_APPID ??
    process.env.EDAMAM_APP_ID ??
    null;
  const app_key =
    process.env.EDAMAM_RECIPE_APP_KEY ??
    process.env.EDAMAM_APIKEY ??
    process.env.EDAMAM_APP_KEY ??
    null;
  const account_user = process.env.EDAMAM_ACCOUNT_USER ?? null;

  return {
    app_id,
    app_key,
    account_user,
  };
}

export async function search_edamam_recipes(
  query: string,
  limit = 8,
): Promise<EdamamRecipeSearchItem[]> {
  const { app_id, app_key, account_user } = get_recipe_credentials();

  if (!app_id || !app_key) {
    return [];
  }

  const trimmed_query = query.trim();

  if (trimmed_query.length < 2) {
    return [];
  }

  const capped_limit = Math.min(Math.max(limit, 1), 20);
  const params = new URLSearchParams({
    type: "public",
    q: trimmed_query,
    app_id,
    app_key,
  });

  const headers: HeadersInit = {};

  if (account_user) {
    headers["Edamam-Account-User"] = account_user;
  }

  const response = await fetch(`${EDAMAM_RECIPE_SEARCH_URL}?${params.toString()}`, {
    headers,
    next: { revalidate: 900 },
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as EdamamRecipeSearchResponse;

  return (payload.hits ?? [])
    .map((hit) => normalize_recipe(hit))
    .filter((item): item is EdamamRecipeSearchItem => Boolean(item))
    .slice(0, capped_limit);
}
