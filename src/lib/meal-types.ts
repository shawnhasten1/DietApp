export const meal_type_values = ["breakfast", "lunch", "dinner", "snack"] as const;

export type MealTypeValue = (typeof meal_type_values)[number];

export const meal_type_labels: Record<MealTypeValue, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export function normalize_meal_type(value: string | null | undefined): MealTypeValue | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  switch (normalized) {
    case "breakfast":
      return "breakfast";
    case "lunch":
      return "lunch";
    case "dinner":
      return "dinner";
    case "snack":
    case "snacks":
      return "snack";
    default:
      return null;
  }
}
