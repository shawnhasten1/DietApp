"use client";

import { useMemo, useState } from "react";

type ProviderFoodItem = {
  name: string;
  brand: string | null;
  upc: string | null;
  serving_size: number | null;
  serving_unit: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  source: "manual" | "edamam" | "open_food_facts" | "other";
  source_ref: string | null;
};

type FoodLogFormProps = {
  action: (form_data: FormData) => void;
};

type EditableFoodFields = {
  name: string;
  brand: string;
  upc: string;
  serving_size: string;
  serving_unit: string;
  calories: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  fiber_g: string;
  sugar_g: string;
  sodium_mg: string;
  source: string;
  source_ref: string;
};

function now_local_datetime_value(): string {
  const date = new Date();
  const timezone_offset_ms = date.getTimezoneOffset() * 60_000;
  const local_time = new Date(date.getTime() - timezone_offset_ms);
  return local_time.toISOString().slice(0, 16);
}

function to_editable_fields(item?: ProviderFoodItem): EditableFoodFields {
  if (!item) {
    return {
      name: "",
      brand: "",
      upc: "",
      serving_size: "",
      serving_unit: "g",
      calories: "",
      protein_g: "0",
      carbs_g: "0",
      fat_g: "0",
      fiber_g: "",
      sugar_g: "",
      sodium_mg: "",
      source: "MANUAL",
      source_ref: "",
    };
  }

  return {
    name: item.name,
    brand: item.brand ?? "",
    upc: item.upc ?? "",
    serving_size: item.serving_size !== null ? String(item.serving_size) : "",
    serving_unit: item.serving_unit ?? "g",
    calories: String(item.calories),
    protein_g: String(item.protein_g),
    carbs_g: String(item.carbs_g),
    fat_g: String(item.fat_g),
    fiber_g: item.fiber_g !== null ? String(item.fiber_g) : "",
    sugar_g: item.sugar_g !== null ? String(item.sugar_g) : "",
    sodium_mg: item.sodium_mg !== null ? String(item.sodium_mg) : "",
    source: item.source.toUpperCase(),
    source_ref: item.source_ref ?? "",
  };
}

export function FoodLogForm({ action }: FoodLogFormProps) {
  const [search_query, set_search_query] = useState("");
  const [upc_query, set_upc_query] = useState("");
  const [search_results, set_search_results] = useState<ProviderFoodItem[]>([]);
  const [provider_error, set_provider_error] = useState<string | null>(null);
  const [is_searching, set_is_searching] = useState(false);
  const [fields, set_fields] = useState<EditableFoodFields>(() => to_editable_fields());
  const [meal_type, set_meal_type] = useState("meal");
  const [servings, set_servings] = useState("1");
  const [consumed_at, set_consumed_at] = useState(() => now_local_datetime_value());
  const [notes, set_notes] = useState("");

  const has_results = useMemo(() => search_results.length > 0, [search_results.length]);

  function patch_fields(patch: Partial<EditableFoodFields>) {
    set_fields((current) => ({ ...current, ...patch }));
  }

  function choose_provider_item(item: ProviderFoodItem) {
    set_fields(to_editable_fields(item));
  }

  async function lookup_by_upc() {
    const upc = upc_query.trim();

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
        set_provider_error("No UPC match found. You can still enter values manually.");
        return;
      }

      const data = (await response.json()) as { item?: ProviderFoodItem | null };

      if (!data.item) {
        set_search_results([]);
        set_provider_error("No UPC match found. You can still enter values manually.");
        return;
      }

      choose_provider_item(data.item);
      set_search_results([data.item]);
    } catch {
      set_provider_error("Lookup failed. Please try again.");
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
        set_provider_error("Search failed. You can still log manually.");
        return;
      }

      const data = (await response.json()) as { items?: ProviderFoodItem[] };
      const items = data.items ?? [];
      set_search_results(items);

      if (items.length === 0) {
        set_provider_error("No search results found. You can still log manually.");
      }
    } catch {
      set_provider_error("Search failed. Please try again.");
    } finally {
      set_is_searching(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Food Lookup
        </p>
        <div className="mt-2 grid grid-cols-1 gap-2">
          <div className="flex gap-2">
            <input
              placeholder="Search food name (banana, yogurt...)"
              value={search_query}
              onChange={(event) => set_search_query(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={is_searching}
              onClick={search_by_name}
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
              disabled={is_searching}
              onClick={lookup_by_upc}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
            >
              Lookup
            </button>
          </div>
        </div>
        {provider_error ? <p className="mt-2 text-xs text-rose-700">{provider_error}</p> : null}
      </div>

      {has_results ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Results</p>
          <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
            {search_results.map((item, index) => (
              <button
                key={`${item.source_ref ?? item.name}-${index}`}
                type="button"
                onClick={() => choose_provider_item(item)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left"
              >
                <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                <p className="text-xs text-slate-600">
                  {item.brand ?? "No brand"}
                  {" | "}
                  {item.calories}
                  {" cal"}
                  {" | "}
                  P
                  {item.protein_g}
                  {" C"}
                  {item.carbs_g}
                  {" F"}
                  {item.fat_g}
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <form action={action} className="space-y-3">
        <div className="grid grid-cols-1 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700" htmlFor="name">
              Food Name
            </label>
            <input
              id="name"
              name="name"
              required
              value={fields.name}
              onChange={(event) => patch_fields({ name: event.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700" htmlFor="brand">
                Brand
              </label>
              <input
                id="brand"
                name="brand"
                value={fields.brand}
                onChange={(event) => patch_fields({ brand: event.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700" htmlFor="upc">
                UPC
              </label>
              <input
                id="upc"
                name="upc"
                value={fields.upc}
                onChange={(event) => patch_fields({ upc: event.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700" htmlFor="serving_size">
                Serving Size
              </label>
              <input
                id="serving_size"
                name="serving_size"
                type="number"
                step="0.01"
                value={fields.serving_size}
                onChange={(event) => patch_fields({ serving_size: event.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700" htmlFor="serving_unit">
                Serving Unit
              </label>
              <input
                id="serving_unit"
                name="serving_unit"
                value={fields.serving_unit}
                onChange={(event) => patch_fields({ serving_unit: event.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700" htmlFor="calories">
                Calories
              </label>
              <input
                id="calories"
                name="calories"
                type="number"
                min={0}
                required
                value={fields.calories}
                onChange={(event) => patch_fields({ calories: event.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700" htmlFor="protein_g">
                Protein (g)
              </label>
              <input
                id="protein_g"
                name="protein_g"
                type="number"
                step="0.1"
                min={0}
                required
                value={fields.protein_g}
                onChange={(event) => patch_fields({ protein_g: event.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700" htmlFor="carbs_g">
                Carbs (g)
              </label>
              <input
                id="carbs_g"
                name="carbs_g"
                type="number"
                step="0.1"
                min={0}
                required
                value={fields.carbs_g}
                onChange={(event) => patch_fields({ carbs_g: event.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700" htmlFor="fat_g">
                Fat (g)
              </label>
              <input
                id="fat_g"
                name="fat_g"
                type="number"
                step="0.1"
                min={0}
                required
                value={fields.fat_g}
                onChange={(event) => patch_fields({ fat_g: event.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700" htmlFor="fiber_g">
                Fiber
              </label>
              <input
                id="fiber_g"
                name="fiber_g"
                type="number"
                step="0.1"
                min={0}
                value={fields.fiber_g}
                onChange={(event) => patch_fields({ fiber_g: event.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700" htmlFor="sugar_g">
                Sugar
              </label>
              <input
                id="sugar_g"
                name="sugar_g"
                type="number"
                step="0.1"
                min={0}
                value={fields.sugar_g}
                onChange={(event) => patch_fields({ sugar_g: event.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700" htmlFor="sodium_mg">
                Sodium mg
              </label>
              <input
                id="sodium_mg"
                name="sodium_mg"
                type="number"
                step="0.1"
                min={0}
                value={fields.sodium_mg}
                onChange={(event) => patch_fields({ sodium_mg: event.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700" htmlFor="servings">
                Servings
              </label>
              <input
                id="servings"
                name="servings"
                type="number"
                step="0.01"
                min={0.01}
                value={servings}
                onChange={(event) => set_servings(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700" htmlFor="meal_type">
                Meal Type
              </label>
              <input
                id="meal_type"
                name="meal_type"
                value={meal_type}
                onChange={(event) => set_meal_type(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700" htmlFor="consumed_at">
              Consumed At
            </label>
            <input
              id="consumed_at"
              name="consumed_at"
              type="datetime-local"
              value={consumed_at}
              onChange={(event) => set_consumed_at(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700" htmlFor="notes">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={2}
              value={notes}
              onChange={(event) => set_notes(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
            />
          </div>
        </div>

        <input type="hidden" name="source" value={fields.source} />
        <input type="hidden" name="source_ref" value={fields.source_ref} />

        <button
          type="submit"
          className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Save Food Log
        </button>
      </form>
    </div>
  );
}
