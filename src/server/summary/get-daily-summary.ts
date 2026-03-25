import { prisma } from "@/lib/prisma";
import { day_bounds_for_date_in_app_time_zone } from "@/lib/app-time";

function round_to_tenths(value: number): number {
  return Math.round(value * 10) / 10;
}

export async function get_daily_summary(user_id: string, date = new Date()) {
  const { day_start, day_end } = day_bounds_for_date_in_app_time_zone(date);

  const [food_logs, exercise_totals, profile] = await Promise.all([
    prisma.foodLog.findMany({
      where: {
        user_id,
        consumed_at: {
          gte: day_start,
          lt: day_end,
        },
      },
      include: {
        food_item: true,
      },
    }),
    prisma.exerciseLog.aggregate({
      where: {
        user_id,
        performed_at: {
          gte: day_start,
          lt: day_end,
        },
      },
      _sum: {
        calories_burned: true,
      },
    }),
    prisma.userProfile.findUnique({
      where: { user_id },
      select: {
        avg_tdee_calories: true,
      },
    }),
  ]);

  const consumed = food_logs.reduce((sum, log) => {
    return sum + Number(log.servings) * log.food_item.calories;
  }, 0);

  const protein = food_logs.reduce((sum, log) => {
    return sum + Number(log.servings) * Number(log.food_item.protein_g);
  }, 0);

  const carbs = food_logs.reduce((sum, log) => {
    return sum + Number(log.servings) * Number(log.food_item.carbs_g);
  }, 0);

  const fat = food_logs.reduce((sum, log) => {
    return sum + Number(log.servings) * Number(log.food_item.fat_g);
  }, 0);

  const burned = exercise_totals._sum.calories_burned ?? 0;
  const avg_tdee_calories = profile?.avg_tdee_calories ?? null;
  const total_burn_with_tdee_calories =
    avg_tdee_calories !== null ? avg_tdee_calories + burned : null;
  const calorie_balance_vs_tdee =
    total_burn_with_tdee_calories !== null
      ? Math.round(consumed - total_burn_with_tdee_calories)
      : null;
  const daily_deficit_vs_tdee =
    total_burn_with_tdee_calories !== null
      ? Math.round(total_burn_with_tdee_calories - consumed)
      : null;

  return {
    date: day_start.toISOString(),
    total_consumed_calories: Math.round(consumed),
    total_burned_calories: burned,
    net_calories: Math.round(consumed - burned),
    avg_tdee_calories,
    total_burn_with_tdee_calories,
    calorie_balance_vs_tdee,
    daily_deficit_vs_tdee,
    protein_g: round_to_tenths(protein),
    carbs_g: round_to_tenths(carbs),
    fat_g: round_to_tenths(fat),
  };
}
