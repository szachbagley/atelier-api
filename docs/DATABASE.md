# Database

This document describes the complete data model for Atelier, including table definitions, relationships, and conventions.

## Schema Overview

### Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                      Users                                           │
│                                                                                      │
│  ┌─────────────────────┐         ┌─────────────────────────────────────────────┐    │
│  │        users         │ ──1:N── │              user_api_keys                  │    │
│  │                      │         │                                             │    │
│  │  id                  │         │  Encrypted storage for Gemini, etc.         │    │
│  │  email               │         │                                             │    │
│  │  password_hash       │         └─────────────────────────────────────────────┘    │
│  └─────────────────────┘                                                            │
│            │                     ┌─────────────────────────────────────────────┐     │
│            │ 1:N                 │              refresh_tokens                  │     │
│            │                     │                                             │     │
│            ├────────────────────►│  JWT refresh token tracking                 │     │
│            │                     └─────────────────────────────────────────────┘     │
│            │                                                                         │
│            ▼                                                                         │
│  ┌─────────────────────┐                                                            │
│  │      projects        │                                                            │
│  │                      │                                                            │
│  │  id, title,          │                                                            │
│  │  share_token         │                                                            │
│  └─────────────────────┘                                                            │
│            │                                                                         │
│            ├──────────────────────────────────────────────────────────┐              │
│            │                                                          │              │
│            │ 1:1                                                      │ 1:N          │
│            ▼                                                          ▼              │
│  ┌─────────────────────┐                                   ┌─────────────────────┐  │
│  │     art_styles       │                                   │        acts          │  │
│  │                      │                                   │                      │  │
│  │  Project-wide        │                                   │  Story divisions     │  │
│  │  visual style        │                                   │                      │  │
│  └─────────────────────┘                                   └─────────────────────┘  │
│            │                                                          │              │
│            │ 1:N (component library)                                  │ 1:N          │
│            ▼                                                          ▼              │
│  ┌─────────────────────────────────────────────────┐       ┌─────────────────────┐  │
│  │              Component Library                    │       │       scenes         │  │
│  │                                                   │       │                      │  │
│  │  ┌────────────┐  ┌──────────┐  ┌──────────────┐ │       │  Continuous action   │  │
│  │  │ characters  │  │ settings │  │    props     │ │       │  in one location     │  │
│  │  └────────────┘  └──────────┘  └──────────────┘ │       └─────────────────────┘  │
│  │        │                                          │                │              │
│  │        │ 1:N          ┌──────────────────┐       │                │ 1:N          │
│  │        ▼              │ lighting_setups   │       │                ▼              │
│  │  ┌────────────┐      └──────────────────┘       │       ┌─────────────────────┐  │
│  │  │  variants   │                                  │       │       shots          │  │
│  │  └────────────┘                                  │       │                      │  │
│  └─────────────────────────────────────────────────┘       │  Camera setups       │  │
│                                                              │  with annotations    │  │
│                                                              └─────────────────────┘  │
│                                                                       │              │
│                                                              ┌────────┴────────┐     │
│                                                              │                 │     │
│                                                              ▼                 ▼     │
│                                                     ┌──────────────┐  ┌────────────┐│
│                                                     │shot_characters│  │ shot_props ││
│                                                     └──────────────┘  └────────────┘│
│                                                                                      │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                     Images                                           │
│                                                                                      │
│  ┌─────────────────────────────┐         ┌─────────────────────────────────────┐    │
│  │     generated_images        │         │          reference_images            │    │
│  │                             │         │                                     │    │
│  │  AI-generated outputs       │         │  User-uploaded references           │    │
│  └─────────────────────────────┘         └─────────────────────────────────────┘    │
│                                                                                      │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                              Concept Art Sessions                                    │
│                                                                                      │
│  ┌─────────────────────────────┐         ┌─────────────────────────────────────┐    │
│  │    concept_art_sessions     │ ──1:N── │       concept_art_messages          │    │
│  │                             │         │                                     │    │
│  │  Tracks iterative design    │         │  Chat history for component         │    │
│  │  conversations              │         │  visualization                      │    │
│  └─────────────────────────────┘         └─────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Table Relationships

| Parent | Child | Relationship | On Delete |
|--------|-------|--------------|-----------|
| users | projects | 1:N | CASCADE |
| users | user_api_keys | 1:N | CASCADE |
| users | refresh_tokens | 1:N | CASCADE |
| projects | art_styles | 1:1 | CASCADE |
| projects | characters | 1:N | CASCADE |
| projects | settings | 1:N | CASCADE |
| projects | props | 1:N | CASCADE |
| projects | lighting_setups | 1:N | CASCADE |
| projects | acts | 1:N | CASCADE |
| projects | generated_images | 1:N | CASCADE |
| projects | concept_art_sessions | 1:N | CASCADE |
| characters | variants | 1:N | CASCADE |
| acts | scenes | 1:N | CASCADE |
| scenes | shots | 1:N | CASCADE |
| shots | shot_characters | 1:N | CASCADE |
| shots | shot_props | 1:N | CASCADE |
| concept_art_sessions | concept_art_messages | 1:N | CASCADE |

---

## Table Definitions

### Users and Authentication

#### users

Stores user account information.

```sql
CREATE TABLE users (
    id CHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    INDEX idx_email (email),
    INDEX idx_deleted (deleted_at)
);
```

| Column | Type | Description |
|--------|------|-------------|
| id | CHAR(36) | UUID primary key |
| email | VARCHAR(255) | Unique email address, used for login |
| password_hash | VARCHAR(255) | Bcrypt hash of password |
| created_at | TIMESTAMP | Account creation time |
| updated_at | TIMESTAMP | Last modification time |
| deleted_at | TIMESTAMP | Soft delete timestamp (NULL if active) |

#### user_api_keys

Stores encrypted API keys for external services (Gemini, future providers).

```sql
CREATE TABLE user_api_keys (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    provider ENUM('gemini', 'openai', 'stability', 'midjourney') NOT NULL,
    encrypted_key TEXT NOT NULL,
    key_hint VARCHAR(10),
    is_valid BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_provider (user_id, provider),
    INDEX idx_deleted (deleted_at)
);
```

| Column | Type | Description |
|--------|------|-------------|
| id | CHAR(36) | UUID primary key |
| user_id | CHAR(36) | Foreign key to users |
| provider | ENUM | API provider name |
| encrypted_key | TEXT | AES-256-GCM encrypted API key |
| key_hint | VARCHAR(10) | Last 4 characters for display (e.g., "•••••3xyz") |
| is_valid | BOOLEAN | Whether key passed last validation |
| deleted_at | TIMESTAMP | Soft delete timestamp |

#### refresh_tokens

Tracks issued refresh tokens for session management.

```sql
CREATE TABLE refresh_tokens (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP NULL DEFAULT NULL,
    replaced_by_id CHAR(36) NULL,
    user_agent VARCHAR(512),
    ip_address VARCHAR(45),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_tokens (user_id),
    INDEX idx_expires (expires_at),
    INDEX idx_token_hash (token_hash)
);
```

| Column | Type | Description |
|--------|------|-------------|
| id | CHAR(36) | UUID, matches `jti` claim in JWT |
| user_id | CHAR(36) | Foreign key to users |
| token_hash | VARCHAR(64) | SHA-256 hash of token (not the token itself) |
| expires_at | TIMESTAMP | Token expiration time |
| revoked_at | TIMESTAMP | When token was revoked (NULL if active) |
| replaced_by_id | CHAR(36) | Points to new token after rotation |
| user_agent | VARCHAR(512) | Browser/client identifier |
| ip_address | VARCHAR(45) | Client IP (supports IPv6) |

---

### Projects

#### projects

Top-level container for all user work.

```sql
CREATE TABLE projects (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    share_token CHAR(36) UNIQUE,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_projects (user_id),
    INDEX idx_share_token (share_token),
    INDEX idx_deleted (deleted_at)
);
```

| Column | Type | Description |
|--------|------|-------------|
| id | CHAR(36) | UUID primary key |
| user_id | CHAR(36) | Foreign key to owning user |
| title | VARCHAR(255) | Project name |
| share_token | CHAR(36) | UUID for public sharing link |
| is_public | BOOLEAN | Whether share link is active |
| deleted_at | TIMESTAMP | Soft delete timestamp |

---

### Art Style

#### art_styles

Project-wide visual style definition (one per project).

```sql
CREATE TABLE art_styles (
    id CHAR(36) PRIMARY KEY,
    project_id CHAR(36) UNIQUE NOT NULL,
    name VARCHAR(255),
    description TEXT,
    color_palette TEXT,
    style_references TEXT,
    technical_terms JSON,
    ai_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    INDEX idx_deleted (deleted_at)
);
```

| Column | Type | Description |
|--------|------|-------------|
| id | CHAR(36) | UUID primary key |
| project_id | CHAR(36) | Foreign key to project (unique constraint) |
| name | VARCHAR(255) | Style name (e.g., "Neo-Noir") |
| description | TEXT | Human-readable style description |
| color_palette | TEXT | Color preferences (e.g., "desaturated, blue highlights") |
| style_references | TEXT | Reference works (e.g., "Blade Runner, Sin City") |
| technical_terms | JSON | Array of style terms (e.g., ["cel-shaded", "high contrast"]) |
| ai_description | TEXT | Optimized description for image generation prompts |

---

### Component Library

#### characters

Characters that appear in the story.

```sql
CREATE TABLE characters (
    id CHAR(36) PRIMARY KEY,
    project_id CHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    physical_description TEXT,
    default_appearance TEXT,
    personality TEXT,
    ai_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    INDEX idx_project_characters (project_id),
    INDEX idx_deleted (deleted_at)
);
```

| Column | Type | Description |
|--------|------|-------------|
| id | CHAR(36) | UUID primary key |
| project_id | CHAR(36) | Foreign key to project |
| name | VARCHAR(255) | Character name |
| physical_description | TEXT | Human-readable appearance |
| default_appearance | TEXT | Default clothing/look |
| personality | TEXT | Personality traits (for reference) |
| ai_description | TEXT | Optimized description for prompts |

#### variants

Alternate appearances for a character (e.g., "Business Formal", "Casual Weekend").

```sql
CREATE TABLE variants (
    id CHAR(36) PRIMARY KEY,
    character_id CHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    ai_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    INDEX idx_character_variants (character_id),
    INDEX idx_deleted (deleted_at)
);
```

| Column | Type | Description |
|--------|------|-------------|
| id | CHAR(36) | UUID primary key |
| character_id | CHAR(36) | Foreign key to parent character |
| name | VARCHAR(255) | Variant name (e.g., "Disguise") |
| description | TEXT | How this variant differs from default |
| ai_description | TEXT | Optimized description for prompts |

#### settings

Locations and environments.

```sql
CREATE TABLE settings (
    id CHAR(36) PRIMARY KEY,
    project_id CHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    set_dressing TEXT,
    time_of_day ENUM('dawn', 'morning', 'midday', 'afternoon', 'dusk', 'night', 'unspecified') DEFAULT 'unspecified',
    weather ENUM('clear', 'cloudy', 'rain', 'snow', 'fog', 'storm', 'unspecified') DEFAULT 'unspecified',
    lighting TEXT,
    mood TEXT,
    ai_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    INDEX idx_project_settings (project_id),
    INDEX idx_deleted (deleted_at)
);
```

| Column | Type | Description |
|--------|------|-------------|
| id | CHAR(36) | UUID primary key |
| project_id | CHAR(36) | Foreign key to project |
| name | VARCHAR(255) | Setting name (e.g., "Corporate Office") |
| description | TEXT | General description |
| set_dressing | TEXT | Physical details (furniture, objects, etc.) |
| time_of_day | ENUM | Time of day for default lighting |
| weather | ENUM | Weather conditions |
| lighting | TEXT | Lighting description |
| mood | TEXT | Emotional quality |
| ai_description | TEXT | Optimized description for prompts |

#### props

Objects that characters interact with.

```sql
CREATE TABLE props (
    id CHAR(36) PRIMARY KEY,
    project_id CHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    handled_by TEXT,
    ai_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    INDEX idx_project_props (project_id),
    INDEX idx_deleted (deleted_at)
);
```

| Column | Type | Description |
|--------|------|-------------|
| id | CHAR(36) | UUID primary key |
| project_id | CHAR(36) | Foreign key to project |
| name | VARCHAR(255) | Prop name (e.g., "Manila Folder") |
| description | TEXT | Physical description |
| handled_by | TEXT | Notes on which character uses this |
| ai_description | TEXT | Optimized description for prompts |

#### lighting_setups

Lighting conditions for scenes.

```sql
CREATE TABLE lighting_setups (
    id CHAR(36) PRIMARY KEY,
    project_id CHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    mood TEXT,
    ai_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    INDEX idx_project_lighting (project_id),
    INDEX idx_deleted (deleted_at)
);
```

| Column | Type | Description |
|--------|------|-------------|
| id | CHAR(36) | UUID primary key |
| project_id | CHAR(36) | Foreign key to project |
| name | VARCHAR(255) | Lighting name (e.g., "Interrogation Room") |
| description | TEXT | Key light, fill, color temperature, shadows |
| mood | TEXT | Emotional quality the lighting creates |
| ai_description | TEXT | Optimized description for prompts |

---

### Storyboard Structure

#### acts

High-level organizational containers.

```sql
CREATE TABLE acts (
    id CHAR(36) PRIMARY KEY,
    project_id CHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    sequence_number INT NOT NULL DEFAULT 1000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    INDEX idx_project_acts (project_id),
    INDEX idx_sequence (project_id, sequence_number),
    INDEX idx_deleted (deleted_at)
);
```

| Column | Type | Description |
|--------|------|-------------|
| id | CHAR(36) | UUID primary key |
| project_id | CHAR(36) | Foreign key to project |
| title | VARCHAR(255) | Act title (e.g., "Act 1: Setup") |
| sequence_number | INT | Order within project (see Sequencing Strategy) |

#### scenes

Continuous action in one location.

```sql
CREATE TABLE scenes (
    id CHAR(36) PRIMARY KEY,
    act_id CHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    sequence_number INT NOT NULL DEFAULT 1000,
    default_setting_id CHAR(36),
    default_lighting_id CHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (act_id) REFERENCES acts(id) ON DELETE CASCADE,
    FOREIGN KEY (default_setting_id) REFERENCES settings(id) ON DELETE SET NULL,
    FOREIGN KEY (default_lighting_id) REFERENCES lighting_setups(id) ON DELETE SET NULL,
    INDEX idx_act_scenes (act_id),
    INDEX idx_sequence (act_id, sequence_number),
    INDEX idx_deleted (deleted_at)
);
```

| Column | Type | Description |
|--------|------|-------------|
| id | CHAR(36) | UUID primary key |
| act_id | CHAR(36) | Foreign key to parent act |
| title | VARCHAR(255) | Scene title |
| sequence_number | INT | Order within act |
| default_setting_id | CHAR(36) | Default setting inherited by shots |
| default_lighting_id | CHAR(36) | Default lighting inherited by shots |

#### shots

Individual camera setups / storyboard frames.

```sql
CREATE TABLE shots (
    id CHAR(36) PRIMARY KEY,
    scene_id CHAR(36) NOT NULL,
    sequence_number INT NOT NULL DEFAULT 1000,
    description TEXT,
    shot_type ENUM('EWS', 'WS', 'FS', 'MWS', 'MS', 'MCU', 'CU', 'ECU', 'OTS', 'POV', 'TWO_SHOT', 'INSERT', 'ESTABLISHING'),
    camera_angle ENUM('EYE_LEVEL', 'LOW_ANGLE', 'HIGH_ANGLE', 'BIRDS_EYE', 'DUTCH_ANGLE', 'WORMS_EYE'),
    camera_movement ENUM('STATIC', 'PAN', 'TILT', 'DOLLY', 'CRANE', 'HANDHELD', 'ZOOM'),
    setting_id CHAR(36),
    lighting_id CHAR(36),
    generated_image_id CHAR(36),
    previous_image_id CHAR(36),
    annotations JSON,
    caption TEXT,
    compiled_prompt TEXT,
    edited_prompt TEXT,
    status ENUM('DRAFT', 'GENERATING', 'GENERATED', 'FAILED') DEFAULT 'DRAFT',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE,
    FOREIGN KEY (setting_id) REFERENCES settings(id) ON DELETE SET NULL,
    FOREIGN KEY (lighting_id) REFERENCES lighting_setups(id) ON DELETE SET NULL,
    INDEX idx_scene_shots (scene_id),
    INDEX idx_sequence (scene_id, sequence_number),
    INDEX idx_deleted (deleted_at)
);
```

| Column | Type | Description |
|--------|------|-------------|
| id | CHAR(36) | UUID primary key |
| scene_id | CHAR(36) | Foreign key to parent scene |
| sequence_number | INT | Order within scene |
| description | TEXT | Free-form shot description |
| shot_type | ENUM | Camera framing type |
| camera_angle | ENUM | Camera perspective |
| camera_movement | ENUM | How camera moves (for annotation context) |
| setting_id | CHAR(36) | Override setting (NULL = inherit from scene) |
| lighting_id | CHAR(36) | Override lighting (NULL = inherit from scene) |
| generated_image_id | CHAR(36) | Current generated image |
| previous_image_id | CHAR(36) | Previous image (for single-step revert) |
| annotations | JSON | Vector annotation layer data |
| caption | TEXT | Text description for export |
| compiled_prompt | TEXT | Last compiled prompt sent to API |
| edited_prompt | TEXT | User's manual edits to prompt |
| status | ENUM | Generation status |

**Shot Type Values:**

| Value | Description |
|-------|-------------|
| EWS | Extreme Wide Shot |
| WS | Wide Shot |
| FS | Full Shot |
| MWS | Medium Wide Shot |
| MS | Medium Shot |
| MCU | Medium Close-Up |
| CU | Close-Up |
| ECU | Extreme Close-Up |
| OTS | Over-the-Shoulder |
| POV | Point of View |
| TWO_SHOT | Two-Shot |
| INSERT | Insert Shot |
| ESTABLISHING | Establishing Shot |

**Camera Angle Values:**

| Value | Description |
|-------|-------------|
| EYE_LEVEL | Neutral, eye-level perspective |
| LOW_ANGLE | Camera looking upward |
| HIGH_ANGLE | Camera looking downward |
| BIRDS_EYE | Directly overhead |
| DUTCH_ANGLE | Tilted horizon |
| WORMS_EYE | Ground level looking up |

**Camera Movement Values:**

| Value | Description |
|-------|-------------|
| STATIC | No camera movement |
| PAN | Horizontal rotation |
| TILT | Vertical rotation |
| DOLLY | Forward/backward movement |
| CRANE | Vertical movement |
| HANDHELD | Handheld/shaky movement |
| ZOOM | Lens zoom |

**Status Values:**

| Value | Description |
|-------|-------------|
| DRAFT | No image generated yet |
| GENERATING | Image generation in progress |
| GENERATED | Image successfully generated |
| FAILED | Last generation attempt failed |

---

### Junction Tables

#### shot_characters

Links shots to characters with optional variant selection.

```sql
CREATE TABLE shot_characters (
    id CHAR(36) PRIMARY KEY,
    shot_id CHAR(36) NOT NULL,
    character_id CHAR(36) NOT NULL,
    variant_id CHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shot_id) REFERENCES shots(id) ON DELETE CASCADE,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES variants(id) ON DELETE SET NULL,
    UNIQUE KEY unique_shot_character (shot_id, character_id)
);
```

#### shot_props

Links shots to props.

```sql
CREATE TABLE shot_props (
    id CHAR(36) PRIMARY KEY,
    shot_id CHAR(36) NOT NULL,
    prop_id CHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shot_id) REFERENCES shots(id) ON DELETE CASCADE,
    FOREIGN KEY (prop_id) REFERENCES props(id) ON DELETE CASCADE,
    UNIQUE KEY unique_shot_prop (shot_id, prop_id)
);
```

---

### Images

#### generated_images

AI-generated image outputs.

```sql
CREATE TABLE generated_images (
    id CHAR(36) PRIMARY KEY,
    project_id CHAR(36) NOT NULL,
    s3_key VARCHAR(512) NOT NULL,
    prompt TEXT,
    provider VARCHAR(50),
    model VARCHAR(100),
    width INT,
    height INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    INDEX idx_project_images (project_id),
    INDEX idx_deleted (deleted_at)
);
```

| Column | Type | Description |
|--------|------|-------------|
| id | CHAR(36) | UUID primary key |
| project_id | CHAR(36) | Foreign key to project |
| s3_key | VARCHAR(512) | S3 object key |
| prompt | TEXT | Prompt used to generate this image |
| provider | VARCHAR(50) | API provider (e.g., "gemini") |
| model | VARCHAR(100) | Model name/version |
| width | INT | Image width in pixels |
| height | INT | Image height in pixels |

#### reference_images

User-uploaded reference images attached to any component type.

```sql
CREATE TABLE reference_images (
    id CHAR(36) PRIMARY KEY,
    component_type ENUM('character', 'variant', 'setting', 'prop', 'lighting', 'art_style') NOT NULL,
    component_id CHAR(36) NOT NULL,
    s3_key VARCHAR(512) NOT NULL,
    filename VARCHAR(255),
    mime_type VARCHAR(100),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    INDEX idx_component (component_type, component_id),
    INDEX idx_deleted (deleted_at)
);
```

| Column | Type | Description |
|--------|------|-------------|
| id | CHAR(36) | UUID primary key |
| component_type | ENUM | Type of component this references |
| component_id | CHAR(36) | ID of the component |
| s3_key | VARCHAR(512) | S3 object key |
| filename | VARCHAR(255) | Original filename |
| mime_type | VARCHAR(100) | File MIME type |

---

### Concept Art Sessions

#### concept_art_sessions

Tracks iterative design conversations for components.

```sql
CREATE TABLE concept_art_sessions (
    id CHAR(36) PRIMARY KEY,
    project_id CHAR(36) NOT NULL,
    component_type ENUM('character', 'variant', 'setting', 'prop', 'lighting', 'art_style') NOT NULL,
    component_id CHAR(36),
    status ENUM('ACTIVE', 'COMPLETED', 'ABANDONED') DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    INDEX idx_project_sessions (project_id),
    INDEX idx_deleted (deleted_at)
);
```

| Column | Type | Description |
|--------|------|-------------|
| id | CHAR(36) | UUID primary key |
| project_id | CHAR(36) | Foreign key to project |
| component_type | ENUM | Type of component being designed |
| component_id | CHAR(36) | ID of component (NULL if creating new) |
| status | ENUM | Session status |

#### concept_art_messages

Chat messages within concept art sessions.

```sql
CREATE TABLE concept_art_messages (
    id CHAR(36) PRIMARY KEY,
    session_id CHAR(36) NOT NULL,
    role ENUM('user', 'assistant', 'system') NOT NULL,
    content TEXT,
    generated_image_id CHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES concept_art_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (generated_image_id) REFERENCES generated_images(id) ON DELETE SET NULL,
    INDEX idx_session_messages (session_id)
);
```

| Column | Type | Description |
|--------|------|-------------|
| id | CHAR(36) | UUID primary key |
| session_id | CHAR(36) | Foreign key to session |
| role | ENUM | Message author role |
| content | TEXT | Message text content |
| generated_image_id | CHAR(36) | Associated generated image (if any) |

---

## Conventions

### UUID Primary Keys

All tables use UUID (v4) primary keys stored as `CHAR(36)`.

This provides:

- Global uniqueness without coordination
- No sequential ID enumeration attacks
- Safe for distributed systems

**Generation:**

```typescript
import { v4 as uuid } from 'uuid';
const id = uuid();  // e.g., "550e8400-e29b-41d4-a716-446655440000"
```

### Soft Deletes

Most tables include a `deleted_at` column for soft deletes:

```sql
deleted_at TIMESTAMP NULL DEFAULT NULL
```

**Behavior:**

- `NULL` = record is active
- Timestamp = record is soft-deleted at that time
- All queries must include `WHERE deleted_at IS NULL` unless explicitly recovering

**Utility Functions:**

```typescript
// Add to query
query.whereNull('deleted_at');

// Soft delete
await db(table).where({ id }).update({ deleted_at: db.fn.now() });

// Restore
await db(table).where({ id }).update({ deleted_at: null });

// Permanent delete (run as scheduled job)
await db(table)
  .whereNotNull('deleted_at')
  .where('deleted_at', '<', thirtyDaysAgo)
  .delete();
```

### Sequence Numbering Strategy

Ordered items (acts, scenes, shots) use `sequence_number` with gaps for efficient insertion.

**Default Gap:** 1000

**Example:**
```
Act 1: sequence_number = 1000
Act 2: sequence_number = 2000
Act 3: sequence_number = 3000

Insert between Act 1 and Act 2:
New Act: sequence_number = 1500

Insert between Act 1 and New Act:
Another Act: sequence_number = 1250
```

**Renumbering:**

When the gap between items becomes too small (< 1), renumber all items in the container:

```typescript
const SEQUENCE_GAP = 1000;

function renumber(items: { id: string; sequence_number: number }[]): Map<string, number> {
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
```

### Timestamps

All tables include:

```sql
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

- `created_at` is set once on insert
- `updated_at` automatically updates on any modification

### JSON Columns

JSON columns (e.g., `shots.annotations`, `art_styles.technical_terms`) store structured data:

```sql
annotations JSON,
technical_terms JSON
```

**Validation:** JSON schema validated at application layer before storage.

**Querying:** Use MySQL JSON functions:

```sql
-- Extract value
SELECT JSON_EXTRACT(annotations, '$.version') FROM shots;

-- Search within JSON
SELECT * FROM shots WHERE JSON_CONTAINS(annotations, '"arrow"', '$.elements[*].type');
```

---

## Indexes

### Primary Indexes

Every table has a primary key index on `id`.

### Foreign Key Indexes

Foreign key columns have indexes for efficient joins:

```sql
INDEX idx_user_projects (user_id)
INDEX idx_project_characters (project_id)
INDEX idx_character_variants (character_id)
INDEX idx_act_scenes (act_id)
INDEX idx_scene_shots (scene_id)
```

### Soft Delete Indexes

Tables with soft deletes have an index for filtering active records:

```sql
INDEX idx_deleted (deleted_at)
```

### Sequence Indexes

Ordered items have composite indexes for efficient ordering:

```sql
INDEX idx_sequence (project_id, sequence_number)  -- acts
INDEX idx_sequence (act_id, sequence_number)      -- scenes
INDEX idx_sequence (scene_id, sequence_number)    -- shots
```

### Unique Constraints

```sql
-- Users
UNIQUE KEY (email)

-- User API Keys
UNIQUE KEY unique_user_provider (user_id, provider)

-- Projects
UNIQUE KEY (share_token)

-- Art Styles (one per project)
UNIQUE KEY (project_id)

-- Junction tables (prevent duplicates)
UNIQUE KEY unique_shot_character (shot_id, character_id)
UNIQUE KEY unique_shot_prop (shot_id, prop_id)
```

---

## Annotations Schema

The `shots.annotations` column stores a JSON structure for vector annotations overlaid on generated images:

```typescript
interface AnnotationLayer {
  version: 1;
  elements: AnnotationElement[];
}

type AnnotationElement = ArrowAnnotation | TextBoxAnnotation | SymbolAnnotation;

interface BaseAnnotation {
  id: string;           // UUID
  type: string;         // Discriminator
  x: number;            // 0-100 (percentage of image width)
  y: number;            // 0-100 (percentage of image height)
  rotation: number;     // Degrees
  zIndex: number;       // Stacking order
}

interface ArrowAnnotation extends BaseAnnotation {
  type: 'arrow';
  endX: number;
  endY: number;
  color: string;        // Hex color
  strokeWidth: number;
  arrowStyle: 'single' | 'double' | 'curved';
  label?: string;
}

interface TextBoxAnnotation extends BaseAnnotation {
  type: 'textBox';
  width: number;
  height: number;
  content: string;
  fontSize: number;
  fontColor: string;
  backgroundColor: string;
  borderColor: string;
}

interface SymbolAnnotation extends BaseAnnotation {
  type: 'symbol';
  symbol: 'camera_push' | 'camera_pull' | 'camera_pan_left' | 'camera_pan_right' |
          'camera_tilt_up' | 'camera_tilt_down' | 'camera_crane_up' | 'camera_crane_down' |
          'character_move' | 'character_enter' | 'character_exit' |
          'focus_point' | 'eyeline';
  scale: number;
  color: string;
}
```

**Example:**

```json
{
  "version": 1,
  "elements": [
    {
      "id": "a1b2c3d4",
      "type": "arrow",
      "x": 20,
      "y": 50,
      "endX": 60,
      "endY": 50,
      "rotation": 0,
      "zIndex": 1,
      "color": "#ef4444",
      "strokeWidth": 3,
      "arrowStyle": "single",
      "label": "Character moves"
    },
    {
      "id": "e5f6g7h8",
      "type": "symbol",
      "x": 80,
      "y": 30,
      "rotation": 0,
      "zIndex": 2,
      "symbol": "camera_push",
      "scale": 1.5,
      "color": "#3b82f6"
    }
  ]
}
```
