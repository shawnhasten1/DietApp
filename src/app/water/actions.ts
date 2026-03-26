"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parse_datetime_local_in_app_time_zone } from "@/lib/app-time";
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

function parse_datetime_or_now(value: FormDataEntryValue | null): Date {
  if (typeof value !== "string" || value.trim().length === 0) {
    return new Date();
  }

  const parsed = parse_datetime_local_in_app_time_zone(value);
  return parsed ?? new Date();
}

const create_water_log_schema = z.object({
  amount_oz: z.number().int().min(1).max(2000),
  consumed_at: z.date(),
  notes: z.string().max(500).nullable(),
});

const delete_water_log_schema = z.object({
  log_id: z.string().min(1),
});

export async function create_water_log_action(form_data: FormData) {
  const user = await require_authenticated_user();

  const parsed = create_water_log_schema.safeParse({
    amount_oz: Number(required_string(form_data.get("amount_oz"))),
    consumed_at: parse_datetime_or_now(form_data.get("consumed_at")),
    notes: optional_string(form_data.get("notes")),
  });

  if (!parsed.success) {
    throw new Error("Invalid water log input.");
  }

  await prisma.waterLog.create({
    data: {
      user_id: user.id,
      amount_oz: parsed.data.amount_oz,
      consumed_at: parsed.data.consumed_at,
      notes: parsed.data.notes,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/daily");
  revalidatePath("/check-in");
}

export async function delete_water_log_action(form_data: FormData) {
  const user = await require_authenticated_user();

  const parsed = delete_water_log_schema.safeParse({
    log_id: required_string(form_data.get("log_id")),
  });

  if (!parsed.success) {
    throw new Error("Missing water log id.");
  }

  await prisma.waterLog.deleteMany({
    where: {
      id: parsed.data.log_id,
      user_id: user.id,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/daily");
  revalidatePath("/check-in");
}
