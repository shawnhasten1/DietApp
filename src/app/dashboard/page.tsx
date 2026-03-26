import Link from "next/link";
import { AppShellHeader } from "@/components/app-shell-header";
import { DashboardMealLogItem } from "@/components/food/dashboard-meal-log-item";
import { MealAddFoodSheet } from "@/components/food/meal-add-food-sheet";
import {
  add_days_to_day_key,
  day_bounds_for_date_in_app_time_zone,
  day_bounds_for_key_in_app_time_zone,
  day_key_in_app_time_zone,
  format_date_in_app_time_zone,
  format_datetime_local_in_app_time_zone,
  format_day_key_in_app_time_zone,
} from "@/lib/app-time";
import { prisma } from "@/lib/prisma";
import { require_authenticated_user } from "@/lib/authz";
import {
  create_food_log_action,
  delete_food_log_action,
  relog_recent_meal_action,
  update_food_log_action,
} from "@/app/food/actions";
import { meal_type_labels, meal_type_values, normalize_meal_type, type MealTypeValue } from "@/lib/meal-types";
import { build_quick_pick_items } from "@/server/food/build-quick-picks";
import { get_daily_summary } from "@/server/summary/get-daily-summary";
import { create_water_log_action, delete_water_log_action } from "@/app/water/actions";

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

type RecentMealTemplate = {
  date_key: string;
  meal_type: MealTypeValue;
  calories: number;
  item_count: number;
  food_names: string[];
};

function day_label_from_key(day_key: string): string {
  return format_day_key_in_app_time_zone(day_key, { weekday: "short" });
}

function get_last_n_day_keys(n: number, end_date = new Date()): string[] {
  const day_keys: string[] = [];
  const end_day_key = day_bounds_for_date_in_app_time_zone(end_date).day_key;

  for (let index = n - 1; index >= 0; index -= 1) {
    day_keys.push(add_days_to_day_key(end_day_key, -index));
  }

  return day_keys;
}

function get_previous_n_day_keys(n: number, end_date = new Date()): string[] {
  const day_keys: string[] = [];
  const end_day_key = day_bounds_for_date_in_app_time_zone(end_date).day_key;

  for (let index = n; index >= 1; index -= 1) {
    day_keys.push(add_days_to_day_key(end_day_key, -index));
  }

  return day_keys;
}

function format_date(date_iso: string): string {
  return format_date_in_app_time_zone(new Date(date_iso), {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function build_calorie_trend(
  trend_day_keys: string[],
  food_logs: Array<{ consumed_at: Date; servings: unknown; food_item: { calories: number } }>,
  exercise_logs: Array<{ performed_at: Date; calories_burned: number }>,
): CalorieTrendDay[] {
  const trend_map = new Map<string, { consumed: number; burned: number }>();

  for (const date_key of trend_day_keys) {
    trend_map.set(date_key, { consumed: 0, burned: 0 });
  }

  for (const log of food_logs) {
    const key = day_key_in_app_time_zone(log.consumed_at);
    const existing = trend_map.get(key);
    if (!existing) {
      continue;
    }
    existing.consumed += Number(log.servings) * log.food_item.calories;
  }

  for (const log of exercise_logs) {
    const key = day_key_in_app_time_zone(log.performed_at);
    const existing = trend_map.get(key);
    if (!existing) {
      continue;
    }
    existing.burned += log.calories_burned;
  }

  return trend_day_keys.map((date_key) => {
    const values = trend_map.get(date_key) ?? { consumed: 0, burned: 0 };
    return {
      date_key,
      label: day_label_from_key(date_key),
      consumed: Math.round(values.consumed),
      burned: Math.round(values.burned),
      net: Math.round(values.consumed - values.burned),
    };
  });
}

function build_weight_trend(
  trend_day_keys: string[],
  weight_entries: Array<{ recorded_at: Date; weight_lb: unknown }>,
): WeightTrendDay[] {
  const latest_by_day = new Map<string, { recorded_at: Date; weight_lb: number }>();

  for (const entry of weight_entries) {
    const key = day_key_in_app_time_zone(entry.recorded_at);
    const existing = latest_by_day.get(key);

    if (!existing || entry.recorded_at > existing.recorded_at) {
      latest_by_day.set(key, {
        recorded_at: entry.recorded_at,
        weight_lb: Number(entry.weight_lb),
      });
    }
  }

  return trend_day_keys.map((date_key) => {
    const point = latest_by_day.get(date_key);

    return {
      date_key,
      label: day_label_from_key(date_key),
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

function round_to_tenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function round_to_hundredth(value: number): number {
  return Math.round(value * 100) / 100;
}

function compute_streak_days(day_keys_with_entries: Set<string>, end_day_key: string): number {
  let streak = 0;
  let cursor = end_day_key;

  while (day_keys_with_entries.has(cursor)) {
    streak += 1;
    cursor = add_days_to_day_key(cursor, -1);
  }

  return streak;
}

function streak_badge(streak: number, metric: "food" | "weight"): string {
  if (streak >= 30) {
    return metric === "food" ? "Food Streak Legend" : "Weight Streak Legend";
  }

  if (streak >= 14) {
    return metric === "food" ? "Food Streak On Fire" : "Weight Streak On Fire";
  }

  if (streak >= 7) {
    return metric === "food" ? "Food Streak Builder" : "Weight Streak Builder";
  }

  if (streak >= 3) {
    return metric === "food" ? "Food Momentum" : "Weight Momentum";
  }

  return metric === "food" ? "Start Food Streak" : "Start Weight Streak";
}

export default async function DashboardPage() {
  const user = await require_authenticated_user();
  const trend_day_keys = get_last_n_day_keys(7);
  const deficit_basis_day_keys = get_previous_n_day_keys(7);
  const trend_start = day_bounds_for_key_in_app_time_zone(deficit_basis_day_keys[0])?.day_start ?? new Date(0);
  const today_bounds = day_bounds_for_date_in_app_time_zone(new Date());
  const streak_start =
    day_bounds_for_key_in_app_time_zone(add_days_to_day_key(today_bounds.day_key, -120))?.day_start ??
    new Date(0);
  const recent_meal_start =
    day_bounds_for_key_in_app_time_zone(add_days_to_day_key(today_bounds.day_key, -21))?.day_start ??
    new Date(0);

  const [
    summary,
    profile,
    latest_weight,
    recent_food_logs,
    recent_exercise_logs,
    today_food_logs,
    today_water_logs,
    quick_pick_logs,
    recent_meal_logs,
    trend_food_logs,
    trend_exercise_logs,
    trend_weight_entries,
    streak_food_logs,
    streak_weight_entries,
  ] = await Promise.all([
    get_daily_summary(user.id),
    prisma.userProfile.findUnique({
      where: { user_id: user.id },
      select: {
        target_calories: true,
        target_weight_lb: true,
        avg_tdee_calories: true,
        water_goal_oz: true,
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
        consumed_at: {
          gte: today_bounds.day_start,
          lt: today_bounds.day_end,
        },
      },
      include: {
        food_item: true,
      },
      orderBy: {
        consumed_at: "asc",
      },
    }),
    prisma.waterLog.findMany({
      where: {
        user_id: user.id,
        consumed_at: {
          gte: today_bounds.day_start,
          lt: today_bounds.day_end,
        },
      },
      orderBy: {
        consumed_at: "desc",
      },
      take: 20,
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
    prisma.foodLog.findMany({
      where: {
        user_id: user.id,
        consumed_at: {
          gte: recent_meal_start,
          lt: today_bounds.day_start,
        },
      },
      include: {
        food_item: {
          select: {
            name: true,
            calories: true,
          },
        },
      },
      orderBy: {
        consumed_at: "desc",
      },
      take: 300,
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
    prisma.foodLog.findMany({
      where: {
        user_id: user.id,
        consumed_at: { gte: streak_start },
      },
      select: {
        consumed_at: true,
      },
      orderBy: {
        consumed_at: "asc",
      },
    }),
    prisma.weightEntry.findMany({
      where: {
        user_id: user.id,
        recorded_at: { gte: streak_start },
      },
      select: {
        recorded_at: true,
      },
      orderBy: {
        recorded_at: "asc",
      },
    }),
  ]);

  const calorie_trend = build_calorie_trend(trend_day_keys, trend_food_logs, trend_exercise_logs);
  const deficit_basis_trend = build_calorie_trend(
    deficit_basis_day_keys,
    trend_food_logs,
    trend_exercise_logs,
  );
  const weight_trend = build_weight_trend(trend_day_keys, trend_weight_entries);
  const quick_pick_items = build_quick_pick_items(quick_pick_logs);
  const today_food_by_meal: Record<MealTypeValue, typeof today_food_logs> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  };

  for (const log of today_food_logs) {
    const meal_type = normalize_meal_type(log.meal_type) ?? "snack";
    today_food_by_meal[meal_type].push(log);
  }

  const total_water_oz = today_water_logs.reduce((sum, log) => sum + log.amount_oz, 0);
  const water_goal_oz = profile?.water_goal_oz ?? 64;
  const water_remaining_oz = Math.max(water_goal_oz - total_water_oz, 0);
  const water_progress_pct = Math.min(Math.round((total_water_oz / Math.max(water_goal_oz, 1)) * 100), 100);

  const food_day_keys = new Set(streak_food_logs.map((log) => day_key_in_app_time_zone(log.consumed_at)));
  const weight_day_keys = new Set(streak_weight_entries.map((entry) => day_key_in_app_time_zone(entry.recorded_at)));
  const food_streak_days = compute_streak_days(food_day_keys, today_bounds.day_key);
  const weight_streak_days = compute_streak_days(weight_day_keys, today_bounds.day_key);

  const recent_template_map = new Map<string, RecentMealTemplate>();

  for (const log of recent_meal_logs) {
    const meal_type = normalize_meal_type(log.meal_type) ?? "snack";
    const day_key = day_key_in_app_time_zone(log.consumed_at);
    const map_key = `${day_key}:${meal_type}`;
    const existing = recent_template_map.get(map_key);
    const calories = Math.round(Number(log.servings) * log.food_item.calories);

    if (!existing) {
      recent_template_map.set(map_key, {
        date_key: day_key,
        meal_type,
        calories,
        item_count: 1,
        food_names: [log.food_item.name],
      });
      continue;
    }

    existing.calories += calories;
    existing.item_count += 1;
    if (existing.food_names.length < 3 && !existing.food_names.includes(log.food_item.name)) {
      existing.food_names.push(log.food_item.name);
    }
  }

  const recent_meal_templates_by_type: Record<MealTypeValue, RecentMealTemplate[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  };

  for (const template of recent_template_map.values()) {
    recent_meal_templates_by_type[template.meal_type].push(template);
  }

  for (const meal_type of meal_type_values) {
    recent_meal_templates_by_type[meal_type] = recent_meal_templates_by_type[meal_type]
      .sort((a, b) => b.date_key.localeCompare(a.date_key))
      .slice(0, 3);
  }

  const calorie_trend_change = calorie_trend[calorie_trend.length - 1].net - calorie_trend[0].net;
  const known_weights = weight_trend.filter((day) => day.weight_lb !== null);
  const weight_trend_change =
    known_weights.length >= 2
      ? Number((known_weights[known_weights.length - 1].weight_lb! - known_weights[0].weight_lb!).toFixed(1))
      : null;

  const avg_tdee_calories = profile?.avg_tdee_calories ?? null;
  const planned_daily_deficit =
    avg_tdee_calories !== null ? avg_tdee_calories - summary.target_calories_for_day : null;
  const active_deficit_basis_days = deficit_basis_trend.filter(
    (day) => day.consumed > 0 || day.burned > 0,
  );
  const latest_logged_deficit_day =
    active_deficit_basis_days.length > 0
      ? active_deficit_basis_days[active_deficit_basis_days.length - 1]
      : null;
  const latest_logged_daily_deficit =
    avg_tdee_calories !== null && latest_logged_deficit_day
      ? avg_tdee_calories + latest_logged_deficit_day.burned - latest_logged_deficit_day.consumed
      : null;
  const seven_day_avg_daily_deficit =
    avg_tdee_calories !== null && active_deficit_basis_days.length > 0
      ? active_deficit_basis_days.reduce(
          (sum, day) => sum + (avg_tdee_calories + day.burned - day.consumed),
          0,
        ) / active_deficit_basis_days.length
      : null;
  const estimated_weekly_weight_change_lb =
    seven_day_avg_daily_deficit !== null
      ? round_to_hundredth((seven_day_avg_daily_deficit * 7) / 3500)
      : null;

  const latest_weight_lb = latest_weight ? Number(latest_weight.weight_lb) : null;
  const target_weight_lb = profile?.target_weight_lb ? Number(profile.target_weight_lb) : null;
  const pounds_to_lose =
    latest_weight_lb !== null &&
    target_weight_lb !== null &&
    target_weight_lb < latest_weight_lb
      ? latest_weight_lb - target_weight_lb
      : null;
  const estimated_days_to_goal =
    pounds_to_lose !== null &&
    seven_day_avg_daily_deficit !== null &&
    seven_day_avg_daily_deficit > 0
      ? Math.ceil((pounds_to_lose * 3500) / seven_day_avg_daily_deficit)
      : null;
  const estimated_weeks_to_goal =
    estimated_days_to_goal !== null ? round_to_hundredth(estimated_days_to_goal / 7) : null;
  const estimated_goal_date =
    estimated_days_to_goal !== null
      ? add_days_to_day_key(today_bounds.day_key, estimated_days_to_goal)
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
            {summary.target_calories_for_day}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {summary.target_calories_uses_schedule_override ? "Scheduled day target" : "Base day target"}
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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Consistency</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">🍽 Food Logging</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{food_streak_days} day streak</p>
            <p className="text-xs text-slate-600">{streak_badge(food_streak_days, "food")}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">⚖ Weight Logging</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{weight_streak_days} day streak</p>
            <p className="text-xs text-slate-600">{streak_badge(weight_streak_days, "weight")}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Water</h2>
        <p className="mt-2 text-sm text-slate-700">
          {total_water_oz} oz / {water_goal_oz} oz goal
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-cyan-500 transition-all"
            style={{ width: `${water_progress_pct}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-slate-600">
          {water_remaining_oz > 0 ? `${water_remaining_oz} oz remaining` : "Goal reached"}
        </p>

        <div className="mt-3 grid grid-cols-4 gap-2">
          {[8, 12, 16, 24].map((amount) => (
            <form key={amount} action={create_water_log_action}>
              <input type="hidden" name="amount_oz" value={amount} />
              <button
                type="submit"
                className="w-full rounded-lg border border-cyan-200 bg-cyan-50 px-2 py-2 text-xs font-semibold text-cyan-700"
              >
                💧 +{amount}
              </button>
            </form>
          ))}
        </div>

        <form action={create_water_log_action} className="mt-3 flex gap-2">
          <input
            name="amount_oz"
            type="number"
            min={1}
            max={2000}
            placeholder="Custom oz"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
          >
            Add
          </button>
        </form>

        {today_water_logs.length > 0 ? (
          <div className="mt-3 space-y-2">
            {today_water_logs.slice(0, 5).map((log) => (
              <div key={log.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-xs font-semibold text-slate-700">
                  💧 {log.amount_oz} oz
                </p>
                <form action={delete_water_log_action}>
                  <input type="hidden" name="log_id" value={log.id} />
                  <button
                    type="submit"
                    className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700"
                    aria-label="Delete water entry"
                  >
                    🗑
                  </button>
                </form>
              </div>
            ))}
          </div>
        ) : null}
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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Energy Plan</h2>
        {avg_tdee_calories === null ? (
          <p className="mt-2 text-sm text-slate-600">
            Add your average TDEE in Profile to unlock deficit and timeline estimates.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Avg TDEE</p>
                <p className="mt-1 font-semibold text-slate-900">{avg_tdee_calories} cal</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  Latest Deficit
                </p>
                <p
                  className={`mt-1 font-semibold ${
                    (latest_logged_daily_deficit ?? 0) >= 0 ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {latest_logged_daily_deficit !== null
                    ? `${format_signed_number(Math.round(latest_logged_daily_deficit))} cal`
                    : "-"}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">7-Day Avg Deficit</p>
                <p
                  className={`mt-1 font-semibold ${
                    (seven_day_avg_daily_deficit ?? 0) >= 0 ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {seven_day_avg_daily_deficit !== null
                    ? `${format_signed_number(Math.round(seven_day_avg_daily_deficit))} cal`
                    : "-"}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Weekly Pace</p>
                <p className="mt-1 font-semibold text-slate-900">
                  {estimated_weekly_weight_change_lb !== null
                    ? `${format_signed_number(estimated_weekly_weight_change_lb)} lb`
                    : "-"}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Goal Timeline
              </p>
              {latest_weight_lb === null ? (
                <p className="mt-2 text-slate-600">Log your current weight to estimate timeline.</p>
              ) : target_weight_lb === null ? (
                <p className="mt-2 text-slate-600">Set a target weight in Profile.</p>
              ) : target_weight_lb >= latest_weight_lb ? (
                <p className="mt-2 text-slate-600">
                  Timeline shows when target weight is below current weight.
                </p>
              ) : active_deficit_basis_days.length === 0 ? (
                <p className="mt-2 text-slate-600">
                  No entries in the last 7 days (excluding today) to estimate from yet.
                </p>
              ) : seven_day_avg_daily_deficit === null || seven_day_avg_daily_deficit <= 0 ? (
                <p className="mt-2 text-slate-600">
                  Recent average deficit is not positive yet.
                </p>
              ) : (
                <div className="mt-2 grid grid-cols-1 gap-1 text-slate-700">
                  <p>
                    To lose: <span className="font-semibold text-slate-900">{pounds_to_lose?.toFixed(1)} lb</span>
                  </p>
                  <p>
                    Estimated pace:{" "}
                    <span className="font-semibold text-slate-900">
                      {estimated_weeks_to_goal !== null ? `${estimated_weeks_to_goal} weeks` : "-"}
                    </span>
                  </p>
                  <p>
                    Goal date:{" "}
                    <span className="font-semibold text-slate-900">
                      {estimated_goal_date
                        ? format_day_key_in_app_time_zone(estimated_goal_date, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "-"}
                    </span>
                  </p>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-500">
              Based on {active_deficit_basis_days.length} of last 7 days (excluding today).
            </p>
            <p className="text-xs text-slate-500">
              Planned deficit vs goal:{" "}
              {planned_daily_deficit !== null ? `${format_signed_number(planned_daily_deficit)} cal/day` : "-"}
            </p>
          </div>
        )}
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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Today Meals</h2>
        <div className="mt-3 space-y-4">
          {meal_type_values.map((meal_type, index) => {
            const meal_logs = today_food_by_meal[meal_type];
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
              <div
                key={meal_type}
                className={index > 0 ? "border-t border-slate-200 pt-4" : ""}
              >
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
                <p className="mt-1 text-xs text-slate-600">
                  {Math.round(meal_calories)} cal | P {round_to_tenth(meal_protein)} C{" "}
                  {round_to_tenth(meal_carbs)} F {round_to_tenth(meal_fat)}
                </p>
                {meal_logs.length === 0 ? (
                  <p className="mt-1 text-sm text-slate-600">No entries yet.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {meal_logs.map((log) => (
                      <DashboardMealLogItem
                        key={log.id}
                        log={{
                          id: log.id,
                          name: log.food_item.name,
                          brand: log.food_item.brand,
                          servings: Number(log.servings),
                          calories_per_serving: log.food_item.calories,
                          meal_type: normalize_meal_type(log.meal_type) ?? "snack",
                          consumed_at_local: format_datetime_local_in_app_time_zone(log.consumed_at),
                          notes: log.notes ?? "",
                        }}
                        update_action={update_food_log_action}
                        delete_action={delete_food_log_action}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Quick Re-Log Meals</h2>
        <p className="mt-1 text-xs text-slate-600">
          One tap to copy a recent meal into today.
        </p>
        <div className="mt-3 space-y-4">
          {meal_type_values.map((meal_type) => {
            const templates = recent_meal_templates_by_type[meal_type];

            return (
              <div key={meal_type}>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  {meal_type_labels[meal_type]}
                </p>
                {templates.length === 0 ? (
                  <p className="mt-1 text-xs text-slate-500">No recent {meal_type_labels[meal_type].toLowerCase()} templates.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {templates.map((template) => (
                      <form key={`${template.date_key}-${template.meal_type}`} action={relog_recent_meal_action}>
                        <input type="hidden" name="source_day_key" value={template.date_key} />
                        <input type="hidden" name="meal_type" value={template.meal_type} />
                        <button
                          type="submit"
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left"
                        >
                          <p className="text-xs font-semibold text-slate-800">
                            🔁 {format_day_key_in_app_time_zone(template.date_key, { weekday: "short", month: "short", day: "numeric" })}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-600">
                            {template.item_count} items | {template.calories} cal
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-slate-500">
                            {template.food_names.join(" · ")}
                          </p>
                        </button>
                      </form>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Today Actions</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-semibold">
          <Link href="/food" className="rounded-lg bg-slate-50 px-3 py-2 text-center">
            Food Tools
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
          <Link href="/check-in" className="rounded-lg bg-slate-50 px-3 py-2 text-center">
            📊 Weekly Check-In
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
