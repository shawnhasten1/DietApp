import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-8">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Household Tracker
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">
          Nutrition + Fitness Logging
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Fast daily logging for food, exercise, and weight. Invite-only and private by
          default.
        </p>
      </section>

      <section className="mt-4 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Included In Scaffold
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          <li>Invite-only auth: Google + email/password</li>
          <li>Prisma schema for profiles, food logs, exercise logs, and weight</li>
          <li>Server-side nutrition provider abstraction + UPC/search routes</li>
          <li>Daily net calorie summary foundation</li>
        </ul>
      </section>

      <section className="mt-4 space-y-3">
        <Link
          href="/signup"
          className="block w-full rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white"
        >
          Create Account
        </Link>
        <Link
          href="/login"
          className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700"
        >
          Sign In
        </Link>
        <Link
          href="/dashboard"
          className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700"
        >
          Open Dashboard
        </Link>
      </section>
    </main>
  );
}
