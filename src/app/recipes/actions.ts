"use server";

import { revalidatePath } from "next/cache";
import { FoodSource, Prisma } from "@prisma/client";
import { z } from "zod";
import { require_authenticated_user } from "@/lib/authz";
import { parse_datetime_local_in_app_time_zone } from "@/lib/app-time";
import { prisma } from "@/lib/prisma";

type RecipeFoodItemInput = {
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
  source: FoodSource;
  source_ref: string | null;
};

function required_string(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function optional_string(value: FormDataEntryValue | null): string | null {
  const parsed = required_string(value);
  return parsed.length > 0 ? parsed : null;
}

function number_or_null(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parse_datetime_or_now(value: FormDataEntryValue | null): Date {
  if (typeof value !== "string" || value.trim().length === 0) {
    return new Date();
  }

  const parsed = parse_datetime_local_in_app_time_zone(value);
  return parsed ?? new Date();
}

function build_food_item_match_conditions(data: RecipeFoodItemInput) {
  const shared_fields = {
    name: data.name,
    brand: data.brand,
    upc: data.upc,
    serving_size: data.serving_size,
    serving_unit: data.serving_unit,
    calories: data.calories,
    protein_g: data.protein_g,
    carbs_g: data.carbs_g,
    fat_g: data.fat_g,
    fiber_g: data.fiber_g,
    sugar_g: data.sugar_g,
    sodium_mg: data.sodium_mg,
    source: data.source,
  };

  const conditions: Array<Record<string, unknown>> = [];

  if (data.source_ref) {
    conditions.push({
      ...shared_fields,
      source_ref: data.source_ref,
    });
  }

  if (data.upc) {
    conditions.push({
      ...shared_fields,
    });
  }

  conditions.push({
    ...shared_fields,
    source_ref: data.source_ref,
  });

  return conditions;
}

const ingredient_schema = z.object({
  name: z.string().min(1).max(200),
  brand: z.string().max(120).nullable(),
  upc: z.string().max(32).nullable(),
  serving_size: z.number().min(0).max(100000).nullable(),
  serving_unit: z.string().max(20).nullable(),
  calories: z.number().int().min(0).max(10000),
  protein_g: z.number().min(0).max(1000),
  carbs_g: z.number().min(0).max(1000),
  fat_g: z.number().min(0).max(1000),
  fiber_g: z.number().min(0).max(1000).nullable(),
  sugar_g: z.number().min(0).max(1000).nullable(),
  sodium_mg: z.number().min(0).max(200000).nullable(),
  source: z.nativeEnum(FoodSource),
  source_ref: z.string().max(120).nullable(),
  quantity: z.number().min(0.01).max(1000),
});

const create_recipe_schema = z.object({
  name: z.string().min(1).max(160),
  servings: z.number().min(0.01).max(1000),
  notes: z.string().max(4000).nullable(),
  ingredients: z.array(ingredient_schema).min(1).max(200),
});

const update_recipe_schema = create_recipe_schema.extend({
  recipe_id: z.string().min(1),
});

const log_recipe_schema = z.object({
  recipe_id: z.string().min(1),
  servings: z.number().min(0.01).max(100),
  meal_type: z.string().max(32).nullable(),
  consumed_at: z.date(),
  notes: z.string().max(1000).nullable(),
});

type IngredientInput = z.infer<typeof ingredient_schema>;

function parse_ingredients_json(value: string): IngredientInput[] {
  let payload: unknown;

  try {
    payload = JSON.parse(value);
  } catch {
    throw new Error("Invalid recipe ingredients payload.");
  }

  if (!Array.isArray(payload)) {
    throw new Error("Invalid recipe ingredients payload.");
  }

  const parsed = payload.map((raw_item) => {
    const item = (raw_item as Record<string, unknown>) ?? {};

    return {
      name: String(item.name ?? "").trim(),
      brand: item.brand === null || item.brand === undefined ? null : String(item.brand).trim(),
      upc: item.upc === null || item.upc === undefined ? null : String(item.upc).trim(),
      serving_size:
        typeof item.serving_size === "number"
          ? item.serving_size
          : item.serving_size === null || item.serving_size === undefined
            ? null
            : Number(item.serving_size),
      serving_unit:
        item.serving_unit === null || item.serving_unit === undefined
          ? null
          : String(item.serving_unit).trim(),
      calories: Number(item.calories),
      protein_g: Number(item.protein_g),
      carbs_g: Number(item.carbs_g),
      fat_g: Number(item.fat_g),
      fiber_g:
        item.fiber_g === null || item.fiber_g === undefined ? null : Number(item.fiber_g),
      sugar_g:
        item.sugar_g === null || item.sugar_g === undefined ? null : Number(item.sugar_g),
      sodium_mg:
        item.sodium_mg === null || item.sodium_mg === undefined ? null : Number(item.sodium_mg),
      source: String(item.source ?? "").toUpperCase(),
      source_ref:
        item.source_ref === null || item.source_ref === undefined
          ? null
          : String(item.source_ref).trim(),
      quantity: Number(item.quantity),
    };
  });

  const validated = z.array(ingredient_schema).safeParse(parsed);

  if (!validated.success) {
    throw new Error("Invalid recipe ingredient values.");
  }

  return validated.data;
}

function compute_recipe_totals(ingredients: Array<{ quantity: number; food_item: RecipeFoodItemInput }>) {
  return ingredients.reduce(
    (accumulator, ingredient) => {
      const factor = ingredient.quantity;
      const food_item = ingredient.food_item;

      return {
        calories: accumulator.calories + food_item.calories * factor,
        protein_g: accumulator.protein_g + food_item.protein_g * factor,
        carbs_g: accumulator.carbs_g + food_item.carbs_g * factor,
        fat_g: accumulator.fat_g + food_item.fat_g * factor,
        fiber_g: accumulator.fiber_g + (food_item.fiber_g ?? 0) * factor,
        sugar_g: accumulator.sugar_g + (food_item.sugar_g ?? 0) * factor,
        sodium_mg: accumulator.sodium_mg + (food_item.sodium_mg ?? 0) * factor,
      };
    },
    {
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fiber_g: 0,
      sugar_g: 0,
      sodium_mg: 0,
    },
  );
}

async function resolve_or_create_food_item(
  tx: Prisma.TransactionClient,
  ingredient: IngredientInput,
) {
  const find_conditions = build_food_item_match_conditions(ingredient);

  const existing_food_item = await tx.foodItem.findFirst({
    where: {
      OR: find_conditions,
    },
  });

  return (
    existing_food_item ??
    (await tx.foodItem.create({
      data: {
        name: ingredient.name,
        brand: ingredient.brand,
        upc: ingredient.upc,
        serving_size: ingredient.serving_size,
        serving_unit: ingredient.serving_unit,
        calories: ingredient.calories,
        protein_g: ingredient.protein_g,
        carbs_g: ingredient.carbs_g,
        fat_g: ingredient.fat_g,
        fiber_g: ingredient.fiber_g,
        sugar_g: ingredient.sugar_g,
        sodium_mg: ingredient.sodium_mg,
        source: ingredient.source,
        source_ref: ingredient.source_ref,
      },
    }))
  );
}

async function replace_recipe_ingredients(
  tx: Prisma.TransactionClient,
  recipe_id: string,
  ingredients: IngredientInput[],
) {
  await tx.recipeIngredient.deleteMany({
    where: {
      recipe_id,
    },
  });

  for (const ingredient of ingredients) {
    const food_item = await resolve_or_create_food_item(tx, ingredient);

    await tx.recipeIngredient.create({
      data: {
        recipe_id,
        food_item_id: food_item.id,
        quantity: ingredient.quantity,
      },
    });
  }
}

export async function create_recipe_action(form_data: FormData) {
  const user = await require_authenticated_user();
  const ingredients_json = required_string(form_data.get("ingredients_json"));
  const ingredients = parse_ingredients_json(ingredients_json);

  const parsed = create_recipe_schema.safeParse({
    name: required_string(form_data.get("name")),
    servings: number_or_null(form_data.get("servings")) ?? -1,
    notes: optional_string(form_data.get("notes")),
    ingredients,
  });

  if (!parsed.success) {
    throw new Error("Invalid recipe input.");
  }

  await prisma.$transaction(async (tx) => {
    const recipe = await tx.recipe.create({
      data: {
        user_id: user.id,
        name: parsed.data.name,
        servings: parsed.data.servings,
        notes: parsed.data.notes,
      },
    });

    await replace_recipe_ingredients(tx, recipe.id, parsed.data.ingredients);
  });

  revalidatePath("/recipes");
}

export async function update_recipe_action(form_data: FormData) {
  const user = await require_authenticated_user();
  const ingredients_json = required_string(form_data.get("ingredients_json"));
  const ingredients = parse_ingredients_json(ingredients_json);

  const parsed = update_recipe_schema.safeParse({
    recipe_id: required_string(form_data.get("recipe_id")),
    name: required_string(form_data.get("name")),
    servings: number_or_null(form_data.get("servings")) ?? -1,
    notes: optional_string(form_data.get("notes")),
    ingredients,
  });

  if (!parsed.success) {
    throw new Error("Invalid recipe update input.");
  }

  await prisma.$transaction(async (tx) => {
    const recipe = await tx.recipe.findFirst({
      where: {
        id: parsed.data.recipe_id,
        user_id: user.id,
      },
      select: {
        id: true,
      },
    });

    if (!recipe) {
      throw new Error("Recipe not found.");
    }

    await tx.recipe.update({
      where: {
        id: recipe.id,
      },
      data: {
        name: parsed.data.name,
        servings: parsed.data.servings,
        notes: parsed.data.notes,
      },
    });

    await replace_recipe_ingredients(tx, recipe.id, parsed.data.ingredients);
  });

  revalidatePath("/recipes");
  revalidatePath(`/recipes/${parsed.data.recipe_id}/edit`);
}

export async function log_recipe_food_action(form_data: FormData) {
  const user = await require_authenticated_user();

  const parsed = log_recipe_schema.safeParse({
    recipe_id: required_string(form_data.get("recipe_id")),
    servings: number_or_null(form_data.get("servings")) ?? -1,
    meal_type: optional_string(form_data.get("meal_type")),
    consumed_at: parse_datetime_or_now(form_data.get("consumed_at")),
    notes: optional_string(form_data.get("notes")),
  });

  if (!parsed.success) {
    throw new Error("Invalid recipe log input.");
  }

  const recipe = await prisma.recipe.findFirst({
    where: {
      id: parsed.data.recipe_id,
      user_id: user.id,
    },
    include: {
      ingredients: {
        include: {
          food_item: true,
        },
      },
    },
  });

  if (!recipe) {
    throw new Error("Recipe not found.");
  }

  if (recipe.ingredients.length === 0) {
    throw new Error("Recipe has no ingredients.");
  }

  const total_nutrients = compute_recipe_totals(
    recipe.ingredients.map((ingredient) => ({
      quantity: Number(ingredient.quantity),
      food_item: {
        name: ingredient.food_item.name,
        brand: ingredient.food_item.brand,
        upc: ingredient.food_item.upc,
        serving_size:
          ingredient.food_item.serving_size !== null ? Number(ingredient.food_item.serving_size) : null,
        serving_unit: ingredient.food_item.serving_unit,
        calories: ingredient.food_item.calories,
        protein_g: Number(ingredient.food_item.protein_g),
        carbs_g: Number(ingredient.food_item.carbs_g),
        fat_g: Number(ingredient.food_item.fat_g),
        fiber_g: ingredient.food_item.fiber_g !== null ? Number(ingredient.food_item.fiber_g) : null,
        sugar_g: ingredient.food_item.sugar_g !== null ? Number(ingredient.food_item.sugar_g) : null,
        sodium_mg: ingredient.food_item.sodium_mg !== null ? Number(ingredient.food_item.sodium_mg) : null,
        source: ingredient.food_item.source,
        source_ref: ingredient.food_item.source_ref,
      },
    })),
  );

  const recipe_servings = Math.max(Number(recipe.servings), 0.01);
  const per_serving_nutrients = {
    calories: Math.round(total_nutrients.calories / recipe_servings),
    protein_g: total_nutrients.protein_g / recipe_servings,
    carbs_g: total_nutrients.carbs_g / recipe_servings,
    fat_g: total_nutrients.fat_g / recipe_servings,
    fiber_g: total_nutrients.fiber_g / recipe_servings,
    sugar_g: total_nutrients.sugar_g / recipe_servings,
    sodium_mg: total_nutrients.sodium_mg / recipe_servings,
  };

  const recipe_food_name = `Recipe: ${recipe.name}`;
  const recipe_source_ref = `recipe:${recipe.id}`;

  await prisma.$transaction(async (tx) => {
    // Keep existing food logs immutable: when recipe nutrients change over time
    // we create a new derived food item shape instead of mutating older ones.
    const existing_recipe_food_item = await tx.foodItem.findFirst({
      where: {
        source: FoodSource.OTHER,
        source_ref: recipe_source_ref,
        name: recipe_food_name,
        calories: per_serving_nutrients.calories,
        protein_g: per_serving_nutrients.protein_g,
        carbs_g: per_serving_nutrients.carbs_g,
        fat_g: per_serving_nutrients.fat_g,
        fiber_g: per_serving_nutrients.fiber_g,
        sugar_g: per_serving_nutrients.sugar_g,
        sodium_mg: per_serving_nutrients.sodium_mg,
      },
    });

    const recipe_food_item =
      existing_recipe_food_item ??
      (await tx.foodItem.create({
        data: {
          name: recipe_food_name,
          brand: null,
          upc: null,
          serving_size: 1,
          serving_unit: "recipe serving",
          calories: per_serving_nutrients.calories,
          protein_g: per_serving_nutrients.protein_g,
          carbs_g: per_serving_nutrients.carbs_g,
          fat_g: per_serving_nutrients.fat_g,
          fiber_g: per_serving_nutrients.fiber_g,
          sugar_g: per_serving_nutrients.sugar_g,
          sodium_mg: per_serving_nutrients.sodium_mg,
          source: FoodSource.OTHER,
          source_ref: recipe_source_ref,
        },
      }));

    await tx.foodLog.create({
      data: {
        user_id: user.id,
        food_item_id: recipe_food_item.id,
        servings: parsed.data.servings,
        meal_type: parsed.data.meal_type,
        consumed_at: parsed.data.consumed_at,
        notes: parsed.data.notes,
      },
    });
  });

  revalidatePath("/recipes");
  revalidatePath("/food");
  revalidatePath("/dashboard");
}

export async function delete_recipe_action(form_data: FormData) {
  const user = await require_authenticated_user();
  const recipe_id = required_string(form_data.get("recipe_id"));

  if (!recipe_id) {
    throw new Error("Missing recipe id.");
  }

  await prisma.recipe.deleteMany({
    where: {
      id: recipe_id,
      user_id: user.id,
    },
  });

  revalidatePath("/recipes");
}
