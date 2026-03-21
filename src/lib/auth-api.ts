import { NextResponse } from "next/server";
import { get_server_session } from "@/lib/auth";

export async function require_api_user_id() {
  const session = await get_server_session();

  if (!session?.user?.id) {
    return {
      user_id: null,
      error_response: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    };
  }

  return {
    user_id: session.user.id,
    error_response: null,
  };
}
