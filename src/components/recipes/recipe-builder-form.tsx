"use client";

import { useMemo, useState } from "react";
import { BarcodeScanner } from "@/components/food/barcode-scanner";
import type { ProviderFoodItem } from "@/lib/food-item-types";

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
    ingredients: Array<{
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
    }>;
  };
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

export function RecipeBuilderForm({
  action,
  initial_recipe,
  submit_label,
  hidden_fields,
}: RecipeBuilderFormProps) {
  const [search_query, set_search_query] = useState("");
  const [upc_query, set_upc_query] = useState("");
  const [provider_error, set_provider_error] = useState<string | null>(null);
  const [is_searching, set_is_searching] = useState(false);
  const [is_hydrating_result, set_is_hydrating_result] = useState(false);
  const [search_results, set_search_results] = useState<ProviderFoodItem[]>([]);
  const [ingredients, set_ingredients] = useState<RecipeIngredientDraft[]>(() =>
    initial_recipe
      ? initial_recipe.ingredients.map((ingredient, index) => ({
          ...ingredient,
          id: `${ingredient.source_ref ?? ingredient.name}-initial-${index}`,
          quantity: String(ingredient.quantity),
        }))
      : [],
  );
  const is_busy = is_searching || is_hydrating_result;

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
            defaultValue={initial_recipe?.name ?? ""}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <input
            name="servings"
            type="number"
            required
            min={0.01}
            step="0.01"
            defaultValue={initial_recipe?.servings ?? 1}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <textarea
            name="notes"
            rows={2}
            placeholder="Optional notes"
            defaultValue={initial_recipe?.notes ?? ""}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </div>
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
