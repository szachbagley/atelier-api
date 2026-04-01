# Deferred Features

This document describes features that are explicitly deferred from the MVP release, along with rationale and implementation notes for future development.

## Overview

These features were considered during planning but deferred to keep the MVP focused and achievable. They are organized by category and priority.

### Priority Levels

| Priority | Meaning | Timeline |
|----------|---------|----------|
| **P1** | High value, implement soon after MVP | 1-3 months post-launch |
| **P2** | Medium value, implement based on user feedback | 3-6 months post-launch |
| **P3** | Nice to have, implement if resources allow | 6-12 months post-launch |
| **P4** | Long-term vision | 12+ months |

---

## AI & Image Generation

### 1. Multiple AI Image Generation Providers

**Priority:** P1

**Current State:** MVP supports Google Gemini (Imagen) only.

**Deferred Feature:** Support multiple providers:
- OpenAI DALL-E 3
- Stability AI (Stable Diffusion)
- Midjourney (when API available)
- Local models (ComfyUI integration)

**Rationale for Deferral:**
- Gemini provides sufficient quality for MVP
- Prompt compiler already has adapter architecture ready
- Each provider requires unique prompt optimization

**Implementation Notes:**
- Create new `PromptCompiler` adapter per provider (base class already exists)
- Add provider selection to user settings and per-project override
- Update `user_api_keys` table (already supports provider ENUM)
- Provider-specific error mapping (pattern exists in `errorMapper.ts`)

---

### 2. Negative Prompts

**Priority:** P2

**Current State:** Prompts are positive-only.

**Deferred Feature:** Provider-specific "avoid" terms at the art style level:
- Art style gains a `negative_prompt` field
- Providers that support it (Stable Diffusion) include it in API calls
- Providers that don't (Gemini) ignore it gracefully

**Rationale for Deferral:**
- Gemini doesn't use negative prompts
- More relevant when multiple providers are supported

**Database Changes:**
```sql
ALTER TABLE art_styles ADD COLUMN negative_prompt TEXT;
```

---

### 3. Image-to-Image Generation

**Priority:** P2

**Current State:** Text-to-image only.

**Deferred Feature:** Use existing images as starting points:
- Style transfer from reference images
- Iterative refinement of generated images
- Character consistency via reference images

**Rationale for Deferral:**
- Requires significant prompt engineering research
- Provider support varies
- MVP focuses on text-based workflow

**Implementation Notes:**
- Store reference image IDs with generation requests
- Add image upload to generation flow
- Implement image preprocessing (resize, format)

---

### 4. Batch Generation

**Priority:** P3

**Current State:** One shot generated at a time.

**Deferred Feature:** Generate multiple shots in parallel or sequence:
- Queue-based batch processing
- Progress tracking UI
- Cost estimation before batch start
- Cancellation support

**Rationale for Deferral:**
- API rate limits make this complex
- Cost management needed
- Single generation sufficient for MVP

---

## Storyboard Features

### 5. Multiple Storyboards Per Project

**Priority:** P2

**Current State:** One storyboard per project (implicit — acts belong directly to project).

**Deferred Feature:** Create multiple storyboards within a project:
- Alternative versions
- A/B plot separation
- Storyboard templates

**Rationale for Deferral:**
- Single storyboard covers most use cases
- Adds UI complexity
- Component library already shared at project level

**Database Changes:**
```sql
CREATE TABLE storyboards (
  id CHAR(36) PRIMARY KEY,
  project_id CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Modify acts to reference storyboard instead of project
ALTER TABLE acts ADD COLUMN storyboard_id CHAR(36);
```

---

### 6. Full Version History

**Priority:** P2

**Current State:** Single revert (one previous image saved per shot).

**Deferred Feature:** Complete version history:
- Unlimited history depth
- Version comparison view
- Restore any previous version
- Version annotations/notes

**Rationale for Deferral:**
- Storage costs increase significantly
- UI complexity for version browsing
- Single revert covers most "oops" cases

**Database Changes:**
```sql
CREATE TABLE shot_versions (
  id CHAR(36) PRIMARY KEY,
  shot_id CHAR(36) NOT NULL,
  version_number INT NOT NULL,
  generated_image_id CHAR(36),
  compiled_prompt TEXT,
  edited_prompt TEXT,
  annotations JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shot_id) REFERENCES shots(id)
);
```

---

### 7. Act/Scene Metadata

**Priority:** P3

**Current State:** Acts and scenes have only titles.

**Deferred Feature:** Rich metadata for acts and scenes:
- Descriptions and notes
- Duration estimates
- Color coding / tags
- Scene breakdowns (INT/EXT, DAY/NIGHT)

**Database Changes:**
```sql
ALTER TABLE acts ADD COLUMN description TEXT;
ALTER TABLE acts ADD COLUMN notes TEXT;

ALTER TABLE scenes ADD COLUMN description TEXT;
ALTER TABLE scenes ADD COLUMN notes TEXT;
ALTER TABLE scenes ADD COLUMN location_type ENUM('INT', 'EXT', 'INT/EXT');
ALTER TABLE scenes ADD COLUMN time_context VARCHAR(100);
ALTER TABLE scenes ADD COLUMN estimated_duration_seconds INT;
```

---

### 8. Character Blocking/Relationships

**Priority:** P3

**Current State:** Characters listed per shot without structured positioning data beyond what's in the prompt.

**Deferred Feature:** Structured character positioning:
- Position on horizontal axis (left, center-left, center, center-right, right)
- Depth (foreground, midground, background)
- Facing direction
- Interaction targets ("looking at", "reaching toward")

**Database Changes:**
```sql
ALTER TABLE shot_characters ADD COLUMN position_horizontal ENUM('left', 'center_left', 'center', 'center_right', 'right') DEFAULT 'center';
ALTER TABLE shot_characters ADD COLUMN position_depth ENUM('foreground', 'midground', 'background') DEFAULT 'midground';
ALTER TABLE shot_characters ADD COLUMN facing ENUM('left', 'right', 'camera', 'away');
ALTER TABLE shot_characters ADD COLUMN interacting_with CHAR(36);
```

---

## Export & Sharing

### 9. PDF Export

**Priority:** P1

**Current State:** Share link only (read-only web view).

**Deferred Feature:** Export storyboard as PDF:
- Industry-standard storyboard layout
- Configurable shots per page (1, 2, 4, 6)
- Include/exclude annotations
- Include/exclude captions
- Custom cover page

**Rationale for Deferral:**
- Share link provides immediate value
- PDF generation adds complexity
- Requires careful layout design

**Implementation Notes:**
- Use Puppeteer or similar for PDF generation
- Template system for different layouts
- Background job for large storyboards
- S3 storage for generated PDFs

---

### 10. Video Animatic Export

**Priority:** P2

**Current State:** No video export.

**Deferred Feature:** Export as video animatic:
- Configurable duration per shot
- Transitions between shots
- Background music track
- Voiceover track
- Pan/zoom on static images (Ken Burns effect)

**Rationale for Deferral:**
- Complex video processing required
- Many third-party tools exist for this
- High compute costs

**Implementation Notes:**
- FFmpeg for video generation
- WebM/MP4 output formats
- Async job processing
- Consider cloud video API (e.g., Creatomate)

---

### 11. Image Sequence Export

**Priority:** P2

**Current State:** No bulk image download.

**Deferred Feature:** Download all images as ZIP:
- Sequential naming
- With/without annotations burned in
- Multiple resolution options
- Metadata sidecar files

**Rationale for Deferral:**
- Individual images accessible via share link
- ZIP generation straightforward but adds backend work
- Lower priority than PDF

---

### 12. Real-Time Collaboration

**Priority:** P4

**Current State:** Single user per project.

**Deferred Feature:** Multiple users editing simultaneously:
- Shared project access with roles (owner, editor, viewer)
- Real-time cursor presence
- Conflict resolution
- Activity feed

**Rationale for Deferral:**
- Significant architecture changes required
- WebSocket infrastructure needed
- Complex conflict resolution
- MVP validates core concept first

**Implementation Notes:**
- WebSocket server (Socket.io or native)
- Operational transformation or CRDT for conflict resolution
- Redis for presence/pub-sub
- Permission system redesign

**Database Changes:**
```sql
CREATE TABLE project_members (
  id CHAR(36) PRIMARY KEY,
  project_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  role ENUM('owner', 'editor', 'viewer') NOT NULL,
  invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP,
  UNIQUE KEY (project_id, user_id)
);

CREATE TABLE project_activity (
  id CHAR(36) PRIMARY KEY,
  project_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  action VARCHAR(50) NOT NULL,
  target_type VARCHAR(50),
  target_id CHAR(36),
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Component Library

### 13. Cross-Project Component Sharing

**Priority:** P3

**Current State:** Components are project-scoped.

**Deferred Feature:** Share components across projects:
- Global user component library
- Import components from other projects
- Component templates/presets
- Community component sharing (future)

**Rationale for Deferral:**
- Project-scoped components simpler to implement
- Avoids complex ownership questions
- Most users work on one project at a time initially

---

### 14. Batch Component Operations

**Priority:** P3

**Current State:** Components modified one at a time.

**Deferred Feature:** Bulk operations on components:
- Apply lighting to multiple shots
- Replace character across all shots
- Bulk description regeneration
- Find and replace in descriptions

**Rationale for Deferral:**
- Individual edits sufficient for MVP
- Complex UI for selection/preview
- Risk of unintended changes

---

## Annotation Features

### 15. Free-Draw Annotation

**Priority:** P2

**Current State:** Predefined annotation tools (arrows, text boxes, symbols).

**Deferred Feature:** Freehand drawing on frames:
- Brush tool with size/color
- Eraser
- Shape tools (rectangle, circle, line)
- Pen pressure support (tablets)

**Rationale for Deferral:**
- Predefined tools cover common storyboard use cases
- Freehand drawing increases data storage
- Complex touch/stylus handling

**Implementation Notes:**
- Extend Fabric.js implementation
- Vector path storage (SVG paths)
- Compression for complex drawings

---

### 16. Annotation Templates

**Priority:** P3

**Current State:** Annotations created from scratch each time.

**Deferred Feature:** Save and reuse annotation arrangements:
- Save current annotations as template
- Apply template to other shots
- System-provided templates (camera movement presets)

**Rationale for Deferral:**
- Copy/paste would solve most cases
- Lower priority than core features
- Template management adds UI complexity

---

## User Experience

### 17. Keyboard Shortcuts

**Priority:** P2

**Current State:** Mouse/touch only.

**Deferred Feature:** Comprehensive keyboard shortcuts:
- Navigation (next/prev shot, scene, act)
- Tools (select, arrow, text, symbols)
- Actions (generate, save, undo)
- Customizable bindings

**Rationale for Deferral:**
- Mouse interface functional for MVP
- Shortcut system requires global handling
- Documentation needed

**Implementation Notes:**
```typescript
const defaultShortcuts = {
  navigation: {
    nextShot: 'ArrowRight',
    prevShot: 'ArrowLeft',
    nextScene: 'Ctrl+ArrowRight',
    prevScene: 'Ctrl+ArrowLeft',
  },
  tools: {
    select: 'v',
    arrow: 'a',
    text: 't',
    symbol: 's',
  },
  actions: {
    generate: 'Ctrl+Enter',
    save: 'Ctrl+s',
    undo: 'Ctrl+z',
    redo: 'Ctrl+Shift+z',
  },
};
```

---

### 18. Onboarding & Tutorials

**Priority:** P2

**Current State:** No guided onboarding.

**Deferred Feature:** Interactive onboarding:
- First-project wizard
- Feature tooltips
- Sample project with data
- Video tutorials
- Contextual help

**Rationale for Deferral:**
- Core functionality needs validation first
- Onboarding best designed after user feedback
- Sample data requires curation

---

### 19. Dark Mode

**Priority:** P3

**Current State:** Light mode only.

**Deferred Feature:** Dark mode theme that preserves the same editorial minimalism aesthetic as the default light mode:
- Dark charcoal backgrounds (not pure black)
- Maintain the warm/cool color distinction
- Keep accent colors recognizable but adjusted for dark backgrounds
- System preference detection
- Manual toggle
- Ensure equivalent contrast ratios
- Canvas background handling for annotation visibility

**Rationale for Deferral:**
- Light mode sufficient for launch
- Tailwind makes implementation straightforward when ready
- Canvas theming needs careful design

**Implementation Notes:**
- Use Tailwind dark mode classes
- CSS custom properties for dynamic values
- Test all UI components in both modes

```css
[data-theme="dark"] {
  --color-bg-primary: #1E1E1C;
  --color-bg-secondary: #2A2A28;
  --color-bg-tertiary: #363632;
  --color-text-primary: #F5F1E8;
  --color-text-secondary: #B8B4AA;
  --color-text-tertiary: #8A8680;
}
```

---

## Infrastructure

### 20. RDS MySQL (Managed Database)

**Priority:** P1

**Current State:** Self-managed MySQL on EC2 t3.micro.

**Deferred Feature:** Migrate to Amazon RDS:
- Automated backups
- Point-in-time recovery
- Multi-AZ deployment
- Automated patching
- Performance Insights

**Rationale for Deferral:**
- Cost (~$30-50/month additional)
- EC2 sufficient for MVP scale
- Manual backups acceptable initially

**Migration Plan:**
1. Create RDS instance
2. Set up replication from EC2
3. Test application with RDS endpoint
4. Switch connection string in Secrets Manager
5. Verify functionality
6. Decommission EC2 database

---

### 21. NAT Gateway (Private Subnets for Fargate)

**Priority:** P2

**Current State:** Fargate tasks in public subnets with public IPs.

**Deferred Feature:** Move Fargate to private subnets:
- NAT Gateway for outbound internet access
- Better network isolation
- No public IPs on containers

**Rationale for Deferral:**
- Cost (~$32/month + data processing)
- Public subnet with security groups is secure enough for MVP
- Reduces MVP complexity

---

### 22. CloudFront CDN

**Priority:** P2

**Current State:** S3 images served directly via presigned URLs.

**Deferred Feature:** CloudFront distribution:
- Edge caching for images
- Lower latency globally
- Reduced S3 request costs
- Custom domain for assets
- Signed URLs for security

**Rationale for Deferral:**
- Presigned URLs work for MVP
- Most users likely in same region initially

---

### 23. Multi-Region Deployment

**Priority:** P4

**Current State:** Single region (us-west-2).

**Deferred Feature:** Deploy to multiple AWS regions:
- Lower latency for global users
- Disaster recovery
- Data residency compliance

**Rationale for Deferral:**
- Significant cost increase
- Complex data synchronization
- MVP focuses on core market

---

### 24. Auto-Scaling

**Priority:** P2

**Current State:** Fixed single task per service.

**Deferred Feature:** Automatic scaling based on demand:
- CPU/memory-based scaling
- Request count scaling
- Scheduled scaling
- Scale-to-zero for cost savings

**Rationale for Deferral:**
- Fixed capacity sufficient for MVP
- Scaling adds complexity
- Need usage patterns before configuring

**Implementation Notes:**
```yaml
ScalableTarget:
  ServiceNamespace: ecs
  ScalableDimension: ecs:service:DesiredCount
  MinCapacity: 1
  MaxCapacity: 4

ScalingPolicy:
  PolicyType: TargetTrackingScaling
  TargetTrackingScalingPolicyConfiguration:
    TargetValue: 70
    PredefinedMetricSpecification:
      PredefinedMetricType: ECSServiceAverageCPUUtilization
    ScaleInCooldown: 300
    ScaleOutCooldown: 60
```

---

## Security & Compliance

### 25. Audit Logging

**Priority:** P2

**Current State:** Application logs only (Pino → CloudWatch).

**Deferred Feature:** Structured audit trail:
- Who changed what, when
- Project-level activity log
- Admin dashboard
- Data export for compliance

**Rationale for Deferral:**
- Application logs sufficient for MVP
- Single-user projects reduce audit need
- Adds database write overhead

---

### 26. API Rate Limiting (User-Facing)

**Priority:** P2

**Current State:** Rate limiting only on auth endpoints.

**Deferred Feature:** Per-user rate limits on all API endpoints:
- Tiered limits based on account type
- Rate limit headers in responses
- Configurable per-endpoint limits

**Rationale for Deferral:**
- MVP has very few users
- Auth rate limiting covers the most critical path
- Full rate limiting adds complexity

---

### 27. Two-Factor Authentication

**Priority:** P3

**Current State:** Email/password only.

**Deferred Feature:** 2FA support:
- TOTP (Google Authenticator, Authy)
- Backup codes
- Recovery flow

**Rationale for Deferral:**
- Email/password sufficient for MVP
- 2FA adds UX friction
- Implement based on user security requirements

---

### 28. WAF (Web Application Firewall)

**Priority:** P3

**Current State:** No WAF.

**Deferred Feature:** AWS WAF on ALB:
- SQL injection rules
- XSS rules
- Rate limiting at edge
- Geo-blocking
- Bot detection

**Rationale for Deferral:**
- Application-level security sufficient for MVP
- Cost consideration
- Low traffic doesn't justify edge protection

---

## Monitoring & Analytics

### 29. Usage Analytics

**Priority:** P2

**Current State:** CloudWatch metrics only.

**Deferred Feature:** Product analytics:
- User behavior tracking
- Feature usage metrics
- Conversion funnels
- Session recordings

**Rationale for Deferral:**
- MVP focuses on building, not measuring
- Privacy considerations need evaluation
- Can add analytics tooling later

**Options to Consider:** PostHog (self-hosted), Mixpanel, Amplitude

---

### 30. Enhanced Error Monitoring

**Priority:** P2

**Current State:** CloudWatch logs and basic alarms.

**Deferred Feature:** Advanced error tracking:
- Error aggregation and grouping
- Stack trace analysis
- User impact assessment
- Release tracking
- Slack/email alerts

**Rationale for Deferral:**
- CloudWatch sufficient for MVP
- Third-party tools have costs
- Team size doesn't require sophisticated tooling yet

**Options to Consider:** Sentry, Bugsnag, Rollbar

---

## Summary by Priority

### P1 — Implement Soon After MVP
- 1 — Multiple AI Image Generation Providers
- 9 — PDF Export
- 20 — RDS MySQL (Managed Database)

### P2 — Based on User Feedback
- 2 — Negative Prompts
- 3 — Image-to-Image Generation
- 5 — Multiple Storyboards Per Project
- 6 — Full Version History
- 10 — Video Animatic Export
- 11 — Image Sequence Export
- 15 — Free-Draw Annotation
- 17 — Keyboard Shortcuts
- 18 — Onboarding & Tutorials
- 21 — NAT Gateway
- 22 — CloudFront CDN
- 24 — Auto-Scaling
- 25 — Audit Logging
- 26 — API Rate Limiting
- 29 — Usage Analytics
- 30 — Enhanced Error Monitoring

### P3 — If Resources Allow
- 4 — Batch Generation
- 7 — Act/Scene Metadata
- 8 — Character Blocking/Relationships
- 13 — Cross-Project Component Sharing
- 14 — Batch Component Operations
- 16 — Annotation Templates
- 19 — Dark Mode
- 27 — Two-Factor Authentication
- 28 — WAF

### P4 — Long-Term Vision
- 12 — Real-Time Collaboration
- 23 — Multi-Region Deployment

---

## Feature Request Process

When users request features:

1. **Check this document** — Feature may already be planned
2. **Assess priority** — User impact, effort, alignment with vision
3. **Document** — Add to this file with rationale
4. **Communicate** — Let user know it's being considered
5. **Track** — Link to user feedback for prioritization

### Adding New Deferred Features

Use this template:

```markdown
### [Number]. [Feature Name]

**Priority:** P[1-4]

**Current State:** [What exists now]

**Deferred Feature:** [What would be built]

**Rationale for Deferral:**
- [Reason 1]
- [Reason 2]

**Implementation Notes:**
[Technical details, code snippets, database changes]
```
