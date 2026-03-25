import { AppShellHeader } from "@/components/app-shell-header";
import { FoodLogForm } from "@/components/food/food-log-form";
import {
  format_date_in_app_time_zone,
  format_datetime_local_in_app_time_zone,
} from "@/lib/app-time";
import type { QuickPickFoodItem } from "@/lib/food-item-types";
import { require_authenticated_user } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { build_quick_pick_items } from "@/server/food/build-quick-picks";
import {
  create_food_log_action,
  delete_food_log_action,
  update_food_log_action,
} from "@/app/food/actions";
import { meal_type_labels, meal_type_values, normalize_meal_type, type MealTypeValue } from "@/lib/meal-types";

function menu_date_label(): string {
  return format_date_in_app_time_zone(new Date(), {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function meal_value_or_default(value: string | null): MealTypeValue {
  return normalize_meal_type(value) ?? "snack";
}

export default async function FoodPage() {
  const user = await require_authenticated_user();

  const food_logs = await prisma.foodLog.findMany({
    where: { user_id: user.id },
    include: { food_item: true },
    orderBy: { consumed_at: "desc" },
    take: 120,
  });

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

  const quick_pick_items: QuickPickFoodItem[] = build_quick_pick_items(food_logs);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-4 py-6">
      <AppShellHeader
        title="Food Tools"
        subtitle="Advanced search, UPC fallback, and manual logging."
        menu_email={user.email}
        menu_date={menu_date_label()}
      />

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Advanced Food Entry
        </h2>
        <div className="mt-4">
          <FoodLogForm action={create_food_log_action} quick_pick_items={quick_pick_items} />
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Recent Food Tool Entries
        </h2>

        {food_logs.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No food logs yet.</p>
        ) : (
          <div className="mt-3 space-y-5">
            {meal_type_values.map((meal_type) => (
              <div key={meal_type}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  {meal_type_labels[meal_type]}
                </h3>

                {grouped_food_logs[meal_type].length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">No recent entries.</p>
                ) : (
                  <div className="mt-2 space-y-3">
                    {grouped_food_logs[meal_type].slice(0, 8).map((log) => (
                      <article
                        key={log.id}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                      >
                        <p className="text-sm font-semibold text-slate-900">{log.food_item.name}</p>
                        <p className="text-xs text-slate-600">
                          {log.food_item.brand ?? "No brand"}
                          {" | "}
                          {log.food_item.calories}
                          {" cal per serving"}
                        </p>

                        <form action={update_food_log_action} className="mt-3 space-y-2">
                          <input type="hidden" name="log_id" value={log.id} />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              name="servings"
                              type="number"
                              step="0.01"
                              min={0.01}
                              defaultValue={Number(log.servings)}
                              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            />
                            <select
                              name="meal_type"
                              defaultValue={meal_value_or_default(log.meal_type)}
                              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            >
                              {meal_type_values.map((value) => (
                                <option key={value} value={value}>
                                  {meal_type_labels[value]}
                                </option>
                              ))}
                            </select>
                          </div>
                          <input
                            name="consumed_at"
                            type="datetime-local"
                            defaultValue={format_datetime_local_in_app_time_zone(log.consumed_at)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          />
                          <textarea
                            name="notes"
                            rows={2}
                            defaultValue={log.notes ?? ""}
                            placeholder="Notes"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          />
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                            >
                              Update
                            </button>
                          </div>
                        </form>

                        <form action={delete_food_log_action} className="mt-2">
                          <input type="hidden" name="log_id" value={log.id} />
                          <button
                            type="submit"
                            className="w-full rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
                          >
                            Delete
                          </button>
                        </form>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
