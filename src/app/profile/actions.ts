"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { require_authenticated_user } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

function nullable_string(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function nullable_int(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function nullable_decimal(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const profile_schema = z.object({
  display_name: z.string().max(100).nullable(),
  date_of_birth: z.string().date().nullable(),
  height_feet: z.number().int().min(1).max(8).nullable(),
  height_inches: z.number().int().min(0).max(11).nullable(),
  target_weight_lb: z.number().min(50).max(1000).nullable(),
  target_calories: z.number().int().min(800).max(12000),
  target_calories_sun: z.number().int().min(800).max(12000).nullable(),
  target_calories_mon: z.number().int().min(800).max(12000).nullable(),
  target_calories_tue: z.number().int().min(800).max(12000).nullable(),
  target_calories_wed: z.number().int().min(800).max(12000).nullable(),
  target_calories_thu: z.number().int().min(800).max(12000).nullable(),
  target_calories_fri: z.number().int().min(800).max(12000).nullable(),
  target_calories_sat: z.number().int().min(800).max(12000).nullable(),
  water_goal_oz: z.number().int().min(8).max(1000),
  avg_tdee_calories: z.number().int().min(1000).max(8000).nullable(),
});

export async function save_profile_action(form_data: FormData) {
  const user = await require_authenticated_user();

  const raw = {
    display_name: nullable_string(form_data.get("display_name")),
    date_of_birth: nullable_string(form_data.get("date_of_birth")),
    height_feet: nullable_int(form_data.get("height_feet")),
    height_inches: nullable_int(form_data.get("height_inches")),
    target_weight_lb: nullable_decimal(form_data.get("target_weight_lb")),
    target_calories: nullable_int(form_data.get("target_calories")) ?? 2000,
    target_calories_sun: nullable_int(form_data.get("target_calories_sun")),
    target_calories_mon: nullable_int(form_data.get("target_calories_mon")),
    target_calories_tue: nullable_int(form_data.get("target_calories_tue")),
    target_calories_wed: nullable_int(form_data.get("target_calories_wed")),
    target_calories_thu: nullable_int(form_data.get("target_calories_thu")),
    target_calories_fri: nullable_int(form_data.get("target_calories_fri")),
    target_calories_sat: nullable_int(form_data.get("target_calories_sat")),
    water_goal_oz: nullable_int(form_data.get("water_goal_oz")) ?? 64,
    avg_tdee_calories: nullable_int(form_data.get("avg_tdee_calories")),
  };

  const parsed = profile_schema.safeParse(raw);

  if (!parsed.success) {
    throw new Error("Invalid profile form input.");
  }

  await prisma.userProfile.upsert({
    where: { user_id: user.id },
    update: {
      display_name: parsed.data.display_name,
      date_of_birth: parsed.data.date_of_birth ? new Date(parsed.data.date_of_birth) : null,
      height_feet: parsed.data.height_feet,
      height_inches: parsed.data.height_inches,
      target_weight_lb: parsed.data.target_weight_lb,
      target_calories: parsed.data.target_calories,
      target_calories_sun: parsed.data.target_calories_sun,
      target_calories_mon: parsed.data.target_calories_mon,
      target_calories_tue: parsed.data.target_calories_tue,
      target_calories_wed: parsed.data.target_calories_wed,
      target_calories_thu: parsed.data.target_calories_thu,
      target_calories_fri: parsed.data.target_calories_fri,
      target_calories_sat: parsed.data.target_calories_sat,
      water_goal_oz: parsed.data.water_goal_oz,
      avg_tdee_calories: parsed.data.avg_tdee_calories,
    },
    create: {
      user_id: user.id,
      display_name: parsed.data.display_name,
      date_of_birth: parsed.data.date_of_birth ? new Date(parsed.data.date_of_birth) : null,
      height_feet: parsed.data.height_feet,
      height_inches: parsed.data.height_inches,
      target_weight_lb: parsed.data.target_weight_lb,
      target_calories: parsed.data.target_calories,
      target_calories_sun: parsed.data.target_calories_sun,
      target_calories_mon: parsed.data.target_calories_mon,
      target_calories_tue: parsed.data.target_calories_tue,
      target_calories_wed: parsed.data.target_calories_wed,
      target_calories_thu: parsed.data.target_calories_thu,
      target_calories_fri: parsed.data.target_calories_fri,
      target_calories_sat: parsed.data.target_calories_sat,
      water_goal_oz: parsed.data.water_goal_oz,
      avg_tdee_calories: parsed.data.avg_tdee_calories,
    },
  });

  revalidatePath("/profile");
  revalidatePath("/dashboard");
}
