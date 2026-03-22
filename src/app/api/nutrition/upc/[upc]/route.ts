import { NextResponse } from "next/server";
import { require_api_user_id } from "@/lib/auth-api";
import { get_upc_nutrition_provider_chain } from "@/server/nutrition/provider";

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

  const providers = get_upc_nutrition_provider_chain();
  let item = null;

  for (const provider of providers) {
    item = await provider.lookup_by_upc(upc);

    if (item) {
      break;
    }
  }

  if (!item) {
    return NextResponse.json({ item: null }, { status: 404 });
  }

  return NextResponse.json({ item }, { status: 200 });
}
