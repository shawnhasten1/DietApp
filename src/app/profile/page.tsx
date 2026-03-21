import { AppShellHeader } from "@/components/app-shell-header";
import { require_authenticated_user } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { save_profile_action } from "@/app/profile/actions";

function date_to_input_value(date: Date | null): string {
  if (!date) {
    return "";
  }

  return new Date(date).toISOString().slice(0, 10);
}

export default async function ProfilePage() {
  const user = await require_authenticated_user();

  const profile = await prisma.userProfile.findUnique({
    where: { user_id: user.id },
    select: {
      display_name: true,
      date_of_birth: true,
      height_feet: true,
      height_inches: true,
      target_weight_lb: true,
      target_calories: true,
    },
  });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-4 py-6">
      <AppShellHeader title="Profile" subtitle={user.email ?? undefined} />

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Goals And Defaults
        </h2>

        <form action={save_profile_action} className="mt-4 space-y-4">
          <div className="space-y-1">
            <label htmlFor="display_name" className="text-sm font-medium text-slate-700">
              Display Name
            </label>
            <input
              id="display_name"
              name="display_name"
              defaultValue={profile?.display_name ?? ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="date_of_birth" className="text-sm font-medium text-slate-700">
              Date Of Birth
            </label>
            <input
              id="date_of_birth"
              name="date_of_birth"
              type="date"
              defaultValue={date_to_input_value(profile?.date_of_birth ?? null)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="height_feet" className="text-sm font-medium text-slate-700">
                Height (Feet)
              </label>
              <input
                id="height_feet"
                name="height_feet"
                type="number"
                min={1}
                max={8}
                defaultValue={profile?.height_feet ?? ""}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="height_inches" className="text-sm font-medium text-slate-700">
                Height (Inches)
              </label>
              <input
                id="height_inches"
                name="height_inches"
                type="number"
                min={0}
                max={11}
                defaultValue={profile?.height_inches ?? ""}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="target_weight_lb" className="text-sm font-medium text-slate-700">
                Target Weight (lb)
              </label>
              <input
                id="target_weight_lb"
                name="target_weight_lb"
                type="number"
                step="0.1"
                min={50}
                max={1000}
                defaultValue={profile?.target_weight_lb ? Number(profile.target_weight_lb) : ""}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="target_calories" className="text-sm font-medium text-slate-700">
                Calorie Goal
              </label>
              <input
                id="target_calories"
                name="target_calories"
                type="number"
                min={800}
                max={12000}
                defaultValue={profile?.target_calories ?? 2000}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Save Profile
          </button>
        </form>
      </section>
    </main>
  );
}
