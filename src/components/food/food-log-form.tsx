"use client";

import { useEffect, useMemo, useState } from "react";
import { BarcodeScanner } from "@/components/food/barcode-scanner";
import type { QuickPickFoodItem, ProviderFoodItem } from "@/lib/food-item-types";
import { meal_type_labels, meal_type_values, type MealTypeValue } from "@/lib/meal-types";

type FoodLogFormProps = {
  action: (form_data: FormData) => Promise<void> | void;
  quick_pick_items?: QuickPickFoodItem[];
  initial_meal_type?: MealTypeValue;
  on_submit_complete?: () => void;
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

type AutoScaleBase = {
  serving_size: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
};

function provider_source_to_form_source(source: ProviderFoodItem["source"]): string {
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
    source: provider_source_to_form_source(item.source),
    source_ref: item.source_ref ?? "",
  };
}

function round_to_tenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function format_optional_number(value: number | null): string {
  if (value === null) {
    return "";
  }

  return String(value);
}

function to_scaled_fields(base: AutoScaleBase, next_serving_size_raw: string): Partial<EditableFoodFields> {
  const next_serving_size = Number(next_serving_size_raw);

  if (!Number.isFinite(next_serving_size) || next_serving_size <= 0) {
    return {};
  }

  const factor = next_serving_size / base.serving_size;

  return {
    calories: String(Math.max(0, Math.round(base.calories * factor))),
    protein_g: String(round_to_tenth(base.protein_g * factor)),
    carbs_g: String(round_to_tenth(base.carbs_g * factor)),
    fat_g: String(round_to_tenth(base.fat_g * factor)),
    fiber_g: format_optional_number(
      base.fiber_g !== null ? round_to_tenth(base.fiber_g * factor) : null,
    ),
    sugar_g: format_optional_number(
      base.sugar_g !== null ? round_to_tenth(base.sugar_g * factor) : null,
    ),
    sodium_mg: format_optional_number(
      base.sodium_mg !== null ? round_to_tenth(base.sodium_mg * factor) : null,
    ),
  };
}

function format_quick_pick_time(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "recently";
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function FoodLogForm({
  action,
  quick_pick_items = [],
  initial_meal_type = "snack",
  on_submit_complete,
}: FoodLogFormProps) {
  const [search_query, set_search_query] = useState("");
  const [upc_query, set_upc_query] = useState("");
  const [search_results, set_search_results] = useState<ProviderFoodItem[]>([]);
  const [provider_error, set_provider_error] = useState<string | null>(null);
  const [is_searching, set_is_searching] = useState(false);
  const [is_hydrating_result, set_is_hydrating_result] = useState(false);
  const [fields, set_fields] = useState<EditableFoodFields>(() => to_editable_fields());
  const [provider_serving_label, set_provider_serving_label] = useState<string | null>(null);
  const [auto_scale_base, set_auto_scale_base] = useState<AutoScaleBase | null>(null);
  const [meal_type, set_meal_type] = useState<MealTypeValue>(initial_meal_type);
  const [servings, set_servings] = useState("1");
  const [consumed_at, set_consumed_at] = useState("");
  const [notes, set_notes] = useState("");

  const has_results = useMemo(() => search_results.length > 0, [search_results.length]);
  const normalized_search_query = useMemo(() => search_query.trim(), [search_query]);
  const has_debug_search = useMemo(() => normalized_search_query.length >= 2, [normalized_search_query]);
  const normalized_upc_query = useMemo(() => upc_query.replace(/\D/g, ""), [upc_query]);
  const has_debug_upc = useMemo(() => /^\d{8,14}$/.test(normalized_upc_query), [normalized_upc_query]);
  const is_busy = is_searching || is_hydrating_result;

  useEffect(() => {
    set_consumed_at(now_local_datetime_value());
  }, []);

  useEffect(() => {
    set_meal_type(initial_meal_type);
  }, [initial_meal_type]);

  async function submit_form(form_data: FormData) {
    await action(form_data);
    on_submit_complete?.();
  }

  function patch_fields(patch: Partial<EditableFoodFields>) {
    set_fields((current) => ({ ...current, ...patch }));
  }

  function apply_provider_item(item: ProviderFoodItem) {
    set_fields(to_editable_fields(item));
    set_provider_serving_label(item.serving_size_label ?? null);

    if (item.serving_size !== null && item.serving_size > 0) {
      set_auto_scale_base({
        serving_size: item.serving_size,
        calories: item.calories,
        protein_g: item.protein_g,
        carbs_g: item.carbs_g,
        fat_g: item.fat_g,
        fiber_g: item.fiber_g,
        sugar_g: item.sugar_g,
        sodium_mg: item.sodium_mg,
      });
      return;
    }

    set_auto_scale_base(null);
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
        hydration_applied?: boolean;
      };

      return data.item ?? item;
    } catch {
      return item;
    } finally {
      set_is_hydrating_result(false);
    }
  }

  async function choose_provider_item(item: ProviderFoodItem): Promise<ProviderFoodItem> {
    const hydrated_item = await hydrate_provider_item(item);
    apply_provider_item(hydrated_item);
    return hydrated_item;
  }

  function choose_quick_pick_item(item: QuickPickFoodItem) {
    apply_provider_item(item);
    set_meal_type(item.suggested_meal_type);
    set_servings("1");
    set_provider_error(null);
  }

  function on_manual_nutrient_change(
    field:
      | "calories"
      | "protein_g"
      | "carbs_g"
      | "fat_g"
      | "fiber_g"
      | "sugar_g"
      | "sodium_mg",
    value: string,
  ) {
    set_auto_scale_base(null);
    patch_fields({ [field]: value });
  }

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
        set_provider_error("No UPC match found. You can still enter values manually.");
        return;
      }

      const data = (await response.json()) as { item?: ProviderFoodItem | null };

      if (!data.item) {
        set_search_results([]);
        set_provider_error("No UPC match found. You can still enter values manually.");
        return;
      }

      const selected_item = await choose_provider_item(data.item);
      set_search_results([selected_item]);
    } catch {
      set_provider_error("Lookup failed. Please try again.");
    } finally {
      set_is_searching(false);
    }
  }

  function on_barcode_detected(upc_code: string) {
    set_upc_query(upc_code);
    void lookup_by_upc(upc_code);
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
      {quick_pick_items.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Common And Recent Foods
          </p>
          <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
            {quick_pick_items.map((item) => (
              <button
                key={`quick-${item.quick_pick_id}`}
                type="button"
                onClick={() => choose_quick_pick_item(item)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left"
              >
                <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                <p className="text-xs text-slate-600">
                  {item.brand ?? "No brand"}
                  {" | "}
                  {item.calories}
                  {" cal"}
                  {" | "}
                  {meal_type_labels[item.suggested_meal_type]}
                </p>
                <p className="text-xs text-slate-500">
                  Logged {item.times_logged}x
                  {" | "}
                  Last {format_quick_pick_time(item.last_logged_at)}
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

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
              disabled={is_busy}
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
              disabled={is_busy}
              onClick={() => {
                void lookup_by_upc();
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
            >
              Lookup
            </button>
          </div>
        </div>
        {has_debug_upc ? (
          <a
            href={`/api/nutrition/upc/${encodeURIComponent(normalized_upc_query)}/debug`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-xs font-semibold text-slate-700 underline"
          >
            View Raw UPC API Debug Data
          </a>
        ) : null}
        {has_debug_search ? (
          <a
            href={`/api/nutrition/search/debug?q=${encodeURIComponent(
              normalized_search_query,
            )}&provider=edamam&limit=12`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 ml-3 inline-block text-xs font-semibold text-slate-700 underline"
          >
            View Raw Search Debug (Edamam)
          </a>
        ) : null}
        <div className="mt-3">
          <BarcodeScanner on_detect={on_barcode_detected} disabled={is_busy} />
        </div>
        {is_hydrating_result ? (
          <p className="mt-2 text-xs text-slate-600">Loading full nutrients for selected food...</p>
        ) : null}
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
                onClick={() => {
                  void choose_provider_item(item);
                }}
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

      <form action={submit_form} className="space-y-3">
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
                onChange={(event) => {
                  const next_serving_size = event.target.value;

                  set_fields((current) => {
                    const next_fields: EditableFoodFields = {
                      ...current,
                      serving_size: next_serving_size,
                    };

                    if (!auto_scale_base) {
                      return next_fields;
                    }

                    return {
                      ...next_fields,
                      ...to_scaled_fields(auto_scale_base, next_serving_size),
                    };
                  });
                }}
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
          {provider_serving_label ? (
            <p className="text-xs text-slate-600">
              Provider serving: {provider_serving_label}
            </p>
          ) : null}

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
                onChange={(event) => on_manual_nutrient_change("calories", event.target.value)}
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
                onChange={(event) => on_manual_nutrient_change("protein_g", event.target.value)}
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
                onChange={(event) => on_manual_nutrient_change("carbs_g", event.target.value)}
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
                onChange={(event) => on_manual_nutrient_change("fat_g", event.target.value)}
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
                onChange={(event) => on_manual_nutrient_change("fiber_g", event.target.value)}
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
                onChange={(event) => on_manual_nutrient_change("sugar_g", event.target.value)}
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
                onChange={(event) => on_manual_nutrient_change("sodium_mg", event.target.value)}
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
                Meal
              </label>
              <select
                id="meal_type"
                name="meal_type"
                value={meal_type}
                onChange={(event) => set_meal_type(event.target.value as MealTypeValue)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
              >
                {meal_type_values.map((value) => (
                  <option key={value} value={value}>
                    {meal_type_labels[value]}
                  </option>
                ))}
              </select>
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
