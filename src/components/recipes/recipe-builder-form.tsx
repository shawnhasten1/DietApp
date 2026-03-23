"use client";

import { useMemo, useState } from "react";
import { BarcodeScanner } from "@/components/food/barcode-scanner";
import type { ProviderFoodItem } from "@/lib/food-item-types";

type RecipeIngredientInput = {
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
  source: "manual" | "edamam" | "open_food_facts" | "usda" | "other";
  source_ref: string | null;
  quantity: number;
};

type SavedRecipeTemplate = {
  id: string;
  name: string;
  servings: number;
  notes: string | null;
  ingredients: RecipeIngredientInput[];
};

type ExternalRecipeSearchItem = {
  id: string;
  name: string;
  source: string | null;
  url: string | null;
  image: string | null;
  yield_servings: number | null;
  total_time_minutes: number | null;
  ingredient_lines: string[];
  calories_total: number | null;
  calories_per_serving: number | null;
  protein_g_per_serving: number | null;
  carbs_g_per_serving: number | null;
  fat_g_per_serving: number | null;
};

type RecipeIngredientDraft = ProviderFoodItem & {
  id: string;
  quantity: string;
};

type RecipeBuilderFormProps = {
  action: (form_data: FormData) => void;
  initial_recipe?: {
    name: string;
    servings: number;
    notes: string | null;
    ingredients: RecipeIngredientInput[];
  };
  saved_recipes?: SavedRecipeTemplate[];
  submit_label?: string;
  hidden_fields?: Record<string, string>;
};

function round_to_tenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function source_to_food_source_enum(source: ProviderFoodItem["source"]): string {
  switch (source) {
    case "manual":
      return "MANUAL";
    case "edamam":
      return "EDAMAM";
    case "open_food_facts":
      return "OPEN_FOOD_FACTS";
    case "usda":
    case "other":
      return "OTHER";
    default:
      return "MANUAL";
  }
}

function to_recipe_ingredient_draft(
  ingredient: RecipeIngredientInput,
  id_seed: string,
): RecipeIngredientDraft {
  return {
    ...ingredient,
    id: id_seed,
    quantity: String(ingredient.quantity),
  };
}

export function RecipeBuilderForm({
  action,
  initial_recipe,
  saved_recipes = [],
  submit_label,
  hidden_fields,
}: RecipeBuilderFormProps) {
  const [search_query, set_search_query] = useState("");
  const [external_recipe_query, set_external_recipe_query] = useState("");
  const [upc_query, set_upc_query] = useState("");
  const [saved_recipe_query, set_saved_recipe_query] = useState("");
  const [provider_error, set_provider_error] = useState<string | null>(null);
  const [external_recipe_error, set_external_recipe_error] = useState<string | null>(null);
  const [external_recipe_info, set_external_recipe_info] = useState<string | null>(null);
  const [is_searching, set_is_searching] = useState(false);
  const [is_searching_external_recipes, set_is_searching_external_recipes] = useState(false);
  const [is_hydrating_result, set_is_hydrating_result] = useState(false);
  const [recipe_name, set_recipe_name] = useState(initial_recipe?.name ?? "");
  const [recipe_servings, set_recipe_servings] = useState(
    initial_recipe?.servings !== undefined ? String(initial_recipe.servings) : "1",
  );
  const [recipe_notes, set_recipe_notes] = useState(initial_recipe?.notes ?? "");
  const [search_results, set_search_results] = useState<ProviderFoodItem[]>([]);
  const [external_recipe_results, set_external_recipe_results] = useState<
    ExternalRecipeSearchItem[]
  >([]);
  const [ingredients, set_ingredients] = useState<RecipeIngredientDraft[]>(() =>
    initial_recipe
      ? initial_recipe.ingredients.map((ingredient, index) => ({
          ...to_recipe_ingredient_draft(
            ingredient,
            `${ingredient.source_ref ?? ingredient.name}-initial-${index}`,
          ),
        }))
      : [],
  );
  const is_busy = is_searching || is_hydrating_result;
  const filtered_saved_recipes = useMemo(() => {
    const query = saved_recipe_query.trim().toLowerCase();

    if (!query) {
      return saved_recipes.slice(0, 6);
    }

    const query_tokens = query.split(/\s+/).filter(Boolean);

    return saved_recipes
      .filter((recipe) => {
        const name = recipe.name.toLowerCase();
        const ingredient_names = recipe.ingredients.map((ingredient) => ingredient.name.toLowerCase());
        const haystack = `${name} ${ingredient_names.join(" ")}`;

        return query_tokens.every((token) => haystack.includes(token));
      })
      .slice(0, 8);
  }, [saved_recipe_query, saved_recipes]);

  const total_nutrients = useMemo(() => {
    return ingredients.reduce(
      (accumulator, ingredient) => {
        const quantity = Number(ingredient.quantity);
        const factor = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;

        return {
          calories: accumulator.calories + ingredient.calories * factor,
          protein_g: accumulator.protein_g + ingredient.protein_g * factor,
          carbs_g: accumulator.carbs_g + ingredient.carbs_g * factor,
          fat_g: accumulator.fat_g + ingredient.fat_g * factor,
          fiber_g: accumulator.fiber_g + (ingredient.fiber_g ?? 0) * factor,
          sugar_g: accumulator.sugar_g + (ingredient.sugar_g ?? 0) * factor,
          sodium_mg: accumulator.sodium_mg + (ingredient.sodium_mg ?? 0) * factor,
        };
      },
      {
        calories: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
        fiber_g: 0,
        sugar_g: 0,
        sodium_mg: 0,
      },
    );
  }, [ingredients]);

  const ingredients_json = useMemo(() => {
    return JSON.stringify(
      ingredients.map((ingredient) => ({
        name: ingredient.name,
        brand: ingredient.brand,
        upc: ingredient.upc,
        serving_size: ingredient.serving_size,
        serving_unit: ingredient.serving_unit,
        calories: ingredient.calories,
        protein_g: ingredient.protein_g,
        carbs_g: ingredient.carbs_g,
        fat_g: ingredient.fat_g,
        fiber_g: ingredient.fiber_g,
        sugar_g: ingredient.sugar_g,
        sodium_mg: ingredient.sodium_mg,
        source: source_to_food_source_enum(ingredient.source),
        source_ref: ingredient.source_ref,
        quantity: Number(ingredient.quantity),
      })),
    );
  }, [ingredients]);

  async function lookup_by_upc(override_upc?: string) {
    const upc = (override_upc ?? upc_query).trim();

    if (upc.length < 8) {
      set_provider_error("UPC must be at least 8 digits.");
      return;
    }

    set_is_searching(true);
    set_provider_error(null);

    try {
      const response = await fetch(`/api/nutrition/upc/${encodeURIComponent(upc)}`);

      if (!response.ok) {
        set_search_results([]);
        set_provider_error("No UPC match found.");
        return;
      }

      const data = (await response.json()) as { item?: ProviderFoodItem | null };

      if (!data.item) {
        set_search_results([]);
        set_provider_error("No UPC match found.");
        return;
      }

      set_search_results([data.item]);
    } catch {
      set_provider_error("UPC lookup failed.");
    } finally {
      set_is_searching(false);
    }
  }

  async function search_by_name() {
    const query = search_query.trim();

    if (query.length < 2) {
      set_provider_error("Search term must be at least 2 characters.");
      return;
    }

    set_is_searching(true);
    set_provider_error(null);

    try {
      const response = await fetch(`/api/nutrition/search?q=${encodeURIComponent(query)}&limit=12`);

      if (!response.ok) {
        set_search_results([]);
        set_provider_error("Search failed.");
        return;
      }

      const data = (await response.json()) as { items?: ProviderFoodItem[] };
      const items = data.items ?? [];
      set_search_results(items);

      if (items.length === 0) {
        set_provider_error("No search results found.");
      }
    } catch {
      set_provider_error("Search failed.");
    } finally {
      set_is_searching(false);
    }
  }

  async function search_external_recipes() {
    const query = external_recipe_query.trim();

    if (query.length < 2) {
      set_external_recipe_error("Search term must be at least 2 characters.");
      return;
    }

    set_is_searching_external_recipes(true);
    set_external_recipe_error(null);

    try {
      const response = await fetch(
        `/api/nutrition/recipes/search?q=${encodeURIComponent(query)}&limit=8`,
      );

      if (!response.ok) {
        set_external_recipe_results([]);
        set_external_recipe_error("Recipe search failed.");
        return;
      }

      const data = (await response.json()) as {
        items?: ExternalRecipeSearchItem[];
      };
      const items = data.items ?? [];
      set_external_recipe_results(items);

      if (items.length === 0) {
        set_external_recipe_error("No recipe matches found.");
      }
    } catch {
      set_external_recipe_error("Recipe search failed.");
    } finally {
      set_is_searching_external_recipes(false);
    }
  }

  function on_barcode_detected(upc_code: string) {
    set_upc_query(upc_code);
    void lookup_by_upc(upc_code);
  }

  async function hydrate_provider_item(item: ProviderFoodItem): Promise<ProviderFoodItem> {
    if (item.source !== "edamam") {
      return item;
    }

    set_is_hydrating_result(true);

    try {
      const response = await fetch("/api/nutrition/item/resolve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ item }),
      });

      if (!response.ok) {
        return item;
      }

      const data = (await response.json()) as {
        item?: ProviderFoodItem | null;
      };

      return data.item ?? item;
    } catch {
      return item;
    } finally {
      set_is_hydrating_result(false);
    }
  }

  async function add_ingredient(item: ProviderFoodItem) {
    const hydrated_item = await hydrate_provider_item(item);

    set_ingredients((current) => [
      ...current,
      {
        ...hydrated_item,
        id: `${hydrated_item.source_ref ?? hydrated_item.name}-${Date.now()}-${current.length}`,
        quantity: "1",
      },
    ]);
  }

  function remove_ingredient(id: string) {
    set_ingredients((current) => current.filter((ingredient) => ingredient.id !== id));
  }

  function update_quantity(id: string, quantity: string) {
    set_ingredients((current) =>
      current.map((ingredient) =>
        ingredient.id === id ? { ...ingredient, quantity } : ingredient,
      ),
    );
  }

  function load_saved_recipe(template: SavedRecipeTemplate) {
    set_recipe_name(template.name);
    set_recipe_servings(String(template.servings));
    set_recipe_notes(template.notes ?? "");
    set_ingredients(
      template.ingredients.map((ingredient, index) =>
        to_recipe_ingredient_draft(
          ingredient,
          `${template.id}-${ingredient.source_ref ?? ingredient.name}-${index}-${Date.now()}`,
        ),
      ),
    );
    set_provider_error(null);
    set_external_recipe_info(null);
  }

  function to_external_recipe_summary_ingredient(item: ExternalRecipeSearchItem): RecipeIngredientDraft {
    const yield_servings =
      item.yield_servings !== null && item.yield_servings > 0 ? item.yield_servings : 1;
    const calories_per_serving =
      item.calories_per_serving ??
      (item.calories_total !== null ? Math.round(item.calories_total / yield_servings) : 0);

    return {
      id: `ext-recipe-${item.id}-${Date.now()}`,
      name: `${item.name} (Imported Recipe)`,
      brand: item.source,
      upc: null,
      serving_size: 1,
      serving_unit: "recipe serving",
      serving_size_label: "1 recipe serving",
      calories: Math.max(0, calories_per_serving),
      protein_g: Math.max(0, item.protein_g_per_serving ?? 0),
      carbs_g: Math.max(0, item.carbs_g_per_serving ?? 0),
      fat_g: Math.max(0, item.fat_g_per_serving ?? 0),
      fiber_g: null,
      sugar_g: null,
      sodium_mg: null,
      source: "other",
      source_ref: `edamam_recipe:${item.id}`,
      quantity: String(yield_servings),
    };
  }

  function import_external_recipe(item: ExternalRecipeSearchItem) {
    set_recipe_name(item.name);

    if (item.yield_servings && item.yield_servings > 0) {
      set_recipe_servings(String(item.yield_servings));
    }

    const note_lines: string[] = [];

    note_lines.push(`Imported from Edamam${item.source ? ` (${item.source})` : ""}`);

    if (item.url) {
      note_lines.push(item.url);
    }

    if (item.total_time_minutes) {
      note_lines.push(`Total time: ${Math.round(item.total_time_minutes)} min`);
    }

    if (item.ingredient_lines.length > 0) {
      note_lines.push("Ingredients:");
      for (const line of item.ingredient_lines) {
        note_lines.push(`- ${line}`);
      }
    }

    const imported_note = note_lines.join("\n").trim();

    set_recipe_notes((current) => {
      const existing = current.trim();

      if (!existing) {
        return imported_note;
      }

      if (item.url && existing.includes(item.url)) {
        return current;
      }

      return `${current}\n\n${imported_note}`;
    });

    // Edamam recipe search provides reliable recipe-level nutrition, but not
    // normalized per-ingredient nutrient breakdown for this builder flow.
    // Seed one aggregate ingredient so the recipe can be saved immediately.
    set_ingredients([to_external_recipe_summary_ingredient(item)]);
    set_external_recipe_info(
      "Imported as one summary ingredient from recipe-level nutrition. You can replace it with scanned/manual ingredients for more precise totals.",
    );
  }

  return (
    <form action={action} className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Recipe Details
        </p>
        <div className="mt-3 space-y-2">
          <input
            name="name"
            required
            placeholder="Recipe name (Spaghetti Night)"
            value={recipe_name}
            onChange={(event) => set_recipe_name(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <input
            name="servings"
            type="number"
            required
            min={0.01}
            step="0.01"
            value={recipe_servings}
            onChange={(event) => set_recipe_servings(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <textarea
            name="notes"
            rows={2}
            placeholder="Optional notes"
            value={recipe_notes}
            onChange={(event) => set_recipe_notes(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </div>
      </section>

      {saved_recipes.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Find Saved Recipe
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Search your saved recipes and load one into the builder.
          </p>
          <input
            value={saved_recipe_query}
            onChange={(event) => set_saved_recipe_query(event.target.value)}
            placeholder="Search by recipe or ingredient name"
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <div className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
            {filtered_saved_recipes.length === 0 ? (
              <p className="text-xs text-slate-600">No matching saved recipes.</p>
            ) : (
              filtered_saved_recipes.map((recipe) => (
                <button
                  key={recipe.id}
                  type="button"
                  onClick={() => load_saved_recipe(recipe)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left"
                >
                  <p className="text-sm font-semibold text-slate-900">{recipe.name}</p>
                  <p className="text-xs text-slate-600">
                    {recipe.ingredients.length} ingredients | yields {recipe.servings.toFixed(2)} servings
                  </p>
                </button>
              ))
            )}
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Edamam Recipe Search
        </p>
        <p className="mt-1 text-xs text-slate-600">
          Search public recipes and import the title, servings, and ingredient notes.
        </p>
        <div className="mt-2 flex gap-2">
          <input
            value={external_recipe_query}
            onChange={(event) => set_external_recipe_query(event.target.value)}
            placeholder="Search recipes (spaghetti, chili...)"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={search_external_recipes}
            disabled={is_searching_external_recipes}
            className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            Search
          </button>
        </div>

        {external_recipe_error ? (
          <p className="mt-2 text-xs text-rose-700">{external_recipe_error}</p>
        ) : null}
        {external_recipe_info ? (
          <p className="mt-2 text-xs text-slate-600">{external_recipe_info}</p>
        ) : null}

        {external_recipe_results.length > 0 ? (
          <div className="mt-2 max-h-64 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
            {external_recipe_results.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                <p className="text-xs text-slate-600">
                  {item.source ?? "Unknown source"}
                  {" | "}
                  {item.yield_servings !== null
                    ? `Yield ${item.yield_servings.toFixed(1)}`
                    : "Yield n/a"}
                  {" | "}
                  {item.calories_per_serving !== null
                    ? `${item.calories_per_serving} cal/serving`
                    : "Calories n/a"}
                </p>
                <p className="text-xs text-slate-600">
                  P {item.protein_g_per_serving ?? "?"} C {item.carbs_g_per_serving ?? "?"} F{" "}
                  {item.fat_g_per_serving ?? "?"}
                </p>
                {item.ingredient_lines.length > 0 ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {item.ingredient_lines.slice(0, 3).join(" • ")}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => import_external_recipe(item)}
                  className="mt-2 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Use In Builder
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Ingredient Lookup
        </p>
        <div className="mt-2 grid grid-cols-1 gap-2">
          <div className="flex gap-2">
            <input
              placeholder="Search ingredient by name"
              value={search_query}
              onChange={(event) => set_search_query(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={search_by_name}
              disabled={is_busy}
              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              Search
            </button>
          </div>
          <div className="flex gap-2">
            <input
              placeholder="UPC code"
              value={upc_query}
              onChange={(event) => set_upc_query(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                void lookup_by_upc();
              }}
              disabled={is_busy}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
            >
              Lookup
            </button>
          </div>
        </div>
        <div className="mt-3">
          <BarcodeScanner on_detect={on_barcode_detected} disabled={is_busy} />
        </div>
        {is_hydrating_result ? (
          <p className="mt-2 text-xs text-slate-600">Loading full nutrients for selected food...</p>
        ) : null}
        {provider_error ? <p className="mt-2 text-xs text-rose-700">{provider_error}</p> : null}
      </section>

      {search_results.length > 0 ? (
        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Results</p>
          <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
            {search_results.map((item, index) => (
              <div
                key={`${item.source_ref ?? item.name}-${index}`}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                <p className="text-xs text-slate-600">
                  {item.brand ?? "No brand"} | {item.calories} cal | P {item.protein_g} C{" "}
                  {item.carbs_g} F {item.fat_g}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    void add_ingredient(item);
                  }}
                  disabled={is_busy}
                  className="mt-2 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Add Ingredient
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Recipe Ingredients
          </p>
          <p className="text-xs text-slate-500">{ingredients.length} items</p>
        </div>

        {ingredients.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">Add ingredients from search or UPC lookup.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {ingredients.map((ingredient) => (
              <div key={ingredient.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <p className="text-sm font-semibold text-slate-900">{ingredient.name}</p>
                <p className="text-xs text-slate-600">
                  {ingredient.brand ?? "No brand"} | {ingredient.calories} cal each
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={ingredient.quantity}
                    onChange={(event) => update_quantity(ingredient.id, event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => remove_ingredient(ingredient.id)}
                    className="rounded-lg border border-rose-300 bg-rose-50 px-2 py-1.5 text-xs font-semibold text-rose-700"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">Batch Totals</p>
        <p className="mt-1">
          {Math.round(total_nutrients.calories)} cal | P {round_to_tenth(total_nutrients.protein_g)} C{" "}
          {round_to_tenth(total_nutrients.carbs_g)} F {round_to_tenth(total_nutrients.fat_g)}
        </p>
      </section>

      {hidden_fields
        ? Object.entries(hidden_fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))
        : null}

      <input type="hidden" name="ingredients_json" value={ingredients_json} />

      <button
        type="submit"
        disabled={ingredients.length === 0}
        className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {submit_label ?? "Save Recipe"}
      </button>
    </form>
  );
}
