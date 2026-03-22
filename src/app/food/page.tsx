import { AppShellHeader } from "@/components/app-shell-header";
import { FoodLogForm } from "@/components/food/food-log-form";
import {
  format_date_in_app_time_zone,
  format_datetime_local_in_app_time_zone,
} from "@/lib/app-time";
import { require_authenticated_user } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
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

type QuickPickFoodItem = {
  name: string;
  brand: string | null;
  upc: string | null;
  serving_size: number | null;
  serving_unit: string | null;
  serving_size_label: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  source: "manual" | "edamam" | "open_food_facts" | "other";
  source_ref: string | null;
  times_logged: number;
  last_logged_at: string;
  suggested_meal_type: MealTypeValue;
};

function to_provider_source(source: string): "manual" | "edamam" | "open_food_facts" | "other" {
  switch (source) {
    case "EDAMAM":
      return "edamam";
    case "OPEN_FOOD_FACTS":
      return "open_food_facts";
    case "OTHER":
      return "other";
    default:
      return "manual";
  }
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

  const quick_pick_by_food_item_id = new Map<
    string,
    {
      log_count: number;
      latest_consumed_at: Date;
      suggested_meal_type: MealTypeValue;
      item: (typeof food_logs)[number]["food_item"];
    }
  >();

  for (const log of food_logs) {
    const existing = quick_pick_by_food_item_id.get(log.food_item_id);
    const normalized_meal_type = normalize_meal_type(log.meal_type) ?? "snack";

    if (!existing) {
      quick_pick_by_food_item_id.set(log.food_item_id, {
        log_count: 1,
        latest_consumed_at: log.consumed_at,
        suggested_meal_type: normalized_meal_type,
        item: log.food_item,
      });
      continue;
    }

    existing.log_count += 1;

    if (log.consumed_at > existing.latest_consumed_at) {
      existing.latest_consumed_at = log.consumed_at;
      existing.suggested_meal_type = normalized_meal_type;
    }
  }

  const quick_pick_items: QuickPickFoodItem[] = Array.from(quick_pick_by_food_item_id.values())
    .sort((a, b) => {
      if (b.log_count !== a.log_count) {
        return b.log_count - a.log_count;
      }

      return b.latest_consumed_at.getTime() - a.latest_consumed_at.getTime();
    })
    .slice(0, 12)
    .map((entry) => ({
      name: entry.item.name,
      brand: entry.item.brand,
      upc: entry.item.upc,
      serving_size: entry.item.serving_size !== null ? Number(entry.item.serving_size) : null,
      serving_unit: entry.item.serving_unit,
      serving_size_label:
        entry.item.serving_size !== null && entry.item.serving_unit
          ? `${Number(entry.item.serving_size)} ${entry.item.serving_unit}`
          : null,
      calories: entry.item.calories,
      protein_g: Number(entry.item.protein_g),
      carbs_g: Number(entry.item.carbs_g),
      fat_g: Number(entry.item.fat_g),
      fiber_g: entry.item.fiber_g !== null ? Number(entry.item.fiber_g) : null,
      sugar_g: entry.item.sugar_g !== null ? Number(entry.item.sugar_g) : null,
      sodium_mg: entry.item.sodium_mg !== null ? Number(entry.item.sodium_mg) : null,
      source: to_provider_source(entry.item.source),
      source_ref: entry.item.source_ref,
      times_logged: entry.log_count,
      last_logged_at: entry.latest_consumed_at.toISOString(),
      suggested_meal_type: entry.suggested_meal_type,
    }));

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-4 py-6">
      <AppShellHeader
        title="Food Logs"
        subtitle="Search by food or UPC, then review and save."
        menu_email={user.email}
        menu_date={menu_date_label()}
      />

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Add Food Entry
        </h2>
        <div className="mt-4">
          <FoodLogForm action={create_food_log_action} quick_pick_items={quick_pick_items} />
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Recent Food Entries
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
