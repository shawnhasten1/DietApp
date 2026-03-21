import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const signup_schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  display_name: z.string().min(1).max(100).optional(),
});

function normalize_email(value: string): string {
  return value.trim().toLowerCase();
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = signup_schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid signup payload.",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const email = normalize_email(parsed.data.email);

  const allowlist_match = await prisma.allowedEmail.findUnique({
    where: { email },
    select: { is_active: true },
  });

  if (!allowlist_match?.is_active) {
    return NextResponse.json(
      { error: "This email is not on the household invite list." },
      { status: 403 },
    );
  }

  const existing_user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, password_hash: true },
  });

  if (existing_user?.password_hash) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const password_hash = await hash(parsed.data.password, 12);

  if (existing_user) {
    await prisma.user.update({
      where: { id: existing_user.id },
      data: {
        password_hash,
        name: parsed.data.display_name ?? undefined,
      },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  }

  await prisma.user.create({
    data: {
      email,
      name: parsed.data.display_name ?? null,
      password_hash,
      profile: {
        create: {},
      },
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
