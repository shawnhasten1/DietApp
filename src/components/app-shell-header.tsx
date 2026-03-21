import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";

type AppShellHeaderProps = {
  title: string;
  subtitle?: string;
};

export function AppShellHeader({ title, subtitle }: AppShellHeaderProps) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
        </div>
        <SignOutButton />
      </div>
      <nav className="mt-4 grid grid-cols-5 gap-2 text-center text-xs font-semibold text-slate-700">
        <Link href="/dashboard" className="rounded-lg bg-slate-50 px-2 py-2">
          Home
        </Link>
        <Link href="/food" className="rounded-lg bg-slate-50 px-2 py-2">
          Food
        </Link>
        <Link href="/exercise" className="rounded-lg bg-slate-50 px-2 py-2">
          Exercise
        </Link>
        <Link href="/weight" className="rounded-lg bg-slate-50 px-2 py-2">
          Weight
        </Link>
        <Link href="/profile" className="rounded-lg bg-slate-50 px-2 py-2">
          Profile
        </Link>
      </nav>
    </section>
  );
}
