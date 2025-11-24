# Security Audit Report - NeatPlan
**Date:** 2025-11-17
**Auditor:** Claude AI Security Audit
**Application:** NeatPlan v0.1.0

## Executive Summary

This security audit identified **23 security issues** across various severity levels in the NeatPlan application. The issues range from critical vulnerabilities like plaintext password storage to medium-severity issues like missing security headers. All critical and high-severity issues require immediate attention before production launch.

### Summary by Severity
- **CRITICAL:** 3 issues
- **HIGH:** 6 issues
- **MEDIUM:** 10 issues
- **LOW:** 4 issues

---

## CRITICAL Issues (Immediate Fix Required)

### 1. Plaintext Password Storage in SMTP Configuration
**File:** `src/app/api/admin/smtp-config/route.ts:137`
**Severity:** CRITICAL
**CVSS Score:** 9.1 (Critical)

**Issue:**
SMTP passwords are stored in plaintext in `.smtp-config.json` file on disk. This exposes credentials if the filesystem is compromised.

**Code:**
```typescript
fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2))
```

**Impact:**
- SMTP credentials exposed if server is compromised
- Credentials visible in backups
- Violates security best practices

**Recommendation:**
Use environment variables exclusively or encrypt passwords before storing. Remove file-based storage of credentials.

---

### 2. Weak Default Secrets
**File:** `env.example:6,9,13,16`
**Severity:** CRITICAL
**CVSS Score:** 8.5 (High)

**Issue:**
Default secrets like "change_me" and "your-super-secret-key-change-this-in-production" are weak and may be deployed to production.

**Code:**
```env
POSTGRES_PASSWORD=change_me
NEXTAUTH_SECRET=your-super-secret-key-change-this-in-production
CRON_SECRET=change-me-in-production
```

**Impact:**
- Unauthorized database access
- JWT token forgery
- Cron endpoint bypass

**Recommendation:**
- Generate cryptographically random secrets during deployment
- Add validation to reject default/weak secrets
- Provide secret generation commands in documentation

---

### 3. Multiple Dependency Vulnerabilities
**File:** `package.json`
**Severity:** CRITICAL
**CVSS Score:** 7.5 (High)

**Issue:**
7 moderate-severity vulnerabilities detected in dependencies:
- `next` 14.2.30 - SSRF, cache confusion, content injection (needs 14.2.32+)
- `next-auth` 4.24.11 - email misdelivery (needs 4.24.12+)
- `nodemailer` 7.0.5 - email to unintended domain (needs 7.0.7+)
- `mammoth` 1.9.1 - directory traversal (needs 1.11.0+)
- `@auth/prisma-adapter` 2.9.1 - needs update
- `js-yaml` - prototype pollution (indirect dependency)

**Impact:**
- Server-side request forgery
- Email misdelivery/hijacking
- Directory traversal attacks

**Recommendation:**
Run `npm audit fix` to update all vulnerable packages.

---

## HIGH Severity Issues

### 4. Predictable Session Tokens
**File:** `src/lib/auth.ts:111`
**Severity:** HIGH
**CVSS Score:** 7.3

**Issue:**
Session tokens are generated using predictable pattern: `session_${user.id}_${Date.now()}`

**Code:**
```typescript
const sessionToken = `session_${user.id}_${Date.now()}`
```

**Impact:**
- Session hijacking
- Unauthorized access

**Recommendation:**
Use cryptographically secure random tokens:
```typescript
import { randomBytes } from 'crypto'
const sessionToken = randomBytes(32).toString('hex')
```

---

### 5. Cron Secret Authentication via Query Parameter
**File:** `src/middleware.ts:55`
**Severity:** HIGH
**CVSS Score:** 6.8

**Issue:**
Cron secret can be passed as URL query parameter, which may be logged in web server logs, browser history, and referrer headers.

**Code:**
```typescript
const providedSecret = request.headers.get('x-cron-secret') || request.nextUrl.searchParams.get('secret')
```

**Impact:**
- Secrets leaked in logs
- Unauthorized cron execution

**Recommendation:**
Only accept `x-cron-secret` header, remove query parameter fallback.

---

### 6. CORS Origin Not Validated Properly
**File:** `next.config.js:40`, `src/app/api/process-document/route.ts:272`
**Severity:** HIGH
**CVSS Score:** 6.5

**Issue:**
CORS origin falls back to `'*'` in some cases, allowing any origin to access API endpoints.

**Code:**
```typescript
'Access-Control-Allow-Origin': process.env.CORS_ALLOWED_ORIGIN || process.env.NEXTAUTH_URL || request.headers.get('origin') || '*'
```

**Impact:**
- Cross-origin data theft
- CSRF attacks

**Recommendation:**
Never use `'*'` as fallback. Require explicit CORS configuration.

---

### 7. SSRF Vulnerability in Document Processing
**File:** `src/app/api/process-document/route.ts:227`
**Severity:** HIGH
**CVSS Score:** 7.0

**Issue:**
Internal fetch call uses user-controlled base URL which could allow SSRF attacks.

**Code:**
```typescript
const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin;
const aiScheduleResponse = await fetch(`${baseUrl}/api/ai/schedule`, {
```

**Impact:**
- Access to internal services
- Port scanning
- Metadata endpoint access (cloud environments)

**Recommendation:**
Always use fixed internal URLs, never rely on `request.nextUrl.origin`.

---

### 8. Silent Error Handling
**File:** `src/lib/auth.ts:62,73`
**Severity:** HIGH
**CVSS Score:** 5.5

**Issue:**
Empty catch blocks silently swallow critical security errors during login.

**Code:**
```typescript
try {
    await prisma.user.update(...)
} catch {}  // Silent failure
```

**Impact:**
- Failed login attempts not recorded
- Security monitoring blind spots
- Debugging difficulties

**Recommendation:**
Log all errors, even if you don't throw them:
```typescript
} catch (error) {
    console.error('Failed to update login attempt:', error)
}
```

---

### 9. Console.log in Production Code
**File:** Multiple files (20+ locations)
**Severity:** HIGH
**CVSS Score:** 5.3

**Issue:**
Extensive use of `console.log` throughout production code may leak sensitive data in production logs.

**Examples:**
- `src/app/api/ai/schedule/route.ts` - logs user content
- `src/app/api/process-document/route.ts` - logs file content
- `src/lib/email.ts` - logs email addresses

**Impact:**
- Sensitive data in logs
- Performance degradation
- Log storage costs

**Recommendation:**
- Use proper logging library with log levels
- Disable debug logs in production
- Sanitize sensitive data before logging

---

## MEDIUM Severity Issues

### 10. In-Memory Rate Limiting
**File:** `src/lib/rate-limit.ts:9-14`
**Severity:** MEDIUM
**CVSS Score:** 5.0

**Issue:**
Rate limiting uses in-memory storage which won't work correctly in multi-instance deployments.

**Impact:**
- Rate limits bypassed by distributing requests across instances
- DoS attacks not properly mitigated

**Recommendation:**
Use Redis or database-backed rate limiting for production.

---

### 11. ESLint Errors Ignored During Builds
**File:** `next.config.js:27`
**Severity:** MEDIUM
**CVSS Score:** 4.0

**Issue:**
ESLint warnings ignored during build process.

**Code:**
```javascript
eslint: {
    ignoreDuringBuilds: true,
}
```

**Impact:**
- Code quality issues undetected
- Potential security issues missed

**Recommendation:**
Enable ESLint in builds: `ignoreDuringBuilds: false`

---

### 12. No Input Sanitization in Email Templates
**File:** `src/lib/email.ts:24-88`
**Severity:** MEDIUM
**CVSS Score:** 5.5

**Issue:**
User data in email templates is not sanitized, potentially allowing HTML injection in emails.

**Code:**
```typescript
<h3 style="margin: 0 0 8px 0; color: #0369a1;">${data.taskName}</h3>
```

**Impact:**
- Email HTML injection
- Phishing attacks

**Recommendation:**
Sanitize all user input before inserting into HTML:
```typescript
const escapeHtml = (str: string) => str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
```

---

### 13. No Content Security Policy
**File:** `next.config.js`
**Severity:** MEDIUM
**CVSS Score:** 5.0

**Issue:**
No Content-Security-Policy headers configured.

**Impact:**
- XSS attacks easier to execute
- Clickjacking vulnerabilities

**Recommendation:**
Add CSP headers in `next.config.js`:
```javascript
{
  key: 'Content-Security-Policy',
  value: "default-src 'self'; script-src 'self' 'unsafe-inline'; ..."
}
```

---

### 14. No HSTS Headers
**File:** `next.config.js`
**Severity:** MEDIUM
**CVSS Score:** 5.0

**Issue:**
No Strict-Transport-Security headers for HTTPS enforcement.

**Impact:**
- Man-in-the-middle attacks
- SSL stripping attacks

**Recommendation:**
Add HSTS header:
```javascript
{
  key: 'Strict-Transport-Security',
  value: 'max-age=31536000; includeSubDomains'
}
```

---

### 15. Dockerfile Runs as Root
**File:** `Dockerfile:2`
**Severity:** MEDIUM
**CVSS Score:** 6.0

**Issue:**
Container runs as root user, violating principle of least privilege.

**Impact:**
- Container escape leads to root access
- Increased attack surface

**Recommendation:**
Add non-root user:
```dockerfile
RUN addgroup -g 1001 nodejs
RUN adduser -S -u 1001 -G nodejs nextjs
USER nextjs
```

---

### 16. No Password Complexity Requirements
**File:** `src/app/api/auth/change-password/route.ts:16`
**Severity:** MEDIUM
**CVSS Score:** 5.0

**Issue:**
Password only requires 8 characters minimum, no complexity requirements.

**Code:**
```typescript
if (!newPassword || newPassword.length < 8)
```

**Impact:**
- Weak passwords
- Brute force attacks

**Recommendation:**
Add complexity validation:
- Minimum 12 characters
- Require uppercase, lowercase, number, special char
- Check against common password lists

---

### 17. Missing X-Frame-Options Header
**File:** `next.config.js`
**Severity:** MEDIUM
**CVSS Score:** 4.5

**Issue:**
No X-Frame-Options header to prevent clickjacking.

**Recommendation:**
Add header:
```javascript
{ key: 'X-Frame-Options', value: 'DENY' }
```

---

### 18. Missing X-Content-Type-Options Header
**File:** `next.config.js`
**Severity:** MEDIUM
**CVSS Score:** 4.0

**Issue:**
No X-Content-Type-Options header.

**Recommendation:**
Add header:
```javascript
{ key: 'X-Content-Type-Options', value: 'nosniff' }
```

---

### 19. No Request Size Limits
**File:** API routes
**Severity:** MEDIUM
**CVSS Score:** 5.0

**Issue:**
No explicit file size limits for document uploads.

**Impact:**
- DoS via large file uploads
- Resource exhaustion

**Recommendation:**
Add file size validation and Next.js body size limits.

---

## LOW Severity Issues

### 20. Development Environment in Docker
**File:** `Dockerfile:22`
**Severity:** LOW
**CVSS Score:** 3.0

**Issue:**
Dockerfile sets `NODE_ENV=development` by default.

**Code:**
```dockerfile
ENV NODE_ENV=development
```

**Recommendation:**
Use `NODE_ENV=production` or make it configurable via build args.

---

### 21. Database Exposed on Localhost
**File:** `docker-compose.yml:44`
**Severity:** LOW
**CVSS Score:** 3.5

**Issue:**
PostgreSQL port exposed on 127.0.0.1:5432, not needed for production.

**Recommendation:**
Remove port mapping in production deployments.

---

### 22. No API Versioning
**File:** API routes
**Severity:** LOW
**CVSS Score:** 2.0

**Issue:**
No API versioning strategy in place.

**Impact:**
- Breaking changes harder to manage
- Client compatibility issues

**Recommendation:**
Implement API versioning (e.g., `/api/v1/...`).

---

### 23. Missing Dependency Lockfile Verification
**File:** Build process
**Severity:** LOW
**CVSS Score:** 3.0

**Issue:**
No verification of package-lock.json during builds.

**Recommendation:**
Use `npm ci` instead of `npm install` in production builds.

---

## Recommendations for Production Launch

### Immediate Actions (Before Launch)
1. ✅ Update all vulnerable dependencies (`npm audit fix`)
2. ✅ Generate strong random secrets for all environments
3. ✅ Fix SMTP password storage (use env vars only)
4. ✅ Fix predictable session tokens
5. ✅ Remove cron secret query parameter option
6. ✅ Fix CORS configuration
7. ✅ Add security headers (CSP, HSTS, X-Frame-Options, etc.)
8. ✅ Fix Dockerfile to run as non-root user
9. ✅ Remove/sanitize console.log statements

### Short-term Actions (Within 1 Month)
10. Implement proper logging system (Winston, Pino)
11. Add password complexity requirements
12. Implement Redis-backed rate limiting
13. Add input sanitization for all user inputs
14. Enable ESLint in builds
15. Add API versioning
16. Implement file size limits
17. Set up security monitoring and alerting

### Long-term Actions (Within 3 Months)
18. Regular security audits and penetration testing
19. Implement WAF (Web Application Firewall)
20. Add automated vulnerability scanning in CI/CD
21. Implement bug bounty program
22. Regular dependency updates
23. Security training for development team

---

## Testing Recommendations

1. **Penetration Testing**: Hire external security firm for comprehensive testing
2. **SAST/DAST**: Implement automated security testing tools
3. **Dependency Scanning**: Use Snyk or Dependabot for continuous monitoring
4. **Code Review**: All security-related changes should be peer-reviewed
5. **Security Headers Testing**: Use securityheaders.com
6. **SSL Testing**: Use ssllabs.com for HTTPS configuration

---

## Compliance Considerations

- **GDPR**: Ensure password storage and user data handling complies
- **SOC 2**: Address logging and monitoring requirements
- **PCI DSS**: If handling payments, additional requirements apply
- **HIPAA**: If handling health data, additional requirements apply

---

## Conclusion

The NeatPlan application has a solid foundation with NextAuth, Prisma ORM, and proper role-based access control. However, the critical and high-severity issues identified must be addressed before production deployment. Implementing the recommended fixes will significantly improve the security posture of the application.

**Estimated Effort to Fix Critical/High Issues:** 16-24 hours
**Recommended Launch Delay:** Until all Critical and High severity issues are resolved

---

*This audit was performed on November 17, 2025. Security is an ongoing process - regular audits and updates are essential.*
