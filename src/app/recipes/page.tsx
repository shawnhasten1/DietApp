import Link from "next/link";
import { AppShellHeader } from "@/components/app-shell-header";
import { RecipeBuilderForm } from "@/components/recipes/recipe-builder-form";
import { require_authenticated_user } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  create_recipe_action,
  delete_recipe_action,
  log_recipe_food_action,
} from "@/app/recipes/actions";

function menu_date_label(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function datetime_local_value(date: Date): string {
  const timezone_offset_ms = new Date().getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezone_offset_ms).toISOString().slice(0, 16);
}

function now_datetime_local_value(): string {
  return datetime_local_value(new Date());
}

function summarize_recipe(
  recipe: Array<{
    quantity: number;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }>,
) {
  return recipe.reduce(
    (accumulator, ingredient) => {
      return {
        calories: accumulator.calories + ingredient.calories * ingredient.quantity,
        protein_g: accumulator.protein_g + ingredient.protein_g * ingredient.quantity,
        carbs_g: accumulator.carbs_g + ingredient.carbs_g * ingredient.quantity,
        fat_g: accumulator.fat_g + ingredient.fat_g * ingredient.quantity,
      };
    },
    {
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
    },
  );
}

export default async function RecipesPage() {
  const user = await require_authenticated_user();

  const recipes = await prisma.recipe.findMany({
    where: {
      user_id: user.id,
    },
    include: {
      ingredients: {
        include: {
          food_item: true,
        },
        orderBy: {
          created_at: "asc",
        },
      },
    },
    orderBy: {
      created_at: "desc",
    },
  });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-4 py-6">
      <AppShellHeader
        title="Recipes"
        subtitle="Build once, log quickly later."
        menu_email={user.email}
        menu_date={menu_date_label()}
      />

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Create Recipe
        </h2>
        <div className="mt-4">
          <RecipeBuilderForm action={create_recipe_action} />
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Saved Recipes
        </h2>

        {recipes.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No saved recipes yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {recipes.map((recipe) => {
              const recipe_servings = Math.max(Number(recipe.servings), 0.01);
              const totals = summarize_recipe(
                recipe.ingredients.map((ingredient) => ({
                  quantity: Number(ingredient.quantity),
                  calories: ingredient.food_item.calories,
                  protein_g: Number(ingredient.food_item.protein_g),
                  carbs_g: Number(ingredient.food_item.carbs_g),
                  fat_g: Number(ingredient.food_item.fat_g),
                })),
              );

              const per_serving_calories = Math.round(totals.calories / recipe_servings);
              const per_serving_protein = (totals.protein_g / recipe_servings).toFixed(1);
              const per_serving_carbs = (totals.carbs_g / recipe_servings).toFixed(1);
              const per_serving_fat = (totals.fat_g / recipe_servings).toFixed(1);

              return (
                <article
                  key={recipe.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <p className="text-sm font-semibold text-slate-900">{recipe.name}</p>
                  <p className="text-xs text-slate-600">
                    Yields {recipe_servings.toFixed(2)} servings | {recipe.ingredients.length} ingredients
                  </p>
                  <p className="mt-1 text-xs text-slate-700">
                    Per serving: {per_serving_calories} cal | P {per_serving_protein} C{" "}
                    {per_serving_carbs} F {per_serving_fat}
                  </p>

                  {recipe.notes ? (
                    <p className="mt-2 rounded-lg bg-white px-2 py-1 text-xs text-slate-600">
                      {recipe.notes}
                    </p>
                  ) : null}

                  <div className="mt-2 space-y-1 rounded-lg bg-white p-2">
                    {recipe.ingredients.map((ingredient) => (
                      <p key={ingredient.id} className="text-xs text-slate-700">
                        {Number(ingredient.quantity).toFixed(2)} x {ingredient.food_item.name}
                      </p>
                    ))}
                  </div>

                  <form action={log_recipe_food_action} className="mt-3 space-y-2">
                    <input type="hidden" name="recipe_id" value={recipe.id} />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        name="servings"
                        type="number"
                        min={0.01}
                        step="0.01"
                        defaultValue={1}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                      <input
                        name="meal_type"
                        defaultValue="meal"
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <input
                      name="consumed_at"
                      type="datetime-local"
                      defaultValue={now_datetime_local_value()}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <input
                      name="notes"
                      placeholder="Optional log note"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                    >
                      Log Recipe
                    </button>
                  </form>

                  <form action={delete_recipe_action} className="mt-2">
                    <input type="hidden" name="recipe_id" value={recipe.id} />
                    <button
                      type="submit"
                      className="w-full rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
                    >
                      Delete Recipe
                    </button>
                  </form>
                  <Link
                    href={`/recipes/${recipe.id}/edit`}
                    className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-xs font-semibold text-slate-700"
                  >
                    Edit Recipe
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
