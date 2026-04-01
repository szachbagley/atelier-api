# Backend

This document describes the backend implementation details for Atelier, including project structure, configuration, services, and middleware.

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── index.ts              # Configuration loader
│   │   ├── auth.ts               # JWT and password settings
│   │   ├── database.ts           # Database connection settings
│   │   └── storage.ts            # S3 and image settings
│   │
│   ├── db/
│   │   ├── index.ts              # Knex instance and connection
│   │   ├── migrations/           # Database migrations
│   │   │   ├── 001_create_users.ts
│   │   │   ├── 002_create_projects.ts
│   │   │   └── ...
│   │   └── repositories/         # Data access layer
│   │       ├── userRepository.ts
│   │       ├── projectRepository.ts
│   │       ├── characterRepository.ts
│   │       ├── shotRepository.ts
│   │       └── ...
│   │
│   ├── errors/
│   │   ├── index.ts              # Error exports
│   │   ├── codes.ts              # Error code constants
│   │   └── AppError.ts           # Error classes
│   │
│   ├── middleware/
│   │   ├── authenticate.ts       # JWT verification
│   │   ├── errorHandler.ts       # Global error handling
│   │   ├── rateLimiter.ts        # Rate limiting
│   │   ├── requestId.ts          # Request ID tracking
│   │   ├── securityHeaders.ts    # Helmet configuration
│   │   ├── cors.ts               # CORS configuration
│   │   └── validate.ts           # Request validation
│   │
│   ├── routes/
│   │   ├── index.ts              # Route aggregator
│   │   ├── auth.ts               # Authentication routes
│   │   ├── userSettings.ts       # API key management
│   │   ├── projects.ts           # Project CRUD
│   │   ├── artStyle.ts           # Art style routes
│   │   ├── characters.ts         # Character and variant routes
│   │   ├── settings.ts           # Setting routes
│   │   ├── props.ts              # Prop routes
│   │   ├── lighting.ts           # Lighting routes
│   │   ├── referenceImages.ts    # Reference image upload routes
│   │   ├── acts.ts               # Act routes
│   │   ├── scenes.ts             # Scene routes
│   │   ├── shots.ts              # Shot routes with generation
│   │   ├── conceptSessions.ts    # Concept art session routes
│   │   └── shared.ts             # Public sharing routes
│   │
│   ├── schemas/
│   │   ├── auth.ts               # Auth validation schemas
│   │   ├── project.ts            # Project schemas
│   │   ├── character.ts          # Character schemas
│   │   ├── shot.ts               # Shot schemas
│   │   └── ...
│   │
│   ├── services/
│   │   ├── auth/
│   │   │   └── authService.ts    # Registration, login, tokens
│   │   ├── encryption/
│   │   │   └── encryptionService.ts  # AES-256-GCM
│   │   ├── imageGeneration/
│   │   │   ├── index.ts          # Service entry point
│   │   │   └── errorMapper.ts    # Provider error mapping
│   │   ├── promptCompiler/
│   │   │   ├── PromptCompiler.ts # Base class
│   │   │   ├── geminiAdapter.ts  # Gemini-specific compiler
│   │   │   ├── descriptors.ts    # Shot type/angle descriptions
│   │   │   └── index.ts          # Factory and compilation service
│   │   └── storage/
│   │       ├── storageService.ts # S3 operations
│   │       └── s3Client.ts       # AWS SDK setup
│   │
│   ├── types/
│   │   ├── models.ts             # Database model types
│   │   └── express.d.ts          # Express type extensions
│   │
│   ├── utils/
│   │   ├── logger.ts             # Pino logger setup
│   │   ├── softDelete.ts         # Soft delete helpers
│   │   └── sequencing.ts         # Sequence number utilities
│   │
│   ├── app.ts                    # Express app setup
│   └── server.ts                 # Server entry point
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── Dockerfile
└── package.json
```

---

## Error System

### Error Code Registry

```typescript
// src/errors/codes.ts

export const ErrorCodes = {
  // Authentication (AUTH_xxx)
  AUTH_TOKEN_MISSING: 'AUTH_TOKEN_MISSING',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_EMAIL_IN_USE: 'AUTH_EMAIL_IN_USE',
  
  // Authorization (AUTHZ_xxx)
  AUTHZ_PROJECT_ACCESS_DENIED: 'AUTHZ_PROJECT_ACCESS_DENIED',
  AUTHZ_RESOURCE_ACCESS_DENIED: 'AUTHZ_RESOURCE_ACCESS_DENIED',
  
  // Validation (VAL_xxx)
  VAL_REQUIRED_FIELD: 'VAL_REQUIRED_FIELD',
  VAL_INVALID_FORMAT: 'VAL_INVALID_FORMAT',
  VAL_STRING_TOO_LONG: 'VAL_STRING_TOO_LONG',
  VAL_INVALID_ENUM: 'VAL_INVALID_ENUM',
  VAL_INVALID_UUID: 'VAL_INVALID_UUID',
  
  // Resource (RES_xxx)
  RES_NOT_FOUND: 'RES_NOT_FOUND',
  RES_ALREADY_EXISTS: 'RES_ALREADY_EXISTS',
  RES_DELETED: 'RES_DELETED',
  RES_CONFLICT: 'RES_CONFLICT',
  
  // API Keys (KEY_xxx)
  KEY_NOT_CONFIGURED: 'KEY_NOT_CONFIGURED',
  KEY_INVALID: 'KEY_INVALID',
  KEY_EXPIRED: 'KEY_EXPIRED',
  KEY_RATE_LIMITED: 'KEY_RATE_LIMITED',
  KEY_QUOTA_EXCEEDED: 'KEY_QUOTA_EXCEEDED',
  KEY_DECRYPTION_FAILED: 'KEY_DECRYPTION_FAILED',
  
  // Image Generation (GEN_xxx)
  GEN_PROMPT_TOO_LONG: 'GEN_PROMPT_TOO_LONG',
  GEN_PROVIDER_ERROR: 'GEN_PROVIDER_ERROR',
  GEN_PROVIDER_TIMEOUT: 'GEN_PROVIDER_TIMEOUT',
  GEN_CONTENT_FILTERED: 'GEN_CONTENT_FILTERED',
  GEN_ALREADY_IN_PROGRESS: 'GEN_ALREADY_IN_PROGRESS',
  GEN_NO_PREVIOUS_IMAGE: 'GEN_NO_PREVIOUS_IMAGE',
  
  // Upload (UPL_xxx)
  UPL_FILE_TOO_LARGE: 'UPL_FILE_TOO_LARGE',
  UPL_INVALID_FILE_TYPE: 'UPL_INVALID_FILE_TYPE',
  UPL_S3_ERROR: 'UPL_S3_ERROR',
  
  // System (SYS_xxx)
  SYS_INTERNAL_ERROR: 'SYS_INTERNAL_ERROR',
  SYS_DATABASE_ERROR: 'SYS_DATABASE_ERROR',
  SYS_SERVICE_UNAVAILABLE: 'SYS_SERVICE_UNAVAILABLE',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
```

### Error Classes

```typescript
// src/errors/AppError.ts

import { ErrorCode, ErrorCodes } from './codes';

interface ApiError {
  error: {
    code: string;
    message: string;
    details?: object;
    requestId?: string;
  };
}

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public statusCode: number,
    message: string,
    public details?: object
  ) {
    super(message);
    this.name = 'AppError';
  }
  
  toResponse(requestId?: string): ApiError {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        requestId,
      },
    };
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: object) {
    super(ErrorCodes.VAL_REQUIRED_FIELD, 400, message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(ErrorCodes.RES_NOT_FOUND, 404, `${resource} not found: ${id}`, { resource, id });
  }
}

export class UnauthorizedError extends AppError {
  constructor(code: ErrorCode = ErrorCodes.AUTH_TOKEN_MISSING) {
    super(code, 401, 'Authentication required');
  }
}

export class ForbiddenError extends AppError {
  constructor(resource: string) {
    super(ErrorCodes.AUTHZ_RESOURCE_ACCESS_DENIED, 403, `Access denied to ${resource}`);
  }
}

export class ConflictError extends AppError {
  constructor(code: ErrorCode, message: string) {
    super(code, 409, message);
  }
}

export class ApiKeyError extends AppError {
  constructor(code: ErrorCode, provider: string, message: string) {
    super(code, 422, message, { provider });
  }
}

export class GenerationError extends AppError {
  constructor(code: ErrorCode, message: string, details?: object) {
    super(code, 422, message, details);
  }
}

export class ProviderError extends AppError {
  constructor(provider: string, originalError: string, retryable: boolean = false) {
    super(
      ErrorCodes.GEN_PROVIDER_ERROR,
      502,
      `Image generation failed: ${originalError}`,
      { provider, retryable }
    );
  }
}
```

---

## Configuration

### Environment Variables

```typescript
// src/config/index.ts

import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optional(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

export const config = {
  env: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '3000'), 10),
  
  database: {
    url: required('DATABASE_URL'),
  },
  
  auth: {
    accessTokenSecret: required('JWT_ACCESS_SECRET'),
    refreshTokenSecret: required('JWT_REFRESH_SECRET'),
    accessTokenExpiry: optional('JWT_ACCESS_EXPIRY', '15m'),
    refreshTokenExpiry: optional('JWT_REFRESH_EXPIRY', '7d'),
    bcryptRounds: parseInt(optional('BCRYPT_ROUNDS', '12'), 10),
  },
  
  encryption: {
    key: required('ENCRYPTION_KEY'),
  },
  
  aws: {
    region: optional('AWS_REGION', 'us-west-2'),
    s3Bucket: required('S3_BUCKET'),
  },
  
  cors: {
    origins: optional('CORS_ORIGINS', 'http://localhost:5173').split(','),
  },
};
```

### Auth Configuration

```typescript
// src/config/auth.ts

import { config } from './index';

export const authConfig = {
  accessToken: {
    secret: config.auth.accessTokenSecret,
    expiresIn: config.auth.accessTokenExpiry,
    algorithm: 'HS256' as const,
  },
  
  refreshToken: {
    secret: config.auth.refreshTokenSecret,
    expiresIn: config.auth.refreshTokenExpiry,
    algorithm: 'HS256' as const,
    cookie: {
      name: 'refresh_token',
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'strict' as const,
      path: '/api/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  },
  
  password: {
    saltRounds: config.auth.bcryptRounds,
    minLength: 8,
    maxLength: 128,
  },
};
```

### Storage Configuration

```typescript
// src/config/storage.ts

import { config } from './index';

export const storageConfig = {
  bucket: config.aws.s3Bucket,
  region: config.aws.region,
  
  presignedUrl: {
    uploadExpiry: 15 * 60,      // 15 minutes
    downloadExpiry: 60 * 60,    // 1 hour
  },
  
  limits: {
    referenceImage: {
      maxSizeBytes: 10 * 1024 * 1024,  // 10 MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
    },
    generatedImage: {
      maxSizeBytes: 20 * 1024 * 1024,  // 20 MB
    },
  },
  
  thumbnails: {
    width: 400,
    height: 225,
    format: 'webp' as const,
    quality: 80,
  },
};
```

---

## Services

### Auth Service

Handles user registration, login, token management, and session handling.

```typescript
// src/services/auth/authService.ts

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuid } from 'uuid';
import { authConfig } from '../../config/auth';
import { db } from '../../db';
import { UnauthorizedError, ConflictError } from '../../errors';
import { ErrorCodes } from '../../errors/codes';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export const authService = {
  
  async register(email: string, password: string) {
    // Check for existing user
    const existing = await db('users').where({ email }).whereNull('deleted_at').first();
    if (existing) {
      throw new ConflictError(ErrorCodes.AUTH_EMAIL_IN_USE, 'Email already registered');
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, authConfig.password.saltRounds);
    
    // Create user
    const userId = uuid();
    await db('users').insert({
      id: userId,
      email,
      password_hash: passwordHash,
    });
    
    // Generate tokens
    return this.generateTokenPair(userId, email);
  },
  
  async login(email: string, password: string) {
    const user = await db('users').where({ email }).whereNull('deleted_at').first();
    if (!user) {
      throw new UnauthorizedError(ErrorCodes.AUTH_INVALID_CREDENTIALS);
    }
    
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      throw new UnauthorizedError(ErrorCodes.AUTH_INVALID_CREDENTIALS);
    }
    
    return this.generateTokenPair(user.id, user.email);
  },
  
  async refresh(refreshToken: string) {
    const payload = jwt.verify(refreshToken, authConfig.refreshToken.secret) as any;
    const tokenHash = hashToken(refreshToken);
    const storedToken = await db('refresh_tokens').where({ token_hash: tokenHash }).first();
    
    // Token not found
    if (!storedToken) {
      throw new UnauthorizedError(ErrorCodes.AUTH_TOKEN_INVALID);
    }
    
    // Token was revoked
    if (storedToken.revoked_at) {
      throw new UnauthorizedError(ErrorCodes.AUTH_TOKEN_INVALID);
    }
    
    // Token was already rotated - REPLAY ATTACK DETECTED
    if (storedToken.replaced_by_id) {
      // Revoke entire token family
      await this.revokeTokenFamily(storedToken.id);
      throw new UnauthorizedError(ErrorCodes.AUTH_TOKEN_INVALID);
    }
    
    // Generate new tokens
    const user = await db('users').where({ id: payload.sub }).first();
    const newTokens = await this.generateTokenPair(user.id, user.email);
    
    // Mark old token as rotated
    await db('refresh_tokens').where({ id: storedToken.id }).update({
      replaced_by_id: newTokens.refreshTokenId,
    });
    
    return newTokens;
  },
  
  async logout(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    await db('refresh_tokens').where({ token_hash: tokenHash }).update({
      revoked_at: db.fn.now(),
    });
  },
  
  verifyAccessToken(token: string) {
    try {
      const payload = jwt.verify(token, authConfig.accessToken.secret) as any;
      return { id: payload.sub, email: payload.email };
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        throw new UnauthorizedError(ErrorCodes.AUTH_TOKEN_EXPIRED);
      }
      throw new UnauthorizedError(ErrorCodes.AUTH_TOKEN_INVALID);
    }
  },
  
  async generateTokenPair(userId: string, email: string) {
    // Access token
    const accessToken = jwt.sign(
      { sub: userId, email, type: 'access' },
      authConfig.accessToken.secret,
      { expiresIn: authConfig.accessToken.expiresIn, algorithm: authConfig.accessToken.algorithm }
    );
    
    // Refresh token
    const refreshTokenId = uuid();
    const refreshToken = jwt.sign(
      { sub: userId, jti: refreshTokenId, type: 'refresh' },
      authConfig.refreshToken.secret,
      { expiresIn: authConfig.refreshToken.expiresIn, algorithm: authConfig.refreshToken.algorithm }
    );
    
    // Store refresh token hash
    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    await db('refresh_tokens').insert({
      id: refreshTokenId,
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });
    
    return {
      user: { id: userId, email },
      accessToken,
      refreshToken,
      refreshTokenId,
    };
  },
  
  async revokeTokenFamily(tokenId: string) {
    // Follow the chain and revoke all tokens in the family
    let currentId: string | null = tokenId;
    while (currentId) {
      const token = await db('refresh_tokens').where({ id: currentId }).first();
      if (!token) break;
      
      await db('refresh_tokens').where({ id: currentId }).update({
        revoked_at: db.fn.now(),
      });
      
      currentId = token.replaced_by_id;
    }
  },
};
```

### Encryption Service

AES-256-GCM encryption for user API keys with PBKDF2 key derivation.

```typescript
// src/services/encryption/encryptionService.ts

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const ITERATIONS = 100000;

const MASTER_KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');

interface EncryptedData {
  ciphertext: string;  // base64
  iv: string;          // base64
  authTag: string;     // base64
  salt: string;        // base64
}

export function encryptApiKey(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);
  
  // Derive a unique key for this encryption using salt
  const derivedKey = crypto.pbkdf2Sync(MASTER_KEY, salt, ITERATIONS, 32, 'sha256');
  
  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
  
  let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
  ciphertext += cipher.final('base64');
  
  const authTag = cipher.getAuthTag();
  
  const encrypted: EncryptedData = {
    ciphertext,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    salt: salt.toString('base64'),
  };
  
  return Buffer.from(JSON.stringify(encrypted)).toString('base64');
}

export function decryptApiKey(encryptedString: string): string {
  const encrypted: EncryptedData = JSON.parse(
    Buffer.from(encryptedString, 'base64').toString('utf8')
  );
  
  const iv = Buffer.from(encrypted.iv, 'base64');
  const authTag = Buffer.from(encrypted.authTag, 'base64');
  const salt = Buffer.from(encrypted.salt, 'base64');
  const ciphertext = Buffer.from(encrypted.ciphertext, 'base64');
  
  // Derive the same key using the stored salt
  const derivedKey = crypto.pbkdf2Sync(MASTER_KEY, salt, ITERATIONS, 32, 'sha256');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
  decipher.setAuthTag(authTag);
  
  let plaintext = decipher.update(ciphertext);
  plaintext = Buffer.concat([plaintext, decipher.final()]);
  
  return plaintext.toString('utf8');
}

export function generateKeyHint(apiKey: string): string {
  return '•••••' + apiKey.slice(-4);
}
```

**Key Rotation Strategy:**

If the master encryption key is compromised:

1. Generate new master key, store in Secrets Manager
2. Run migration script that decrypts all keys with old key, re-encrypts with new key
3. Deploy updated ENCRYPTION_KEY to ECS tasks
4. Delete old key from Secrets Manager

```typescript
// scripts/rotateEncryptionKey.ts

async function rotateEncryptionKey(oldKey: string, newKey: string) {
  const allApiKeys = await db('user_api_keys').select('*');
  
  for (const record of allApiKeys) {
    const plaintext = decryptApiKeyWithKey(record.encrypted_key, oldKey);
    const newEncrypted = encryptApiKeyWithKey(plaintext, newKey);
    
    await db('user_api_keys').where({ id: record.id }).update({
      encrypted_key: newEncrypted,
    });
  }
}
```

### Prompt Compiler

The prompt compiler transforms structured shot data into optimized text prompts for image generation providers.

#### Base Class

```typescript
// src/services/promptCompiler/PromptCompiler.ts

export const MAX_PROMPT_LENGTH = 1500;

export interface ShotContext {
  shot: Shot;
  scene: Scene;
  artStyle: ArtStyle | null;
  characters: Array<{ character: Character; variant?: Variant }>;
  setting: Setting | null;
  lighting: LightingSetup | null;
  props: Prop[];
}

export interface PromptSection {
  name: string;
  content: string;
  source: string;
}

export interface CompiledPrompt {
  prompt: string;
  sections: PromptSection[];
  warnings: string[];
  error: { code: string; message: string } | null;
}

export abstract class PromptCompiler {
  
  compile(context: ShotContext): CompiledPrompt {
    const warnings: string[] = [];
    
    if (!context.artStyle?.ai_description && !context.artStyle?.description) {
      warnings.push('Art style has no description - output may lack visual consistency');
    }
    
    context.characters.forEach(({ character, variant }) => {
      const desc = variant?.ai_description || character.ai_description;
      if (!desc && !character.physical_description) {
        warnings.push(`Character "${character.name}" has no description`);
      }
    });
    
    const sections = this.buildSections(context);
    const prompt = this.assembleSections(sections);
    
    if (prompt.length > MAX_PROMPT_LENGTH) {
      return {
        prompt,
        sections,
        warnings,
        error: {
          code: 'PROMPT_TOO_LONG',
          message: `Prompt is ${prompt.length} characters. Maximum is ${MAX_PROMPT_LENGTH}.`,
        },
      };
    }
    
    return { prompt, sections, warnings, error: null };
  }
  
  protected buildSections(context: ShotContext): PromptSection[] {
    const sections: PromptSection[] = [];
    
    const framing = this.buildFramingSection(context);
    if (framing) sections.push(framing);
    
    const description = this.buildDescriptionSection(context);
    if (description) sections.push(description);
    
    const characters = this.buildCharactersSection(context);
    if (characters) sections.push(characters);
    
    const props = this.buildPropsSection(context);
    if (props) sections.push(props);
    
    const setting = this.buildSettingSection(context);
    if (setting) sections.push(setting);
    
    const lighting = this.buildLightingSection(context);
    if (lighting) sections.push(lighting);
    
    const style = this.buildStyleSection(context);
    if (style) sections.push(style);
    
    const quality = this.buildQualitySection();
    if (quality) sections.push(quality);
    
    return sections;
  }
  
  protected buildFramingSection(context: ShotContext): PromptSection | null {
    const parts: string[] = [];
    
    if (context.shot.shot_type) {
      parts.push(SHOT_TYPE_DESCRIPTIONS[context.shot.shot_type] || '');
    }
    if (context.shot.camera_angle) {
      parts.push(CAMERA_ANGLE_DESCRIPTIONS[context.shot.camera_angle] || '');
    }
    
    if (parts.length === 0) return null;
    
    return {
      name: 'framing',
      content: parts.filter(Boolean).join(', '),
      source: 'system:shot_type',
    };
  }
  
  protected buildDescriptionSection(context: ShotContext): PromptSection | null {
    if (!context.shot.description) return null;
    
    return {
      name: 'description',
      content: context.shot.description,
      source: 'user:shot_description',
    };
  }
  
  protected buildCharactersSection(context: ShotContext): PromptSection | null {
    if (context.characters.length === 0) return null;
    
    const descriptions = context.characters.map(({ character, variant }) => {
      const desc = variant?.ai_description || character.ai_description || character.physical_description || character.name;
      return desc;
    });
    
    return {
      name: 'characters',
      content: `featuring ${descriptions.join('; ')}`,
      source: context.characters.map(c => `character:${c.character.id}`).join(','),
    };
  }
  
  protected buildPropsSection(context: ShotContext): PromptSection | null {
    if (context.props.length === 0) return null;
    
    const descriptions = context.props.map(p => p.ai_description || p.description || p.name);
    
    return {
      name: 'props',
      content: `with ${descriptions.join(', ')}`,
      source: context.props.map(p => `prop:${p.id}`).join(','),
    };
  }
  
  protected buildSettingSection(context: ShotContext): PromptSection | null {
    if (!context.setting) return null;
    
    const parts: string[] = [];
    
    if (context.setting.ai_description) {
      parts.push(context.setting.ai_description);
    } else {
      if (context.setting.description) parts.push(context.setting.description);
      if (context.setting.set_dressing) parts.push(context.setting.set_dressing);
    }
    
    if (context.setting.time_of_day && context.setting.time_of_day !== 'unspecified') {
      parts.push(TIME_OF_DAY_DESCRIPTIONS[context.setting.time_of_day]);
    }
    
    if (context.setting.weather && context.setting.weather !== 'unspecified') {
      parts.push(WEATHER_DESCRIPTIONS[context.setting.weather]);
    }
    
    if (parts.length === 0) return null;
    
    return {
      name: 'setting',
      content: `Set in ${parts.filter(Boolean).join('. ')}`,
      source: `setting:${context.setting.id}`,
    };
  }
  
  protected buildLightingSection(context: ShotContext): PromptSection | null {
    if (!context.lighting) return null;
    
    const desc = context.lighting.ai_description || context.lighting.description;
    if (!desc) return null;
    
    return {
      name: 'lighting',
      content: desc,
      source: `lighting:${context.lighting.id}`,
    };
  }
  
  protected buildStyleSection(context: ShotContext): PromptSection | null {
    if (!context.artStyle) return null;
    
    const desc = context.artStyle.ai_description || context.artStyle.description;
    if (!desc) return null;
    
    return {
      name: 'style',
      content: `Rendered in ${desc}`,
      source: `art_style:${context.artStyle.id}`,
    };
  }
  
  protected abstract buildQualitySection(): PromptSection | null;
  protected abstract assembleSections(sections: PromptSection[]): string;
}
```

#### Gemini Adapter

```typescript
// src/services/promptCompiler/geminiAdapter.ts

import { PromptCompiler, ShotContext, CompiledPrompt, PromptSection, MAX_PROMPT_LENGTH } from './PromptCompiler';

const GEMINI_QUALITY_BOOSTERS = [
  'highly detailed',
  'professional cinematography',
  'cinematic composition',
  'dramatic lighting',
];

export class GeminiPromptCompiler extends PromptCompiler {
  
  protected buildQualitySection(): PromptSection {
    return {
      name: 'quality',
      content: GEMINI_QUALITY_BOOSTERS.join(', '),
      source: 'system:quality_boosters',
    };
  }
  
  protected assembleSections(sections: PromptSection[]): string {
    // Gemini works best with natural prose
    return sections
      .map(s => s.content)
      .join('. ')
      .replace(/\.\./g, '.')
      .trim();
  }
}
```

#### Descriptors

```typescript
// src/services/promptCompiler/descriptors.ts

export const SHOT_TYPE_DESCRIPTIONS: Record<string, string> = {
  'EWS': 'extreme wide shot showing vast environment with small figures',
  'WS': 'wide shot showing full environment and complete figures',
  'FS': 'full shot showing complete figure from head to toe',
  'MWS': 'medium wide shot showing figure from knees up',
  'MS': 'medium shot showing figure from waist up',
  'MCU': 'medium close-up showing figure from chest up',
  'CU': 'close-up shot focused on face',
  'ECU': 'extreme close-up showing specific detail',
  'OTS': 'over-the-shoulder shot looking past one figure toward another',
  'POV': 'point-of-view shot from character perspective',
  'TWO_SHOT': 'two-shot framing two figures together',
  'INSERT': 'insert shot focusing on specific object or detail',
  'ESTABLISHING': 'establishing shot introducing location',
};

export const CAMERA_ANGLE_DESCRIPTIONS: Record<string, string> = {
  'EYE_LEVEL': 'eye-level camera angle',
  'LOW_ANGLE': 'low-angle shot looking upward',
  'HIGH_ANGLE': 'high-angle shot looking downward',
  'BIRDS_EYE': "bird's-eye view from directly above",
  'DUTCH_ANGLE': 'dutch angle with tilted horizon',
  'WORMS_EYE': "worm's-eye view from ground level looking up",
};

export const TIME_OF_DAY_DESCRIPTIONS: Record<string, string> = {
  'dawn': 'at dawn with soft pink and orange light on the horizon',
  'morning': 'in morning light with warm golden tones',
  'midday': 'under bright midday sun with harsh shadows',
  'afternoon': 'in warm afternoon light',
  'dusk': 'at dusk with purple and orange sky',
  'night': 'at night with darkness and artificial or moonlight',
  'unspecified': '',
};

export const WEATHER_DESCRIPTIONS: Record<string, string> = {
  'clear': 'clear skies',
  'cloudy': 'overcast with diffused light',
  'rain': 'during rainfall with wet surfaces',
  'snow': 'with falling snow and winter atmosphere',
  'fog': 'in fog with limited visibility and muted colors',
  'storm': 'during storm with dramatic clouds and wind',
  'unspecified': '',
};
```

#### Compilation Service

```typescript
// src/services/promptCompiler/index.ts

import { GeminiPromptCompiler } from './geminiAdapter';
import { PromptCompiler, CompiledPrompt } from './PromptCompiler';

export type Provider = 'gemini' | 'openai' | 'stability' | 'midjourney';

const compilers: Record<string, PromptCompiler> = {
  'gemini': new GeminiPromptCompiler(),
};

export function getCompiler(provider: Provider): PromptCompiler {
  const compiler = compilers[provider];
  if (!compiler) {
    throw new Error(`No prompt compiler available for provider: ${provider}`);
  }
  return compiler;
}

export async function compilePromptForShot(
  shotId: string,
  provider: Provider,
  db: any
): Promise<CompiledPrompt> {
  const shot = await db.shots.findById(shotId);
  const scene = await db.scenes.findById(shot.scene_id);
  const act = await db.acts.findById(scene.act_id);
  const project = await db.projects.findById(act.project_id);
  
  const artStyle = await db.artStyles.findByProjectId(project.id);
  
  const shotCharacters = await db.shotCharacters.findByShot(shotId);
  const characters = await Promise.all(
    shotCharacters.map(async (sc: any) => ({
      character: await db.characters.findById(sc.character_id),
      variant: sc.variant_id ? await db.variants.findById(sc.variant_id) : undefined,
    }))
  );
  
  const settingId = shot.setting_id || scene.default_setting_id;
  const setting = settingId ? await db.settings.findById(settingId) : null;
  
  const lightingId = shot.lighting_id || scene.default_lighting_id;
  const lighting = lightingId ? await db.lightingSetups.findById(lightingId) : null;
  
  const shotProps = await db.shotProps.findByShot(shotId);
  const props = await Promise.all(
    shotProps.map((sp: any) => db.props.findById(sp.prop_id))
  );
  
  const context = { shot, scene, artStyle, characters, setting, lighting, props };
  
  const compiler = getCompiler(provider);
  return compiler.compile(context);
}
```

### Storage Service

Handles S3 operations for image upload, download, and thumbnail generation.

```typescript
// src/services/storage/storageService.ts

import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, getS3Key } from './s3Client';
import { storageConfig } from '../../config/storage';
import { v4 as uuid } from 'uuid';
import sharp from 'sharp';
import path from 'path';

interface UploadResult {
  id: string;
  s3Key: string;
  url: string;
}

interface PresignedUpload {
  uploadUrl: string;
  s3Key: string;
  imageId: string;
  expiresAt: Date;
}

export class StorageService {
  
  async createPresignedUpload(
    projectId: string,
    category: 'references',
    filename: string,
    contentType: string
  ): Promise<PresignedUpload> {
    this.validateFileType(filename, contentType);
    
    const imageId = uuid();
    const ext = path.extname(filename).toLowerCase();
    const s3Key = getS3Key(projectId, category, `${imageId}${ext}`);
    
    const command = new PutObjectCommand({
      Bucket: storageConfig.bucket,
      Key: s3Key,
      ContentType: contentType,
      Metadata: {
        'original-filename': filename,
        'project-id': projectId,
      },
    });
    
    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: storageConfig.presignedUrl.uploadExpiry,
    });
    
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + storageConfig.presignedUrl.uploadExpiry);
    
    return { uploadUrl, s3Key, imageId, expiresAt };
  }
  
  async getPresignedDownloadUrl(s3Key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: storageConfig.bucket,
      Key: s3Key,
    });
    
    return getSignedUrl(s3Client, command, {
      expiresIn: storageConfig.presignedUrl.downloadExpiry,
    });
  }
  
  async getPresignedUrls(s3Keys: string[]): Promise<Map<string, string>> {
    const urls = new Map<string, string>();
    
    await Promise.all(
      s3Keys.map(async (key) => {
        const url = await this.getPresignedDownloadUrl(key);
        urls.set(key, url);
      })
    );
    
    return urls;
  }
  
  async uploadGeneratedImage(
    projectId: string,
    imageBuffer: Buffer,
    format: 'png' | 'jpeg' | 'webp' = 'png'
  ): Promise<UploadResult> {
    const imageId = uuid();
    const s3Key = getS3Key(projectId, 'generated', `${imageId}.${format}`);
    const contentType = `image/${format}`;
    
    await s3Client.send(new PutObjectCommand({
      Bucket: storageConfig.bucket,
      Key: s3Key,
      Body: imageBuffer,
      ContentType: contentType,
      Metadata: { 'project-id': projectId },
    }));
    
    await this.createThumbnail(projectId, imageId, imageBuffer);
    
    const url = await this.getPresignedDownloadUrl(s3Key);
    
    return { id: imageId, s3Key, url };
  }
  
  private async createThumbnail(
    projectId: string,
    imageId: string,
    imageBuffer: Buffer
  ): Promise<void> {
    const { width, height, format, quality } = storageConfig.thumbnails;
    
    const thumbnailBuffer = await sharp(imageBuffer)
      .resize(width, height, { fit: 'cover' })
      .toFormat(format, { quality })
      .toBuffer();
    
    const thumbnailKey = getS3Key(projectId, 'thumbnails', `${imageId}_thumb.${format}`);
    
    await s3Client.send(new PutObjectCommand({
      Bucket: storageConfig.bucket,
      Key: thumbnailKey,
      Body: thumbnailBuffer,
      ContentType: `image/${format}`,
    }));
  }
  
  async deleteImage(s3Key: string): Promise<void> {
    await s3Client.send(new DeleteObjectCommand({
      Bucket: storageConfig.bucket,
      Key: s3Key,
    }));
  }
  
  private validateFileType(filename: string, contentType: string): void {
    const ext = path.extname(filename).toLowerCase();
    const { allowedMimeTypes, allowedExtensions } = storageConfig.limits.referenceImage;
    
    if (!allowedMimeTypes.includes(contentType)) {
      throw new AppError(ErrorCodes.UPL_INVALID_FILE_TYPE, 400, `File type ${contentType} not allowed`);
    }
    
    if (!allowedExtensions.includes(ext)) {
      throw new AppError(ErrorCodes.UPL_INVALID_FILE_TYPE, 400, `File extension ${ext} not allowed`);
    }
  }
}
```

### Provider Error Mapping

Maps provider-specific errors (Gemini API responses) to the application error hierarchy.

```typescript
// src/services/imageGeneration/errorMapper.ts

import { AppError, ApiKeyError, GenerationError, ProviderError } from '../../errors';
import { ErrorCodes } from '../../errors/codes';

interface ProviderErrorMapping {
  match: (error: any) => boolean;
  toAppError: (error: any, provider: string) => AppError;
}

const geminiErrorMappings: ProviderErrorMapping[] = [
  {
    match: (e) => e.status === 400 && e.message?.includes('API key'),
    toAppError: (e, provider) => new ApiKeyError(
      ErrorCodes.KEY_INVALID,
      provider,
      'Invalid API key. Please check your Gemini API key in settings.'
    ),
  },
  {
    match: (e) => e.status === 429,
    toAppError: (e, provider) => new ApiKeyError(
      ErrorCodes.KEY_RATE_LIMITED,
      provider,
      'Rate limit exceeded. Please wait a moment and try again.'
    ),
  },
  {
    match: (e) => e.status === 403 && e.message?.includes('quota'),
    toAppError: (e, provider) => new ApiKeyError(
      ErrorCodes.KEY_QUOTA_EXCEEDED,
      provider,
      'API quota exceeded. Please check your billing settings with Google.'
    ),
  },
  {
    match: (e) => e.message?.includes('safety') || e.message?.includes('blocked'),
    toAppError: (e, provider) => new GenerationError(
      ErrorCodes.GEN_CONTENT_FILTERED,
      'Image generation was blocked by content safety filters. Try adjusting your prompt.',
      { reason: e.message }
    ),
  },
  {
    match: (e) => e.code === 'ETIMEDOUT' || e.code === 'ECONNABORTED',
    toAppError: (e, provider) => new GenerationError(
      ErrorCodes.GEN_PROVIDER_TIMEOUT,
      'Image generation timed out. Please try again.',
      { retryable: true }
    ),
  },
];

export function mapProviderError(provider: string, error: any): AppError {
  const mappings = provider === 'gemini' ? geminiErrorMappings : [];
  
  for (const mapping of mappings) {
    if (mapping.match(error)) {
      return mapping.toAppError(error, provider);
    }
  }
  
  // Default: unknown provider error
  return new ProviderError(
    provider,
    error.message || 'Unknown error',
    false
  );
}
```

---

### Sequencing Utilities

```typescript
// src/utils/sequencing.ts

const SEQUENCE_GAP = 1000;
const MIN_GAP = 1;

interface Sequenceable {
  id: string;
  sequence_number: number;
}

export function getNextSequenceNumber(existing: Sequenceable[]): number {
  if (existing.length === 0) return SEQUENCE_GAP;
  const max = Math.max(...existing.map(e => e.sequence_number));
  return max + SEQUENCE_GAP;
}

export function getInsertSequenceNumber(
  before: Sequenceable | null,
  after: Sequenceable | null
): number | null {
  const low = before?.sequence_number ?? 0;
  const high = after?.sequence_number ?? low + SEQUENCE_GAP * 2;
  
  const gap = high - low;
  if (gap <= MIN_GAP) return null; // Trigger renumber
  
  return Math.floor(low + gap / 2);
}

export function renumber(items: Sequenceable[]): Map<string, number> {
  const sorted = [...items].sort((a, b) => a.sequence_number - b.sequence_number);
  const updates = new Map<string, number>();
  
  sorted.forEach((item, index) => {
    const newSeq = (index + 1) * SEQUENCE_GAP;
    if (item.sequence_number !== newSeq) {
      updates.set(item.id, newSeq);
    }
  });
  
  return updates;
}

export function reorder(
  items: Sequenceable[],
  newOrder: string[]
): Map<string, number> {
  const updates = new Map<string, number>();
  
  newOrder.forEach((id, index) => {
    updates.set(id, (index + 1) * SEQUENCE_GAP);
  });
  
  return updates;
}
```

---

## Middleware

### Authentication Middleware

```typescript
// src/middleware/authenticate.ts

import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth/authService';
import { UnauthorizedError } from '../errors';
import { ErrorCodes } from '../errors/codes';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
    }
  }
}

export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError(ErrorCodes.AUTH_TOKEN_MISSING);
  }
  
  const token = authHeader.slice(7);
  req.user = authService.verifyAccessToken(token);
  
  next();
}

export function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      req.user = authService.verifyAccessToken(token);
    } catch {
      // Ignore invalid tokens for optional auth
    }
  }
  
  next();
}
```

### Error Handler Middleware

```typescript
// src/middleware/errorHandler.ts

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { ErrorCodes } from '../errors/codes';
import { logger } from '../utils/logger';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = req.requestId || 'unknown';
  
  // Known application errors
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, requestId, path: req.path }, 'Server error');
    } else {
      logger.warn({ err, requestId, path: req.path }, 'Client error');
    }
    
    res.status(err.statusCode).json(err.toResponse(requestId));
    return;
  }
  
  // Database duplicate entry
  if ((err as any).code === 'ER_DUP_ENTRY') {
    logger.warn({ err, requestId }, 'Duplicate entry');
    res.status(409).json({
      error: {
        code: ErrorCodes.RES_ALREADY_EXISTS,
        message: 'Resource already exists',
        requestId,
      },
    });
    return;
  }
  
  // Unknown errors
  logger.error({ err, requestId, path: req.path, stack: err.stack }, 'Unhandled error');
  
  res.status(500).json({
    error: {
      code: ErrorCodes.SYS_INTERNAL_ERROR,
      message: 'An unexpected error occurred',
      requestId,
    },
  });
}
```

### Rate Limiting Middleware

```typescript
// src/middleware/rateLimiter.ts

import rateLimit from 'express-rate-limit';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,                    // 10 attempts per window
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many attempts. Please try again in 15 minutes.',
    },
  },
  keyGenerator: (req) => `${req.ip}-${req.body.email || 'unknown'}`,
  standardHeaders: true,
  legacyHeaders: false,
});
```

### Validation Middleware

```typescript
// src/middleware/validate.ts

import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ValidationError } from '../errors';

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

### Security Headers Middleware

```typescript
// src/middleware/securityHeaders.ts

import helmet from 'helmet';

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://*.amazonaws.com"],
      connectSrc: ["'self'", "https://*.amazonaws.com"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});
```

### CORS Middleware

```typescript
// src/middleware/cors.ts

import cors from 'cors';
import { config } from '../config';

const allowedOrigins = config.cors.origins;

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
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
});
```

### Request ID Middleware

```typescript
// src/middleware/requestId.ts

import { Request, Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = (req.headers['x-request-id'] as string) || uuid();
  
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  
  next();
}
```

---

### Project Access Middleware

Verifies the authenticated user owns the requested project.

```typescript
// src/middleware/projectAccess.ts

import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { ForbiddenError, NotFoundError } from '../errors';

declare global {
  namespace Express {
    interface Request {
      project?: any;
    }
  }
}

export async function requireProjectAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { projectId } = req.params;
  const userId = req.user!.id;
  
  const project = await db('projects')
    .where({ id: projectId, user_id: userId })
    .whereNull('deleted_at')
    .first();
  
  if (!project) {
    throw new ForbiddenError('project');
  }
  
  req.project = project;
  next();
}
```

---

## Validation Schemas

```typescript
// src/schemas/auth.ts

import Joi from 'joi';

export const authSchemas = {
  register: Joi.object({
    email: Joi.string()
      .email()
      .required()
      .max(255)
      .messages({
        'string.email': 'Please enter a valid email address',
        'any.required': 'Email is required',
      }),
    password: Joi.string()
      .required()
      .min(8)
      .max(128)
      .messages({
        'string.min': 'Password must be at least 8 characters',
        'any.required': 'Password is required',
      }),
  }),
  
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),
};
```

```typescript
// src/schemas/shot.ts

import Joi from 'joi';

export const shotSchemas = {
  create: Joi.object({
    description: Joi.string().max(5000).allow('', null),
    shotType: Joi.string().valid(
      'EWS', 'WS', 'FS', 'MWS', 'MS', 'MCU', 'CU', 'ECU',
      'OTS', 'POV', 'TWO_SHOT', 'INSERT', 'ESTABLISHING'
    ).allow(null),
    cameraAngle: Joi.string().valid(
      'EYE_LEVEL', 'LOW_ANGLE', 'HIGH_ANGLE', 'BIRDS_EYE', 'DUTCH_ANGLE', 'WORMS_EYE'
    ).allow(null),
    cameraMovement: Joi.string().valid(
      'STATIC', 'PAN', 'TILT', 'DOLLY', 'CRANE', 'HANDHELD', 'ZOOM'
    ).allow(null),
    settingId: Joi.string().uuid().allow(null),
    lightingId: Joi.string().uuid().allow(null),
    characters: Joi.array().items(
      Joi.object({
        characterId: Joi.string().uuid().required(),
        variantId: Joi.string().uuid().allow(null),
      })
    ),
    props: Joi.array().items(Joi.string().uuid()),
    caption: Joi.string().max(2000).allow('', null),
  }),
  
  update: Joi.object({
    description: Joi.string().max(5000).allow('', null),
    shotType: Joi.string().valid(
      'EWS', 'WS', 'FS', 'MWS', 'MS', 'MCU', 'CU', 'ECU',
      'OTS', 'POV', 'TWO_SHOT', 'INSERT', 'ESTABLISHING'
    ).allow(null),
    cameraAngle: Joi.string().valid(
      'EYE_LEVEL', 'LOW_ANGLE', 'HIGH_ANGLE', 'BIRDS_EYE', 'DUTCH_ANGLE', 'WORMS_EYE'
    ).allow(null),
    cameraMovement: Joi.string().valid(
      'STATIC', 'PAN', 'TILT', 'DOLLY', 'CRANE', 'HANDHELD', 'ZOOM'
    ).allow(null),
    settingId: Joi.string().uuid().allow(null),
    lightingId: Joi.string().uuid().allow(null),
    characters: Joi.array().items(
      Joi.object({
        characterId: Joi.string().uuid().required(),
        variantId: Joi.string().uuid().allow(null),
      })
    ),
    props: Joi.array().items(Joi.string().uuid()),
    annotations: Joi.object().allow(null),
    caption: Joi.string().max(2000).allow('', null),
  }),
  
  reorder: Joi.object({
    orderedIds: Joi.array().items(Joi.string().uuid()).required(),
  }),
};
```

---

## Route Handlers

### Auth Routes

```typescript
// src/routes/auth.ts

import { Router } from 'express';
import { authService } from '../services/auth/authService';
import { authConfig } from '../config/auth';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { authSchemas } from '../schemas/auth';
import { authRateLimiter } from '../middleware/rateLimiter';
import { UnauthorizedError } from '../errors';
import { ErrorCodes } from '../errors/codes';

const router = Router();

// POST /api/auth/register
router.post('/register', authRateLimiter, validate(authSchemas.register), async (req, res) => {
  const { email, password } = req.body;
  
  const result = await authService.register(email, password);
  
  res.cookie(
    authConfig.refreshToken.cookie.name,
    result.refreshToken,
    authConfig.refreshToken.cookie
  );
  
  res.status(201).json({
    user: result.user,
    accessToken: result.accessToken,
  });
});

// POST /api/auth/login
router.post('/login', authRateLimiter, validate(authSchemas.login), async (req, res) => {
  const { email, password } = req.body;
  
  const result = await authService.login(email, password, {
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
  });
  
  res.cookie(
    authConfig.refreshToken.cookie.name,
    result.refreshToken,
    authConfig.refreshToken.cookie
  );
  
  res.json({
    user: result.user,
    accessToken: result.accessToken,
  });
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  const refreshToken = req.cookies[authConfig.refreshToken.cookie.name];
  
  if (!refreshToken) {
    throw new UnauthorizedError(ErrorCodes.AUTH_TOKEN_MISSING);
  }
  
  const tokens = await authService.refresh(refreshToken, {
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
  });
  
  res.cookie(
    authConfig.refreshToken.cookie.name,
    tokens.refreshToken,
    authConfig.refreshToken.cookie
  );
  
  res.json({ accessToken: tokens.accessToken });
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  const refreshToken = req.cookies[authConfig.refreshToken.cookie.name];
  
  if (refreshToken) {
    await authService.logout(refreshToken);
  }
  
  res.clearCookie(authConfig.refreshToken.cookie.name, {
    path: authConfig.refreshToken.cookie.path,
  });
  
  res.status(204).send();
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  const user = await db('users').where({ id: req.user!.id }).whereNull('deleted_at').first();
  
  res.json({
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.created_at,
    },
  });
});

export default router;
```

### Reference Image Routes

```typescript
// src/routes/referenceImages.ts

import { Router } from 'express';
import { storageService } from '../services/storage/storageService';
import { db } from '../db';
import { authenticate } from '../middleware/authenticate';
import { requireProjectAccess } from '../middleware/projectAccess';
import { NotFoundError } from '../errors';

const router = Router();

// POST /api/projects/:projectId/reference-images/presign
router.post(
  '/:projectId/reference-images/presign',
  authenticate,
  requireProjectAccess,
  async (req, res) => {
    const { projectId } = req.params;
    const { filename, contentType, componentType, componentId } = req.body;
    
    const presigned = await storageService.createPresignedUpload(
      projectId,
      'references',
      filename,
      contentType
    );
    
    res.json({
      uploadUrl: presigned.uploadUrl,
      imageId: presigned.imageId,
      s3Key: presigned.s3Key,
      expiresAt: presigned.expiresAt,
    });
  }
);

// POST /api/projects/:projectId/reference-images/confirm
router.post(
  '/:projectId/reference-images/confirm',
  authenticate,
  requireProjectAccess,
  async (req, res) => {
    const { imageId, s3Key, componentType, componentId, filename } = req.body;
    
    await storageService.validateUploadedFile(s3Key);
    
    const referenceImage = await db('reference_images').insert({
      id: imageId,
      component_type: componentType,
      component_id: componentId,
      s3_key: s3Key,
      filename,
      mime_type: req.body.contentType,
    });
    
    const url = await storageService.getPresignedDownloadUrl(s3Key);
    
    res.status(201).json({ id: imageId, url, filename });
  }
);

// GET /api/projects/:projectId/reference-images
router.get(
  '/:projectId/reference-images',
  authenticate,
  requireProjectAccess,
  async (req, res) => {
    const { componentType, componentId } = req.query;
    
    const images = await db('reference_images')
      .where({ component_type: componentType, component_id: componentId })
      .whereNull('deleted_at');
    
    const s3Keys = images.map((img: any) => img.s3_key);
    const urls = await storageService.getPresignedUrls(s3Keys);
    
    const result = images.map((img: any) => ({
      id: img.id,
      filename: img.filename,
      url: urls.get(img.s3_key),
      uploadedAt: img.uploaded_at,
    }));
    
    res.json({ images: result });
  }
);

// DELETE /api/projects/:projectId/reference-images/:imageId
router.delete(
  '/:projectId/reference-images/:imageId',
  authenticate,
  requireProjectAccess,
  async (req, res) => {
    const { imageId } = req.params;
    
    const image = await db('reference_images').where({ id: imageId }).whereNull('deleted_at').first();
    if (!image) {
      throw new NotFoundError('Reference image', imageId);
    }
    
    await storageService.deleteImage(image.s3_key);
    await db('reference_images').where({ id: imageId }).update({ deleted_at: db.fn.now() });
    
    res.status(204).send();
  }
);

export default router;
```

### Frontend Error Handling Guidance

The frontend should handle errors based on code category prefixes:

```typescript
// Frontend error handling pattern

function handleApiError(error: ApiError) {
  const { code } = error.error;
  
  if (code.startsWith('AUTH_')) {
    clearAuthState();
    redirectToLogin();
    return;
  }
  
  if (code.startsWith('KEY_')) {
    showApiKeySettingsModal(error.error.details?.provider);
    toast.error(error.error.message);
    return;
  }
  
  if (code.startsWith('GEN_')) {
    if (error.error.details?.retryable) {
      showRetryableError(error.error.message);
    } else {
      showGenerationError(error.error.message);
    }
    return;
  }
  
  if (code.startsWith('VAL_')) {
    highlightFieldErrors(error.error.details?.fields);
    return;
  }
  
  toast.error(`Something went wrong. Reference: ${error.error.requestId}`);
}
```

---

## Database Access

### Knex Configuration

```typescript
// src/db/index.ts

import knex, { Knex } from 'knex';
import { config } from '../config';

export const db = knex({
  client: 'mysql2',
  connection: config.database.url,
  pool: {
    min: 2,
    max: 10,
  },
  migrations: {
    tableName: 'knex_migrations',
    directory: './migrations',
  },
});

export async function initializeDatabase(): Promise<void> {
  await db.raw('SELECT 1');
  console.log('Database connected');
}

export async function runMigrations(): Promise<void> {
  await db.migrate.latest();
  console.log('Migrations complete');
}
```

### Repository Pattern

```typescript
// src/db/repositories/projectRepository.ts

import { db } from '../index';
import { Project } from '../../types/models';
import { notDeleted, softDelete } from '../../utils/softDelete';

export const projectRepository = {
  
  async findById(id: string): Promise<Project | null> {
    return db('projects')
      .where({ id })
      .whereNull('deleted_at')
      .first();
  },
  
  async findByUserId(userId: string): Promise<Project[]> {
    return db('projects')
      .where({ user_id: userId })
      .whereNull('deleted_at')
      .orderBy('updated_at', 'desc');
  },
  
  async findByShareToken(shareToken: string): Promise<Project | null> {
    return db('projects')
      .where({ share_token: shareToken, is_public: true })
      .whereNull('deleted_at')
      .first();
  },
  
  async create(project: Partial<Project>): Promise<Project> {
    await db('projects').insert(project);
    return this.findById(project.id!);
  },
  
  async update(id: string, updates: Partial<Project>): Promise<Project> {
    await db('projects')
      .where({ id })
      .update({ ...updates, updated_at: db.fn.now() });
    return this.findById(id);
  },
  
  async softDelete(id: string): Promise<void> {
    await softDelete(db, 'projects', id);
  },
  
  async restore(id: string): Promise<Project> {
    await db('projects')
      .where({ id })
      .update({ deleted_at: null });
    return this.findById(id);
  },
};
```

### Soft Delete Utilities

```typescript
// src/utils/softDelete.ts

import { Knex } from 'knex';

export function notDeleted<T>(query: Knex.QueryBuilder<T>): Knex.QueryBuilder<T> {
  return query.whereNull('deleted_at');
}

export async function softDelete(
  db: Knex,
  table: string,
  id: string
): Promise<void> {
  await db(table)
    .where({ id })
    .update({ deleted_at: db.fn.now() });
}

export async function restore(
  db: Knex,
  table: string,
  id: string
): Promise<void> {
  await db(table)
    .where({ id })
    .update({ deleted_at: null });
}

export async function purgeDeleted(
  db: Knex,
  table: string,
  retentionDays: number = 30
): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  
  return db(table)
    .whereNotNull('deleted_at')
    .where('deleted_at', '<', cutoff)
    .delete();
}
```

---

## Express App Setup

```typescript
// src/app.ts

import express from 'express';
import cookieParser from 'cookie-parser';
import { corsMiddleware } from './middleware/cors';
import { securityHeaders } from './middleware/securityHeaders';
import { requestIdMiddleware } from './middleware/requestId';
import { errorHandler } from './middleware/errorHandler';
import routes from './routes';

const app = express();

// Middleware
app.use(securityHeaders);
app.use(corsMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(requestIdMiddleware);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// API routes
app.use('/api', routes);

// Error handler (must be last)
app.use(errorHandler);

export { app };
```

---

## Server Entry Point

```typescript
// src/server.ts

import { app } from './app';
import { config } from './config';
import { initializeDatabase } from './db';
import { logger } from './utils/logger';

async function start(): Promise<void> {
  try {
    await initializeDatabase();
    
    app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

start();
```

---

## Logger Setup

```typescript
// src/utils/logger.ts

import pino from 'pino';
import { config } from '../config';

export const logger = pino({
  level: config.env === 'production' ? 'info' : 'debug',
  transport: config.env === 'development'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
        },
      }
    : undefined,
});
```
