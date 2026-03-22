import { NextResponse } from "next/server";
import { require_api_user_id } from "@/lib/auth-api";
import { get_nutrition_provider } from "@/server/nutrition/provider";

const UPC_PATTERN = /^\d{8,14}$/;

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

  const provider = get_nutrition_provider();

  if (provider.lookup_by_upc_debug) {
    const debug_data = await provider.lookup_by_upc_debug(upc);

    if (!debug_data) {
      return NextResponse.json({ debug: null }, { status: 404 });
    }

    return NextResponse.json({ debug: debug_data }, { status: 200 });
  }

  const normalized_item = await provider.lookup_by_upc(upc);

  return NextResponse.json(
    {
      debug: {
        provider: process.env.NUTRITION_PROVIDER ?? "unknown",
        upc,
        normalized_item,
        raw_payload: null,
        debug_summary: {
          message: "Current provider does not expose raw payload debug.",
        },
      },
    },
    { status: normalized_item ? 200 : 404 },
  );
}
