# Testing

This document describes the testing strategy, configuration, and patterns for Atelier.

## Testing Stack

| Tool | Purpose |
|------|---------|
| Vitest | Unit and integration tests (backend and frontend) |
| Supertest | HTTP API testing |
| Testcontainers | Real MySQL for integration tests |
| Playwright | End-to-end browser testing |
| MSW (Mock Service Worker) | Frontend API mocking |
| Faker | Test data generation |

**Why Vitest over Jest?**

- Native TypeScript and ESM support
- Faster execution (uses Vite's transform pipeline)
- Compatible Jest API (easy migration)
- Same tool for frontend and backend

---

## Test Structure

```
backend/
├── tests/
│   ├── unit/
│   │   ├── services/
│   │   │   ├── auth.test.ts
│   │   │   ├── encryption.test.ts
│   │   │   └── promptCompiler.test.ts
│   │   ├── middleware/
│   │   │   ├── authenticate.test.ts
│   │   │   └── validate.test.ts
│   │   └── utils/
│   │       ├── sequencing.test.ts
│   │       └── softDelete.test.ts
│   │
│   ├── integration/
│   │   ├── setup.ts              # Database setup with Testcontainers
│   │   ├── auth.test.ts          # Auth flow tests
│   │   ├── projects.test.ts      # Project CRUD tests
│   │   ├── shots.test.ts         # Shot operations
│   │   └── generation.test.ts    # Image generation (mocked provider)
│   │
│   └── fixtures/
│       ├── index.ts              # Fixture exports
│       ├── users.ts
│       ├── projects.ts
│       ├── components.ts
│       └── shots.ts

frontend/
├── tests/
│   ├── unit/
│   │   ├── hooks/
│   │   │   ├── useAuth.test.ts
│   │   │   └── useAutoSave.test.ts
│   │   ├── components/
│   │   │   ├── Button.test.tsx
│   │   │   └── ShotEditor.test.tsx
│   │   └── utils/
│   │       └── formatters.test.ts
│   │
│   ├── e2e/
│   │   ├── auth.spec.ts
│   │   ├── projects.spec.ts
│   │   ├── storyboard.spec.ts
│   │   └── generation.spec.ts
│   │
│   └── mocks/
│       ├── handlers.ts           # MSW request handlers
│       └── server.ts             # MSW server setup
```

---

## Configuration

### Backend Vitest Config (Unit)

```typescript
// backend/vitest.config.ts

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/types/**',
        'src/server.ts',
      ],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
    setupFiles: ['tests/unit/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### Backend Vitest Config (Integration)

```typescript
// backend/vitest.integration.config.ts

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    setupFiles: ['tests/integration/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,  // Run serially to avoid DB conflicts
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### Backend Test Setup

```typescript
// backend/tests/unit/setup.ts

import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-minimum-32-characters';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-minimum-32-characters';
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

beforeEach(() => {
  vi.clearAllMocks();
});
```

### Frontend Vitest Config

```typescript
// frontend/vitest.config.ts

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    exclude: ['tests/e2e/**'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      exclude: [
        'node_modules',
        'tests',
        'dist',
        '**/*.d.ts',
        'src/types/**',
        'src/main.tsx',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### Frontend Test Setup

```typescript
// frontend/tests/setup.ts

import { beforeAll, afterAll, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { server } from './mocks/server';

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
```

### Playwright Config

```typescript
// frontend/playwright.config.ts

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

---

## Unit Tests

### Prompt Compiler Tests

```typescript
// backend/tests/unit/services/promptCompiler.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { GeminiPromptCompiler } from '@/services/promptCompiler/geminiAdapter';
import { ShotContext } from '@/services/promptCompiler/PromptCompiler';

describe('GeminiPromptCompiler', () => {
  let compiler: GeminiPromptCompiler;
  
  const baseContext: ShotContext = {
    shot: {
      description: 'Hero enters the room',
      shot_type: 'MS',
      camera_angle: 'EYE_LEVEL',
      camera_movement: 'STATIC',
    },
    scene: { title: 'Test Scene' },
    artStyle: {
      id: 'style-1',
      ai_description: 'Cinematic style with dramatic lighting',
    },
    characters: [],
    setting: null,
    lighting: null,
    props: [],
  };
  
  beforeEach(() => {
    compiler = new GeminiPromptCompiler();
  });
  
  it('should include all components in compiled prompt', () => {
    const context: ShotContext = {
      ...baseContext,
      characters: [
        {
          character: { id: 'char-1', name: 'Hero', ai_description: 'A tall warrior in silver armor' },
        },
      ],
      setting: { id: 'set-1', ai_description: 'A medieval castle hall' },
    };
    
    const result = compiler.compile(context);
    
    expect(result.prompt).toContain('tall warrior in silver armor');
    expect(result.prompt).toContain('medieval castle hall');
    expect(result.prompt).toContain('Cinematic style');
    expect(result.prompt).toContain('Hero enters the room');
    expect(result.error).toBeNull();
  });
  
  it('should return error when prompt exceeds max length', () => {
    const context: ShotContext = {
      ...baseContext,
      shot: { ...baseContext.shot, description: 'A'.repeat(2000) },
    };
    
    const result = compiler.compile(context);
    
    expect(result.error).not.toBeNull();
    expect(result.error?.code).toBe('PROMPT_TOO_LONG');
  });
  
  it('should include warnings for missing descriptions', () => {
    const context: ShotContext = {
      ...baseContext,
      artStyle: { id: 'style-1', ai_description: null, description: null },
      characters: [
        {
          character: { id: 'char-1', name: 'Unknown', physical_description: null, ai_description: null },
        },
      ],
    };
    
    const result = compiler.compile(context);
    
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some(w => w.includes('Art style'))).toBe(true);
    expect(result.warnings.some(w => w.includes('Unknown'))).toBe(true);
  });
  
  it('should track section sources', () => {
    const context: ShotContext = {
      ...baseContext,
      characters: [
        {
          character: { id: 'char-1', name: 'Sarah', ai_description: 'A professional woman' },
        },
      ],
    };
    
    const result = compiler.compile(context);
    
    expect(result.sections.find(s => s.name === 'framing')?.source).toBe('system:shot_type');
    expect(result.sections.find(s => s.name === 'characters')?.source).toContain('character:char-1');
    expect(result.sections.find(s => s.name === 'style')?.source).toBe('art_style:style-1');
  });
});
```

### Encryption Service Tests

```typescript
// backend/tests/unit/services/encryption.test.ts

import { describe, it, expect } from 'vitest';
import { encryptApiKey, decryptApiKey, generateKeyHint } from '@/services/encryption/encryptionService';

describe('EncryptionService', () => {
  const testApiKey = 'AIzaSyB1234567890abcdefghijklmnop';
  
  it('should encrypt and decrypt API key', () => {
    const encrypted = encryptApiKey(testApiKey);
    const decrypted = decryptApiKey(encrypted);
    
    expect(decrypted).toBe(testApiKey);
  });
  
  it('should produce different ciphertext for same plaintext', () => {
    const encrypted1 = encryptApiKey(testApiKey);
    const encrypted2 = encryptApiKey(testApiKey);
    
    expect(encrypted1).not.toBe(encrypted2);
  });
  
  it('should detect tampered ciphertext', () => {
    const encrypted = encryptApiKey(testApiKey);
    const tampered = encrypted.slice(0, -2) + 'XX';
    
    expect(() => decryptApiKey(tampered)).toThrow();
  });
  
  it('should generate key hint showing last 4 characters', () => {
    const hint = generateKeyHint(testApiKey);
    
    expect(hint).toBe('•••••mnop');
    expect(hint).not.toContain('AIza');
  });
});
```

### Middleware Tests

```typescript
// backend/tests/unit/middleware/validate.test.ts

import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { validate } from '@/middleware/validate';

describe('validate middleware', () => {
  const mockResponse = () => {
    const res = {} as Response;
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
  };
  
  const schema = Joi.object({
    name: Joi.string().required().max(100),
    email: Joi.string().email().required(),
  });
  
  it('should pass valid input through', () => {
    const req = { body: { name: 'Test', email: 'test@example.com' } } as Request;
    const res = mockResponse();
    const next = vi.fn();
    
    validate(schema)(req, res, next);
    
    expect(next).toHaveBeenCalled();
    expect(req.body.name).toBe('Test');
  });
  
  it('should reject invalid input with field details', () => {
    const req = { body: { name: '' } } as Request;
    const res = mockResponse();
    const next = vi.fn();
    
    expect(() => validate(schema)(req, res, next)).toThrow();
    expect(next).not.toHaveBeenCalled();
  });
  
  it('should strip unknown fields', () => {
    const req = { body: { name: 'Test', email: 'test@example.com', extra: 'field' } } as Request;
    const res = mockResponse();
    const next = vi.fn();
    
    validate(schema)(req, res, next);
    
    expect(req.body.extra).toBeUndefined();
  });
});
```

---

## Integration Tests

### Database Setup with Testcontainers

```typescript
// backend/tests/integration/setup.ts

import { beforeAll, afterAll, beforeEach } from 'vitest';
import { MySqlContainer, StartedMySqlContainer } from '@testcontainers/mysql';
import knex, { Knex } from 'knex';

let container: StartedMySqlContainer;
export let db: Knex;

beforeAll(async () => {
  // Start MySQL container
  container = await new MySqlContainer('mysql:8.0')
    .withDatabase('atelier_test')
    .withUsername('test')
    .withRootPassword('test')
    .start();
  
  // Connect
  db = knex({
    client: 'mysql2',
    connection: {
      host: container.getHost(),
      port: container.getPort(),
      user: 'test',
      password: 'test',
      database: 'atelier_test',
    },
  });
  
  // Run migrations
  await db.migrate.latest();
}, 60000); // 60s timeout for container startup

afterAll(async () => {
  await db.destroy();
  await container.stop();
});

export async function truncateTables(db: Knex) {
  await db.raw('SET FOREIGN_KEY_CHECKS = 0');
  
  const tables = [
    'concept_art_messages', 'concept_art_sessions',
    'shot_props', 'shot_characters',
    'reference_images', 'generated_images',
    'shots', 'scenes', 'acts',
    'props', 'lighting_setups', 'settings', 'variants', 'characters',
    'art_styles', 'projects',
    'refresh_tokens', 'user_api_keys', 'users',
  ];
  
  for (const table of tables) {
    await db(table).truncate();
  }
  
  await db.raw('SET FOREIGN_KEY_CHECKS = 1');
}
```

### Auth Integration Tests

```typescript
// backend/tests/integration/auth.test.ts

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '@/app';
import { setupTestDatabase, teardownTestDatabase, truncateTables, db } from './setup';

describe('Auth API Integration', () => {
  beforeEach(async () => {
    await truncateTables(db);
  });
  
  describe('POST /api/auth/register', () => {
    it('should create user and return tokens', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'newuser@example.com', password: 'SecurePass123' });
      
      expect(response.status).toBe(201);
      expect(response.body.user.email).toBe('newuser@example.com');
      expect(response.body.accessToken).toBeDefined();
      expect(response.headers['set-cookie']).toBeDefined();
      
      // Verify user in database
      const user = await db('users').where({ email: 'newuser@example.com' }).first();
      expect(user).toBeDefined();
      expect(user.password_hash).not.toBe('SecurePass123');
    });
    
    it('should reject duplicate email', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ email: 'duplicate@example.com', password: 'SecurePass123' });
      
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'duplicate@example.com', password: 'DifferentPass123' });
      
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('AUTH_EMAIL_IN_USE');
    });
    
    it('should reject weak password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'user@example.com', password: 'weak' });
      
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VAL_REQUIRED_FIELD');
    });
  });
  
  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'Password123' });
    });
    
    it('should return tokens for valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'Password123' });
      
      expect(response.status).toBe(200);
      expect(response.body.accessToken).toBeDefined();
    });
    
    it('should reject invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'WrongPassword' });
      
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
    });
  });
  
  describe('POST /api/auth/refresh', () => {
    let refreshTokenCookie: string;
    
    beforeEach(async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'Password123' });
      
      refreshTokenCookie = response.headers['set-cookie'][0];
    });
    
    it('should return new tokens with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', refreshTokenCookie);
      
      expect(response.status).toBe(200);
      expect(response.body.accessToken).toBeDefined();
    });
    
    it('should reject reused refresh token (replay detection)', async () => {
      // First refresh — should succeed
      await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', refreshTokenCookie);
      
      // Second refresh with same token — should fail
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', refreshTokenCookie);
      
      expect(response.status).toBe(401);
    });
  });
  
  describe('GET /api/auth/me', () => {
    let accessToken: string;
    
    beforeEach(async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'Password123' });
      
      accessToken = response.body.accessToken;
    });
    
    it('should return current user', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe('test@example.com');
    });
    
    it('should reject missing token', async () => {
      const response = await request(app).get('/api/auth/me');
      
      expect(response.status).toBe(401);
    });
  });
});
```

### Shot Integration Tests

```typescript
// backend/tests/integration/shots.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '@/app';
import { truncateTables, db } from './setup';
import { createTestUser, createTestProject, createTestAct, createTestScene } from '../fixtures';

describe('Shots API Integration', () => {
  let accessToken: string;
  let projectId: string;
  let sceneId: string;
  
  beforeEach(async () => {
    await truncateTables(db);
    
    const user = await createTestUser(db);
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'Password123' });
    accessToken = loginResponse.body.accessToken;
    
    const project = await createTestProject(db, user.userId);
    projectId = project.id;
    
    const act = await createTestAct(db, projectId);
    const scene = await createTestScene(db, act.id);
    sceneId = scene.id;
  });
  
  describe('POST /api/projects/:projectId/scenes/:sceneId/shots', () => {
    it('should create shot with auto-assigned sequence number', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/scenes/${sceneId}/shots`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          description: 'Hero enters the room',
          shotType: 'MS',
          cameraAngle: 'EYE_LEVEL',
        });
      
      expect(response.status).toBe(201);
      expect(response.body.sequenceNumber).toBe(1000);
      expect(response.body.description).toBe('Hero enters the room');
    });
    
    it('should assign incrementing sequence numbers', async () => {
      // Create two shots
      await request(app)
        .post(`/api/projects/${projectId}/scenes/${sceneId}/shots`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ description: 'Shot 1' });
      
      const response = await request(app)
        .post(`/api/projects/${projectId}/scenes/${sceneId}/shots`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ description: 'Shot 2' });
      
      expect(response.body.sequenceNumber).toBe(2000);
    });
    
    it('should reject access to other users projects', async () => {
      const otherUser = await createTestUser(db, { email: 'other@example.com' });
      const otherProject = await createTestProject(db, otherUser.userId);
      const otherAct = await createTestAct(db, otherProject.id);
      const otherScene = await createTestScene(db, otherAct.id);
      
      const response = await request(app)
        .post(`/api/projects/${otherProject.id}/scenes/${otherScene.id}/shots`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ description: 'Should fail' });
      
      expect(response.status).toBe(403);
    });
  });
});
```

---

## Frontend Testing

### MSW Handlers

```typescript
// frontend/tests/mocks/handlers.ts

import { http, HttpResponse } from 'msw';

const API_URL = 'http://localhost:3000/api';

export const handlers = [
  http.post(`${API_URL}/auth/login`, async ({ request }) => {
    const body = await request.json() as { email: string; password: string };
    
    if (body.email === 'test@example.com' && body.password === 'Password123') {
      return HttpResponse.json({
        user: { id: 'user-1', email: 'test@example.com' },
        accessToken: 'mock-access-token',
      });
    }
    
    return HttpResponse.json(
      { error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'Invalid credentials' } },
      { status: 401 }
    );
  }),
  
  http.post(`${API_URL}/auth/register`, async ({ request }) => {
    const body = await request.json() as { email: string; password: string };
    
    return HttpResponse.json({
      user: { id: 'user-new', email: body.email },
      accessToken: 'mock-access-token',
    }, { status: 201 });
  }),
  
  http.get(`${API_URL}/auth/me`, () => {
    return HttpResponse.json({
      user: { id: 'user-1', email: 'test@example.com' },
    });
  }),
  
  http.get(`${API_URL}/projects`, () => {
    return HttpResponse.json({
      data: [
        { id: 'proj-1', title: 'Test Project', actCount: 2, shotCount: 10 },
      ],
    });
  }),
];
```

### MSW Server Setup

```typescript
// frontend/tests/mocks/server.ts

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

---

## E2E Tests (Playwright)

### Auth Flow

```typescript
// frontend/tests/e2e/auth.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should register a new user', async ({ page }) => {
    await page.goto('/register');
    
    await page.fill('input[name="email"]', 'newuser@example.com');
    await page.fill('input[name="password"]', 'SecurePass123');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('.toast-success')).toContainText('Account created');
  });
  
  test('should login and redirect to dashboard', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'Password123');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL('/dashboard');
  });
  
  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'WrongPassword');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('.toast-error')).toBeVisible();
    await expect(page).toHaveURL('/login');
  });
  
  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard');
    
    await expect(page).toHaveURL('/login');
  });
});
```

### Storyboard Flow

```typescript
// frontend/tests/e2e/storyboard.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Storyboard Workflow', () => {
  test.beforeEach(async ({ page, context }) => {
    // Mock auth
    await context.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        json: { user: { id: 'user-1', email: 'test@example.com' } },
      });
    });
  });
  
  test('should generate image and display result', async ({ page, context }) => {
    await context.route('**/api/projects/*/shots/*/generate', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          id: 'generated-image-1',
          url: 'https://example.com/test-image.png',
          thumbnailUrl: 'https://example.com/test-thumb.png',
        },
      });
    });
    
    await page.goto('/projects/test-project/shots/shot-1');
    
    await page.fill('textarea[name="description"]', 'Hero in battle');
    await page.click('button:has-text("Generate")');
    
    await expect(page.locator('.generation-status')).toContainText('Generating');
    await expect(page.locator('.shot-image img')).toBeVisible();
    await expect(page.locator('button:has-text("Revert")')).toBeEnabled();
  });
  
  test('should allow reverting to previous image', async ({ page, context }) => {
    await context.route('**/api/projects/*/shots/*/revert', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          id: 'previous-image-1',
          url: 'https://example.com/previous-image.png',
        },
      });
    });
    
    await page.goto('/projects/test-project/shots/shot-with-history');
    
    await page.click('button:has-text("Revert")');
    
    await expect(page.locator('.toast-info')).toContainText('Reverted');
  });
});
```

---

## Test Fixtures

```typescript
// backend/tests/fixtures/index.ts

import { Knex } from 'knex';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export async function createTestUser(db: Knex, overrides: any = {}) {
  const userId = uuid();
  const email = overrides.email || `test-${userId.slice(0, 8)}@example.com`;
  const passwordHash = await bcrypt.hash('Password123', 10);
  
  await db('users').insert({
    id: userId,
    email,
    password_hash: passwordHash,
  });
  
  const token = jwt.sign(
    { sub: userId, email, type: 'access' },
    process.env.JWT_ACCESS_SECRET!,
    { expiresIn: '1h' }
  );
  
  return { userId, email, token };
}

export async function createTestProject(db: Knex, userId: string, overrides: any = {}) {
  const projectId = uuid();
  
  await db('projects').insert({
    id: projectId,
    user_id: userId,
    title: 'Test Project',
    ...overrides,
  });
  
  // Create default art style
  await db('art_styles').insert({
    id: uuid(),
    project_id: projectId,
    name: 'Default Style',
    ai_description: 'Cinematic, realistic style',
  });
  
  return { id: projectId };
}

export async function createTestAct(db: Knex, projectId: string, overrides: any = {}) {
  const actId = uuid();
  
  await db('acts').insert({
    id: actId,
    project_id: projectId,
    title: 'Act 1',
    sequence_number: 1000,
    ...overrides,
  });
  
  return { id: actId };
}

export async function createTestScene(db: Knex, actId: string, overrides: any = {}) {
  const sceneId = uuid();
  
  await db('scenes').insert({
    id: sceneId,
    act_id: actId,
    title: 'Scene 1',
    sequence_number: 1000,
    ...overrides,
  });
  
  return { id: sceneId };
}

export function createMockShotContext(overrides: any = {}) {
  return {
    shot: {
      description: '',
      shot_type: null,
      camera_angle: null,
      camera_movement: null,
      ...overrides.shot,
    },
    scene: { title: 'Test Scene' },
    artStyle: {
      id: 'style-1',
      ai_description: 'Cinematic style',
      ...overrides.artStyle,
    },
    characters: overrides.characters || [],
    setting: overrides.setting || null,
    lighting: overrides.lighting || null,
    props: overrides.props || [],
  };
}
```

---

## NPM Scripts

```json
// backend/package.json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "test:all": "npm run test && npm run test:integration"
  }
}
```

```json
// frontend/package.json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "test:all": "npm run test && npm run test:e2e"
  }
}
```

---

## CI Integration

```yaml
# .github/workflows/test.yml

name: Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  backend-unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json
      
      - name: Install dependencies
        working-directory: ./backend
        run: npm ci
      
      - name: Run unit tests
        working-directory: ./backend
        run: npm run test:coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage/lcov.info
          flags: backend-unit

  backend-integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json
      
      - name: Install dependencies
        working-directory: ./backend
        run: npm ci
      
      - name: Run integration tests
        working-directory: ./backend
        run: npm run test:integration
        env:
          JWT_ACCESS_SECRET: test-secret
          JWT_REFRESH_SECRET: test-refresh-secret
          ENCRYPTION_KEY: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

  frontend-unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      
      - name: Install dependencies
        working-directory: ./frontend
        run: npm ci
      
      - name: Run unit tests
        working-directory: ./frontend
        run: npm run test:coverage

  e2e:
    runs-on: ubuntu-latest
    needs: [backend-unit, frontend-unit]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install backend dependencies
        working-directory: ./backend
        run: npm ci
      
      - name: Install frontend dependencies
        working-directory: ./frontend
        run: npm ci
      
      - name: Install Playwright
        working-directory: ./frontend
        run: npx playwright install --with-deps
      
      - name: Start services
        run: docker-compose up -d
      
      - name: Wait for services
        run: sleep 10
      
      - name: Run E2E tests
        working-directory: ./frontend
        run: npm run test:e2e
        env:
          E2E_BASE_URL: http://localhost:5173
      
      - name: Upload test artifacts
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: frontend/playwright-report/
```

---

## MVP Test Coverage Priorities

| Priority | Area | Reason |
|----------|------|--------|
| **High** | Auth (login, register, refresh) | Security critical |
| **High** | API key encryption | Protects user secrets |
| **High** | Prompt compilation | Core functionality |
| **High** | Shot CRUD + ordering | Primary user workflow |
| **Medium** | Component CRUD | Secondary workflow |
| **Medium** | Image upload/generation | External dependencies |
| **Medium** | Authorization (project access) | Security |
| **Low** | Annotation serialization | UI-heavy, less logic |
| **Low** | Export/sharing | Read-only, lower risk |

**MVP Coverage Targets:**
- 80%+ coverage on high-priority areas
- 60%+ coverage overall
- E2E tests covering the happy path for main workflows
