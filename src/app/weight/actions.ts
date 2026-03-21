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
  weight_lb: z.number().min(50).max(1000),
  recorded_at: z.date(),
  notes: z.string().max(1000).nullable(),
});

const update_schema = z.object({
  entry_id: z.string().min(1),
  weight_lb: z.number().min(50).max(1000),
  recorded_at: z.date(),
  notes: z.string().max(1000).nullable(),
});

export async function create_weight_entry_action(form_data: FormData) {
  const user = await require_authenticated_user();

  const parsed = create_schema.safeParse({
    weight_lb: number_or_null(form_data.get("weight_lb")) ?? -1,
    recorded_at: parse_datetime_or_now(form_data.get("recorded_at")),
    notes: optional_string(form_data.get("notes")),
  });

  if (!parsed.success) {
    throw new Error("Invalid weight input.");
  }

  await prisma.weightEntry.create({
    data: {
      user_id: user.id,
      weight_lb: parsed.data.weight_lb,
      recorded_at: parsed.data.recorded_at,
      notes: parsed.data.notes,
    },
  });

  revalidatePath("/weight");
  revalidatePath("/dashboard");
}

export async function update_weight_entry_action(form_data: FormData) {
  const user = await require_authenticated_user();

  const parsed = update_schema.safeParse({
    entry_id: required_string(form_data.get("entry_id")),
    weight_lb: number_or_null(form_data.get("weight_lb")) ?? -1,
    recorded_at: parse_datetime_or_now(form_data.get("recorded_at")),
    notes: optional_string(form_data.get("notes")),
  });

  if (!parsed.success) {
    throw new Error("Invalid weight update input.");
  }

  const updated = await prisma.weightEntry.updateMany({
    where: { id: parsed.data.entry_id, user_id: user.id },
    data: {
      weight_lb: parsed.data.weight_lb,
      recorded_at: parsed.data.recorded_at,
      notes: parsed.data.notes,
    },
  });

  if (updated.count !== 1) {
    throw new Error("Weight entry not found.");
  }

  revalidatePath("/weight");
  revalidatePath("/dashboard");
}

export async function delete_weight_entry_action(form_data: FormData) {
  const user = await require_authenticated_user();
  const entry_id = required_string(form_data.get("entry_id"));

  if (!entry_id) {
    throw new Error("Missing weight entry id.");
  }

  await prisma.weightEntry.deleteMany({
    where: { id: entry_id, user_id: user.id },
  });

  revalidatePath("/weight");
  revalidatePath("/dashboard");
}
