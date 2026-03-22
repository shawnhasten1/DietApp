import { AppShellHeader } from "@/components/app-shell-header";
import { require_authenticated_user } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  create_exercise_log_action,
  delete_exercise_log_action,
  update_exercise_log_action,
} from "@/app/exercise/actions";

function datetime_local_value(date: Date): string {
  const timezone_offset_ms = new Date().getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezone_offset_ms).toISOString().slice(0, 16);
}

function now_datetime_local_value(): string {
  return datetime_local_value(new Date());
}

function menu_date_label(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default async function ExercisePage() {
  const user = await require_authenticated_user();

  const logs = await prisma.exerciseLog.findMany({
    where: { user_id: user.id },
    orderBy: { performed_at: "desc" },
    take: 30,
  });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-4 py-6">
      <AppShellHeader
        title="Exercise"
        subtitle="Track calories burned manually."
        menu_email={user.email}
        menu_date={menu_date_label()}
      />

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Add Exercise
        </h2>
        <form action={create_exercise_log_action} className="mt-4 space-y-3">
          <input
            name="activity_name"
            required
            placeholder="Activity name"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              name="duration_minutes"
              type="number"
              min={1}
              required
              placeholder="Minutes"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
            />
            <input
              name="calories_burned"
              type="number"
              min={0}
              required
              placeholder="Calories burned"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
            />
          </div>
          <input
            name="performed_at"
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
            Save Exercise
          </button>
        </form>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Recent Exercise Entries
        </h2>
        {logs.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No exercise entries yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {logs.map((log) => (
              <article key={log.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <form action={update_exercise_log_action} className="space-y-2">
                  <input type="hidden" name="log_id" value={log.id} />
                  <input
                    name="activity_name"
                    defaultValue={log.activity_name}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      name="duration_minutes"
                      type="number"
                      min={1}
                      defaultValue={log.duration_minutes}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <input
                      name="calories_burned"
                      type="number"
                      min={0}
                      defaultValue={log.calories_burned}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <input
                    name="performed_at"
                    type="datetime-local"
                    defaultValue={datetime_local_value(log.performed_at)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <textarea
                    name="notes"
                    rows={2}
                    defaultValue={log.notes ?? ""}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                  >
                    Update
                  </button>
                </form>
                <form action={delete_exercise_log_action} className="mt-2">
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
