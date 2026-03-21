import { NextResponse } from "next/server";
import { require_api_user_id } from "@/lib/auth-api";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { user_id, error_response } = await require_api_user_id();

  if (error_response) {
    return error_response;
  }

  if (!user_id) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const entries = await prisma.weightEntry.findMany({
    where: { user_id },
    orderBy: { recorded_at: "asc" },
    select: {
      recorded_at: true,
      weight_lb: true,
    },
  });

  return NextResponse.json(
    {
      points: entries.map((entry) => ({
        recorded_at: entry.recorded_at.toISOString(),
        weight_lb: Number(entry.weight_lb),
      })),
    },
    { status: 200 },
  );
}
