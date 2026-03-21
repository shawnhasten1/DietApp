import Link from "next/link";
import { AppShellHeader } from "@/components/app-shell-header";
import { prisma } from "@/lib/prisma";
import { require_authenticated_user } from "@/lib/authz";
import { get_daily_summary } from "@/server/summary/get-daily-summary";

function format_date(date_iso: string): string {
  return new Date(date_iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default async function DashboardPage() {
  const user = await require_authenticated_user();

  const [summary, profile, latest_weight, recent_food_logs, recent_exercise_logs] = await Promise.all([
    get_daily_summary(user.id),
    prisma.userProfile.findUnique({
      where: { user_id: user.id },
      select: {
        target_calories: true,
        target_weight_lb: true,
      },
    }),
    prisma.weightEntry.findFirst({
      where: { user_id: user.id },
      orderBy: { recorded_at: "desc" },
      select: {
        weight_lb: true,
        recorded_at: true,
      },
    }),
    prisma.foodLog.findMany({
      where: { user_id: user.id },
      include: { food_item: true },
      orderBy: { consumed_at: "desc" },
      take: 5,
    }),
    prisma.exerciseLog.findMany({
      where: { user_id: user.id },
      orderBy: { performed_at: "desc" },
      take: 5,
    }),
  ]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-4 py-6">
      <AppShellHeader
        title="Dashboard"
        subtitle={`${user.email ?? "Signed in"} • ${format_date(summary.date)}`}
      />

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Consumed</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {summary.total_consumed_calories}
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Burned</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {summary.total_burned_calories}
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Net</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{summary.net_calories}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Target</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {profile?.target_calories ?? 2000}
          </p>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Macros</h2>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs uppercase text-slate-500">Protein</p>
            <p className="mt-1 font-semibold text-slate-900">{summary.protein_g} g</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs uppercase text-slate-500">Carbs</p>
            <p className="mt-1 font-semibold text-slate-900">{summary.carbs_g} g</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs uppercase text-slate-500">Fat</p>
            <p className="mt-1 font-semibold text-slate-900">{summary.fat_g} g</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Weight</h2>
        <p className="mt-2 text-sm text-slate-700">
          Latest:
          {" "}
          {latest_weight
            ? `${Number(latest_weight.weight_lb).toFixed(1)} lb`
            : "No entries yet"}
        </p>
        <p className="mt-1 text-sm text-slate-700">
          Target:
          {" "}
          {profile?.target_weight_lb ? `${Number(profile.target_weight_lb).toFixed(1)} lb` : "Not set"}
        </p>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Today Actions</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-semibold">
          <Link href="/food" className="rounded-lg bg-slate-50 px-3 py-2 text-center">
            Log Food
          </Link>
          <Link href="/exercise" className="rounded-lg bg-slate-50 px-3 py-2 text-center">
            Log Exercise
          </Link>
          <Link href="/weight" className="rounded-lg bg-slate-50 px-3 py-2 text-center">
            Log Weight
          </Link>
          <Link href="/profile" className="rounded-lg bg-slate-50 px-3 py-2 text-center">
            Edit Goals
          </Link>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Recent Food</h2>
        {recent_food_logs.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No food entries yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {recent_food_logs.map((log) => (
              <div key={log.id} className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-sm font-semibold text-slate-900">
                  {log.food_item.name}
                  {" x "}
                  {Number(log.servings).toFixed(2)}
                </p>
                <p className="text-xs text-slate-600">
                  {Math.round(log.food_item.calories * Number(log.servings))}
                  {" calories"}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Recent Exercise
        </h2>
        {recent_exercise_logs.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No exercise entries yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {recent_exercise_logs.map((log) => (
              <div key={log.id} className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-sm font-semibold text-slate-900">{log.activity_name}</p>
                <p className="text-xs text-slate-600">
                  {log.duration_minutes}
                  {" min • "}
                  {log.calories_burned}
                  {" cal burned"}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
