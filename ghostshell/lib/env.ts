/**
 * Environment Variable Validation
 *
 * Validates required environment variables at startup.
 * Provides clear error messages for missing or invalid values.
 *
 * Usage: Import this file in your app layout or API routes
 */

const REQUIRED_ENV_VARS = {
  // Database
  DATABASE_URL: 'PostgreSQL connection string',

  // Stripe (Billing)
  STRIPE_SECRET_KEY: 'Stripe secret key (sk_test_... for development)',
  STRIPE_WEBHOOK_SECRET: 'Stripe webhook signing secret (whsec_...)',
  STRIPE_PRICE_PRO_MONTHLY: 'Stripe price ID for Pro monthly plan',
  STRIPE_PRICE_PRO_ANNUAL: 'Stripe price ID for Pro annual plan',

  // Shannon Service
  SHANNON_SERVICE_URL: 'Shannon service API URL',
} as const;

const OPTIONAL_ENV_VARS = {
  // Clerk Auth (may not be needed for all deployments)
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'Clerk publishable key',
  CLERK_SECRET_KEY: 'Clerk secret key',
} as const;

class EnvironmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvironmentError';
  }
}

/**
 * Validates that all required environment variables are set
 * @throws {EnvironmentError} If any required variables are missing or invalid
 */
export function validateEnvironment(): void {
  const missing: string[] = [];
  const invalid: string[] = [];

  // Check required variables
  for (const [key, description] of Object.entries(REQUIRED_ENV_VARS)) {
    const value = process.env[key];

    if (!value) {
      missing.push(`${key} - ${description}`);
      continue;
    }

    // Check for placeholder values
    if (value.includes('placeholder') || value.includes('your_') || value.includes('replace')) {
      invalid.push(`${key} - Contains placeholder value. ${description}`);
    }

    // Validate specific formats
    if (key === 'STRIPE_SECRET_KEY' && !value.startsWith('sk_')) {
      invalid.push(`${key} - Must start with 'sk_test_' (development) or 'sk_live_' (production)`);
    }

    if (key === 'STRIPE_WEBHOOK_SECRET' && !value.startsWith('whsec_')) {
      invalid.push(`${key} - Must start with 'whsec_'`);
    }

    if (key === 'STRIPE_PRICE_PRO_MONTHLY' && !value.startsWith('price_')) {
      invalid.push(`${key} - Must start with 'price_'`);
    }

    if (key === 'DATABASE_URL' && !value.startsWith('postgresql://')) {
      invalid.push(`${key} - Must be a valid PostgreSQL connection string`);
    }
  }

  // Report errors
  if (missing.length > 0 || invalid.length > 0) {
    const errorParts: string[] = [
      '❌ Environment Configuration Error',
      '',
    ];

    if (missing.length > 0) {
      errorParts.push('Missing required environment variables:');
      missing.forEach(m => errorParts.push(`  - ${m}`));
      errorParts.push('');
    }

    if (invalid.length > 0) {
      errorParts.push('Invalid environment variable values:');
      invalid.forEach(i => errorParts.push(`  - ${i}`));
      errorParts.push('');
    }

    errorParts.push('Fix: Update your .env.local file with valid values.');
    errorParts.push('See: ghostshell/.env.example for reference');
    errorParts.push('');
    errorParts.push('For Stripe test keys, visit: https://dashboard.stripe.com/test/apikeys');

    throw new EnvironmentError(errorParts.join('\n'));
  }
}

/**
 * Gets a required environment variable, throwing if not set
 */
export function getRequiredEnv(key: keyof typeof REQUIRED_ENV_VARS): string {
  const value = process.env[key];
  if (!value) {
    throw new EnvironmentError(
      `Required environment variable ${key} is not set. Check your .env.local file.`
    );
  }
  return value;
}

/**
 * Gets an optional environment variable, returning undefined if not set
 */
export function getOptionalEnv(key: keyof typeof OPTIONAL_ENV_VARS): string | undefined {
  return process.env[key];
}

/**
 * Checks if running in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Checks if using Stripe test mode
 */
export function isStripeTestMode(): boolean {
  return process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') ?? false;
}

// Auto-validate on import (only in development)
if (isDevelopment()) {
  try {
    validateEnvironment();
  } catch (error) {
    if (error instanceof EnvironmentError) {
      console.error('\n' + error.message + '\n');
      // Don't throw in development to allow Next.js to start
      // The error will be shown in the console
    }
  }
}
