import { EdamamProvider } from "@/server/nutrition/providers/edamam-provider";
import { OpenFoodFactsProvider } from "@/server/nutrition/providers/open-food-facts-provider";
import type { NutritionProvider } from "@/server/nutrition/types";

let provider_instance: NutritionProvider | null = null;
let upc_provider_instance: NutritionProvider | null = null;

export function get_nutrition_provider(): NutritionProvider {
  if (provider_instance) {
    return provider_instance;
  }

  const provider_name = process.env.NUTRITION_PROVIDER?.toLowerCase() ?? "edamam";

  switch (provider_name) {
    case "edamam":
      provider_instance = new EdamamProvider();
      break;
    case "open_food_facts":
      provider_instance = new OpenFoodFactsProvider();
      break;
    default:
      provider_instance = new EdamamProvider();
      break;
  }

  return provider_instance;
}

export function get_upc_nutrition_provider(): NutritionProvider {
  if (upc_provider_instance) {
    return upc_provider_instance;
  }

  const provider_name =
    process.env.NUTRITION_UPC_PROVIDER?.toLowerCase() ?? "open_food_facts";

  switch (provider_name) {
    case "edamam":
      upc_provider_instance = new EdamamProvider();
      break;
    case "open_food_facts":
      upc_provider_instance = new OpenFoodFactsProvider();
      break;
    default:
      upc_provider_instance = new OpenFoodFactsProvider();
      break;
  }

  return upc_provider_instance;
}
