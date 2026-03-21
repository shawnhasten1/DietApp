import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { get_server_session } from "@/lib/auth";

export default async function LoginPage() {
  const session = await get_server_session();

  if (session?.user?.id) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">Sign In</h1>
      <p className="mt-2 text-sm text-slate-600">
        Access is invite-only. Use an allowlisted email account.
      </p>
      <div className="mt-6">
        <LoginForm />
      </div>
    </main>
  );
}
