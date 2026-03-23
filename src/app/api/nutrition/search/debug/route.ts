import { NextRequest, NextResponse } from "next/server";
import { require_api_user_id } from "@/lib/auth-api";
import { get_nutrition_provider_by_name } from "@/server/nutrition/provider";

function provider_label(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "unknown";
  }

  const constructor_name =
    "constructor" in value && value.constructor && "name" in value.constructor
      ? String(value.constructor.name ?? "")
      : "";
  const normalized = constructor_name.toLowerCase();

  if (normalized.includes("openfoodfacts")) {
    return "open_food_facts";
  }

  if (normalized.includes("edamam")) {
    return "edamam";
  }

  if (normalized.includes("usda")) {
    return "usda";
  }

  return constructor_name || "unknown";
}

export async function GET(request: NextRequest) {
  const { error_response } = await require_api_user_id();

  if (error_response) {
    return error_response;
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const provider_name = request.nextUrl.searchParams.get("provider");
  const limit_raw = request.nextUrl.searchParams.get("limit");
  const limit = Math.min(Math.max(Number(limit_raw) || 12, 1), 25);

  if (query.length < 2) {
    return NextResponse.json(
      { error: "Search query must be at least 2 characters." },
      { status: 400 },
    );
  }

  const provider = get_nutrition_provider_by_name(provider_name);

  if (provider.search_foods_debug) {
    const debug = await provider.search_foods_debug(query, limit);

    if (!debug) {
      return NextResponse.json({ debug: null }, { status: 404 });
    }

    return NextResponse.json({ debug }, { status: 200 });
  }

  const items = await provider.search_foods(query, limit);

  return NextResponse.json(
    {
      debug: {
        provider: provider_label(provider),
        query,
        normalized_items: items,
        raw_payload: null,
        debug_summary: {
          message: "Selected provider does not expose search debug payload.",
        },
      },
    },
    { status: 200 },
  );
}
