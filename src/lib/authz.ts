import { redirect } from "next/navigation";
import { get_server_session } from "@/lib/auth";

export async function require_authenticated_user() {
  const session = await get_server_session();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return session.user;
}
