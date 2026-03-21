"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { require_authenticated_user } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

function required_string(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function optional_string(value: FormDataEntryValue | null): string | null {
  const parsed = required_string(value);
  return parsed.length > 0 ? parsed : null;
}

function number_or_null(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parse_datetime_or_now(value: FormDataEntryValue | null): Date {
  if (typeof value !== "string" || value.trim().length === 0) {
    return new Date();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

const create_schema = z.object({
  activity_name: z.string().min(1).max(120),
  duration_minutes: z.number().int().min(1).max(600),
  calories_burned: z.number().int().min(0).max(5000),
  performed_at: z.date(),
  notes: z.string().max(1000).nullable(),
});

const update_schema = z.object({
  log_id: z.string().min(1),
  activity_name: z.string().min(1).max(120),
  duration_minutes: z.number().int().min(1).max(600),
  calories_burned: z.number().int().min(0).max(5000),
  performed_at: z.date(),
  notes: z.string().max(1000).nullable(),
});

export async function create_exercise_log_action(form_data: FormData) {
  const user = await require_authenticated_user();

  const parsed = create_schema.safeParse({
    activity_name: required_string(form_data.get("activity_name")),
    duration_minutes: number_or_null(form_data.get("duration_minutes")) ?? -1,
    calories_burned: number_or_null(form_data.get("calories_burned")) ?? -1,
    performed_at: parse_datetime_or_now(form_data.get("performed_at")),
    notes: optional_string(form_data.get("notes")),
  });

  if (!parsed.success) {
    throw new Error("Invalid exercise log input.");
  }

  await prisma.exerciseLog.create({
    data: {
      user_id: user.id,
      activity_name: parsed.data.activity_name,
      duration_minutes: parsed.data.duration_minutes,
      calories_burned: parsed.data.calories_burned,
      performed_at: parsed.data.performed_at,
      notes: parsed.data.notes,
    },
  });

  revalidatePath("/exercise");
  revalidatePath("/dashboard");
}

export async function update_exercise_log_action(form_data: FormData) {
  const user = await require_authenticated_user();

  const parsed = update_schema.safeParse({
    log_id: required_string(form_data.get("log_id")),
    activity_name: required_string(form_data.get("activity_name")),
    duration_minutes: number_or_null(form_data.get("duration_minutes")) ?? -1,
    calories_burned: number_or_null(form_data.get("calories_burned")) ?? -1,
    performed_at: parse_datetime_or_now(form_data.get("performed_at")),
    notes: optional_string(form_data.get("notes")),
  });

  if (!parsed.success) {
    throw new Error("Invalid exercise update input.");
  }

  const updated = await prisma.exerciseLog.updateMany({
    where: { id: parsed.data.log_id, user_id: user.id },
    data: {
      activity_name: parsed.data.activity_name,
      duration_minutes: parsed.data.duration_minutes,
      calories_burned: parsed.data.calories_burned,
      performed_at: parsed.data.performed_at,
      notes: parsed.data.notes,
    },
  });

  if (updated.count !== 1) {
    throw new Error("Exercise log not found.");
  }

  revalidatePath("/exercise");
  revalidatePath("/dashboard");
}

export async function delete_exercise_log_action(form_data: FormData) {
  const user = await require_authenticated_user();
  const log_id = required_string(form_data.get("log_id"));

  if (!log_id) {
    throw new Error("Missing exercise log id.");
  }

  await prisma.exerciseLog.deleteMany({
    where: { id: log_id, user_id: user.id },
  });

  revalidatePath("/exercise");
  revalidatePath("/dashboard");
}
