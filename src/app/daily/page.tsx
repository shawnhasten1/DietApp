import Link from "next/link";
import { AppShellHeader } from "@/components/app-shell-header";
import { MealAddFoodSheet } from "@/components/food/meal-add-food-sheet";
import { require_authenticated_user } from "@/lib/authz";
import {
  add_days_to_day_key,
  day_bounds_for_key_in_app_time_zone,
  format_date_in_app_time_zone,
  format_time_in_app_time_zone,
  normalize_day_key_in_app_time_zone,
} from "@/lib/app-time";
import { meal_type_labels, meal_type_values, normalize_meal_type, type MealTypeValue } from "@/lib/meal-types";
import { prisma } from "@/lib/prisma";
import { create_food_log_action } from "@/app/food/actions";
import { build_quick_pick_items } from "@/server/food/build-quick-picks";
import { get_daily_summary } from "@/server/summary/get-daily-summary";

function format_menu_date(date: Date): string {
  return format_date_in_app_time_zone(date, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function format_time(date: Date): string {
  return format_time_in_app_time_zone(date, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function round_to_tenth(value: number): number {
  return Math.round(value * 10) / 10;
}

export default async function DailyPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await require_authenticated_user();
  const { date } = await searchParams;

  const selected_day_key = normalize_day_key_in_app_time_zone(date);
  const bounds = day_bounds_for_key_in_app_time_zone(selected_day_key);

  if (!bounds) {
    throw new Error("Invalid day key.");
  }

  const { day_start, day_end } = bounds;
  const selected_day = day_start;

  const [summary, food_logs, recent_food_logs, exercise_logs, weight_entries] = await Promise.all([
    get_daily_summary(user.id, selected_day),
    prisma.foodLog.findMany({
      where: {
        user_id: user.id,
        consumed_at: {
          gte: day_start,
          lt: day_end,
        },
      },
      include: {
        food_item: true,
      },
      orderBy: {
        consumed_at: "asc",
      },
    }),
    prisma.foodLog.findMany({
      where: {
        user_id: user.id,
      },
      include: {
        food_item: true,
      },
      orderBy: {
        consumed_at: "desc",
      },
      take: 120,
    }),
    prisma.exerciseLog.findMany({
      where: {
        user_id: user.id,
        performed_at: {
          gte: day_start,
          lt: day_end,
        },
      },
      orderBy: {
        performed_at: "asc",
      },
    }),
    prisma.weightEntry.findMany({
      where: {
        user_id: user.id,
        recorded_at: {
          gte: day_start,
          lt: day_end,
        },
      },
      orderBy: {
        recorded_at: "asc",
      },
    }),
  ]);

  const grouped_food_logs: Record<MealTypeValue, typeof food_logs> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  };

  for (const log of food_logs) {
    const meal_type = normalize_meal_type(log.meal_type) ?? "snack";
    grouped_food_logs[meal_type].push(log);
  }

  const quick_pick_items = build_quick_pick_items(recent_food_logs);

  const previous_day_key = add_days_to_day_key(selected_day_key, -1);
  const next_day_key = add_days_to_day_key(selected_day_key, 1);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-4 py-6">
      <AppShellHeader
        title="Daily Log"
        subtitle="Review food, exercise, and weight by day."
        menu_email={user.email}
        menu_date={format_menu_date(selected_day)}
      />

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/daily?date=${previous_day_key}`}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
          >
            Previous
          </Link>
          <p className="text-sm font-semibold text-slate-900">{format_menu_date(selected_day)}</p>
          <Link
            href={`/daily?date=${next_day_key}`}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
          >
            Next
          </Link>
        </div>

        <form method="get" className="mt-3 flex gap-2">
          <input
            type="date"
            name="date"
            defaultValue={selected_day_key}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
          >
            Go
          </button>
        </form>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Consumed</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {summary.total_consumed_calories}
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Burned</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{summary.total_burned_calories}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Net</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{summary.net_calories}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Macros</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            P {summary.protein_g} C {summary.carbs_g} F {summary.fat_g}
          </p>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Food By Meal</h2>
        <div className="mt-3 space-y-4">
          {meal_type_values.map((meal_type) => (
            <div key={meal_type}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  {meal_type_labels[meal_type]}
                </p>
                <MealAddFoodSheet
                  meal_type={meal_type}
                  action={create_food_log_action}
                  quick_pick_items={quick_pick_items}
                />
              </div>
              {(() => {
                const meal_logs = grouped_food_logs[meal_type];
                const meal_calories = meal_logs.reduce((sum, log) => {
                  return sum + Number(log.servings) * log.food_item.calories;
                }, 0);
                const meal_protein = meal_logs.reduce((sum, log) => {
                  return sum + Number(log.servings) * Number(log.food_item.protein_g);
                }, 0);
                const meal_carbs = meal_logs.reduce((sum, log) => {
                  return sum + Number(log.servings) * Number(log.food_item.carbs_g);
                }, 0);
                const meal_fat = meal_logs.reduce((sum, log) => {
                  return sum + Number(log.servings) * Number(log.food_item.fat_g);
                }, 0);

                return (
                  <p className="mt-1 text-xs text-slate-600">
                    {Math.round(meal_calories)} cal | P {round_to_tenth(meal_protein)} C{" "}
                    {round_to_tenth(meal_carbs)} F {round_to_tenth(meal_fat)}
                  </p>
                );
              })()}
              {grouped_food_logs[meal_type].length === 0 ? (
                <p className="mt-1 text-sm text-slate-600">No entries.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {grouped_food_logs[meal_type].map((log) => (
                    <div key={log.id} className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-sm font-semibold text-slate-900">{log.food_item.name}</p>
                      <p className="text-xs text-slate-600">
                        {format_time(log.consumed_at)} | {Number(log.servings).toFixed(2)} servings |{" "}
                        {Math.round(Number(log.servings) * log.food_item.calories)} cal
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Exercise</h2>
        {exercise_logs.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No exercise entries.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {exercise_logs.map((log) => (
              <div key={log.id} className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-sm font-semibold text-slate-900">{log.activity_name}</p>
                <p className="text-xs text-slate-600">
                  {format_time(log.performed_at)} | {log.duration_minutes} min | {log.calories_burned} cal
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Weight</h2>
        {weight_entries.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No weight entries.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {weight_entries.map((entry) => (
              <div key={entry.id} className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-sm font-semibold text-slate-900">
                  {Number(entry.weight_lb).toFixed(1)} lb
                </p>
                <p className="text-xs text-slate-600">{format_time(entry.recorded_at)}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
