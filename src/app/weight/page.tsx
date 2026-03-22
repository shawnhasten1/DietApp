import { AppShellHeader } from "@/components/app-shell-header";
import {
  format_date_in_app_time_zone,
  format_datetime_local_in_app_time_zone,
} from "@/lib/app-time";
import { require_authenticated_user } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  create_weight_entry_action,
  delete_weight_entry_action,
  update_weight_entry_action,
} from "@/app/weight/actions";

function now_datetime_local_value(): string {
  return format_datetime_local_in_app_time_zone(new Date());
}

function menu_date_label(): string {
  return format_date_in_app_time_zone(new Date(), {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default async function WeightPage() {
  const user = await require_authenticated_user();

  const entries = await prisma.weightEntry.findMany({
    where: { user_id: user.id },
    orderBy: { recorded_at: "desc" },
    take: 40,
  });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-4 py-6">
      <AppShellHeader
        title="Weight"
        subtitle="Track bodyweight over time."
        menu_email={user.email}
        menu_date={menu_date_label()}
      />

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Add Weight Entry
        </h2>
        <form action={create_weight_entry_action} className="mt-4 space-y-3">
          <input
            name="weight_lb"
            type="number"
            step="0.1"
            min={50}
            max={1000}
            required
            placeholder="Weight (lb)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
          />
          <input
            name="recorded_at"
            type="datetime-local"
            defaultValue={now_datetime_local_value()}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
          />
          <textarea
            name="notes"
            rows={2}
            placeholder="Notes"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Save Weight
          </button>
        </form>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Recent Weight Entries
        </h2>
        {entries.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No weight entries yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {entries.map((entry) => (
              <article
                key={entry.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3"
              >
                <form action={update_weight_entry_action} className="space-y-2">
                  <input type="hidden" name="entry_id" value={entry.id} />
                  <input
                    name="weight_lb"
                    type="number"
                    step="0.1"
                    min={50}
                    max={1000}
                    defaultValue={Number(entry.weight_lb)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    name="recorded_at"
                    type="datetime-local"
                    defaultValue={format_datetime_local_in_app_time_zone(entry.recorded_at)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <textarea
                    name="notes"
                    rows={2}
                    defaultValue={entry.notes ?? ""}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                  >
                    Update
                  </button>
                </form>
                <form action={delete_weight_entry_action} className="mt-2">
                  <input type="hidden" name="entry_id" value={entry.id} />
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
