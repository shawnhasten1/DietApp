import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/signup-form";
import { get_server_session } from "@/lib/auth";

export default async function SignupPage() {
  const session = await get_server_session();

  if (session?.user?.id) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">Create Account</h1>
      <p className="mt-2 text-sm text-slate-600">
        Registration is limited to allowlisted household emails.
      </p>
      <div className="mt-6">
        <SignupForm />
      </div>
    </main>
  );
}
