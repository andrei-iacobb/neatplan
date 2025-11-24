#!/usr/bin/env node
/**
 * Environment Variable Validation Script
 * Run this before deploying to production to ensure all required env vars are set
 * and that default/weak secrets are not being used.
 */

const crypto = require('crypto');

// Color codes for terminal output
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let errors = [];
let warnings = [];

// Check if a secret is weak/default
function isWeakSecret(value) {
  const weakSecrets = [
    'change_me',
    'change-me',
    'change-this',
    'your-super-secret-key-change-this-in-production',
    'change-me-in-production',
    'secret',
    'password',
    'admin',
    'test'
  ];

  if (!value || value.length < 32) {
    return true;
  }

  const lowerValue = value.toLowerCase();
  return weakSecrets.some(weak => lowerValue.includes(weak));
}

// Generate a secure random secret
function generateSecret(length = 64) {
  return crypto.randomBytes(length).toString('hex');
}

console.log('\n🔒 Environment Variable Validation for Production\n');

// Required environment variables
const requiredVars = {
  DATABASE_URL: {
    check: (val) => val && val.startsWith('postgresql://'),
    error: 'DATABASE_URL must be set and start with postgresql://'
  },
  NEXTAUTH_URL: {
    check: (val) => val && (val.startsWith('http://') || val.startsWith('https://')),
    error: 'NEXTAUTH_URL must be set and be a valid URL'
  },
  NEXTAUTH_SECRET: {
    check: (val) => val && !isWeakSecret(val),
    error: 'NEXTAUTH_SECRET must be a strong random secret (min 32 chars)',
    suggestion: () => `Use: ${generateSecret(32)}`
  }
};

// Optional but recommended for production
const recommendedVars = {
  NODE_ENV: {
    check: (val) => val === 'production',
    warning: 'NODE_ENV should be set to "production"'
  },
  CRON_SECRET: {
    check: (val) => val && !isWeakSecret(val),
    warning: 'CRON_SECRET should be a strong random secret',
    suggestion: () => `Use: ${generateSecret(32)}`
  },
  ALLOWED_IPS: {
    check: (val) => val && val.length > 0,
    warning: 'ALLOWED_IPS is not set. Consider IP whitelisting for production.'
  },
  IP_WHITELIST_ENFORCE: {
    check: (val) => val === 'true',
    warning: 'IP_WHITELIST_ENFORCE is not enabled. Consider enabling for production.'
  }
};

// Check database password strength
const dbUrl = process.env.DATABASE_URL;
if (dbUrl) {
  const passwordMatch = dbUrl.match(/:([^@]+)@/);
  if (passwordMatch) {
    const dbPassword = passwordMatch[1];
    if (isWeakSecret(dbPassword)) {
      errors.push('Database password in DATABASE_URL is weak. Use a strong random password.');
    }
  }
}

// Check required variables
Object.entries(requiredVars).forEach(([key, config]) => {
  const value = process.env[key];

  if (!value) {
    errors.push(`${key} is not set`);
  } else if (!config.check(value)) {
    errors.push(config.error);
    if (config.suggestion) {
      console.log(`${YELLOW}  Suggestion: ${config.suggestion()}${RESET}`);
    }
  } else {
    console.log(`${GREEN}✓${RESET} ${key} is configured correctly`);
  }
});

// Check recommended variables
Object.entries(recommendedVars).forEach(([key, config]) => {
  const value = process.env[key];

  if (!value || !config.check(value)) {
    warnings.push(config.warning);
    if (config.suggestion) {
      console.log(`${YELLOW}  Suggestion: ${config.suggestion()}${RESET}`);
    }
  } else {
    console.log(`${GREEN}✓${RESET} ${key} is configured correctly`);
  }
});

// Report results
console.log('\n');

if (errors.length > 0) {
  console.log(`${RED}❌ Errors (${errors.length}):${RESET}`);
  errors.forEach(err => console.log(`${RED}  - ${err}${RESET}`));
}

if (warnings.length > 0) {
  console.log(`\n${YELLOW}⚠️  Warnings (${warnings.length}):${RESET}`);
  warnings.forEach(warn => console.log(`${YELLOW}  - ${warn}${RESET}`));
}

if (errors.length === 0 && warnings.length === 0) {
  console.log(`${GREEN}✅ All environment variables are properly configured!${RESET}\n`);
  process.exit(0);
} else if (errors.length === 0) {
  console.log(`\n${YELLOW}⚠️  Configuration has warnings but no critical errors${RESET}\n`);
  process.exit(0);
} else {
  console.log(`\n${RED}❌ Configuration has critical errors that must be fixed before production deployment${RESET}\n`);
  process.exit(1);
}
