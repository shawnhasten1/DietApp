import { EdamamProvider } from "@/server/nutrition/providers/edamam-provider";
import { OpenFoodFactsProvider } from "@/server/nutrition/providers/open-food-facts-provider";
import { UsdaProvider } from "@/server/nutrition/providers/usda-provider";
import type { NutritionProvider } from "@/server/nutrition/types";

export type ProviderName = "edamam" | "open_food_facts" | "usda";

const provider_names: ProviderName[] = ["edamam", "open_food_facts", "usda"];

let provider_instance: NutritionProvider | null = null;
let upc_provider_instance: NutritionProvider | null = null;
let search_provider_chain_instance: NutritionProvider[] | null = null;
let upc_provider_chain_instance: NutritionProvider[] | null = null;

function normalize_provider_name(value: string | null | undefined): ProviderName | null {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  return provider_names.includes(normalized as ProviderName)
    ? (normalized as ProviderName)
    : null;
}

function parse_provider_chain(value: string | null | undefined): ProviderName[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((part) => normalize_provider_name(part))
    .filter((part): part is ProviderName => Boolean(part));
}

function unique_provider_names(names: ProviderName[]): ProviderName[] {
  const seen = new Set<ProviderName>();
  const unique: ProviderName[] = [];

  for (const name of names) {
    if (seen.has(name)) {
      continue;
    }

    seen.add(name);
    unique.push(name);
  }

  return unique;
}

function default_search_chain(primary_provider: ProviderName): ProviderName[] {
  switch (primary_provider) {
    case "usda":
      return ["usda", "edamam", "open_food_facts"];
    case "open_food_facts":
      return ["open_food_facts", "usda", "edamam"];
    default:
      return ["edamam", "usda", "open_food_facts"];
  }
}

function default_upc_chain(primary_provider: ProviderName): ProviderName[] {
  switch (primary_provider) {
    case "edamam":
      return ["edamam", "open_food_facts", "usda"];
    case "usda":
      return ["usda", "open_food_facts", "edamam"];
    default:
      return ["open_food_facts", "usda", "edamam"];
  }
}

function create_provider_by_name(provider_name: ProviderName): NutritionProvider {
  switch (provider_name) {
    case "edamam":
      return new EdamamProvider();
    case "open_food_facts":
      return new OpenFoodFactsProvider();
    case "usda":
      return new UsdaProvider();
    default:
      return new EdamamProvider();
  }
}

export function get_nutrition_provider_by_name(value: string | null | undefined): NutritionProvider {
  const provider_name = normalize_provider_name(value) ?? "edamam";
  return create_provider_by_name(provider_name);
}

export function get_nutrition_provider(): NutritionProvider {
  if (provider_instance) {
    return provider_instance;
  }

  const provider_name = normalize_provider_name(process.env.NUTRITION_PROVIDER) ?? "edamam";
  provider_instance = create_provider_by_name(provider_name);

  return provider_instance;
}

export function get_upc_nutrition_provider(): NutritionProvider {
  if (upc_provider_instance) {
    return upc_provider_instance;
  }

  const provider_name = normalize_provider_name(process.env.NUTRITION_UPC_PROVIDER) ?? "open_food_facts";
  upc_provider_instance = create_provider_by_name(provider_name);

  return upc_provider_instance;
}

export function get_search_nutrition_provider_chain(): NutritionProvider[] {
  if (search_provider_chain_instance) {
    return search_provider_chain_instance;
  }

  const primary_provider = normalize_provider_name(process.env.NUTRITION_PROVIDER) ?? "edamam";
  const configured_fallback = parse_provider_chain(process.env.NUTRITION_SEARCH_FALLBACK_CHAIN);
  const provider_chain =
    configured_fallback.length > 0
      ? unique_provider_names([primary_provider, ...configured_fallback])
      : default_search_chain(primary_provider);

  search_provider_chain_instance = provider_chain.map((provider_name) =>
    create_provider_by_name(provider_name),
  );

  return search_provider_chain_instance;
}

export function get_upc_nutrition_provider_chain(): NutritionProvider[] {
  if (upc_provider_chain_instance) {
    return upc_provider_chain_instance;
  }

  const primary_provider = normalize_provider_name(process.env.NUTRITION_UPC_PROVIDER) ?? "open_food_facts";
  const configured_fallback = parse_provider_chain(process.env.NUTRITION_UPC_FALLBACK_CHAIN);
  const chain_names =
    configured_fallback.length > 0
      ? unique_provider_names([primary_provider, ...configured_fallback])
      : default_upc_chain(primary_provider);

  upc_provider_chain_instance = chain_names.map((provider_name) =>
    create_provider_by_name(provider_name),
  );

  return upc_provider_chain_instance;
}
