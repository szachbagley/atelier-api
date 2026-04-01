# Security

This document describes the security measures implemented in Atelier, including authentication, encryption, input validation, and infrastructure security.

## Security Overview

Atelier implements defense-in-depth with multiple security layers:

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              Security Layers                                         │
│                                                                                      │
│  ┌───────────────────────────────────────────────────────────────────────────────┐  │
│  │                         Layer 1: Network                                       │  │
│  │                                                                                │  │
│  │  • HTTPS only (TLS 1.2+)                                                      │  │
│  │  • AWS Security Groups (firewall)                                             │  │
│  │  • Private subnet for database                                                │  │
│  │  • VPC endpoints for AWS services                                             │  │
│  └───────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                      │
│  ┌───────────────────────────────────────────────────────────────────────────────┐  │
│  │                         Layer 2: Application                                   │  │
│  │                                                                                │  │
│  │  • JWT authentication with refresh token rotation                             │  │
│  │  • CORS restrictions                                                          │  │
│  │  • Rate limiting on auth endpoints                                            │  │
│  │  • Security headers (Helmet.js)                                               │  │
│  │  • Input validation (Joi)                                                     │  │
│  └───────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                      │
│  ┌───────────────────────────────────────────────────────────────────────────────┐  │
│  │                         Layer 3: Data                                           │  │
│  │                                                                                │  │
│  │  • API keys encrypted at rest (AES-256-GCM)                                   │  │
│  │  • Passwords hashed (bcrypt, cost 12)                                         │  │
│  │  • S3 server-side encryption                                                  │  │
│  │  • Secrets in AWS Secrets Manager                                             │  │
│  └───────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Authentication

### Password Security

**Requirements:**

```typescript
const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: false,  // Keep MVP simple, can tighten later
};
```

**Bcrypt Configuration:**

```typescript
// Cost factor of 12 = ~250ms to hash on modern hardware
// Balances security vs. DoS risk from expensive hashing
const BCRYPT_ROUNDS = 12;
```

### JWT Token Security

**Token Strategy:**
- **Access Token**: 15-minute expiry, stored in memory (never localStorage), sent via `Authorization: Bearer` header
- **Refresh Token**: 7-day expiry, stored in HTTP-only secure cookie, used only to obtain new access tokens

**Access Token Payload:**

```typescript
interface AccessTokenPayload {
  sub: string;        // User ID
  email: string;
  iat: number;        // Issued at
  exp: number;        // Expiration
  type: 'access';
}
```

**Refresh Token Payload:**

```typescript
interface RefreshTokenPayload {
  sub: string;        // User ID
  jti: string;        // Unique token ID (for revocation)
  iat: number;
  exp: number;
  type: 'refresh';
}
```

**Cookie Configuration:**

```typescript
const refreshTokenCookie = {
  httpOnly: true,       // Not accessible via JavaScript
  secure: true,         // HTTPS only (in production)
  sameSite: 'strict',   // No cross-site requests
  path: '/api/auth',    // Only sent to auth endpoints
  maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
};
```

### Refresh Token Rotation

Every time a refresh token is used, it is rotated — a new refresh token is issued and the old one is marked as used.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                         Token Rotation Flow                                       │
│                                                                                   │
│  Client                                 Server                                    │
│    │                                      │                                       │
│    │  POST /api/auth/refresh              │                                       │
│    │  Cookie: refresh_token=TOKEN_A       │                                       │
│    │─────────────────────────────────────►│                                       │
│    │                                      │  Verify TOKEN_A                       │
│    │                                      │  Check: not revoked, not rotated      │
│    │                                      │  Generate TOKEN_B                     │
│    │                                      │  Mark TOKEN_A as replaced_by TOKEN_B  │
│    │  Set-Cookie: refresh_token=TOKEN_B   │                                       │
│    │  Body: { accessToken: NEW_ACCESS }   │                                       │
│    │◄─────────────────────────────────────│                                       │
│    │                                      │                                       │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Reuse Detection:**

If a refresh token that has already been rotated is used again, it indicates token theft. The entire token family is revoked:

```typescript
async refresh(refreshToken: string): Promise<TokenPair> {
  const payload = jwt.verify(refreshToken, config.refreshToken.secret);
  const tokenHash = hashToken(refreshToken);
  const storedToken = await db.refreshTokens.findByHash(tokenHash);
  
  if (!storedToken) throw new UnauthorizedError('Invalid token');
  if (storedToken.revoked_at) throw new UnauthorizedError('Token revoked');
  
  // Token was already rotated - REPLAY ATTACK DETECTED
  if (storedToken.replaced_by_id) {
    await this.revokeTokenFamily(storedToken.id);
    throw new UnauthorizedError('Token reuse detected');
  }
  
  const newTokens = await this.generateTokenPair(user);
  await db.refreshTokens.update(storedToken.id, {
    replaced_by_id: newTokens.refreshTokenId,
  });
  
  return newTokens;
}
```

**Token Security Summary:**

| Measure | Implementation |
|---------|----------------|
| Short access token lifetime | 15 minutes |
| Refresh token rotation | New token on each refresh |
| Refresh token reuse detection | Revoke family if reused |
| Secure token storage | HTTP-only cookie for refresh, memory for access |
| Token binding | Store user agent + IP with refresh tokens |

### Rate Limiting

**Auth Endpoints:**

```typescript
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,                    // 10 attempts per window
  keyGenerator: (req) => `${req.ip}-${req.body.email || 'unknown'}`,
  standardHeaders: true,
  legacyHeaders: false,
});
```

---

## Encryption

### API Key Encryption

User API keys (Gemini, etc.) are encrypted at rest using AES-256-GCM with per-encryption salts.

**Algorithm Details:**
- Cipher: AES-256-GCM
- Key derivation: PBKDF2 with SHA-256
- Iterations: 100,000
- Salt: 32 bytes, unique per encryption
- IV: 16 bytes, unique per encryption
- Auth tag: 16 bytes

**Why Per-Encryption Salt?**

Using a unique salt for each encryption ensures:
1. Same plaintext produces different ciphertext
2. Compromising one key doesn't help decrypt others
3. Protects against precomputation attacks

See BACKEND.md for full encryption service implementation.

### S3 Encryption

All S3 objects encrypted at rest:

```yaml
Encryption:
  Type: SSE-S3 (AES-256)
  BucketKey: Enabled
```

### Database Encryption

- **In transit**: TLS connection between ECS and MySQL
- **At rest**: EBS volume encryption (AES-256)

---

## Input Validation

### Joi Schema Validation

All API inputs are validated with Joi schemas before processing:

```typescript
// middleware/validate.ts

export function validate(schema: Joi.ObjectSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    
    if (error) {
      const fields = error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message,
      }));
      throw new ValidationError('Validation failed', { fields });
    }
    
    req.body = value;
    next();
  };
}
```

### SQL Injection Prevention

All database queries use parameterized statements via Knex:

```typescript
// SAFE: Parameterized query
const user = await db('users')
  .where({ email: userInput })
  .first();

// SAFE: Parameterized insert
await db('projects').insert({
  id: uuid(),
  user_id: userId,
  title: userInput,  // Automatically escaped
});

// NEVER DO THIS:
// const user = await db.raw(`SELECT * FROM users WHERE email = '${userInput}'`);
```

### XSS Prevention

**Output Encoding — React automatically escapes content in JSX:**

```tsx
// SAFE: React escapes this
<p>{userContent}</p>

// DANGEROUS: Only use for trusted HTML
<div dangerouslySetInnerHTML={{ __html: trustedHtml }} />
```

**Input Sanitization:**

```typescript
import DOMPurify from 'isomorphic-dompurify';

function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong'],
    ALLOWED_ATTR: [],
  });
}
```

**Content Security Policy:**

```typescript
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],  // Tailwind requires inline styles
    imgSrc: ["'self'", "https://*.s3.amazonaws.com", "data:", "blob:"],
    connectSrc: ["'self'", "https://*.amazonaws.com"],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"],
  },
}
```

### Prompt Injection Prevention

User inputs included in AI prompts are sanitized:

```typescript
function sanitizeForPrompt(input: string): string {
  return input
    .replace(/[<>{}[\]]/g, '')      // Remove brackets
    .replace(/```/g, '')             // Remove code blocks
    .replace(/\n{3,}/g, '\n\n')      // Limit consecutive newlines
    .trim()
    .slice(0, 2000);                 // Enforce length limit
}
```

Applied to shot descriptions, component descriptions, AI descriptions, and any user text that becomes part of a prompt.

---

## Authorization

### Resource Ownership

All resources are scoped to the owning user. Authorization is enforced at the middleware level:

```typescript
export async function requireProjectAccess(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { projectId } = req.params;
  const userId = req.user!.id;
  
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();
  
  if (!project) {
    throw new ForbiddenError('Access denied to this project');
  }
  
  req.project = project;
  next();
}
```

### Shared Project Access

Shared projects allow read-only access without authentication:

```typescript
router.get('/shared/:shareToken', async (req, res) => {
  const project = await db('projects')
    .where({ share_token: req.params.shareToken, is_public: true })
    .whereNull('deleted_at')
    .first();
  
  if (!project) throw new NotFoundError('Shared project not found');
  
  const data = await buildSharedProjectView(project.id);
  res.json(data);
});
```

---

## Security Headers

### Helmet.js Configuration

```typescript
app.use(helmet({
  contentSecurityPolicy: { /* see Input Validation section */ },
  frameguard: { action: 'deny' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  xssFilter: true,
  hidePoweredBy: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
}));
```

### Response Headers

Every response includes:

```
Content-Security-Policy: default-src 'self'; ...
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Referrer-Policy: strict-origin-when-cross-origin
```

---

## CORS Configuration

```typescript
const allowedOrigins = [
  'https://atelier.app',
  'https://www.atelier.app',
];

if (process.env.NODE_ENV === 'development') {
  allowedOrigins.push('http://localhost:5173');
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID'],
  maxAge: 86400,
}));
```

---

## Network Security

### Security Groups

**ALB Security Group:**
```
Inbound:  443 (HTTPS) from 0.0.0.0/0, 80 (HTTP) from 0.0.0.0/0 → Redirects to HTTPS
Outbound: All traffic to VPC (10.0.0.0/16)
```

**ECS Security Group:**
```
Inbound:  3000 from ALB SG only, 80 from ALB SG only
Outbound: 443 to 0.0.0.0/0 (external APIs), 3306 to Database SG
```

**Database Security Group:**
```
Inbound:  3306 from ECS SG only
Outbound: 443 to S3 VPC Endpoint (backups)
```

### TLS Configuration

**ALB HTTPS Listener:**
- SSL Policy: `ELBSecurityPolicy-TLS13-1-2-2021-06`
- Minimum TLS: 1.2
- Certificate: ACM-managed

**Supported Cipher Suites:**
- TLS_AES_128_GCM_SHA256
- TLS_AES_256_GCM_SHA384
- TLS_CHACHA20_POLY1305_SHA256
- ECDHE-ECDSA-AES128-GCM-SHA256
- ECDHE-RSA-AES128-GCM-SHA256
- ECDHE-ECDSA-AES256-GCM-SHA384
- ECDHE-RSA-AES256-GCM-SHA384

---

## Secrets Management

### AWS Secrets Manager

| Secret | Description | Rotation |
|--------|-------------|----------|
| `atelier/prod/db-root-password` | MySQL root password | Manual |
| `atelier/prod/db-app-password` | Application DB user | Manual |
| `atelier/prod/jwt-access-secret` | Access token signing | Manual |
| `atelier/prod/jwt-refresh-secret` | Refresh token signing | Manual |
| `atelier/prod/encryption-key` | API key encryption | Manual |

### Secret Generation

```bash
# JWT secrets (32 bytes = 64 hex characters)
openssl rand -hex 32

# Encryption key (32 bytes = 64 hex characters)
openssl rand -hex 32

# Database passwords (24 characters, alphanumeric)
openssl rand -base64 24 | tr -d '/+=' | head -c 24
```

### Secret Access Rules

Secrets are injected into ECS containers via task definition. **Never:**
- Commit secrets to source control
- Log secrets
- Include secrets in error messages
- Store secrets in environment files (.env) in production

---

## S3 Security

### Bucket Configuration

```yaml
Block Public Access:
  BlockPublicAcls: true
  IgnorePublicAcls: true
  BlockPublicPolicy: true
  RestrictPublicBuckets: true

Encryption: SSE-S3 (AES-256)
Versioning: Enabled
```

### Presigned URLs

All S3 access uses presigned URLs with short expiry:

```typescript
// Upload URL: 15 minutes
const uploadUrl = await getSignedUrl(s3Client, putCommand, {
  expiresIn: 15 * 60,
});

// Download URL: 1 hour
const downloadUrl = await getSignedUrl(s3Client, getCommand, {
  expiresIn: 60 * 60,
});
```

---

## Logging and Monitoring

### Security Event Logging

Logged events:
- Authentication attempts (success/failure)
- Authorization failures
- Rate limit hits
- Input validation failures
- Encryption/decryption errors

**Log Format:**

```typescript
logger.warn({
  event: 'auth_failure',
  email: email,
  ip: req.ip,
  userAgent: req.headers['user-agent'],
  reason: 'invalid_password',
  requestId: req.requestId,
});
```

### CloudWatch Security Alarms

```yaml
# High rate of 401 errors
- AlarmName: atelier-high-401-rate
  Metric: 4XXError
  Threshold: 50 per 5 minutes

# High rate of 403 errors
- AlarmName: atelier-high-403-rate
  Metric: HTTPCode_Target_4XX_Count
  Threshold: 20 per 5 minutes

# Unusual API error rate
- AlarmName: atelier-api-errors
  Metric: HTTPCode_Target_5XX_Count
  Threshold: 10 per 5 minutes
```

---

## Security Checklist

### Pre-Launch

- [ ] All secrets stored in Secrets Manager
- [ ] No secrets in source control (check git history)
- [ ] HTTPS enforced (HTTP redirects to HTTPS)
- [ ] Security headers configured (verify with securityheaders.com)
- [ ] CORS restricted to known origins
- [ ] Rate limiting enabled on auth endpoints
- [ ] Input validation on all endpoints
- [ ] Parameterized queries throughout
- [ ] Password hashing with bcrypt (cost 12+)
- [ ] JWT secrets are cryptographically random
- [ ] Refresh token rotation implemented
- [ ] S3 bucket is private (block public access)
- [ ] Database in private subnet
- [ ] Security groups properly configured
- [ ] TLS 1.2+ enforced
- [ ] Error messages don't leak sensitive info

### Ongoing

- [ ] Dependencies updated regularly (`npm audit`)
- [ ] Docker base images updated
- [ ] AWS security patches applied
- [ ] Access logs reviewed periodically
- [ ] Failed login attempts monitored
- [ ] Secrets rotated periodically
- [ ] Backup restoration tested

### Incident Response

If a security incident is suspected:

1. **Contain:** Revoke compromised tokens/credentials
2. **Investigate:** Review CloudWatch logs
3. **Remediate:** Patch vulnerability, rotate secrets
4. **Communicate:** Notify affected users if data exposed
5. **Document:** Record incident and response

---

## Dependency Security

### NPM Audit

```bash
# Check for vulnerabilities
npm audit

# Auto-fix where possible
npm audit fix

# Check in CI (fail on high/critical)
npm audit --audit-level=high
```

### Dependabot Configuration

```yaml
# .github/dependabot.yml

version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/backend"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    
  - package-ecosystem: "npm"
    directory: "/frontend"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    
  - package-ecosystem: "docker"
    directory: "/backend"
    schedule:
      interval: "weekly"
      
  - package-ecosystem: "docker"
    directory: "/frontend"
    schedule:
      interval: "weekly"
```

### Container Scanning

ECR scans images on push:

```yaml
ScanOnPush: true
```

Review scan results:

```bash
aws ecr describe-image-scan-findings \
  --repository-name atelier-backend \
  --image-id imageTag=latest
```
