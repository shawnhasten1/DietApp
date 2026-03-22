import Link from "next/link";
import { AppShellHeader } from "@/components/app-shell-header";
import { prisma } from "@/lib/prisma";
import { require_authenticated_user } from "@/lib/authz";
import { get_daily_summary } from "@/server/summary/get-daily-summary";

type CalorieTrendDay = {
  date_key: string;
  label: string;
  consumed: number;
  burned: number;
  net: number;
};

type WeightTrendDay = {
  date_key: string;
  label: string;
  weight_lb: number | null;
};

function start_of_day(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function day_key(date: Date): string {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function day_label_from_date(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function get_last_n_days(n: number, end_date = new Date()): Date[] {
  const days: Date[] = [];
  const end_day = start_of_day(end_date);

  for (let index = n - 1; index >= 0; index -= 1) {
    const date = new Date(end_day);
    date.setDate(end_day.getDate() - index);
    days.push(date);
  }

  return days;
}

function format_date(date_iso: string): string {
  return new Date(date_iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function build_calorie_trend(
  trend_days: Date[],
  food_logs: Array<{ consumed_at: Date; servings: unknown; food_item: { calories: number } }>,
  exercise_logs: Array<{ performed_at: Date; calories_burned: number }>,
): CalorieTrendDay[] {
  const trend_map = new Map<string, { consumed: number; burned: number }>();

  for (const day of trend_days) {
    trend_map.set(day_key(day), { consumed: 0, burned: 0 });
  }

  for (const log of food_logs) {
    const key = day_key(log.consumed_at);
    const existing = trend_map.get(key);
    if (!existing) {
      continue;
    }
    existing.consumed += Number(log.servings) * log.food_item.calories;
  }

  for (const log of exercise_logs) {
    const key = day_key(log.performed_at);
    const existing = trend_map.get(key);
    if (!existing) {
      continue;
    }
    existing.burned += log.calories_burned;
  }

  return trend_days.map((day) => {
    const key = day_key(day);
    const values = trend_map.get(key) ?? { consumed: 0, burned: 0 };
    return {
      date_key: key,
      label: day_label_from_date(day),
      consumed: Math.round(values.consumed),
      burned: Math.round(values.burned),
      net: Math.round(values.consumed - values.burned),
    };
  });
}

function build_weight_trend(
  trend_days: Date[],
  weight_entries: Array<{ recorded_at: Date; weight_lb: unknown }>,
): WeightTrendDay[] {
  const latest_by_day = new Map<string, { recorded_at: Date; weight_lb: number }>();

  for (const entry of weight_entries) {
    const key = day_key(entry.recorded_at);
    const existing = latest_by_day.get(key);

    if (!existing || entry.recorded_at > existing.recorded_at) {
      latest_by_day.set(key, {
        recorded_at: entry.recorded_at,
        weight_lb: Number(entry.weight_lb),
      });
    }
  }

  return trend_days.map((day) => {
    const key = day_key(day);
    const point = latest_by_day.get(key);

    return {
      date_key: key,
      label: day_label_from_date(day),
      weight_lb: point ? Number(point.weight_lb.toFixed(1)) : null,
    };
  });
}

function format_signed_number(value: number): string {
  if (value > 0) {
    return `+${value}`;
  }

  return String(value);
}

export default async function DashboardPage() {
  const user = await require_authenticated_user();
  const trend_days = get_last_n_days(7);
  const trend_start = trend_days[0];

  const [
    summary,
    profile,
    latest_weight,
    recent_food_logs,
    recent_exercise_logs,
    trend_food_logs,
    trend_exercise_logs,
    trend_weight_entries,
  ] = await Promise.all([
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
    prisma.foodLog.findMany({
      where: {
        user_id: user.id,
        consumed_at: { gte: trend_start },
      },
      select: {
        consumed_at: true,
        servings: true,
        food_item: {
          select: {
            calories: true,
          },
        },
      },
      orderBy: { consumed_at: "asc" },
    }),
    prisma.exerciseLog.findMany({
      where: {
        user_id: user.id,
        performed_at: { gte: trend_start },
      },
      select: {
        performed_at: true,
        calories_burned: true,
      },
      orderBy: { performed_at: "asc" },
    }),
    prisma.weightEntry.findMany({
      where: {
        user_id: user.id,
        recorded_at: { gte: trend_start },
      },
      select: {
        recorded_at: true,
        weight_lb: true,
      },
      orderBy: { recorded_at: "asc" },
    }),
  ]);

  const calorie_trend = build_calorie_trend(trend_days, trend_food_logs, trend_exercise_logs);
  const weight_trend = build_weight_trend(trend_days, trend_weight_entries);

  const calorie_trend_change = calorie_trend[calorie_trend.length - 1].net - calorie_trend[0].net;
  const known_weights = weight_trend.filter((day) => day.weight_lb !== null);
  const weight_trend_change =
    known_weights.length >= 2
      ? Number((known_weights[known_weights.length - 1].weight_lb! - known_weights[0].weight_lb!).toFixed(1))
      : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-4 py-6">
      <AppShellHeader
        title="Dashboard"
        subtitle="Daily summary"
        menu_email={user.email}
        menu_date={format_date(summary.date)}
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
          Latest: {latest_weight ? `${Number(latest_weight.weight_lb).toFixed(1)} lb` : "No entries yet"}
        </p>
        <p className="mt-1 text-sm text-slate-700">
          Target:{" "}
          {profile?.target_weight_lb ? `${Number(profile.target_weight_lb).toFixed(1)} lb` : "Not set"}
        </p>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">7-Day Calorie Trend</h2>
        <p className="mt-2 text-sm text-slate-700">
          Net change (today vs 7 days ago): {format_signed_number(calorie_trend_change)} cal
        </p>
        <div className="mt-3 space-y-2">
          {calorie_trend.map((day) => (
            <div key={day.date_key} className="grid grid-cols-4 rounded-lg bg-slate-50 px-3 py-2 text-xs">
              <span className="font-semibold text-slate-800">{day.label}</span>
              <span className="text-slate-600">In {day.consumed}</span>
              <span className="text-slate-600">Out {day.burned}</span>
              <span className="text-right font-semibold text-slate-900">Net {day.net}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">7-Day Weight Trend</h2>
        <p className="mt-2 text-sm text-slate-700">
          Change: {weight_trend_change !== null ? `${format_signed_number(weight_trend_change)} lb` : "Not enough data"}
        </p>
        <div className="mt-3 space-y-2">
          {weight_trend.map((day) => (
            <div key={day.date_key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
              <span className="font-semibold text-slate-800">{day.label}</span>
              <span className="text-slate-700">{day.weight_lb !== null ? `${day.weight_lb.toFixed(1)} lb` : "-"}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Today Actions</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-semibold">
          <Link href="/food" className="rounded-lg bg-slate-50 px-3 py-2 text-center">
            Log Food
          </Link>
          <Link href="/daily" className="rounded-lg bg-slate-50 px-3 py-2 text-center">
            Daily Log
          </Link>
          <Link href="/recipes" className="rounded-lg bg-slate-50 px-3 py-2 text-center">
            Recipe Builder
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
                  {log.food_item.name} x {Number(log.servings).toFixed(2)}
                </p>
                <p className="text-xs text-slate-600">
                  {Math.round(log.food_item.calories * Number(log.servings))} calories
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Recent Exercise</h2>
        {recent_exercise_logs.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No exercise entries yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {recent_exercise_logs.map((log) => (
              <div key={log.id} className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-sm font-semibold text-slate-900">{log.activity_name}</p>
                <p className="text-xs text-slate-600">
                  {log.duration_minutes} min | {log.calories_burned} cal burned
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
