/**
 * Findings Diff - Compare findings between two scans
 * Epic 011: Git Repository Tracking for Scans
 * User Story 2: Branch-Specific Scanning
 */

import type { Finding } from "@prisma/client";

export interface FindingComparison {
  commonFindings: Finding[]; // Present in both scans
  onlyInScanA: Finding[]; // Branch-specific to scan A
  onlyInScanB: Finding[]; // Branch-specific to scan B
}

/**
 * Generate a fingerprint for a finding to determine uniqueness
 * Uses: title, category, severity, and CWE (if available)
 *
 * This allows matching the "same" vulnerability across different scans
 */
function getFindingFingerprint(finding: Finding): string {
  const parts = [
    finding.title.toLowerCase().trim(),
    finding.category.toLowerCase().trim(),
    finding.severity.toLowerCase().trim(),
  ];

  // Include CWE if available for more precise matching
  if (finding.cwe) {
    parts.push(finding.cwe.toLowerCase().trim());
  }

  return parts.join("|");
}

/**
 * T056: Compare findings from two scans and identify differences
 *
 * Returns:
 * - commonFindings: Vulnerabilities present in both scans
 * - onlyInScanA: Vulnerabilities only in scan A (branch-specific)
 * - onlyInScanB: Vulnerabilities only in scan B (branch-specific)
 *
 * Use case: Compare scans from different branches to identify:
 * - Security regressions (new vulnerabilities in a branch)
 * - Security improvements (vulnerabilities fixed in a branch)
 * - Baseline security posture (common vulnerabilities across branches)
 */
export function findingsDiff(
  findingsA: Finding[],
  findingsB: Finding[]
): FindingComparison {
  // Create fingerprint maps for fast lookup
  const fingerprintMapA = new Map<string, Finding>();
  const fingerprintMapB = new Map<string, Finding>();

  // Build fingerprint map for scan A
  for (const finding of findingsA) {
    const fingerprint = getFindingFingerprint(finding);
    fingerprintMapA.set(fingerprint, finding);
  }

  // Build fingerprint map for scan B
  for (const finding of findingsB) {
    const fingerprint = getFindingFingerprint(finding);
    fingerprintMapB.set(fingerprint, finding);
  }

  const commonFindings: Finding[] = [];
  const onlyInScanA: Finding[] = [];
  const onlyInScanB: Finding[] = [];

  // Find common findings and findings only in A
  for (const [fingerprint, finding] of fingerprintMapA) {
    if (fingerprintMapB.has(fingerprint)) {
      // Present in both scans - use the finding from scan A
      commonFindings.push(finding);
    } else {
      // Only in scan A (branch-specific to A)
      onlyInScanA.push(finding);
    }
  }

  // Find findings only in B
  for (const [fingerprint, finding] of fingerprintMapB) {
    if (!fingerprintMapA.has(fingerprint)) {
      // Only in scan B (branch-specific to B)
      onlyInScanB.push(finding);
    }
  }

  // Sort by severity (critical -> high -> medium -> low -> info)
  const severityOrder = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  };

  const sortBySeverity = (a: Finding, b: Finding) => {
    const severityA =
      severityOrder[a.severity.toLowerCase() as keyof typeof severityOrder] ??
      99;
    const severityB =
      severityOrder[b.severity.toLowerCase() as keyof typeof severityOrder] ??
      99;
    return severityA - severityB;
  };

  commonFindings.sort(sortBySeverity);
  onlyInScanA.sort(sortBySeverity);
  onlyInScanB.sort(sortBySeverity);

  return {
    commonFindings,
    onlyInScanA,
    onlyInScanB,
  };
}

/**
 * Helper function to categorize finding differences
 * Useful for displaying comparison results in the UI
 */
export function categorizeDifferences(comparison: FindingComparison): {
  securityRegressions: Finding[]; // New vulnerabilities
  securityImprovements: Finding[]; // Fixed vulnerabilities
  baseline: Finding[]; // Common vulnerabilities
} {
  return {
    securityRegressions: comparison.onlyInScanB, // New in B (assuming B is newer)
    securityImprovements: comparison.onlyInScanA, // Removed in B (fixed)
    baseline: comparison.commonFindings, // Present in both
  };
}

/**
 * Calculate security posture delta between two scans
 * Positive delta = improvement (fewer vulnerabilities)
 * Negative delta = regression (more vulnerabilities)
 */
export function calculateSecurityDelta(comparison: FindingComparison): {
  totalDelta: number;
  criticalDelta: number;
  highDelta: number;
  mediumDelta: number;
  lowDelta: number;
} {
  const countBySeverity = (findings: Finding[], severity: string) =>
    findings.filter((f) => f.severity.toLowerCase() === severity.toLowerCase())
      .length;

  const criticalA = countBySeverity(comparison.onlyInScanA, "critical");
  const highA = countBySeverity(comparison.onlyInScanA, "high");
  const mediumA = countBySeverity(comparison.onlyInScanA, "medium");
  const lowA = countBySeverity(comparison.onlyInScanA, "low");

  const criticalB = countBySeverity(comparison.onlyInScanB, "critical");
  const highB = countBySeverity(comparison.onlyInScanB, "high");
  const mediumB = countBySeverity(comparison.onlyInScanB, "medium");
  const lowB = countBySeverity(comparison.onlyInScanB, "low");

  return {
    totalDelta:
      comparison.onlyInScanA.length - comparison.onlyInScanB.length,
    criticalDelta: criticalA - criticalB,
    highDelta: highA - highB,
    mediumDelta: mediumA - mediumB,
    lowDelta: lowA - lowB,
  };
}
