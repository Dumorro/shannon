/**
 * Usage Alert Email Template
 * Sent when an organization reaches 80% of their token allowance
 */

interface UsageAlertEmailProps {
  organizationName: string;
  percentage: number;
  tokensUsed: number;
  tokensAllowance: number;
  periodEnd: Date;
  billingUrl: string;
}

export function UsageAlertEmail({
  organizationName,
  percentage,
  tokensUsed,
  tokensAllowance,
  periodEnd,
  billingUrl,
}: UsageAlertEmailProps) {
  const remaining = tokensAllowance - tokensUsed;
  const daysRemaining = Math.ceil(
    (periodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        maxWidth: "600px",
        margin: "0 auto",
        padding: "20px",
      }}
    >
      <h1 style={{ color: "#1a1a1a", fontSize: "24px", marginBottom: "20px" }}>
        Usage Alert for {organizationName}
      </h1>

      <div
        style={{
          backgroundColor: "#fef3c7",
          border: "1px solid #f59e0b",
          borderRadius: "8px",
          padding: "16px",
          marginBottom: "20px",
        }}
      >
        <p style={{ color: "#92400e", margin: "0", fontWeight: "bold" }}>
          ⚠️ You&apos;ve used {percentage}% of your monthly token allowance
        </p>
      </div>

      <div
        style={{
          backgroundColor: "#f9fafb",
          borderRadius: "8px",
          padding: "20px",
          marginBottom: "20px",
        }}
      >
        <h2
          style={{ color: "#374151", fontSize: "16px", marginTop: "0" }}
        >
          Current Usage
        </h2>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
          }}
        >
          <tbody>
            <tr>
              <td style={{ padding: "8px 0", color: "#6b7280" }}>
                Tokens Used
              </td>
              <td
                style={{
                  padding: "8px 0",
                  textAlign: "right",
                  fontWeight: "bold",
                }}
              >
                {tokensUsed.toLocaleString()}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "8px 0", color: "#6b7280" }}>
                Monthly Allowance
              </td>
              <td
                style={{
                  padding: "8px 0",
                  textAlign: "right",
                  fontWeight: "bold",
                }}
              >
                {tokensAllowance.toLocaleString()}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "8px 0", color: "#6b7280" }}>Remaining</td>
              <td
                style={{
                  padding: "8px 0",
                  textAlign: "right",
                  fontWeight: "bold",
                  color: "#f59e0b",
                }}
              >
                {remaining.toLocaleString()}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "8px 0", color: "#6b7280" }}>
                Days Until Reset
              </td>
              <td
                style={{
                  padding: "8px 0",
                  textAlign: "right",
                  fontWeight: "bold",
                }}
              >
                {daysRemaining}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p style={{ color: "#374151", lineHeight: "1.6" }}>
        If you exceed your allowance, additional tokens will be billed at the
        overage rate. Consider upgrading your plan for a higher allowance.
      </p>

      <a
        href={billingUrl}
        style={{
          display: "inline-block",
          backgroundColor: "#4f46e5",
          color: "#ffffff",
          padding: "12px 24px",
          borderRadius: "6px",
          textDecoration: "none",
          fontWeight: "bold",
          marginTop: "16px",
        }}
      >
        View Billing & Usage
      </a>

      <hr
        style={{
          border: "none",
          borderTop: "1px solid #e5e7eb",
          margin: "32px 0",
        }}
      />

      <p style={{ color: "#9ca3af", fontSize: "12px" }}>
        This is an automated message from Shannon. You received this email
        because you are the billing contact for {organizationName}.
      </p>
    </div>
  );
}

/**
 * Generate plain text version of the usage alert email
 */
export function usageAlertPlainText({
  organizationName,
  percentage,
  tokensUsed,
  tokensAllowance,
  periodEnd,
  billingUrl,
}: UsageAlertEmailProps): string {
  const remaining = tokensAllowance - tokensUsed;
  const daysRemaining = Math.ceil(
    (periodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return `
Usage Alert for ${organizationName}

You've used ${percentage}% of your monthly token allowance.

Current Usage:
- Tokens Used: ${tokensUsed.toLocaleString()}
- Monthly Allowance: ${tokensAllowance.toLocaleString()}
- Remaining: ${remaining.toLocaleString()}
- Days Until Reset: ${daysRemaining}

If you exceed your allowance, additional tokens will be billed at the overage rate. Consider upgrading your plan for a higher allowance.

View Billing & Usage: ${billingUrl}

---
This is an automated message from Shannon.
`.trim();
}
