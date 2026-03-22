export type NutrientsBasis = "per_100g" | "per_serving" | "unknown";

export type EdamamNutrients = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
};

export type EdamamServingInput = {
  source: "edamam";
  serving_size: number | null;
  serving_unit: string | null;
  nutrients: EdamamNutrients;
};

export type EdamamServingNormalization = {
  raw: EdamamServingInput;
  normalized: EdamamNutrients;
  normalization_applied: boolean;
  normalization_reason: string;
  nutrients_basis: NutrientsBasis;
  heuristic: {
    factor: number | null;
    named_serving_unit: boolean;
    macro_calories: number;
    macro_match: boolean;
    implied_kcal_per_gram: number | null;
    normalized_calories: number | null;
    suspicious_kcal_per_gram: boolean;
    plausible_normalized_calories: boolean;
  };
};

const GRAM_LIKE_UNITS = new Set([
  "g",
  "gram",
  "grams",
  "kg",
  "mg",
  "oz",
  "ounce",
  "ounces",
  "lb",
  "lbs",
  "ml",
  "l",
  "liter",
  "liters",
]);

const NAMED_UNIT_KEYWORDS = [
  "bar",
  "cookie",
  "bottle",
  "cup",
  "piece",
  "pack",
  "packet",
  "pouch",
  "wafer",
  "brownie",
  "muffin",
  "slice",
  "can",
  "sandwich",
  "serving",
  "stick",
  "bun",
  "cracker",
];

function optional_scaled(value: number | null, factor: number): number | null {
  if (value === null) {
    return null;
  }
  return value * factor;
}

function is_named_serving_unit(value: string | null): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  if (GRAM_LIKE_UNITS.has(normalized)) {
    return false;
  }

  if (NAMED_UNIT_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return true;
  }

  return /[a-z]/.test(normalized);
}

function is_positive_number(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function normalize_edamam_serving(input: EdamamServingInput): EdamamServingNormalization {
  const raw = {
    source: input.source,
    serving_size: input.serving_size,
    serving_unit: input.serving_unit,
    nutrients: { ...input.nutrients },
  };

  const serving_size = input.serving_size;
  const has_serving_size = is_positive_number(serving_size);
  const factor = has_serving_size ? serving_size / 100 : null;
  const named_serving_unit = is_named_serving_unit(input.serving_unit);

  const macro_calories =
    input.nutrients.fat_g * 9 + input.nutrients.carbs_g * 4 + input.nutrients.protein_g * 4;

  const macro_match =
    Math.abs(macro_calories - input.nutrients.calories) /
      Math.max(input.nutrients.calories, 1) <=
    0.1;

  const implied_kcal_per_gram =
    has_serving_size && serving_size > 0
      ? input.nutrients.calories / serving_size
      : null;

  const suspicious_kcal_per_gram = implied_kcal_per_gram !== null && implied_kcal_per_gram > 9.5;
  const normalized_calories = factor !== null ? input.nutrients.calories * factor : null;
  const plausible_normalized_calories =
    normalized_calories !== null && normalized_calories >= 20 && normalized_calories <= 800;

  const likely_per_100g_with_named_serving =
    has_serving_size &&
    named_serving_unit &&
    macro_match &&
    suspicious_kcal_per_gram &&
    plausible_normalized_calories;

  if (likely_per_100g_with_named_serving && factor !== null) {
    return {
      raw,
      normalized: {
        calories: input.nutrients.calories * factor,
        protein_g: input.nutrients.protein_g * factor,
        carbs_g: input.nutrients.carbs_g * factor,
        fat_g: input.nutrients.fat_g * factor,
        fiber_g: optional_scaled(input.nutrients.fiber_g, factor),
        sugar_g: optional_scaled(input.nutrients.sugar_g, factor),
        sodium_mg: optional_scaled(input.nutrients.sodium_mg, factor),
      },
      normalization_applied: true,
      normalization_reason:
        "Likely per-100g nutrient payload with named serving metadata. Applied serving_size/100 rescale.",
      nutrients_basis: "per_100g",
      heuristic: {
        factor,
        named_serving_unit,
        macro_calories,
        macro_match,
        implied_kcal_per_gram,
        normalized_calories,
        suspicious_kcal_per_gram,
        plausible_normalized_calories,
      },
    };
  }

  if (has_serving_size && macro_match && !suspicious_kcal_per_gram) {
    return {
      raw,
      normalized: { ...input.nutrients },
      normalization_applied: false,
      normalization_reason:
        "Nutrients look plausible for a per-serving payload; no rescale applied.",
      nutrients_basis: "per_serving",
      heuristic: {
        factor,
        named_serving_unit,
        macro_calories,
        macro_match,
        implied_kcal_per_gram,
        normalized_calories,
        suspicious_kcal_per_gram,
        plausible_normalized_calories,
      },
    };
  }

  let reason = "Low confidence normalization case. Keeping raw nutrient values.";

  if (!has_serving_size) {
    reason = "Missing or invalid serving_size; unable to determine per-100g vs per-serving basis.";
  } else if (!macro_match) {
    reason =
      "Macro-derived calories do not closely match calories, so nutrient basis remains unknown.";
  }

  return {
    raw,
    normalized: { ...input.nutrients },
    normalization_applied: false,
    normalization_reason: reason,
    nutrients_basis: "unknown",
    heuristic: {
      factor,
      named_serving_unit,
      macro_calories,
      macro_match,
      implied_kcal_per_gram,
      normalized_calories,
      suspicious_kcal_per_gram,
      plausible_normalized_calories,
    },
  };
}
