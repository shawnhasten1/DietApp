import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShellHeader } from "@/components/app-shell-header";
import { RecipeBuilderForm } from "@/components/recipes/recipe-builder-form";
import { format_date_in_app_time_zone } from "@/lib/app-time";
import { require_authenticated_user } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { update_recipe_action } from "@/app/recipes/actions";

function menu_date_label(): string {
  return format_date_in_app_time_zone(new Date(), {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function source_to_form_source(
  source: "MANUAL" | "EDAMAM" | "OPEN_FOOD_FACTS" | "OTHER",
): "manual" | "edamam" | "open_food_facts" | "other" {
  switch (source) {
    case "MANUAL":
      return "manual";
    case "EDAMAM":
      return "edamam";
    case "OPEN_FOOD_FACTS":
      return "open_food_facts";
    default:
      return "other";
  }
}

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ recipe_id: string }>;
}) {
  const user = await require_authenticated_user();
  const { recipe_id } = await params;

  const recipe = await prisma.recipe.findFirst({
    where: {
      id: recipe_id,
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
  });

  if (!recipe) {
    notFound();
  }

  const saved_recipes = await prisma.recipe.findMany({
    where: {
      user_id: user.id,
      id: {
        not: recipe.id,
      },
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

  const initial_recipe = {
    name: recipe.name,
    servings: Number(recipe.servings),
    notes: recipe.notes,
    ingredients: recipe.ingredients.map((ingredient) => ({
      name: ingredient.food_item.name,
      brand: ingredient.food_item.brand,
      upc: ingredient.food_item.upc,
      serving_size:
        ingredient.food_item.serving_size !== null
          ? Number(ingredient.food_item.serving_size)
          : null,
      serving_unit: ingredient.food_item.serving_unit,
      serving_size_label:
        ingredient.food_item.serving_size !== null
          ? `1 ${ingredient.food_item.serving_unit ?? "serving"} (${Number(
              ingredient.food_item.serving_size,
            )} ${ingredient.food_item.serving_unit ?? ""})`
          : null,
      calories: ingredient.food_item.calories,
      protein_g: Number(ingredient.food_item.protein_g),
      carbs_g: Number(ingredient.food_item.carbs_g),
      fat_g: Number(ingredient.food_item.fat_g),
      fiber_g:
        ingredient.food_item.fiber_g !== null ? Number(ingredient.food_item.fiber_g) : null,
      sugar_g:
        ingredient.food_item.sugar_g !== null ? Number(ingredient.food_item.sugar_g) : null,
      sodium_mg:
        ingredient.food_item.sodium_mg !== null ? Number(ingredient.food_item.sodium_mg) : null,
      source: source_to_form_source(ingredient.food_item.source),
      source_ref: ingredient.food_item.source_ref,
      quantity: Number(ingredient.quantity),
    })),
  };

  const saved_recipe_templates = saved_recipes.map((saved_recipe) => ({
    id: saved_recipe.id,
    name: saved_recipe.name,
    servings: Number(saved_recipe.servings),
    notes: saved_recipe.notes,
    ingredients: saved_recipe.ingredients.map((ingredient) => ({
      name: ingredient.food_item.name,
      brand: ingredient.food_item.brand,
      upc: ingredient.food_item.upc,
      serving_size:
        ingredient.food_item.serving_size !== null
          ? Number(ingredient.food_item.serving_size)
          : null,
      serving_unit: ingredient.food_item.serving_unit,
      serving_size_label:
        ingredient.food_item.serving_size !== null
          ? `1 ${ingredient.food_item.serving_unit ?? "serving"} (${Number(
              ingredient.food_item.serving_size,
            )} ${ingredient.food_item.serving_unit ?? ""})`
          : null,
      calories: ingredient.food_item.calories,
      protein_g: Number(ingredient.food_item.protein_g),
      carbs_g: Number(ingredient.food_item.carbs_g),
      fat_g: Number(ingredient.food_item.fat_g),
      fiber_g:
        ingredient.food_item.fiber_g !== null ? Number(ingredient.food_item.fiber_g) : null,
      sugar_g:
        ingredient.food_item.sugar_g !== null ? Number(ingredient.food_item.sugar_g) : null,
      sodium_mg:
        ingredient.food_item.sodium_mg !== null ? Number(ingredient.food_item.sodium_mg) : null,
      source: source_to_form_source(ingredient.food_item.source),
      source_ref: ingredient.food_item.source_ref,
      quantity: Number(ingredient.quantity),
    })),
  }));

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-4 py-6">
      <AppShellHeader
        title="Edit Recipe"
        subtitle={recipe.name}
        menu_email={user.email}
        menu_date={menu_date_label()}
      />

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Update Recipe
          </h2>
          <Link
            href="/recipes"
            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
          >
            Back
          </Link>
        </div>
        <div className="mt-4">
          <RecipeBuilderForm
            action={update_recipe_action}
            initial_recipe={initial_recipe}
            saved_recipes={saved_recipe_templates}
            hidden_fields={{ recipe_id: recipe.id }}
            submit_label="Save Recipe Changes"
          />
        </div>
      </section>
    </main>
  );
}
