import { prisma } from "@/lib/prisma";

function start_of_day(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function end_of_day(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0);
}

function round_to_tenths(value: number): number {
  return Math.round(value * 10) / 10;
}

export async function get_daily_summary(user_id: string, date = new Date()) {
  const day_start = start_of_day(date);
  const day_end = end_of_day(date);

  const [food_logs, exercise_totals] = await Promise.all([
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

  return {
    date: day_start.toISOString(),
    total_consumed_calories: Math.round(consumed),
    total_burned_calories: burned,
    net_calories: Math.round(consumed - burned),
    protein_g: round_to_tenths(protein),
    carbs_g: round_to_tenths(carbs),
    fat_g: round_to_tenths(fat),
  };
}
