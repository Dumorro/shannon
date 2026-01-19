import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding PlanLimits...");

  // Upsert plan limits to avoid duplicates on re-runs
  const plans = [
    {
      planName: "free",
      concurrentScans: 1,
      teamMembers: 1,
      scanDurationMinutes: 30,
      monthlyTokenAllowance: 50000,
      features: {
        customReports: false,
        apiAccess: false,
        scheduledScans: false,
      },
      monthlyPriceUsd: 0,
      annualPriceUsd: null,
    },
    {
      planName: "pro",
      concurrentScans: 3,
      teamMembers: 5,
      scanDurationMinutes: 60,
      monthlyTokenAllowance: 500000,
      features: {
        customReports: true,
        apiAccess: false,
        scheduledScans: true,
      },
      monthlyPriceUsd: 9900, // $99.00
      annualPriceUsd: 99000, // $990.00 (2 months free)
    },
    {
      planName: "enterprise",
      concurrentScans: 10,
      teamMembers: 2147483647, // MAX_INT for unlimited
      scanDurationMinutes: 120,
      monthlyTokenAllowance: 5000000,
      features: {
        customReports: true,
        apiAccess: true,
        scheduledScans: true,
      },
      monthlyPriceUsd: 0, // Custom pricing
      annualPriceUsd: null,
    },
  ];

  for (const plan of plans) {
    await prisma.planLimits.upsert({
      where: { planName: plan.planName },
      update: plan,
      create: plan,
    });
    console.log(`  - ${plan.planName} plan created/updated`);
  }

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
