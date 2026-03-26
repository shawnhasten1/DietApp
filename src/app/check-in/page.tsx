import { AppShellHeader } from "@/components/app-shell-header";
import {
  add_days_to_day_key,
  day_bounds_for_date_in_app_time_zone,
  day_bounds_for_key_in_app_time_zone,
  day_key_in_app_time_zone,
  format_day_key_in_app_time_zone,
} from "@/lib/app-time";
import { resolve_target_calories_for_date } from "@/lib/calorie-target";
import { require_authenticated_user } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

type WeeklyDaySummary = {
  day_key: string;
  consumed: number;
  burned: number;
  water_oz: number;
  target: number;
};

function build_week_day_keys(end_day_key: string, days = 7): string[] {
  const keys: string[] = [];

  for (let index = days - 1; index >= 0; index -= 1) {
    keys.push(add_days_to_day_key(end_day_key, -index));
  }

  return keys;
}

function round_to_tenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function round_to_hundredth(value: number): number {
  return Math.round(value * 100) / 100;
}

function format_signed_number(value: number): string {
  if (value > 0) {
    return `+${value}`;
  }

  return String(value);
}

export default async function CheckInPage() {
  const user = await require_authenticated_user();
  const today_bounds = day_bounds_for_date_in_app_time_zone(new Date());
  const end_day_key = add_days_to_day_key(today_bounds.day_key, -1);
  const start_day_key = add_days_to_day_key(end_day_key, -6);
  const range_start = day_bounds_for_key_in_app_time_zone(start_day_key)?.day_start ?? new Date(0);
  const range_end = today_bounds.day_start;
  const week_day_keys = build_week_day_keys(end_day_key);

  const [profile, food_logs, exercise_logs, water_logs, weight_entries] = await Promise.all([
    prisma.userProfile.findUnique({
      where: { user_id: user.id },
      select: {
        target_weight_lb: true,
        target_calories: true,
        target_calories_sun: true,
        target_calories_mon: true,
        target_calories_tue: true,
        target_calories_wed: true,
        target_calories_thu: true,
        target_calories_fri: true,
        target_calories_sat: true,
        avg_tdee_calories: true,
        water_goal_oz: true,
      },
    }),
    prisma.foodLog.findMany({
      where: {
        user_id: user.id,
        consumed_at: {
          gte: range_start,
          lt: range_end,
        },
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
      orderBy: {
        consumed_at: "asc",
      },
    }),
    prisma.exerciseLog.findMany({
      where: {
        user_id: user.id,
        performed_at: {
          gte: range_start,
          lt: range_end,
        },
      },
      select: {
        performed_at: true,
        calories_burned: true,
      },
      orderBy: {
        performed_at: "asc",
      },
    }),
    prisma.waterLog.findMany({
      where: {
        user_id: user.id,
        consumed_at: {
          gte: range_start,
          lt: range_end,
        },
      },
      select: {
        consumed_at: true,
        amount_oz: true,
      },
      orderBy: {
        consumed_at: "asc",
      },
    }),
    prisma.weightEntry.findMany({
      where: {
        user_id: user.id,
        recorded_at: {
          gte: range_start,
          lt: range_end,
        },
      },
      select: {
        recorded_at: true,
        weight_lb: true,
      },
      orderBy: {
        recorded_at: "asc",
      },
    }),
  ]);

  const calorie_schedule = {
    target_calories: profile?.target_calories ?? 2000,
    target_calories_sun: profile?.target_calories_sun ?? null,
    target_calories_mon: profile?.target_calories_mon ?? null,
    target_calories_tue: profile?.target_calories_tue ?? null,
    target_calories_wed: profile?.target_calories_wed ?? null,
    target_calories_thu: profile?.target_calories_thu ?? null,
    target_calories_fri: profile?.target_calories_fri ?? null,
    target_calories_sat: profile?.target_calories_sat ?? null,
  };

  const weekly_map = new Map<string, WeeklyDaySummary>();
  for (const day_key of week_day_keys) {
    const day_bounds = day_bounds_for_key_in_app_time_zone(day_key);
    const target =
      day_bounds !== null
        ? resolve_target_calories_for_date(calorie_schedule, day_bounds.day_start).target_calories
        : calorie_schedule.target_calories;

    weekly_map.set(day_key, {
      day_key,
      consumed: 0,
      burned: 0,
      water_oz: 0,
      target,
    });
  }

  for (const log of food_logs) {
    const key = day_key_in_app_time_zone(log.consumed_at);
    const day = weekly_map.get(key);
    if (!day) {
      continue;
    }

    day.consumed += Number(log.servings) * log.food_item.calories;
  }

  for (const log of exercise_logs) {
    const key = day_key_in_app_time_zone(log.performed_at);
    const day = weekly_map.get(key);
    if (!day) {
      continue;
    }

    day.burned += log.calories_burned;
  }

  for (const log of water_logs) {
    const key = day_key_in_app_time_zone(log.consumed_at);
    const day = weekly_map.get(key);
    if (!day) {
      continue;
    }

    day.water_oz += log.amount_oz;
  }

  const weekly_days = week_day_keys
    .map((key) => weekly_map.get(key))
    .filter((day): day is WeeklyDaySummary => day !== undefined);

  const logged_days = weekly_days.filter((day) => day.consumed > 0 || day.burned > 0);
  const divisor = Math.max(logged_days.length, 1);

  const avg_consumed = round_to_tenth(logged_days.reduce((sum, day) => sum + day.consumed, 0) / divisor);
  const avg_burned = round_to_tenth(logged_days.reduce((sum, day) => sum + day.burned, 0) / divisor);
  const avg_target = round_to_tenth(weekly_days.reduce((sum, day) => sum + day.target, 0) / Math.max(weekly_days.length, 1));
  const avg_net = round_to_tenth(avg_consumed - avg_burned);
  const avg_water_oz = round_to_tenth(weekly_days.reduce((sum, day) => sum + day.water_oz, 0) / Math.max(weekly_days.length, 1));
  const avg_water_goal = profile?.water_goal_oz ?? 64;

  const avg_deficit_vs_target = round_to_tenth(avg_target - avg_consumed);
  const avg_tdee_calories = profile?.avg_tdee_calories ?? null;
  const avg_deficit_vs_tdee =
    avg_tdee_calories !== null
      ? round_to_tenth(
          logged_days.reduce((sum, day) => sum + (avg_tdee_calories + day.burned - day.consumed), 0) / divisor,
        )
      : null;
  const estimated_weekly_change_lb =
    avg_deficit_vs_tdee !== null ? round_to_hundredth((avg_deficit_vs_tdee * 7) / 3500) : null;

  const latest_weight = weight_entries.length > 0 ? Number(weight_entries[weight_entries.length - 1].weight_lb) : null;
  const earliest_weight = weight_entries.length > 0 ? Number(weight_entries[0].weight_lb) : null;
  const weight_change =
    latest_weight !== null && earliest_weight !== null
      ? round_to_tenth(latest_weight - earliest_weight)
      : null;
  const target_weight_lb = profile?.target_weight_lb ? Number(profile.target_weight_lb) : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-4 py-6">
      <AppShellHeader
        title="Weekly Check-In"
        subtitle="Last 7 complete days"
        menu_email={user.email}
        menu_date={`${format_day_key_in_app_time_zone(start_day_key, {
          month: "short",
          day: "numeric",
        })} - ${format_day_key_in_app_time_zone(end_day_key, { month: "short", day: "numeric" })}`}
      />

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Avg Intake</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{avg_consumed}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Avg Burn</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{avg_burned}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Avg Net</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{avg_net}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Avg Water</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{avg_water_oz} oz</p>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Pace</h2>
        <p className="mt-2 text-sm text-slate-700">
          Avg target: <span className="font-semibold text-slate-900">{avg_target} cal</span>
        </p>
        <p className="mt-1 text-sm text-slate-700">
          Deficit vs target: <span className="font-semibold text-slate-900">{format_signed_number(avg_deficit_vs_target)} cal/day</span>
        </p>
        <p className="mt-1 text-sm text-slate-700">
          Avg water goal: <span className="font-semibold text-slate-900">{avg_water_goal} oz/day</span>
        </p>
        <p className="mt-1 text-sm text-slate-700">
          Deficit vs TDEE:{" "}
          <span className="font-semibold text-slate-900">
            {avg_deficit_vs_tdee !== null ? `${format_signed_number(avg_deficit_vs_tdee)} cal/day` : "Add TDEE in profile"}
          </span>
        </p>
        <p className="mt-1 text-sm text-slate-700">
          Estimated weekly change:{" "}
          <span className="font-semibold text-slate-900">
            {estimated_weekly_change_lb !== null ? `${format_signed_number(estimated_weekly_change_lb)} lb/week` : "-"}
          </span>
        </p>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Weight Check</h2>
        <p className="mt-2 text-sm text-slate-700">
          Week change:{" "}
          <span className="font-semibold text-slate-900">
            {weight_change !== null ? `${format_signed_number(weight_change)} lb` : "Not enough entries"}
          </span>
        </p>
        <p className="mt-1 text-sm text-slate-700">
          Target:{" "}
          <span className="font-semibold text-slate-900">
            {target_weight_lb !== null ? `${target_weight_lb.toFixed(1)} lb` : "Set in profile"}
          </span>
        </p>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Daily Breakdown</h2>
        <div className="mt-3 space-y-2">
          {weekly_days.map((day) => (
            <div key={day.day_key} className="grid grid-cols-5 rounded-lg bg-slate-50 px-3 py-2 text-xs">
              <span className="font-semibold text-slate-800">
                {format_day_key_in_app_time_zone(day.day_key, { weekday: "short" })}
              </span>
              <span className="text-slate-700">In {Math.round(day.consumed)}</span>
              <span className="text-slate-700">Out {Math.round(day.burned)}</span>
              <span className="text-slate-700">💧 {day.water_oz}</span>
              <span className="text-right text-slate-700">Tgt {Math.round(day.target)}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">Based on {logged_days.length} logged days out of 7.</p>
      </section>
    </main>
  );
}

