"use client";

import { FormEvent, useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  callback_path_to_absolute_url,
  callback_url_to_path,
  extract_safe_callback_path,
} from "@/lib/callback-url";

export function LoginForm() {
  const router = useRouter();
  const search_params = useSearchParams();
  const callback_path = useMemo(
    () => extract_safe_callback_path(search_params.get("callbackUrl")),
    [search_params],
  );
  const callback_url = callback_path_to_absolute_url(callback_path);

  const [email, set_email] = useState("");
  const [password, set_password] = useState("");
  const [is_submitting, set_is_submitting] = useState(false);
  const [error_message, set_error_message] = useState<string | null>(null);

  async function on_submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    set_is_submitting(true);
    set_error_message(null);

    const result = await signIn("credentials", {
      email,
      password,
      callbackUrl: callback_url,
      redirect: false,
    });

    if (result?.error) {
      set_error_message("Sign-in failed. Check your email/password and invite status.");
      set_is_submitting(false);
      return;
    }

    router.push(callback_url_to_path(result?.url ?? callback_url));
    router.refresh();
  }

  async function sign_in_with_google() {
    await signIn("google", { callbackUrl: callback_url });
  }

  return (
    <form onSubmit={on_submit} className="space-y-4 rounded-xl bg-white p-5 shadow-sm">
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
          autoComplete="current-password"
          required
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
        {is_submitting ? "Signing in..." : "Sign In"}
      </button>

      <button
        type="button"
        onClick={sign_in_with_google}
        className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
      >
        Continue with Google
      </button>

      <p className="text-center text-sm text-slate-600">
        Need an account?{" "}
        <Link href="/signup" className="font-semibold text-slate-900 underline">
          Create one
        </Link>
      </p>
    </form>
  );
}
