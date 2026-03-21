import { AppShellHeader } from "@/components/app-shell-header";
import { FoodLogForm } from "@/components/food/food-log-form";
import { require_authenticated_user } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  create_food_log_action,
  delete_food_log_action,
  update_food_log_action,
} from "@/app/food/actions";

function datetime_local_value(date: Date): string {
  const timezone_offset_ms = new Date().getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezone_offset_ms).toISOString().slice(0, 16);
}

export default async function FoodPage() {
  const user = await require_authenticated_user();

  const food_logs = await prisma.foodLog.findMany({
    where: { user_id: user.id },
    include: { food_item: true },
    orderBy: { consumed_at: "desc" },
    take: 30,
  });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-4 py-6">
      <AppShellHeader title="Food Logs" subtitle="Search by food or UPC, then review and save." />

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Add Food Entry
        </h2>
        <div className="mt-4">
          <FoodLogForm action={create_food_log_action} />
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Recent Food Entries
        </h2>

        {food_logs.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No food logs yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {food_logs.map((log) => (
              <article key={log.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
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
                    <input
                      name="meal_type"
                      defaultValue={log.meal_type ?? ""}
                      placeholder="Meal type"
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <input
                    name="consumed_at"
                    type="datetime-local"
                    defaultValue={datetime_local_value(log.consumed_at)}
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
      </section>
    </main>
  );
}
