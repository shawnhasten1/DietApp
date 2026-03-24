"use client";

import { useState } from "react";
import { FoodLogForm } from "@/components/food/food-log-form";
import type { QuickPickFoodItem } from "@/lib/food-item-types";
import { meal_type_labels, type MealTypeValue } from "@/lib/meal-types";

type MealAddFoodSheetProps = {
  meal_type: MealTypeValue;
  action: (form_data: FormData) => Promise<void> | void;
  quick_pick_items: QuickPickFoodItem[];
};

export function MealAddFoodSheet({ meal_type, action, quick_pick_items }: MealAddFoodSheetProps) {
  const [is_open, set_is_open] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => set_is_open(true)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
      >
        Add Food
      </button>

      {is_open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 px-4">
          <button
            type="button"
            aria-label="Close add food panel"
            onClick={() => set_is_open(false)}
            className="absolute inset-0"
          />
          <section className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                Add {meal_type_labels[meal_type]}
              </h3>
              <button
                type="button"
                onClick={() => set_is_open(false)}
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700"
              >
                Close
              </button>
            </div>

            <FoodLogForm
              action={action}
              quick_pick_items={quick_pick_items}
              initial_meal_type={meal_type}
              on_submit_complete={() => set_is_open(false)}
            />
          </section>
        </div>
      ) : null}
    </>
  );
}
