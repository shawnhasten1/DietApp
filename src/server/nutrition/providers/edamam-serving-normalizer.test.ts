import { describe, expect, it } from "vitest";
import { normalize_edamam_serving } from "./edamam-serving-normalizer";

describe("normalize_edamam_serving", () => {
  it("rescales likely per-100g nutrients to serving values for named unit servings", () => {
    const result = normalize_edamam_serving({
      source: "edamam",
      serving_size: 36,
      serving_unit: "Bar",
      nutrients: {
        calories: 547,
        protein_g: 13.25220012664795,
        carbs_g: 50.80179977416992,
        fat_g: 32.811798095703125,
        fiber_g: 8.037199974060059,
        sugar_g: 25.851699829101562,
        sodium_mg: 369.0466003417969,
      },
    });

    expect(result.normalization_applied).toBe(true);
    expect(result.nutrients_basis).toBe("per_100g");
    expect(result.normalized.calories).toBeCloseTo(196.92, 2);
    expect(result.normalized.protein_g).toBeCloseTo(4.770792045593262, 6);
    expect(result.normalized.carbs_g).toBeCloseTo(18.288647918701173, 6);
    expect(result.normalized.fat_g).toBeCloseTo(11.812247314453125, 6);
    expect(result.normalized.fiber_g).toBeCloseTo(2.893391990661621, 6);
    expect(result.normalized.sugar_g).toBeCloseTo(9.306611938476562, 6);
    expect(result.normalized.sodium_mg).toBeCloseTo(132.85677612304687, 6);
  });

  it("keeps likely per-serving nutrients unchanged", () => {
    const result = normalize_edamam_serving({
      source: "edamam",
      serving_size: 330,
      serving_unit: "Bottle",
      nutrients: {
        calories: 140,
        protein_g: 0,
        carbs_g: 35,
        fat_g: 0,
        fiber_g: 0,
        sugar_g: 34,
        sodium_mg: 55,
      },
    });

    expect(result.normalization_applied).toBe(false);
    expect(result.nutrients_basis).toBe("per_serving");
    expect(result.normalized.calories).toBe(140);
    expect(result.normalized.carbs_g).toBe(35);
    expect(result.normalized.sugar_g).toBe(34);
  });

  it("does not rescale when serving_size is missing or invalid", () => {
    const result = normalize_edamam_serving({
      source: "edamam",
      serving_size: null,
      serving_unit: "Bar",
      nutrients: {
        calories: 250,
        protein_g: 5,
        carbs_g: 30,
        fat_g: 10,
        fiber_g: null,
        sugar_g: 14,
        sodium_mg: 180,
      },
    });

    expect(result.normalization_applied).toBe(false);
    expect(result.nutrients_basis).toBe("unknown");
    expect(result.normalization_reason).toContain("Missing or invalid serving_size");
    expect(result.normalized.calories).toBe(250);
  });

  it("keeps basis unknown when macro calories do not match", () => {
    const result = normalize_edamam_serving({
      source: "edamam",
      serving_size: 50,
      serving_unit: "Cookie",
      nutrients: {
        calories: 200,
        protein_g: 1,
        carbs_g: 1,
        fat_g: 1,
        fiber_g: 0,
        sugar_g: 0,
        sodium_mg: 40,
      },
    });

    expect(result.normalization_applied).toBe(false);
    expect(result.nutrients_basis).toBe("unknown");
    expect(result.normalization_reason).toContain("Macro-derived calories do not closely match");
    expect(result.normalized.calories).toBe(200);
  });
});
