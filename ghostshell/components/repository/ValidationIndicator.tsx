"use client";

import { CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";

export type ValidationStatus = "idle" | "validating" | "valid" | "invalid" | "error";

interface ValidationIndicatorProps {
  status: ValidationStatus;
  message?: string | null;
  className?: string;
}

export function ValidationIndicator({
  status,
  message,
  className = "",
}: ValidationIndicatorProps) {
  if (status === "idle") {
    return null;
  }

  const styles = {
    validating: {
      icon: Loader2,
      iconClass: "h-5 w-5 text-blue-600 animate-spin",
      bgClass: "bg-blue-50",
      textClass: "text-blue-800",
      text: "Validating repository access...",
    },
    valid: {
      icon: CheckCircle2,
      iconClass: "h-5 w-5 text-green-600",
      bgClass: "bg-green-50",
      textClass: "text-green-800",
      text: "Repository access verified",
    },
    invalid: {
      icon: XCircle,
      iconClass: "h-5 w-5 text-red-600",
      bgClass: "bg-red-50",
      textClass: "text-red-800",
      text: "Unable to access repository",
    },
    error: {
      icon: AlertCircle,
      iconClass: "h-5 w-5 text-amber-600",
      bgClass: "bg-amber-50",
      textClass: "text-amber-800",
      text: "Validation failed",
    },
  };

  const config = styles[status];
  const Icon = config.icon;
  const displayMessage = message || config.text;

  return (
    <div className={`rounded-lg ${config.bgClass} p-4 ${className}`}>
      <div className="flex gap-3">
        <Icon className={config.iconClass} />
        <div className="flex-1">
          <p className={`text-sm font-medium ${config.textClass}`}>
            {displayMessage}
          </p>
        </div>
      </div>
    </div>
  );
}
