import { NextRequest, NextResponse } from "next/server";
import { require_api_user_id } from "@/lib/auth-api";
import { get_nutrition_provider } from "@/server/nutrition/provider";

export async function GET(request: NextRequest) {
  const { error_response } = await require_api_user_id();

  if (error_response) {
    return error_response;
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limit_raw = request.nextUrl.searchParams.get("limit");
  const limit = Math.min(Math.max(Number(limit_raw) || 20, 1), 50);

  if (query.length < 2) {
    return NextResponse.json(
      { error: "Search query must be at least 2 characters." },
      { status: 400 },
    );
  }

  const provider = get_nutrition_provider();
  const items = await provider.search_foods(query, limit);

  return NextResponse.json({ items }, { status: 200 });
}
