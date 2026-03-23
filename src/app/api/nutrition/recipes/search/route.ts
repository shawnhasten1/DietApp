import { NextRequest, NextResponse } from "next/server";
import { require_api_user_id } from "@/lib/auth-api";
import { search_edamam_recipes } from "@/server/nutrition/providers/edamam-recipe-provider";

export async function GET(request: NextRequest) {
  const { error_response } = await require_api_user_id();

  if (error_response) {
    return error_response;
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limit_raw = request.nextUrl.searchParams.get("limit");
  const limit = Math.min(Math.max(Number(limit_raw) || 8, 1), 20);

  if (query.length < 2) {
    return NextResponse.json(
      { error: "Search query must be at least 2 characters." },
      { status: 400 },
    );
  }

  const items = await search_edamam_recipes(query, limit);

  return NextResponse.json({ items }, { status: 200 });
}
