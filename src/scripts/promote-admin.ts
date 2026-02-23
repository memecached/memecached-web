import postgres from "postgres";

const USAGE = `
Promotes a user to admin role and sets their status to approved.

Usage:
  npx tsx --env-file=.env scripts/promote-admin.ts <email>

Example:
  npx tsx --env-file=.env scripts/promote-admin.ts user@example.com

Arguments:
  email    The email address of the user to promote

`.trim();

const arg = process.argv[2];
if (!arg || arg === "-h" || arg === "--help") {
  console.log(USAGE);
  process.exit(arg ? 0 : 1);
}

async function main() {
  const email = arg;
  const sql = postgres(process.env.DATABASE_URL!);

  const [updated] = await sql`
    UPDATE users
    SET role = 'admin', status = 'approved'
    WHERE email = ${email}
    RETURNING id, email, role, status
  `;

  if (!updated) {
    console.error(`No user found with email: ${email}`);
    await sql.end();
    process.exit(1);
  }

  console.log(`Promoted ${updated.email} to admin (status: approved)`);
  await sql.end();
}

main();
