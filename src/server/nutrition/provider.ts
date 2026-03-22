import { EdamamProvider } from "@/server/nutrition/providers/edamam-provider";
import { OpenFoodFactsProvider } from "@/server/nutrition/providers/open-food-facts-provider";
import type { NutritionProvider } from "@/server/nutrition/types";

let provider_instance: NutritionProvider | null = null;
let upc_provider_instance: NutritionProvider | null = null;
let upc_provider_chain_instance: NutritionProvider[] | null = null;

function create_provider_by_name(provider_name: string): NutritionProvider {
  switch (provider_name) {
    case "edamam":
      return new EdamamProvider();
    case "open_food_facts":
      return new OpenFoodFactsProvider();
    default:
      return new EdamamProvider();
  }
}

export function get_nutrition_provider(): NutritionProvider {
  if (provider_instance) {
    return provider_instance;
  }

  const provider_name = process.env.NUTRITION_PROVIDER?.toLowerCase() ?? "edamam";
  provider_instance = create_provider_by_name(provider_name);

  return provider_instance;
}

export function get_upc_nutrition_provider(): NutritionProvider {
  if (upc_provider_instance) {
    return upc_provider_instance;
  }

  const provider_name =
    process.env.NUTRITION_UPC_PROVIDER?.toLowerCase() ?? "open_food_facts";
  upc_provider_instance = create_provider_by_name(provider_name);

  return upc_provider_instance;
}

export function get_upc_nutrition_provider_chain(): NutritionProvider[] {
  if (upc_provider_chain_instance) {
    return upc_provider_chain_instance;
  }

  const primary_provider = process.env.NUTRITION_UPC_PROVIDER?.toLowerCase() ?? "open_food_facts";

  const provider_names =
    primary_provider === "edamam"
      ? ["edamam", "open_food_facts"]
      : ["open_food_facts", "edamam"];

  upc_provider_chain_instance = provider_names.map((provider_name) =>
    create_provider_by_name(provider_name),
  );

  return upc_provider_chain_instance;
}
