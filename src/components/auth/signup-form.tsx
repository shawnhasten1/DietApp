"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type SignupPayload = {
  email: string;
  password: string;
  display_name?: string;
};

export function SignupForm() {
  const router = useRouter();

  const [display_name, set_display_name] = useState("");
  const [email, set_email] = useState("");
  const [password, set_password] = useState("");
  const [is_submitting, set_is_submitting] = useState(false);
  const [error_message, set_error_message] = useState<string | null>(null);

  async function on_submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    set_is_submitting(true);
    set_error_message(null);

    const payload: SignupPayload = {
      email,
      password,
    };

    if (display_name.trim().length > 0) {
      payload.display_name = display_name.trim();
    }

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      set_error_message(data?.error ?? "Could not create account.");
      set_is_submitting(false);
      return;
    }

    const sign_in_result = await signIn("credentials", {
      email,
      password,
      callbackUrl: "/dashboard",
      redirect: false,
    });

    if (sign_in_result?.error) {
      set_error_message("Account was created, but auto-login failed. Please sign in manually.");
      set_is_submitting(false);
      router.push("/login");
      return;
    }

    router.push(sign_in_result?.url ?? "/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={on_submit} className="space-y-4 rounded-xl bg-white p-5 shadow-sm">
      <div className="space-y-2">
        <label htmlFor="display_name" className="block text-sm font-medium text-slate-700">
          Display Name (Optional)
        </label>
        <input
          id="display_name"
          name="display_name"
          type="text"
          value={display_name}
          onChange={(event) => set_display_name(event.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => set_email(event.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-medium text-slate-700">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => set_password(event.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
        />
      </div>

      {error_message ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error_message}</p>
      ) : null}

      <button
        type="submit"
        disabled={is_submitting}
        className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {is_submitting ? "Creating account..." : "Create Account"}
      </button>

      <p className="text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-slate-900 underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
