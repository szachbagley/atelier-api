# Architecture

This document describes the system architecture, core concepts, and data flow for Atelier.

## System Overview

Atelier is a web application with a React frontend and Node.js backend, deployed on AWS infrastructure.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    AWS Cloud                                         │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                              VPC (10.0.0.0/16)                               │    │
│  │                                                                              │    │
│  │  ┌─────────────────────────────┐    ┌─────────────────────────────┐         │    │
│  │  │   Public Subnet A (AZ-a)    │    │   Public Subnet B (AZ-b)    │         │    │
│  │  │       10.0.1.0/24           │    │       10.0.2.0/24           │         │    │
│  │  │                             │    │                             │         │    │
│  │  │  ┌─────────────────────┐    │    │    ┌─────────────────────┐  │         │    │
│  │  │  │    NAT Gateway      │    │    │    │    NAT Gateway      │  │         │    │
│  │  │  └─────────────────────┘    │    │    └─────────────────────┘  │         │    │
│  │  └─────────────────────────────┘    └─────────────────────────────┘         │    │
│  │                                                                              │    │
│  │  ┌─────────────────────────────┐    ┌─────────────────────────────┐         │    │
│  │  │   Private Subnet A (AZ-a)   │    │   Private Subnet B (AZ-b)   │         │    │
│  │  │       10.0.10.0/24          │    │       10.0.20.0/24          │         │    │
│  │  │                             │    │                             │         │    │
│  │  │  ┌───────────────────────┐  │    │  ┌───────────────────────┐  │         │    │
│  │  │  │  ECS Fargate Tasks    │  │    │  │  ECS Fargate Tasks    │  │         │    │
│  │  │  │  - Frontend           │  │    │  │  - Frontend           │  │         │    │
│  │  │  │  - Backend            │  │    │  │  - Backend            │  │         │    │
│  │  │  └───────────────────────┘  │    │  └───────────────────────┘  │         │    │
│  │  └─────────────────────────────┘    └─────────────────────────────┘         │    │
│  │                                                                              │    │
│  │  ┌─────────────────────────────┐    ┌─────────────────────────────┐         │    │
│  │  │   Data Subnet A (AZ-a)      │    │   Data Subnet B (AZ-b)      │         │    │
│  │  │       10.0.100.0/24         │    │       10.0.200.0/24         │         │    │
│  │  │                             │    │                             │         │    │
│  │  │  ┌───────────────────────┐  │    │  ┌───────────────────────┐  │         │    │
│  │  │  │   EC2 MySQL (MVP)     │  │    │  │   (Reserved for       │  │         │    │
│  │  │  │                       │  │    │  │    future RDS)         │  │         │    │
│  │  │  └───────────────────────┘  │    │  └───────────────────────┘  │         │    │
│  │  └─────────────────────────────┘    └─────────────────────────────┘         │    │
│  │                                                                              │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐     │
│  │     ALB      │  │      S3      │  │     ECR      │  │   Secrets Manager    │     │
│  │              │  │              │  │              │  │                      │     │
│  │ - HTTPS      │  │ - Images     │  │ - Frontend   │  │ - DB credentials     │     │
│  │ - Routing    │  │ - Uploads    │  │ - Backend    │  │ - JWT secrets        │     │
│  │              │  │ - Thumbnails │  │              │  │ - Encryption keys    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────────────┘     │
│                                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                               │
│  │ CloudWatch   │  │    Route53   │  │     ACM      │                               │
│  │              │  │              │  │              │                               │
│  │ - Logs       │  │ - DNS        │  │ - SSL Certs  │                               │
│  │ - Metrics    │  │              │  │              │                               │
│  │ - Alarms     │  │              │  │              │                               │
│  └──────────────┘  └──────────────┘  └──────────────┘                               │
│                                                                                      │
│  ┌───────────────────────────────────────────────────────────────────────────────┐  │
│  │                         Google Gemini API (Imagen)                             │  │
│  │                                                                                │  │
│  │   - Image generation from text prompts                                         │  │
│  │   - Uses user-provided API keys                                                │  │
│  └───────────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Request Flow

```
User Request
     │
     ▼
┌─────────────┐
│  Route 53   │  DNS: atelier.app → ALB
└─────────────┘
     │
     ▼
┌─────────────┐
│     ALB     │  SSL termination, path-based routing
└─────────────┘
     │
     ├── /* ──────────────────────► Frontend Service (serves React app)
     │
     └── /api/* ──────────────────► Backend Service (Express API)
                                          │
                                          ├──► MySQL (EC2)
                                          ├──► S3 (images)
                                          └──► External APIs (Gemini)
```

---

## Core Concepts

### Projects

A project is the top-level container for all work in Atelier. Each project represents a single film, short, or video production and contains:

- One **Art Style** definition (visual style applied to all generated images)
- A **Component Library** (characters, settings, props, lighting setups)
- One **Storyboard** (hierarchical structure of acts, scenes, and shots)

Projects are owned by a single user and can optionally be shared via a public link for read-only viewing.

### Component Library

The component library is a collection of reusable visual elements that can be referenced across multiple shots. Each component has:

- Human-readable attributes (name, description, reference images)
- An **AI Description** optimized for image generation prompts

Components are created through either:
1. **Concept Art Flow**: Generate images with AI, iterate through conversation, then extract a description from the final image
2. **Manual Entry**: Write descriptions directly without generating concept art

#### Characters

Characters represent people or beings in the story. Each character has:

- Physical description
- AI description (optimized for image generation)
- **Variants** — alternate appearances for the same character (e.g., "Business Formal", "Casual Weekend", "Disguise")

#### Settings

Settings represent locations and environments. Each setting has:

- Description and set dressing
- Time of day (dawn, morning, midday, afternoon, dusk, night)
- Weather (clear, cloudy, rain, snow, fog, storm)
- Lighting notes
- Mood

#### Props

Props represent objects that characters interact with. Each prop has:

- Description
- `handled_by` field (notes on which character typically uses this prop)

#### Lighting Setups

Lighting setups define the lighting conditions for a scene. Each setup has:

- Description
- Mood

### Art Style

Each project has one art style that applies to all generated images. The art style defines the visual rendering approach (e.g., "Neo-noir with high contrast and desaturated colors").

### Storyboard Structure

Storyboards use a three-level hierarchy that mirrors professional film production:

#### Acts

Acts are the highest organizational level, representing major story divisions.

#### Scenes

Scenes represent continuous action in a single location. They have:

- Title
- Default setting (inherited by shots unless overridden)
- Default lighting (inherited by shots unless overridden)

#### Shots

Shots are the core unit of the storyboard. Each shot represents a single camera setup and includes:

- **Description**: Free-form text describing the action
- **Shot Type**: Camera framing (wide shot, close-up, etc.)
- **Camera Angle**: Perspective (eye level, low angle, etc.)
- **Camera Movement**: How the camera moves (static, pan, dolly, etc.)
- **Components**: Selected characters (with positioning), setting, lighting, props
- **Generated Image**: AI-generated visualization of the shot
- **Annotations**: Arrows, text boxes, and symbols overlaid on the image
- **Caption**: Text description for export/reference

---

## Data Flow

### User Journey: Concept Art Phase

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Concept Art Workflow                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

1. User creates new character
           │
           ▼
2. User enters basic info (name, physical description)
           │
           ▼
3. User opens Concept Art chat
           │
           ▼
4. User describes what they want to visualize
           │
           ▼
     ┌─────────────────────────────────────────────────────────────┐
     │                    Concept Art Session                       │
     │                                                              │
     │  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐ │
     │  │ User prompt  │ ──► │   Backend    │ ──► │   Gemini     │ │
     │  │              │     │   compiles   │     │   generates  │ │
     │  │              │     │   prompt     │     │   image      │ │
     │  └──────────────┘     └──────────────┘     └──────────────┘ │
     │         ▲                                         │         │
     │         │                                         ▼         │
     │         │              ┌──────────────────────────────────┐ │
     │         │              │  Image displayed to user         │ │
     │         │              └──────────────────────────────────┘ │
     │         │                                         │         │
     │         └──── User provides feedback ◄────────────┘         │
     │                    (iterate until satisfied)                │
     └─────────────────────────────────────────────────────────────┘
           │
           ▼
5. User clicks "Generate Description"
           │
           ▼
6. LLM analyzes final image and generates AI description
           │
           ▼
7. User reviews and edits description
           │
           ▼
8. Character saved with AI description ready for storyboarding
```

### User Journey: Storyboarding Phase

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Storyboarding Workflow                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

1. User creates Act → Scene → Shot structure
           │
           ▼
2. User opens shot editor
           │
           ▼
3. User composes shot:
   ┌─────────────────────────────────────────────────────────────────┐
   │                                                                  │
   │  • Select characters (with variants and positioning)            │
   │  • Select or inherit setting                                    │
   │  • Select or inherit lighting                                   │
   │  • Select props                                                 │
   │  • Choose shot type and camera angle                            │
   │  • Write free-form description of action                        │
   │                                                                  │
   └─────────────────────────────────────────────────────────────────┘
           │
           ▼
4. User clicks "Preview Prompt"
           │
           ▼
     ┌─────────────────────────────────────────────────────────────┐
     │                    Prompt Compilation                        │
     │                                                              │
     │   Shot Data ──────────┐                                     │
     │   Character AI Desc ──┤                                     │
     │   Setting AI Desc ────┼──► Prompt Compiler ──► Text Prompt  │
     │   Lighting AI Desc ───┤                                     │
     │   Art Style AI Desc ──┘                                     │
     │                                                              │
     └─────────────────────────────────────────────────────────────┘
           │
           ▼
5. User reviews compiled prompt (can edit directly)
           │
           ▼
6. User clicks "Generate"
           │
           ▼
     ┌─────────────────────────────────────────────────────────────┐
     │                    Image Generation                          │
     │                                                              │
     │  Prompt ──► Gemini API ──► Image ──► S3 ──► Database        │
     │                                                              │
     └─────────────────────────────────────────────────────────────┘
           │
           ▼
7. Generated image displayed in shot editor
           │
           ▼
8. User can:
   ┌─────────────────────────────────────────────────────────────────┐
   │                                                                  │
   │  • Iterate via chat ("make the lighting warmer")                │
   │  • Revert to previous image                                     │
   │  • Add annotations (arrows, text, symbols)                      │
   │  • Write caption                                                │
   │  • Move to next shot                                            │
   │                                                                  │
   └─────────────────────────────────────────────────────────────────┘
```

### Prompt Compilation Pipeline

The prompt compiler transforms structured shot data into optimized text prompts for image generation.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Prompt Compilation                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────────────────┐
                    │           Input Data                │
                    │                                     │
                    │  • Shot description                 │
                    │  • Shot type (MS, CU, etc.)         │
                    │  • Camera angle                     │
                    │  • Selected characters + positions  │
                    │  • Setting (or inherited)           │
                    │  • Lighting (or inherited)          │
                    │  • Props                            │
                    │  • Art style                        │
                    │                                     │
                    └─────────────────────────────────────┘
                                     │
                                     ▼
                    ┌─────────────────────────────────────┐
                    │         Section Builders            │
                    │                                     │
                    │  buildFramingSection()              │
                    │  buildCharactersSection()           │
                    │  buildPropsSection()                │
                    │  buildSettingSection()              │
                    │  buildLightingSection()             │
                    │  buildDescriptionSection()          │
                    │  buildStyleSection()                │
                    │  buildQualitySection()              │
                    │                                     │
                    └─────────────────────────────────────┘
                                     │
                                     ▼
                    ┌─────────────────────────────────────┐
                    │       Provider Adapter              │
                    │                                     │
                    │  GeminiPromptCompiler               │
                    │  - Assembles sections in optimal    │
                    │    order for Gemini                 │
                    │  - Adds Gemini-specific quality     │
                    │    boosters                         │
                    │  - Formats as natural prose         │
                    │                                     │
                    └─────────────────────────────────────┘
                                     │
                                     ▼
                    ┌─────────────────────────────────────┐
                    │           Output                    │
                    │                                     │
                    │  {                                  │
                    │    prompt: "Medium shot showing...",│
                    │    sections: [...],                 │
                    │    warnings: [...],                 │
                    │    error: null                      │
                    │  }                                  │
                    │                                     │
                    └─────────────────────────────────────┘
```

#### Prompt Structure

The compiled prompt follows this general structure:

```
[Shot Type + Camera Angle] +
[User's Shot Description] +
[Characters with Positions] +
[Props] +
[Setting + Environment] +
[Lighting] +
[Art Style] +
[Quality Boosters]
```

Example compiled prompt:

```
Medium shot showing figure from waist up, eye-level camera angle. Sarah 
confronts Marcus about the missing documents, featuring a professional 
woman in her 30s with sharp features and determined expression wearing a 
tailored charcoal blazer and white blouse with hair pulled back severely 
(in foreground, left of center); a tall man in his 40s with graying 
temples and an evasive demeanor in a rumpled expensive suit (right of 
center), with worn manila folder stuffed with papers. Set in a modern 
corporate office with glass walls, contemporary furniture, and city skyline 
visible through floor-to-ceiling windows. Overhead fluorescent lighting 
casting unflattering shadows, clinical and unforgiving. Rendered in neo-noir 
style with high contrast, desaturated colors with selective color pops, 
deep dramatic shadows. Highly detailed, professional cinematography, 
cinematic composition, dramatic lighting.
```

---

## External Integrations

### Google Gemini (Imagen)

Atelier uses Google's Gemini API for image generation.

**Integration Points:**
- Concept art generation during component creation
- Storyboard frame generation from compiled prompts

**Authentication:**
- Users provide their own Gemini API keys
- Keys are encrypted at rest using AES-256-GCM
- Keys are decrypted only when making API calls

**Error Handling:**
- Invalid/expired keys surface user-friendly error with link to settings
- Rate limiting detected and communicated to user
- Content filtering blocks communicated with prompt adjustment suggestions

**Future Providers:**
The prompt compiler architecture supports multiple providers. Adding a new provider requires:
1. Creating a new `PromptCompiler` adapter
2. Adding provider-specific error mapping
3. Updating the API key management UI

### AWS Services

#### S3

Used for all image storage:

```
atelier-{env}/
├── projects/
│   └── {projectId}/
│       ├── generated/      # AI-generated images
│       │   └── {imageId}.png
│       ├── references/     # User-uploaded reference images
│       │   └── {imageId}.{ext}
│       └── thumbnails/     # Auto-generated thumbnails
│           └── {imageId}_thumb.webp
```

**Access Pattern:**
- All images accessed via presigned URLs (1-hour expiry)
- User uploads use presigned upload URLs (15-minute expiry)
- Thumbnails generated server-side on image creation

#### Secrets Manager

Stores all application secrets:

| Secret | Purpose |
|--------|---------|
| `atelier/prod/db-root-password` | MySQL root access |
| `atelier/prod/db-app-password` | Application database user |
| `atelier/prod/jwt-access-secret` | Access token signing |
| `atelier/prod/jwt-refresh-secret` | Refresh token signing |
| `atelier/prod/encryption-key` | User API key encryption |

**Access:**
- ECS tasks access secrets via IAM roles
- Secrets injected as environment variables at container startup

---

## Design Decisions

### Why Separate AI Descriptions?

Each component has both human-readable attributes and an `aiDescription` field. This separation exists because:

1. **Optimization**: AI image generators respond best to specific phrasing and terminology. The AI description can be tuned for the target model.

2. **Stability**: Human-readable fields can change without affecting prompt consistency. The AI description is the "contract" for visual appearance.

3. **Transparency**: Users can see and edit exactly what will be sent to the image generator.

### Why Compile Prompts Server-Side?

Prompt compilation happens on the backend rather than frontend because:

1. **Security**: API keys never touch the frontend
2. **Consistency**: All clients get identical prompt compilation
3. **Auditability**: Compiled prompts stored in database for debugging
4. **Extensibility**: Provider adapters can be added without frontend changes

### Why Hierarchical Storyboard Structure?

The Act → Scene → Shot hierarchy mirrors professional film production because:

1. **Familiarity**: Filmmakers already think in these terms
2. **Inheritance**: Scene-level defaults reduce repetitive component selection
3. **Organization**: Large projects (500+ shots) need logical grouping
4. **Export**: Maps cleanly to traditional storyboard sheet formats

### Why Bring-Your-Own API Key?

Users provide their own Gemini API keys rather than Atelier proxying through a single key because:

1. **Cost**: No usage-based billing complexity for Atelier
2. **Limits**: Users control their own rate limits and quotas
3. **Privacy**: User prompts go directly to Google, not stored by Atelier
4. **Flexibility**: Users can use enterprise accounts or special access tiers
