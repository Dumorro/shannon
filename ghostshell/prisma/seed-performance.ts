/**
 * Performance Seed Script - Generates 10K findings for performance testing
 *
 * Usage: npx ts-node prisma/seed-performance.ts
 *
 * Prerequisites:
 * - Database must have at least one organization and project
 * - Run after regular seed script
 *
 * Purpose: Test SC-003, SC-004, SC-006 performance requirements
 * - Filter results < 1s
 * - Bulk updates 50 findings < 5s
 * - Search < 2s
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Configuration
const FINDING_COUNT = 10_000;
const BATCH_SIZE = 500; // Insert in batches to avoid memory issues
const NOTES_PER_FINDING_RATIO = 0.2; // 20% of findings have notes (avg 1-3 notes)

// Sample data for realistic findings
const SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;
const STATUSES = ["open", "fixed", "accepted_risk", "false_positive"] as const;
const CATEGORIES = ["injection", "xss", "auth", "authz", "ssrf", "other"] as const;

const TITLES = [
  "SQL Injection in {endpoint}",
  "Stored XSS in {endpoint}",
  "Reflected XSS in {endpoint}",
  "IDOR in {endpoint}",
  "CSRF vulnerability in {endpoint}",
  "Broken Authentication in {endpoint}",
  "Session Fixation in {endpoint}",
  "Missing Authorization Check in {endpoint}",
  "SSRF in {endpoint}",
  "Open Redirect in {endpoint}",
  "Information Disclosure in {endpoint}",
  "Insecure Direct Object Reference in {endpoint}",
  "Path Traversal in {endpoint}",
  "Command Injection in {endpoint}",
  "XML External Entity (XXE) in {endpoint}",
];

const ENDPOINTS = [
  "/api/users",
  "/api/auth/login",
  "/api/auth/register",
  "/api/products",
  "/api/orders",
  "/api/payments",
  "/api/admin/settings",
  "/api/search",
  "/api/upload",
  "/api/export",
  "/dashboard",
  "/profile",
  "/checkout",
];

const DESCRIPTIONS = [
  "A vulnerability was discovered that could allow an attacker to {impact}. The issue exists in the {component} component and requires user interaction to exploit.",
  "During security testing, we identified a {severity} vulnerability in the {component}. An authenticated attacker could {impact}.",
  "The application is vulnerable to {type} attacks. This allows {impact}. Immediate remediation is recommended.",
  "A security misconfiguration was found in {component}. This could lead to {impact} if exploited by a malicious actor.",
];

const IMPACTS = [
  "access sensitive user data",
  "execute arbitrary code",
  "bypass authentication",
  "escalate privileges",
  "steal session tokens",
  "modify database records",
  "exfiltrate confidential information",
  "perform actions on behalf of other users",
];

const REMEDIATIONS = [
  "Implement parameterized queries and prepared statements for all database operations.",
  "Apply proper output encoding and Content Security Policy headers.",
  "Implement CSRF tokens for all state-changing operations.",
  "Add proper authorization checks at the API layer.",
  "Use allowlist validation for URL redirects.",
  "Implement rate limiting and account lockout mechanisms.",
  "Use secure session management with proper token rotation.",
  "Apply principle of least privilege to all API endpoints.",
];

const NOTE_CONTENTS = [
  "Verified this issue in staging environment. Impact confirmed.",
  "Working with development team on remediation plan.",
  "Remediation deployed to staging. Pending production deployment.",
  "Retested after fix - vulnerability no longer present.",
  "False positive - this is expected behavior for admin users.",
  "Risk accepted per security review. Compensating controls in place.",
  "Similar issue found in related endpoint - see finding #{related}.",
  "Customer reported this issue via bug bounty program.",
  "Escalated to security team for priority review.",
  "Workaround implemented while permanent fix is developed.",
];

function randomElement<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateTitle(): string {
  return randomElement(TITLES).replace("{endpoint}", randomElement(ENDPOINTS));
}

function generateDescription(): string {
  const template = randomElement(DESCRIPTIONS);
  return template
    .replace("{impact}", randomElement(IMPACTS))
    .replace("{component}", randomElement(ENDPOINTS).replace("/api/", ""))
    .replace("{severity}", randomElement(["critical", "serious", "significant"]))
    .replace("{type}", randomElement(["injection", "XSS", "authentication bypass"]));
}

function generateEvidence() {
  return {
    steps: [
      "Navigate to the vulnerable endpoint",
      `Enter payload: ${randomElement(["' OR 1=1--", "<script>alert(1)</script>", "../../../etc/passwd"])}`,
      "Observe the application response",
      "Confirm vulnerability exploitation",
    ],
    payloads: [
      randomElement(["' OR '1'='1", "<img onerror=alert(1)>", "${7*7}"]),
    ],
    proofOfImpact: `Successfully demonstrated ${randomElement(IMPACTS)}`,
  };
}

function generateCvss(severity: string): number {
  const ranges: Record<string, [number, number]> = {
    critical: [9.0, 10.0],
    high: [7.0, 8.9],
    medium: [4.0, 6.9],
    low: [0.1, 3.9],
    info: [0, 0],
  };
  const [min, max] = ranges[severity] || [0, 0];
  return Math.round((Math.random() * (max - min) + min) * 10) / 10;
}

function generateCwe(): string {
  const cwes = [
    "CWE-89",  // SQL Injection
    "CWE-79",  // XSS
    "CWE-287", // Improper Authentication
    "CWE-862", // Missing Authorization
    "CWE-918", // SSRF
    "CWE-352", // CSRF
    "CWE-22",  // Path Traversal
    "CWE-78",  // OS Command Injection
    "CWE-200", // Information Disclosure
    "CWE-611", // XXE
  ];
  return randomElement(cwes);
}

async function main() {
  console.log("🚀 Starting performance seed script...\n");

  // Get first organization and project
  const organization = await prisma.organization.findFirst({
    include: { projects: true },
  });

  if (!organization) {
    console.error("❌ No organization found. Please run regular seed first.");
    process.exit(1);
  }

  let project = organization.projects[0];
  if (!project) {
    console.log("📁 Creating test project...");
    project = await prisma.project.create({
      data: {
        name: "Performance Test Project",
        targetUrl: "https://performance-test.example.com",
        organizationId: organization.id,
      },
    });
  }

  // Get or create a user for notes
  const user = await prisma.user.findFirst({
    where: {
      memberships: {
        some: { organizationId: organization.id },
      },
    },
  });

  if (!user) {
    console.error("❌ No user found in organization. Please run regular seed first.");
    process.exit(1);
  }

  console.log(`📊 Configuration:`);
  console.log(`   - Organization: ${organization.name}`);
  console.log(`   - Project: ${project.name}`);
  console.log(`   - Target findings: ${FINDING_COUNT.toLocaleString()}`);
  console.log(`   - Batch size: ${BATCH_SIZE}`);
  console.log("");

  // Create scan for findings
  console.log("🔍 Creating performance test scan...");
  const scan = await prisma.scan.create({
    data: {
      projectId: project.id,
      organizationId: organization.id,
      status: "COMPLETED",
      startedAt: new Date(Date.now() - 3600000), // 1 hour ago
      completedAt: new Date(),
    },
  });

  console.log(`✅ Scan created: ${scan.id}\n`);

  // Generate findings in batches
  const batches = Math.ceil(FINDING_COUNT / BATCH_SIZE);
  let totalCreated = 0;
  const findingIds: string[] = [];

  console.log(`📝 Generating ${FINDING_COUNT.toLocaleString()} findings in ${batches} batches...\n`);

  for (let batch = 0; batch < batches; batch++) {
    const batchStart = batch * BATCH_SIZE;
    const batchEnd = Math.min((batch + 1) * BATCH_SIZE, FINDING_COUNT);
    const batchSize = batchEnd - batchStart;

    const findings = [];
    for (let i = 0; i < batchSize; i++) {
      const severity = randomElement(SEVERITIES);
      const status = randomElement(STATUSES);

      findings.push({
        scanId: scan.id,
        title: generateTitle(),
        description: generateDescription(),
        severity,
        category: randomElement(CATEGORIES),
        status,
        cvss: generateCvss(severity),
        cwe: generateCwe(),
        remediation: randomElement(REMEDIATIONS),
        evidence: generateEvidence(),
        createdAt: new Date(Date.now() - randomInt(0, 30 * 24 * 60 * 60 * 1000)), // Random date in last 30 days
      });
    }

    // Bulk insert findings
    const result = await prisma.finding.createManyAndReturn({
      data: findings,
      select: { id: true },
    });

    findingIds.push(...result.map((f) => f.id));
    totalCreated += result.length;

    const progress = Math.round((totalCreated / FINDING_COUNT) * 100);
    process.stdout.write(`\r   Progress: ${progress}% (${totalCreated.toLocaleString()} / ${FINDING_COUNT.toLocaleString()})`);
  }

  console.log("\n\n✅ Findings created!\n");

  // Generate notes for some findings
  const notesCount = Math.floor(findingIds.length * NOTES_PER_FINDING_RATIO);
  console.log(`📝 Generating notes for ${notesCount.toLocaleString()} findings...\n`);

  let totalNotes = 0;
  const noteBatches = Math.ceil(notesCount / BATCH_SIZE);

  for (let batch = 0; batch < noteBatches; batch++) {
    const batchStart = batch * BATCH_SIZE;
    const batchEnd = Math.min((batch + 1) * BATCH_SIZE, notesCount);
    const batchSize = batchEnd - batchStart;

    const notes = [];
    for (let i = 0; i < batchSize; i++) {
      const findingIndex = batchStart + i;
      const findingId = findingIds[findingIndex];
      const noteCount = randomInt(1, 3);

      for (let n = 0; n < noteCount; n++) {
        notes.push({
          findingId,
          userId: user.id,
          content: randomElement(NOTE_CONTENTS).replace("{related}", String(randomInt(1, 100))),
          createdAt: new Date(Date.now() - randomInt(0, 7 * 24 * 60 * 60 * 1000)), // Random date in last 7 days
        });
      }
    }

    await prisma.findingNote.createMany({ data: notes });
    totalNotes += notes.length;

    const progress = Math.round((Math.min(batchEnd, notesCount) / notesCount) * 100);
    process.stdout.write(`\r   Progress: ${progress}% (${totalNotes.toLocaleString()} notes created)`);
  }

  console.log("\n\n✅ Notes created!\n");

  // Update scan counts
  const severityCounts = await prisma.finding.groupBy({
    by: ["severity"],
    where: { scanId: scan.id },
    _count: true,
  });

  const counts = Object.fromEntries(
    severityCounts.map((s) => [s.severity, s._count])
  );

  await prisma.scan.update({
    where: { id: scan.id },
    data: {
      criticalCount: counts["critical"] || 0,
      highCount: counts["high"] || 0,
      mediumCount: counts["medium"] || 0,
      lowCount: counts["low"] || 0,
      infoCount: counts["info"] || 0,
      totalFindings: totalCreated,
    },
  });

  // Print summary
  console.log("📊 Summary:");
  console.log(`   - Total findings: ${totalCreated.toLocaleString()}`);
  console.log(`   - Total notes: ${totalNotes.toLocaleString()}`);
  console.log(`   - Critical: ${counts["critical"] || 0}`);
  console.log(`   - High: ${counts["high"] || 0}`);
  console.log(`   - Medium: ${counts["medium"] || 0}`);
  console.log(`   - Low: ${counts["low"] || 0}`);
  console.log(`   - Info: ${counts["info"] || 0}`);
  console.log("");
  console.log("🎉 Performance seed complete!");
  console.log("");
  console.log("📌 Next steps:");
  console.log("   1. Run npm run dev in ghostshell/");
  console.log("   2. Navigate to /dashboard/findings");
  console.log("   3. Test filter performance (target: <1s)");
  console.log("   4. Test bulk operations (target: 50 findings in <5s)");
  console.log("   5. Test search performance (target: <2s)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
