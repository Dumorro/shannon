/**
 * Renewal Reminder Email Template
 * Sent to annual subscribers before their subscription renews
 */

interface RenewalReminderEmailProps {
  organizationName: string;
  renewalDate: Date;
  planName: string;
  amount: number; // in cents
  billingUrl: string;
  daysUntilRenewal: number;
}

export function RenewalReminderEmail({
  organizationName,
  renewalDate,
  planName,
  amount,
  billingUrl,
  daysUntilRenewal,
}: RenewalReminderEmailProps) {
  const formattedAmount = `$${(amount / 100).toFixed(2)}`;
  const formattedDate = renewalDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

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
        Subscription Renewal Reminder
      </h1>

      <p style={{ color: "#374151", lineHeight: "1.6" }}>
        Hi there,
      </p>

      <p style={{ color: "#374151", lineHeight: "1.6" }}>
        Your annual {planName} subscription for <strong>{organizationName}</strong> will
        automatically renew in <strong>{daysUntilRenewal} days</strong>.
      </p>

      <div
        style={{
          backgroundColor: "#f9fafb",
          borderRadius: "8px",
          padding: "20px",
          margin: "24px 0",
        }}
      >
        <h2
          style={{ color: "#374151", fontSize: "16px", marginTop: "0" }}
        >
          Renewal Details
        </h2>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
          }}
        >
          <tbody>
            <tr>
              <td style={{ padding: "8px 0", color: "#6b7280" }}>Plan</td>
              <td
                style={{
                  padding: "8px 0",
                  textAlign: "right",
                  fontWeight: "bold",
                }}
              >
                {planName}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "8px 0", color: "#6b7280" }}>
                Renewal Date
              </td>
              <td
                style={{
                  padding: "8px 0",
                  textAlign: "right",
                  fontWeight: "bold",
                }}
              >
                {formattedDate}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "8px 0", color: "#6b7280" }}>Amount</td>
              <td
                style={{
                  padding: "8px 0",
                  textAlign: "right",
                  fontWeight: "bold",
                  color: "#4f46e5",
                }}
              >
                {formattedAmount}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p style={{ color: "#374151", lineHeight: "1.6" }}>
        No action is required if you&apos;d like to continue with your current
        plan. Your subscription will renew automatically using your payment
        method on file.
      </p>

      <p style={{ color: "#374151", lineHeight: "1.6" }}>
        If you&apos;d like to make changes to your subscription or update your
        payment method, you can do so from your billing settings.
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
        Manage Subscription
      </a>

      <hr
        style={{
          border: "none",
          borderTop: "1px solid #e5e7eb",
          margin: "32px 0",
        }}
      />

      <p style={{ color: "#9ca3af", fontSize: "12px" }}>
        This is an automated reminder from Shannon. You received this email
        because you have an annual subscription for {organizationName}. If you
        have questions about your subscription, please contact support.
      </p>
    </div>
  );
}

/**
 * Generate plain text version of the renewal reminder email
 */
export function renewalReminderPlainText({
  organizationName,
  renewalDate,
  planName,
  amount,
  billingUrl,
  daysUntilRenewal,
}: RenewalReminderEmailProps): string {
  const formattedAmount = `$${(amount / 100).toFixed(2)}`;
  const formattedDate = renewalDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `
Subscription Renewal Reminder

Hi there,

Your annual ${planName} subscription for ${organizationName} will automatically renew in ${daysUntilRenewal} days.

Renewal Details:
- Plan: ${planName}
- Renewal Date: ${formattedDate}
- Amount: ${formattedAmount}

No action is required if you'd like to continue with your current plan. Your subscription will renew automatically using your payment method on file.

If you'd like to make changes to your subscription or update your payment method, you can do so from your billing settings:
${billingUrl}

---
This is an automated reminder from Shannon. You received this email because you have an annual subscription for ${organizationName}.
`.trim();
}
