import { NextResponse } from "next/server";
import { require_api_user_id } from "@/lib/auth-api";
import { get_upc_nutrition_provider_chain } from "@/server/nutrition/provider";
import type { UpcDebugResponse } from "@/server/nutrition/types";

const UPC_PATTERN = /^\d{8,14}$/;

function provider_label(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "unknown";
  }

  const constructor_name =
    "constructor" in value && value.constructor && "name" in value.constructor
      ? String(value.constructor.name ?? "")
      : "";

  if (constructor_name.toLowerCase().includes("openfoodfacts")) {
    return "open_food_facts";
  }

  if (constructor_name.toLowerCase().includes("edamam")) {
    return "edamam";
  }

  if (constructor_name.toLowerCase().includes("usda")) {
    return "usda";
  }

  return constructor_name || "unknown";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ upc: string }> },
) {
  const { error_response } = await require_api_user_id();

  if (error_response) {
    return error_response;
  }

  const { upc } = await params;

  if (!UPC_PATTERN.test(upc)) {
    return NextResponse.json({ error: "UPC must be 8 to 14 digits." }, { status: 400 });
  }

  const providers = get_upc_nutrition_provider_chain();
  let best_debug: UpcDebugResponse | null = null;

  for (const provider of providers) {
    if (provider.lookup_by_upc_debug) {
      const debug_data = await provider.lookup_by_upc_debug(upc);

      if (debug_data?.normalized_item) {
        return NextResponse.json({ debug: debug_data }, { status: 200 });
      }

      if (debug_data && !best_debug) {
        best_debug = debug_data;
      }

      continue;
    }

    const normalized_item = await provider.lookup_by_upc(upc);
    const fallback_debug = {
      provider: provider_label(provider),
      upc,
      normalized_item,
      raw_payload: null,
      debug_summary: {
        message: "Current provider does not expose raw payload debug.",
      },
    };

    if (normalized_item) {
      return NextResponse.json({ debug: fallback_debug }, { status: 200 });
    }

    if (!best_debug) {
      best_debug = fallback_debug;
    }
  }

  return NextResponse.json({ debug: best_debug }, { status: best_debug ? 200 : 404 });
}
