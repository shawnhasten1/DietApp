import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { require_api_user_id } from "@/lib/auth-api";
import { get_nutrition_provider_by_name } from "@/server/nutrition/provider";
import type { NormalizedFoodItem } from "@/server/nutrition/types";

const item_schema = z.object({
  name: z.string().min(1).max(200),
  brand: z.string().max(120).nullable(),
  upc: z.string().max(32).nullable(),
  selection_ref: z.string().max(512).nullable().optional(),
  serving_size: z.number().min(0).max(100000).nullable(),
  serving_unit: z.string().max(40).nullable(),
  serving_size_label: z.string().max(120).nullable(),
  calories: z.number().min(0).max(10000),
  protein_g: z.number().min(0).max(1000),
  carbs_g: z.number().min(0).max(1000),
  fat_g: z.number().min(0).max(1000),
  fiber_g: z.number().min(0).max(1000).nullable(),
  sugar_g: z.number().min(0).max(1000).nullable(),
  sodium_mg: z.number().min(0).max(200000).nullable(),
  source: z.enum(["manual", "edamam", "open_food_facts", "usda", "other"]),
  source_ref: z.string().max(240).nullable(),
});

const payload_schema = z.object({
  item: item_schema,
});

function is_hydratable_provider(source: string): source is "edamam" | "open_food_facts" | "usda" {
  return source === "edamam" || source === "open_food_facts" || source === "usda";
}

export async function POST(request: NextRequest) {
  const { error_response } = await require_api_user_id();

  if (error_response) {
    return error_response;
  }

  const payload = await request.json().catch(() => null);
  const parsed = payload_schema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid item payload." }, { status: 400 });
  }

  const item = parsed.data.item as NormalizedFoodItem;

  if (!is_hydratable_provider(item.source)) {
    return NextResponse.json(
      { item, hydration_applied: false, reason: "Selected source does not support hydration." },
      { status: 200 },
    );
  }

  const provider = get_nutrition_provider_by_name(item.source);

  if (!provider.hydrate_item) {
    return NextResponse.json(
      { item, hydration_applied: false, reason: "Provider does not implement hydration." },
      { status: 200 },
    );
  }

  try {
    const hydrated_item = await provider.hydrate_item(item);

    if (!hydrated_item) {
      return NextResponse.json(
        { item, hydration_applied: false, reason: "Hydration did not return a better result." },
        { status: 200 },
      );
    }

    return NextResponse.json(
      { item: hydrated_item, hydration_applied: true, reason: "Hydrated from provider nutrients API." },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { item, hydration_applied: false, reason: "Hydration request failed." },
      { status: 200 },
    );
  }
}
