"use server";

import { revalidatePath } from "next/cache";
import { FoodSource } from "@prisma/client";
import { z } from "zod";
import { require_authenticated_user } from "@/lib/authz";
import { parse_datetime_local_in_app_time_zone } from "@/lib/app-time";
import { normalize_meal_type } from "@/lib/meal-types";
import { prisma } from "@/lib/prisma";

type FoodItemLookupInput = z.infer<typeof create_food_log_schema>;

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

const create_food_log_schema = z.object({
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
  servings: z.number().min(0.01).max(100),
  meal_type: z.string().max(32).nullable(),
  consumed_at: z.date(),
  notes: z.string().max(1000).nullable(),
});

const update_food_log_schema = z.object({
  log_id: z.string().min(1),
  servings: z.number().min(0.01).max(100),
  meal_type: z.string().max(32).nullable(),
  consumed_at: z.date(),
  notes: z.string().max(1000).nullable(),
});

function parse_meal_type(value: FormDataEntryValue | null): "breakfast" | "lunch" | "dinner" | "snack" {
  const raw = optional_string(value);
  return normalize_meal_type(raw) ?? "snack";
}

function build_food_item_match_conditions(data: FoodItemLookupInput) {
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

export async function create_food_log_action(form_data: FormData) {
  const user = await require_authenticated_user();

  const parsed = create_food_log_schema.safeParse({
    name: required_string(form_data.get("name")),
    brand: optional_string(form_data.get("brand")),
    upc: optional_string(form_data.get("upc")),
    serving_size: number_or_null(form_data.get("serving_size")),
    serving_unit: optional_string(form_data.get("serving_unit")),
    calories: number_or_null(form_data.get("calories")) ?? -1,
    protein_g: number_or_null(form_data.get("protein_g")) ?? -1,
    carbs_g: number_or_null(form_data.get("carbs_g")) ?? -1,
    fat_g: number_or_null(form_data.get("fat_g")) ?? -1,
    fiber_g: number_or_null(form_data.get("fiber_g")),
    sugar_g: number_or_null(form_data.get("sugar_g")),
    sodium_mg: number_or_null(form_data.get("sodium_mg")),
    source: (required_string(form_data.get("source")).toUpperCase() as FoodSource) || FoodSource.MANUAL,
    source_ref: optional_string(form_data.get("source_ref")),
    servings: number_or_null(form_data.get("servings")) ?? -1,
    meal_type: parse_meal_type(form_data.get("meal_type")),
    consumed_at: parse_datetime_or_now(form_data.get("consumed_at")),
    notes: optional_string(form_data.get("notes")),
  });

  if (!parsed.success) {
    throw new Error("Invalid food log input.");
  }

  const find_conditions = build_food_item_match_conditions(parsed.data);

  const existing_food_item =
    find_conditions.length > 0
      ? await prisma.foodItem.findFirst({
          where: {
            OR: find_conditions,
          },
        })
      : null;

  const food_item =
    existing_food_item ??
    (await prisma.foodItem.create({
      data: {
        name: parsed.data.name,
        brand: parsed.data.brand,
        upc: parsed.data.upc,
        serving_size: parsed.data.serving_size,
        serving_unit: parsed.data.serving_unit,
        calories: parsed.data.calories,
        protein_g: parsed.data.protein_g,
        carbs_g: parsed.data.carbs_g,
        fat_g: parsed.data.fat_g,
        fiber_g: parsed.data.fiber_g,
        sugar_g: parsed.data.sugar_g,
        sodium_mg: parsed.data.sodium_mg,
        source: parsed.data.source,
        source_ref: parsed.data.source_ref,
      },
    }));

  await prisma.foodLog.create({
    data: {
      user_id: user.id,
      food_item_id: food_item.id,
      servings: parsed.data.servings,
      meal_type: parsed.data.meal_type,
      consumed_at: parsed.data.consumed_at,
      notes: parsed.data.notes,
    },
  });

  revalidatePath("/food");
  revalidatePath("/daily");
  revalidatePath("/dashboard");
}

export async function update_food_log_action(form_data: FormData) {
  const user = await require_authenticated_user();

  const parsed = update_food_log_schema.safeParse({
    log_id: required_string(form_data.get("log_id")),
    servings: number_or_null(form_data.get("servings")) ?? -1,
    meal_type: parse_meal_type(form_data.get("meal_type")),
    consumed_at: parse_datetime_or_now(form_data.get("consumed_at")),
    notes: optional_string(form_data.get("notes")),
  });

  if (!parsed.success) {
    throw new Error("Invalid food log update input.");
  }

  const updated = await prisma.foodLog.updateMany({
    where: {
      id: parsed.data.log_id,
      user_id: user.id,
    },
    data: {
      servings: parsed.data.servings,
      meal_type: parsed.data.meal_type,
      consumed_at: parsed.data.consumed_at,
      notes: parsed.data.notes,
    },
  });

  if (updated.count !== 1) {
    throw new Error("Food log not found.");
  }

  revalidatePath("/food");
  revalidatePath("/daily");
  revalidatePath("/dashboard");
}

export async function delete_food_log_action(form_data: FormData) {
  const user = await require_authenticated_user();
  const log_id = required_string(form_data.get("log_id"));

  if (!log_id) {
    throw new Error("Missing food log id.");
  }

  await prisma.foodLog.deleteMany({
    where: {
      id: log_id,
      user_id: user.id,
    },
  });

  revalidatePath("/food");
  revalidatePath("/daily");
  revalidatePath("/dashboard");
}
