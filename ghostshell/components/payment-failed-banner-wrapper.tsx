import { db } from "@/lib/db";
import { PaymentFailedBanner } from "./payment-failed-banner";

interface PaymentFailedBannerWrapperProps {
  organizationId: string;
}

export async function PaymentFailedBannerWrapper({
  organizationId,
}: PaymentFailedBannerWrapperProps) {
  // Fetch organization subscription status
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { subscriptionStatus: true },
  });

  // Only show banner if subscription is past_due
  if (org?.subscriptionStatus !== "past_due") {
    return null;
  }

  return <PaymentFailedBanner organizationId={organizationId} />;
}
