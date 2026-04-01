# API

This document is the complete REST API reference for Atelier.

## Overview

### Base URL

```
Production: https://atelier.app/api
Development: http://localhost:3000/api
```

### Authentication

Most endpoints require authentication via JWT Bearer token:

```
Authorization: Bearer <access_token>
```

Public endpoints (no auth required):
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/shared/:shareToken`

### Request/Response Format

All requests and responses use JSON. Set `Content-Type: application/json` for requests with bodies.

**Successful Response:**

```json
{
  "data": { ... }
}
```

Or for single resources:

```json
{
  "id": "...",
  "title": "..."
}
```

### Error Response Format

All API errors follow a consistent structure:

```json
{
  "error": {
    "code": "AUTH_TOKEN_EXPIRED",
    "message": "Access token has expired",
    "details": {},
    "requestId": "req-550e8400"
  }
}
```

HTTP status codes:
- `400` — Bad request (validation errors, malformed input)
- `401` — Unauthorized (missing/invalid auth token)
- `403` — Forbidden (valid auth but insufficient permissions)
- `404` — Not found
- `409` — Conflict (duplicate resource, state conflict)
- `422` — Unprocessable entity (valid syntax but semantic error)
- `429` — Rate limited
- `500` — Internal server error
- `502` — Bad gateway (upstream API failure)
- `503` — Service unavailable

---

## Error Codes Reference

### Authentication Errors (AUTH_xxx)

| Code | HTTP Status | Description |
|------|-------------|-------------|
| AUTH_TOKEN_MISSING | 401 | No authorization header or refresh cookie |
| AUTH_TOKEN_INVALID | 401 | Token is malformed or signature invalid |
| AUTH_TOKEN_EXPIRED | 401 | Token has expired |
| AUTH_INVALID_CREDENTIALS | 401 | Email or password incorrect |
| AUTH_EMAIL_IN_USE | 409 | Email already registered |

### Authorization Errors (AUTHZ_xxx)

| Code | HTTP Status | Description |
|------|-------------|-------------|
| AUTHZ_PROJECT_ACCESS_DENIED | 403 | User does not own this project |
| AUTHZ_RESOURCE_ACCESS_DENIED | 403 | User cannot access this resource |

### Validation Errors (VAL_xxx)

| Code | HTTP Status | Description |
|------|-------------|-------------|
| VAL_REQUIRED_FIELD | 400 | Required field missing |
| VAL_INVALID_FORMAT | 400 | Field format invalid |
| VAL_STRING_TOO_LONG | 400 | String exceeds max length |
| VAL_INVALID_ENUM | 400 | Value not in allowed enum |
| VAL_INVALID_UUID | 400 | Invalid UUID format |

### Resource Errors (RES_xxx)

| Code | HTTP Status | Description |
|------|-------------|-------------|
| RES_NOT_FOUND | 404 | Resource does not exist |
| RES_ALREADY_EXISTS | 409 | Resource already exists |
| RES_DELETED | 410 | Resource has been deleted |
| RES_CONFLICT | 409 | State conflict (e.g., already generating) |

### API Key Errors (KEY_xxx)

| Code | HTTP Status | Description |
|------|-------------|-------------|
| KEY_NOT_CONFIGURED | 422 | No API key configured for provider |
| KEY_INVALID | 422 | API key rejected by provider |
| KEY_EXPIRED | 422 | API key has expired |
| KEY_RATE_LIMITED | 429 | Provider rate limit exceeded |
| KEY_QUOTA_EXCEEDED | 422 | Provider quota exceeded |
| KEY_DECRYPTION_FAILED | 500 | Failed to decrypt stored key |

### Image Generation Errors (GEN_xxx)

| Code | HTTP Status | Description |
|------|-------------|-------------|
| GEN_PROMPT_TOO_LONG | 422 | Prompt exceeds max length (1500 chars) |
| GEN_PROVIDER_ERROR | 502 | Provider returned an error |
| GEN_PROVIDER_TIMEOUT | 504 | Provider request timed out |
| GEN_CONTENT_FILTERED | 422 | Content blocked by safety filters |
| GEN_ALREADY_IN_PROGRESS | 409 | Shot is already generating |
| GEN_NO_PREVIOUS_IMAGE | 422 | No previous image to revert to |

### Upload Errors (UPL_xxx)

| Code | HTTP Status | Description |
|------|-------------|-------------|
| UPL_FILE_TOO_LARGE | 400 | File exceeds size limit |
| UPL_INVALID_FILE_TYPE | 400 | File type not allowed |
| UPL_S3_ERROR | 502 | S3 upload failed |

### System Errors (SYS_xxx)

| Code | HTTP Status | Description |
|------|-------------|-------------|
| SYS_INTERNAL_ERROR | 500 | Unexpected server error |
| SYS_DATABASE_ERROR | 500 | Database operation failed |
| SYS_SERVICE_UNAVAILABLE | 503 | Service temporarily unavailable |

---

## Endpoints

### Authentication

#### Register

Create a new user account.

```
POST /api/auth/register
```

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response (201):**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

Also sets `refresh_token` HTTP-only cookie.

**Errors:**
- `AUTH_EMAIL_IN_USE` — Email already registered
- `VAL_REQUIRED_FIELD` — Missing email or password
- `VAL_INVALID_FORMAT` — Password doesn't meet requirements

---

#### Login

Authenticate and receive tokens.

```
POST /api/auth/login
```

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

Also sets `refresh_token` HTTP-only cookie.

**Errors:**
- `AUTH_INVALID_CREDENTIALS` — Invalid email or password

---

#### Refresh Token

Exchange refresh token for new access token.

```
POST /api/auth/refresh
```

**Request:** No body. Refresh token sent via cookie.

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

Also sets new `refresh_token` cookie (rotation).

**Errors:**
- `AUTH_TOKEN_MISSING` — No refresh token cookie
- `AUTH_TOKEN_EXPIRED` — Refresh token expired
- `AUTH_TOKEN_INVALID` — Invalid or revoked token

---

#### Logout

Revoke current refresh token.

```
POST /api/auth/logout
```

**Request:** No body.

**Response (204):** No content.

Clears `refresh_token` cookie.

---

#### Get Current User

Get authenticated user's profile.

```
GET /api/auth/me
```

**Response (200):**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

---

### User Settings

#### List API Keys

List configured API keys (without exposing actual keys).

```
GET /api/user/api-keys
```

**Response (200):**
```json
{
  "apiKeys": [
    {
      "provider": "gemini",
      "keyHint": "•••••3xyz",
      "isValid": true,
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

#### Add/Update API Key

Configure an API key for a provider.

```
POST /api/user/api-keys
```

**Request:**
```json
{
  "provider": "gemini",
  "apiKey": "AIzaSy..."
}
```

**Response (200):**
```json
{
  "provider": "gemini",
  "keyHint": "•••••3xyz",
  "isValid": true
}
```

---

#### Delete API Key

Remove an API key.

```
DELETE /api/user/api-keys/:provider
```

**Response (204):** No content.

---

#### Validate API Key

Test if an API key is valid.

```
POST /api/user/api-keys/:provider/validate
```

**Response (200):**
```json
{
  "isValid": true
}
```

**Errors:**
- `KEY_INVALID` — Key rejected by provider
- `KEY_NOT_CONFIGURED` — No key configured for provider

---

### Projects

#### List Projects

```
GET /api/projects
```

**Response (200):**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "My Film",
      "isPublic": false,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-16T14:20:00Z",
      "actCount": 3,
      "shotCount": 47
    }
  ]
}
```

---

#### Create Project

```
POST /api/projects
```

**Request:**
```json
{
  "title": "My Film"
}
```

**Response (201):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "My Film",
  "isPublic": false,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

---

#### Get Project

```
GET /api/projects/:projectId
```

**Response (200):** Project object with summary stats (act count, scene count, shot count, character count, etc.).

---

#### Update Project

```
PATCH /api/projects/:projectId
```

**Request:**
```json
{
  "title": "My Awesome Film"
}
```

**Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "My Awesome Film",
  "updatedAt": "2024-01-16T14:20:00Z"
}
```

---

#### Delete Project

Soft delete a project and all its contents.

```
DELETE /api/projects/:projectId
```

**Response (204):** No content.

---

#### Restore Project

Restore a soft-deleted project.

```
POST /api/projects/:projectId/restore
```

**Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "My Film",
  "deletedAt": null
}
```

---

#### Share Project

Generate or regenerate a share link.

```
POST /api/projects/:projectId/share
```

**Response (200):**
```json
{
  "shareToken": "770e8400-e29b-41d4-a716-446655440002",
  "shareUrl": "https://atelier.app/shared/770e8400-e29b-41d4-a716-446655440002",
  "isPublic": true
}
```

---

#### Revoke Sharing

Disable the share link.

```
DELETE /api/projects/:projectId/share
```

**Response (200):**
```json
{
  "isPublic": false,
  "shareToken": null
}
```

---

#### View Shared Project

Public endpoint for viewing shared projects.

```
GET /api/shared/:shareToken
```

**Response (200):**
```json
{
  "project": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "My Film"
  },
  "artStyle": { "..." : "..." },
  "acts": [
    {
      "id": "...",
      "title": "Act 1",
      "scenes": [
        {
          "id": "...",
          "title": "Opening Scene",
          "shots": [
            {
              "id": "...",
              "sequenceNumber": 1000,
              "description": "...",
              "imageUrl": "https://...",
              "thumbnailUrl": "https://...",
              "annotations": { "..." : "..." },
              "caption": "..."
            }
          ]
        }
      ]
    }
  ]
}
```

---

### Art Style

#### Get Art Style

Get the project's art style.

```
GET /api/projects/:projectId/art-style
```

**Response (200):**
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "name": "Neo-Noir",
  "description": "Dark, moody aesthetic with high contrast",
  "colorPalette": "Desaturated with blue and orange accents",
  "styleReferences": "Blade Runner, Sin City",
  "technicalTerms": ["high contrast", "film grain", "lens flare"],
  "aiDescription": "Neo-noir cinematic style with high contrast lighting..."
}
```

---

#### Update Art Style

```
PUT /api/projects/:projectId/art-style
```

**Request:**
```json
{
  "name": "Neo-Noir",
  "description": "Dark, moody aesthetic with high contrast",
  "colorPalette": "Desaturated with blue and orange accents",
  "styleReferences": "Blade Runner, Sin City",
  "technicalTerms": ["high contrast", "film grain", "lens flare"],
  "aiDescription": "Neo-noir cinematic style with high contrast lighting..."
}
```

**Response (200):** Updated art style object.

---

#### Generate Art Style Description

```
POST /api/projects/:projectId/art-style/generate-description
```

**Response (200):**
```json
{
  "aiDescription": "Neo-noir cinematic rendering with stark chiaroscuro lighting..."
}
```

---

### Characters

#### List Characters

```
GET /api/projects/:projectId/characters
```

**Response (200):**
```json
{
  "data": [
    {
      "id": "...",
      "name": "Sarah Chen",
      "physicalDescription": "Professional woman in her 30s...",
      "aiDescription": "...",
      "variantCount": 2,
      "referenceImageCount": 1
    }
  ]
}
```

---

#### Create Character

```
POST /api/projects/:projectId/characters
```

**Request:**
```json
{
  "name": "Sarah Chen",
  "physicalDescription": "Professional woman in her early 30s with sharp features",
  "defaultAppearance": "Tailored charcoal blazer, white blouse, hair pulled back",
  "personality": "Determined, strategic, controlled exterior hiding deep empathy",
  "aiDescription": "..."
}
```

**Response (201):** Created character object.

---

#### Get Character

```
GET /api/projects/:projectId/characters/:characterId
```

**Response (200):** Character object with variants and reference images.

---

#### Update Character

```
PATCH /api/projects/:projectId/characters/:characterId
```

**Request:** Partial character object.

**Response (200):** Updated character object.

---

#### Delete Character

```
DELETE /api/projects/:projectId/characters/:characterId
```

**Response (204):** No content.

---

#### Generate Character Description

```
POST /api/projects/:projectId/characters/:characterId/generate-description
```

**Response (200):**
```json
{
  "aiDescription": "A professional woman in her early 30s with sharp, angular features..."
}
```

---

### Variants

#### List Variants

```
GET /api/projects/:projectId/characters/:characterId/variants
```

**Response (200):**
```json
{
  "data": [
    {
      "id": "...",
      "name": "Battle Armor",
      "description": "Full plate armor with battle damage",
      "aiDescription": "..."
    }
  ]
}
```

---

#### Create Variant

```
POST /api/projects/:projectId/characters/:characterId/variants
```

**Request:**
```json
{
  "name": "Battle Armor",
  "description": "Full plate armor with battle damage and blood stains",
  "aiDescription": "..."
}
```

**Response (201):** Created variant object.

---

#### Get/Update/Delete Variant

```
GET    /api/projects/:projectId/characters/:characterId/variants/:variantId
PATCH  /api/projects/:projectId/characters/:characterId/variants/:variantId
DELETE /api/projects/:projectId/characters/:characterId/variants/:variantId
```

Standard CRUD operations.

---

#### Generate Variant Description

```
POST /api/projects/:projectId/characters/:characterId/variants/:variantId/generate-description
```

Generates combined base character + variant description.

---

### Settings

#### List Settings

```
GET /api/projects/:projectId/settings
```

**Response (200):**
```json
{
  "data": [
    {
      "id": "...",
      "name": "Corporate Office",
      "description": "Modern high-rise office",
      "setDressing": "Glass walls, modern furniture, city skyline",
      "timeOfDay": "midday",
      "weather": "clear",
      "lighting": "Harsh fluorescent overhead",
      "mood": "Sterile, corporate",
      "aiDescription": "...",
      "referenceImageCount": 1
    }
  ]
}
```

---

#### Create Setting

```
POST /api/projects/:projectId/settings
```

**Request:**
```json
{
  "name": "Corporate Office",
  "description": "Modern high-rise office in downtown",
  "setDressing": "Glass walls, contemporary furniture, city skyline visible through floor-to-ceiling windows",
  "timeOfDay": "midday",
  "weather": "clear",
  "lighting": "Harsh fluorescent overhead lighting",
  "mood": "Sterile, impersonal, corporate",
  "aiDescription": "..."
}
```

**Response (201):** Created setting object.

---

#### Get/Update/Delete Setting

```
GET    /api/projects/:projectId/settings/:settingId
PATCH  /api/projects/:projectId/settings/:settingId
DELETE /api/projects/:projectId/settings/:settingId
```

Standard CRUD operations.

---

#### Generate Setting Description

```
POST /api/projects/:projectId/settings/:settingId/generate-description
```

---

### Props

#### List Props

```
GET /api/projects/:projectId/props
```

---

#### Create Prop

```
POST /api/projects/:projectId/props
```

**Request:**
```json
{
  "name": "Ancient Sword",
  "description": "Ornate longsword with runic inscriptions",
  "handledBy": "Wielded two-handed by the protagonist",
  "aiDescription": "..."
}
```

**Response (201):** Created prop object.

---

#### Get/Update/Delete Prop

```
GET    /api/projects/:projectId/props/:propId
PATCH  /api/projects/:projectId/props/:propId
DELETE /api/projects/:projectId/props/:propId
```

---

#### Generate Prop Description

```
POST /api/projects/:projectId/props/:propId/generate-description
```

---

### Lighting

#### List Lighting Setups

```
GET /api/projects/:projectId/lighting
```

---

#### Create Lighting Setup

```
POST /api/projects/:projectId/lighting
```

**Request:**
```json
{
  "name": "Interrogation Room",
  "description": "Single harsh overhead light, deep shadows on face",
  "mood": "Tense, oppressive",
  "aiDescription": "..."
}
```

**Response (201):** Created lighting setup object.

---

#### Get/Update/Delete Lighting

```
GET    /api/projects/:projectId/lighting/:lightingId
PATCH  /api/projects/:projectId/lighting/:lightingId
DELETE /api/projects/:projectId/lighting/:lightingId
```

---

#### Generate Lighting Description

```
POST /api/projects/:projectId/lighting/:lightingId/generate-description
```

---

### Reference Images

#### Get Presigned Upload URL

Get a URL for direct browser-to-S3 upload.

```
POST /api/projects/:projectId/reference-images/presign
```

**Request:**
```json
{
  "filename": "character-sketch.png",
  "contentType": "image/png",
  "componentType": "character",
  "componentId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (200):**
```json
{
  "uploadUrl": "https://s3.amazonaws.com/atelier-prod/...",
  "imageId": "770e8400-e29b-41d4-a716-446655440002",
  "s3Key": "projects/.../references/770e8400....png",
  "expiresAt": "2024-01-15T10:45:00Z"
}
```

---

#### Confirm Upload

Confirm upload completed and create database record.

```
POST /api/projects/:projectId/reference-images/confirm
```

**Request:**
```json
{
  "imageId": "770e8400-e29b-41d4-a716-446655440002",
  "s3Key": "projects/.../references/770e8400....png",
  "componentType": "character",
  "componentId": "550e8400-e29b-41d4-a716-446655440000",
  "filename": "character-sketch.png",
  "contentType": "image/png"
}
```

**Response (201):**
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "url": "https://...",
  "filename": "character-sketch.png"
}
```

---

#### List Reference Images

```
GET /api/projects/:projectId/reference-images?componentType=character&componentId=...
```

**Response (200):**
```json
{
  "images": [
    {
      "id": "...",
      "filename": "character-sketch.png",
      "url": "https://...",
      "uploadedAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

#### Delete Reference Image

```
DELETE /api/projects/:projectId/reference-images/:imageId
```

**Response (204):** No content.

---

### Acts

#### List Acts

```
GET /api/projects/:projectId/acts
```

**Response (200):**
```json
{
  "data": [
    {
      "id": "...",
      "title": "Act 1: Setup",
      "sequenceNumber": 1000,
      "sceneCount": 4
    },
    {
      "id": "...",
      "title": "Act 2: Confrontation",
      "sequenceNumber": 2000,
      "sceneCount": 6
    }
  ]
}
```

---

#### Create Act

```
POST /api/projects/:projectId/acts
```

**Request:**
```json
{
  "title": "Act 1: Setup"
}
```

**Response (201):**
```json
{
  "id": "...",
  "title": "Act 1: Setup",
  "sequenceNumber": 1000
}
```

---

#### Get/Update/Delete Act

```
GET    /api/projects/:projectId/acts/:actId
PATCH  /api/projects/:projectId/acts/:actId
DELETE /api/projects/:projectId/acts/:actId
```

---

#### Reorder Acts

```
POST /api/projects/:projectId/acts/reorder
```

**Request:**
```json
{
  "orderedIds": ["act-id-2", "act-id-1", "act-id-3"]
}
```

**Response (200):**
```json
{
  "updated": 3
}
```

---

### Scenes

#### List Scenes

```
GET /api/projects/:projectId/acts/:actId/scenes
```

**Response (200):**
```json
{
  "data": [
    {
      "id": "...",
      "title": "Opening Scene",
      "sequenceNumber": 1000,
      "defaultSetting": {
        "id": "...",
        "name": "Corporate Office"
      },
      "defaultLighting": null,
      "shotCount": 12
    }
  ]
}
```

---

#### Create Scene

```
POST /api/projects/:projectId/acts/:actId/scenes
```

**Request:**
```json
{
  "title": "Opening Scene",
  "defaultSettingId": "...",
  "defaultLightingId": "..."
}
```

**Response (201):** Created scene object.

---

#### Get/Update/Delete Scene

```
GET    /api/projects/:projectId/scenes/:sceneId
PATCH  /api/projects/:projectId/scenes/:sceneId
DELETE /api/projects/:projectId/scenes/:sceneId
```

---

#### Reorder Scenes

```
POST /api/projects/:projectId/acts/:actId/scenes/reorder
```

**Request:**
```json
{
  "orderedIds": ["scene-id-2", "scene-id-1"]
}
```

---

#### Move Scene

Move a scene to a different act.

```
POST /api/projects/:projectId/scenes/:sceneId/move
```

**Request:**
```json
{
  "targetActId": "..."
}
```

---

### Shots

#### List Shots

```
GET /api/projects/:projectId/scenes/:sceneId/shots
```

**Response (200):**
```json
{
  "data": [
    {
      "id": "...",
      "sequenceNumber": 1000,
      "description": "Sarah enters the office",
      "shotType": "MS",
      "cameraAngle": "EYE_LEVEL",
      "cameraMovement": "STATIC",
      "status": "GENERATED",
      "imageUrl": "https://...",
      "thumbnailUrl": "https://...",
      "characters": [
        {
          "characterId": "...",
          "characterName": "Sarah Chen",
          "variantId": "...",
          "variantName": "Business Formal"
        }
      ]
    }
  ]
}
```

---

#### Create Shot

```
POST /api/projects/:projectId/scenes/:sceneId/shots
```

**Request:**
```json
{
  "description": "Sarah enters the office carrying documents",
  "shotType": "MS",
  "cameraAngle": "EYE_LEVEL",
  "cameraMovement": "STATIC",
  "settingId": null,
  "lightingId": null,
  "characters": [
    { "characterId": "...", "variantId": "..." }
  ],
  "props": ["prop-id-1"]
}
```

**Response (201):** Created shot object with auto-assigned sequence number.

---

#### Get Shot

```
GET /api/projects/:projectId/shots/:shotId
```

**Response (200):** Full shot object including characters, props, setting, lighting, image URLs, annotations, and caption.

---

#### Update Shot

```
PATCH /api/projects/:projectId/shots/:shotId
```

**Request:** Partial shot object. Can update description, shot type, camera angle, camera movement, setting, lighting, characters, props, annotations, and caption.

---

#### Delete Shot

```
DELETE /api/projects/:projectId/shots/:shotId
```

**Response (204):** No content.

---

#### Reorder Shots

```
POST /api/projects/:projectId/scenes/:sceneId/shots/reorder
```

**Request:**
```json
{
  "orderedIds": ["shot-id-3", "shot-id-1", "shot-id-2"]
}
```

---

#### Move Shot

Move a shot to a different scene.

```
POST /api/projects/:projectId/shots/:shotId/move
```

**Request:**
```json
{
  "targetSceneId": "..."
}
```

---

#### Compile Prompt (Preview)

Get the compiled prompt without generating an image.

```
GET /api/projects/:projectId/shots/:shotId/compile-prompt
```

**Response (200):**
```json
{
  "prompt": "Medium shot showing figure from waist up...",
  "sections": [
    { "name": "framing", "content": "Medium shot...", "source": "system:shot_type" },
    { "name": "characters", "content": "featuring a professional woman...", "source": "character:abc" }
  ],
  "warnings": [],
  "error": null
}
```

---

#### Generate Image

Compile prompt and generate storyboard frame.

```
POST /api/projects/:projectId/shots/:shotId/generate
```

**Request (optional):**
```json
{
  "editedPrompt": "Custom prompt override..."
}
```

**Response (200):**
```json
{
  "id": "...",
  "imageUrl": "https://...",
  "thumbnailUrl": "https://...",
  "prompt": "...",
  "provider": "gemini",
  "status": "GENERATED"
}
```

**Errors:**
- `KEY_NOT_CONFIGURED` — No Gemini API key configured
- `GEN_ALREADY_IN_PROGRESS` — Shot is already generating
- `GEN_CONTENT_FILTERED` — Content blocked by safety filters
- `GEN_PROVIDER_ERROR` — Gemini API error
- `GEN_PROVIDER_TIMEOUT` — Gemini request timed out

---

#### Revert Image

Restore the previous generated image.

```
POST /api/projects/:projectId/shots/:shotId/revert
```

**Response (200):**
```json
{
  "id": "...",
  "imageUrl": "https://...",
  "thumbnailUrl": "https://..."
}
```

**Errors:**
- `GEN_NO_PREVIOUS_IMAGE` — No previous image available

---

### Image Generation

#### Generate Image (Generic)

Generate image from prompt (for concept art phase).

```
POST /api/projects/:projectId/generate-image
```

**Request:**
```json
{
  "prompt": "A medieval castle on a cliff at sunset"
}
```

**Response (200):**
```json
{
  "id": "...",
  "url": "https://...",
  "prompt": "A medieval castle on a cliff at sunset",
  "provider": "gemini",
  "model": "imagen-3"
}
```

---

### Concept Art Sessions

#### List Sessions

```
GET /api/projects/:projectId/concept-sessions
```

**Response (200):**
```json
{
  "data": [
    {
      "id": "...",
      "componentType": "character",
      "componentId": "...",
      "status": "COMPLETED",
      "createdAt": "2024-01-15T10:30:00Z",
      "messageCount": 8
    }
  ]
}
```

---

#### Create Session

Start a new concept art session.

```
POST /api/projects/:projectId/concept-sessions
```

**Request:**
```json
{
  "componentType": "character",
  "componentId": "..."
}
```

**Response (201):**
```json
{
  "id": "...",
  "componentType": "character",
  "componentId": "...",
  "status": "ACTIVE",
  "messages": []
}
```

---

#### Get Session

```
GET /api/projects/:projectId/concept-sessions/:sessionId
```

**Response (200):**
```json
{
  "id": "...",
  "componentType": "character",
  "componentId": "...",
  "status": "ACTIVE",
  "messages": [
    {
      "id": "...",
      "role": "user",
      "content": "Show me a warrior in silver armor",
      "generatedImageId": null,
      "createdAt": "..."
    },
    {
      "id": "...",
      "role": "assistant",
      "content": "Here's a warrior design...",
      "generatedImageId": "...",
      "imageUrl": "https://...",
      "createdAt": "..."
    }
  ]
}
```

---

#### Send Message

Send a message and optionally trigger image generation.

```
POST /api/projects/:projectId/concept-sessions/:sessionId/messages
```

**Request:**
```json
{
  "content": "Make the armor more battle-worn"
}
```

**Response (200):**
```json
{
  "userMessage": {
    "id": "...",
    "role": "user",
    "content": "Make the armor more battle-worn",
    "createdAt": "..."
  },
  "assistantMessage": {
    "id": "...",
    "role": "assistant",
    "content": "I've updated the design with battle damage...",
    "generatedImageId": "...",
    "imageUrl": "https://...",
    "createdAt": "..."
  }
}
```

---

#### Update Session Status

```
PATCH /api/projects/:projectId/concept-sessions/:sessionId
```

**Request:**
```json
{
  "status": "ABANDONED"
}
```

---

#### Finalize Session

Complete session and generate component description.

```
POST /api/projects/:projectId/concept-sessions/:sessionId/finalize
```

**Request:**
```json
{
  "selectedImageId": "..."
}
```

**Response (200):**
```json
{
  "status": "COMPLETED",
  "generatedDescription": "A battle-worn warrior in dented silver plate armor..."
}
```
