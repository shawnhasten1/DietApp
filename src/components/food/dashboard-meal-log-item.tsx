"use client";

import { useState } from "react";
import { meal_type_labels, meal_type_values, type MealTypeValue } from "@/lib/meal-types";

type DashboardMealLogItemProps = {
  log: {
    id: string;
    name: string;
    brand: string | null;
    servings: number;
    calories_per_serving: number;
    meal_type: MealTypeValue;
    consumed_at_local: string;
    notes: string;
  };
  update_action: (form_data: FormData) => Promise<void> | void;
  delete_action: (form_data: FormData) => Promise<void> | void;
};

function icon_button_class_name(tone: "default" | "danger" = "default"): string {
  if (tone === "danger") {
    return "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-300 bg-rose-50 text-rose-700";
  }

  return "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700";
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m20 6-11 11-5-5" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m18 6-12 12" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export function DashboardMealLogItem({ log, update_action, delete_action }: DashboardMealLogItemProps) {
  const [is_editing, set_is_editing] = useState(false);
  const [servings, set_servings] = useState(String(log.servings));
  const [meal_type, set_meal_type] = useState<MealTypeValue>(log.meal_type);

  const total_calories = Math.round(log.servings * log.calories_per_serving);

  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{log.name}</p>
          <p className="text-xs text-slate-600">
            {log.brand ?? "No brand"}
            {" | "}
            {Number(log.servings).toFixed(2)} servings
            {" | "}
            {total_calories} cal
          </p>
        </div>
        {!is_editing ? (
          <button
            type="button"
            onClick={() => set_is_editing(true)}
            className={icon_button_class_name()}
            aria-label="Edit food log"
            title="Edit"
          >
            <PencilIcon />
          </button>
        ) : null}
      </div>

      {is_editing ? (
        <div className="mt-2 space-y-2">
          <form
            action={async (form_data) => {
              await update_action(form_data);
              set_is_editing(false);
            }}
            className="grid grid-cols-[1fr,1fr,auto] gap-2"
          >
            <input type="hidden" name="log_id" value={log.id} />
            <input type="hidden" name="consumed_at" value={log.consumed_at_local} />
            <input type="hidden" name="notes" value={log.notes} />
            <input
              name="servings"
              type="number"
              min={0.01}
              step="0.01"
              value={servings}
              onChange={(event) => set_servings(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
            />
            <select
              name="meal_type"
              value={meal_type}
              onChange={(event) => set_meal_type(event.target.value as MealTypeValue)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
            >
              {meal_type_values.map((value) => (
                <option key={`${log.id}-${value}`} value={value}>
                  {meal_type_labels[value]}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className={icon_button_class_name()}
              aria-label="Save food log changes"
              title="Save"
            >
              <CheckIcon />
            </button>
          </form>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                set_servings(String(log.servings));
                set_meal_type(log.meal_type);
                set_is_editing(false);
              }}
              className={icon_button_class_name()}
              aria-label="Cancel editing"
              title="Cancel"
            >
              <XIcon />
            </button>
            <form action={delete_action}>
              <input type="hidden" name="log_id" value={log.id} />
              <button
                type="submit"
                className={icon_button_class_name("danger")}
                aria-label="Delete food log"
                title="Delete"
              >
                <TrashIcon />
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
