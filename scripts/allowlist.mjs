import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalize_email(raw_email) {
  return raw_email.trim().toLowerCase();
}

function print_usage() {
  console.log("Usage:");
  console.log("  npm run allowlist -- add user@example.com [optional note]");
  console.log("  npm run allowlist -- remove user@example.com");
  console.log("  npm run allowlist -- list");
}

async function add_email(raw_email, note) {
  const email = normalize_email(raw_email);

  if (!email) {
    throw new Error("Email is required.");
  }

  await prisma.allowedEmail.upsert({
    where: { email },
    update: {
      is_active: true,
      notes: note ?? null,
    },
    create: {
      email,
      is_active: true,
      notes: note ?? null,
    },
  });

  console.log(`Allowed: ${email}`);
}

async function remove_email(raw_email) {
  const email = normalize_email(raw_email);

  if (!email) {
    throw new Error("Email is required.");
  }

  await prisma.allowedEmail.upsert({
    where: { email },
    update: { is_active: false },
    create: { email, is_active: false },
  });

  console.log(`Disabled: ${email}`);
}

async function list_emails() {
  const rows = await prisma.allowedEmail.findMany({
    orderBy: { email: "asc" },
    select: {
      email: true,
      is_active: true,
      notes: true,
      updated_at: true,
    },
  });

  if (rows.length === 0) {
    console.log("No allowlist entries yet.");
    return;
  }

  for (const row of rows) {
    const status = row.is_active ? "active" : "inactive";
    const note = row.notes ? ` | ${row.notes}` : "";
    console.log(`${status.padEnd(8)} ${row.email} | ${row.updated_at.toISOString()}${note}`);
  }
}

async function main() {
  const [command, email, ...rest] = process.argv.slice(2);
  const note = rest.length > 0 ? rest.join(" ") : undefined;

  switch (command) {
    case "add":
      if (!email) {
        print_usage();
        return;
      }
      await add_email(email, note);
      return;
    case "remove":
      if (!email) {
        print_usage();
        return;
      }
      await remove_email(email);
      return;
    case "list":
      await list_emails();
      return;
    default:
      print_usage();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
