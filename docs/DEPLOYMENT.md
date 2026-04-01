# Deployment

This document describes the deployment configuration for Atelier, including Docker setup, CI/CD pipeline, and deployment procedures.

## Docker Configuration

### Backend Dockerfile

```dockerfile
# backend/Dockerfile

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Switch to non-root user
USER nodejs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/server.js"]
```

### Frontend Dockerfile

```dockerfile
# frontend/Dockerfile

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

# Production stage
FROM nginx:alpine AS production

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### Frontend Nginx Configuration

```nginx
# frontend/nginx.conf

worker_processes auto;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1000;
    gzip_proxied any;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;

    server {
        listen 80;
        server_name _;
        root /usr/share/nginx/html;
        index index.html;

        # Security headers
        add_header X-Frame-Options "DENY" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;

        # Cache static assets aggressively
        location ~* \.(js|css)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            try_files $uri =404;
        }

        # Images and fonts
        location ~* \.(ico|gif|jpe?g|png|svg|woff2?|ttf|eot)$ {
            expires 1M;
            add_header Cache-Control "public";
            try_files $uri =404;
        }

        # SPA fallback - serve index.html for all routes
        location / {
            try_files $uri $uri/ /index.html;
            
            # No caching for index.html
            location = /index.html {
                expires -1;
                add_header Cache-Control "no-store, no-cache, must-revalidate";
            }
        }

        # Deny access to hidden files
        location ~ /\. {
            deny all;
            access_log off;
            log_not_found off;
        }
    }
}
```

### Frontend Development Dockerfile

```dockerfile
# frontend/Dockerfile.dev

FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy configuration files
COPY vite.config.ts ./
COPY tsconfig*.json ./
COPY tailwind.config.js ./
COPY postcss.config.js ./
COPY index.html ./

# Source will be mounted as volume
EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
```

---

## Docker Compose

### Local Development

```yaml
# docker-compose.yml

version: '3.8'

services:
  # MySQL Database
  db:
    image: mysql:8.0
    container_name: atelier-db
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: atelier
      MYSQL_USER: atelier
      MYSQL_PASSWORD: localpassword
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
      - ./backend/db/init:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    networks:
      - atelier-network

  # Backend API
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
      target: builder
    container_name: atelier-backend
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: development
      PORT: 3000
      DATABASE_URL: mysql://atelier:localpassword@db:3306/atelier
      JWT_ACCESS_SECRET: dev-access-secret-minimum-32-characters-long
      JWT_REFRESH_SECRET: dev-refresh-secret-minimum-32-characters-long
      ENCRYPTION_KEY: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
      AWS_REGION: us-west-2
      AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
      AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
      S3_BUCKET: atelier-dev
      CORS_ORIGINS: http://localhost:5173
    volumes:
      - ./backend/src:/app/src
      - ./backend/package.json:/app/package.json
    command: npm run dev
    depends_on:
      db:
        condition: service_healthy
    networks:
      - atelier-network

  # Frontend (Vite dev server)
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    container_name: atelier-frontend
    restart: unless-stopped
    ports:
      - "5173:5173"
    environment:
      VITE_API_URL: http://localhost:3000/api
    volumes:
      - ./frontend/src:/app/src
      - ./frontend/public:/app/public
      - ./frontend/index.html:/app/index.html
      - ./frontend/vite.config.ts:/app/vite.config.ts
      - ./frontend/tailwind.config.js:/app/tailwind.config.js
    command: npm run dev -- --host
    networks:
      - atelier-network

volumes:
  mysql_data:

networks:
  atelier-network:
    driver: bridge
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml

name: Deploy to AWS

on:
  push:
    branches:
      - main
  workflow_dispatch:

env:
  AWS_REGION: us-west-2
  ECR_REGISTRY: ${{ secrets.AWS_ACCOUNT_ID }}.dkr.ecr.us-west-2.amazonaws.com
  ECS_CLUSTER: atelier-cluster

jobs:
  # ============================================
  # Test
  # ============================================
  test:
    name: Run Tests
    runs-on: ubuntu-latest
    
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: testpassword
          MYSQL_DATABASE: atelier_test
        ports:
          - 3306:3306
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=5

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: |
            backend/package-lock.json
            frontend/package-lock.json

      - name: Install backend dependencies
        working-directory: ./backend
        run: npm ci

      - name: Run backend linting
        working-directory: ./backend
        run: npm run lint

      - name: Run backend unit tests
        working-directory: ./backend
        run: npm run test
        env:
          DATABASE_URL: mysql://root:testpassword@localhost:3306/atelier_test
          JWT_ACCESS_SECRET: test-access-secret-minimum-32-characters
          JWT_REFRESH_SECRET: test-refresh-secret-minimum-32-characters
          ENCRYPTION_KEY: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

      - name: Run backend integration tests
        working-directory: ./backend
        run: npm run test:integration
        env:
          DATABASE_URL: mysql://root:testpassword@localhost:3306/atelier_test
          JWT_ACCESS_SECRET: test-access-secret-minimum-32-characters
          JWT_REFRESH_SECRET: test-refresh-secret-minimum-32-characters
          ENCRYPTION_KEY: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

      - name: Install frontend dependencies
        working-directory: ./frontend
        run: npm ci

      - name: Run frontend linting
        working-directory: ./frontend
        run: npm run lint

      - name: Run frontend unit tests
        working-directory: ./frontend
        run: npm run test

  # ============================================
  # Build and Deploy
  # ============================================
  deploy:
    name: Build and Deploy
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Run database migrations
        working-directory: ./backend
        run: |
          npm ci
          npm run migrate
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Build and push backend image
        working-directory: ./backend
        run: |
          docker build -t $ECR_REGISTRY/atelier-backend:${{ github.sha }} .
          docker tag $ECR_REGISTRY/atelier-backend:${{ github.sha }} $ECR_REGISTRY/atelier-backend:latest
          docker push $ECR_REGISTRY/atelier-backend:${{ github.sha }}
          docker push $ECR_REGISTRY/atelier-backend:latest

      - name: Build and push frontend image
        working-directory: ./frontend
        run: |
          docker build \
            --build-arg VITE_API_URL=https://atelier.app/api \
            -t $ECR_REGISTRY/atelier-frontend:${{ github.sha }} .
          docker tag $ECR_REGISTRY/atelier-frontend:${{ github.sha }} $ECR_REGISTRY/atelier-frontend:latest
          docker push $ECR_REGISTRY/atelier-frontend:${{ github.sha }}
          docker push $ECR_REGISTRY/atelier-frontend:latest

      - name: Update backend ECS service
        run: |
          aws ecs update-service \
            --cluster $ECS_CLUSTER \
            --service atelier-backend \
            --force-new-deployment

      - name: Update frontend ECS service
        run: |
          aws ecs update-service \
            --cluster $ECS_CLUSTER \
            --service atelier-frontend \
            --force-new-deployment

      - name: Wait for backend deployment
        run: |
          aws ecs wait services-stable \
            --cluster $ECS_CLUSTER \
            --services atelier-backend

      - name: Wait for frontend deployment
        run: |
          aws ecs wait services-stable \
            --cluster $ECS_CLUSTER \
            --services atelier-frontend
```

### GitHub Secrets Required

| Secret | Description |
|--------|-------------|
| `AWS_ACCOUNT_ID` | AWS account ID for ECR registry |
| `AWS_ACCESS_KEY_ID` | CI/CD IAM user access key |
| `AWS_SECRET_ACCESS_KEY` | CI/CD IAM user secret key |
| `DATABASE_URL` | Production database connection string |

---

## Deployment Procedures

### First-Time Setup

```bash
#!/bin/bash
# scripts/initial-setup.sh

set -e

AWS_REGION="us-west-2"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "=== Creating ECR Repositories ==="
aws ecr create-repository --repository-name atelier-backend --region $AWS_REGION
aws ecr create-repository --repository-name atelier-frontend --region $AWS_REGION

echo "=== Logging into ECR ==="
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

echo "=== Building and Pushing Initial Images ==="

# Backend
cd backend
docker build -t atelier-backend .
docker tag atelier-backend:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/atelier-backend:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/atelier-backend:latest
cd ..

# Frontend
cd frontend
docker build --build-arg VITE_API_URL=https://atelier.app/api -t atelier-frontend .
docker tag atelier-frontend:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/atelier-frontend:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/atelier-frontend:latest
cd ..

echo "=== Running Database Migrations ==="
cd backend
npm run migrate
cd ..

echo "=== Initial setup complete ==="
```

### Manual Deployment

```bash
#!/bin/bash
# scripts/deploy.sh

set -e

AWS_REGION="us-west-2"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECS_CLUSTER="atelier-cluster"
IMAGE_TAG="${1:-latest}"

echo "=== Deploying with tag: $IMAGE_TAG ==="

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Run migrations
echo "=== Running Migrations ==="
cd backend
npm run migrate
cd ..

# Build and push backend
echo "=== Building Backend ==="
cd backend
docker build -t atelier-backend .
docker tag atelier-backend:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/atelier-backend:$IMAGE_TAG
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/atelier-backend:$IMAGE_TAG
cd ..

# Build and push frontend
echo "=== Building Frontend ==="
cd frontend
docker build --build-arg VITE_API_URL=https://atelier.app/api -t atelier-frontend .
docker tag atelier-frontend:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/atelier-frontend:$IMAGE_TAG
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/atelier-frontend:$IMAGE_TAG
cd ..

# Update ECS services
echo "=== Updating ECS Services ==="
aws ecs update-service \
  --cluster $ECS_CLUSTER \
  --service atelier-backend \
  --force-new-deployment \
  --region $AWS_REGION

aws ecs update-service \
  --cluster $ECS_CLUSTER \
  --service atelier-frontend \
  --force-new-deployment \
  --region $AWS_REGION

# Wait for stability
echo "=== Waiting for services to stabilize ==="
aws ecs wait services-stable \
  --cluster $ECS_CLUSTER \
  --services atelier-backend atelier-frontend \
  --region $AWS_REGION

echo "=== Deployment complete ==="
```

### Rollback Procedure

```bash
#!/bin/bash
# scripts/rollback.sh

set -e

AWS_REGION="us-west-2"
ECS_CLUSTER="atelier-cluster"
SERVICE="${1:-all}"

rollback_service() {
  local service_name=$1
  
  echo "=== Rolling back $service_name ==="
  
  # Get current task definition
  CURRENT=$(aws ecs describe-services \
    --cluster $ECS_CLUSTER \
    --services $service_name \
    --query 'services[0].taskDefinition' \
    --output text \
    --region $AWS_REGION)
  
  # Extract family and revision
  FAMILY=$(echo $CURRENT | cut -d'/' -f2 | cut -d':' -f1)
  REVISION=$(echo $CURRENT | cut -d':' -f2)
  PREVIOUS_REVISION=$((REVISION - 1))
  
  if [ $PREVIOUS_REVISION -lt 1 ]; then
    echo "No previous revision available for $service_name"
    exit 1
  fi
  
  PREVIOUS_TASK_DEF="$FAMILY:$PREVIOUS_REVISION"
  
  echo "Current: $CURRENT"
  echo "Rolling back to: $PREVIOUS_TASK_DEF"
  
  # Update service with previous task definition
  aws ecs update-service \
    --cluster $ECS_CLUSTER \
    --service $service_name \
    --task-definition $PREVIOUS_TASK_DEF \
    --region $AWS_REGION
}

if [ "$SERVICE" == "all" ]; then
  rollback_service "atelier-backend"
  rollback_service "atelier-frontend"
elif [ "$SERVICE" == "backend" ]; then
  rollback_service "atelier-backend"
elif [ "$SERVICE" == "frontend" ]; then
  rollback_service "atelier-frontend"
else
  echo "Usage: $0 [all|backend|frontend]"
  exit 1
fi

# Wait for stability
echo "=== Waiting for services to stabilize ==="
aws ecs wait services-stable \
  --cluster $ECS_CLUSTER \
  --services atelier-backend atelier-frontend \
  --region $AWS_REGION

echo "=== Rollback complete ==="
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing in CI
- [ ] Code review approved
- [ ] Database migrations reviewed (if any)
- [ ] No breaking API changes (or coordinated frontend update)
- [ ] Environment variables updated in Secrets Manager (if needed)

### During Deployment

- [ ] Monitor CloudWatch logs for errors
- [ ] Monitor ALB target group health
- [ ] Check application health endpoints

### Post-Deployment

- [ ] Verify application loads correctly
- [ ] Test critical user flows:
  - [ ] Login/logout
  - [ ] Create project
  - [ ] Create shot and generate image
  - [ ] Save annotations
- [ ] Check error rates in CloudWatch
- [ ] Verify no increase in latency

### Rollback Triggers

Initiate rollback if:

- Application health checks failing for > 5 minutes
- Error rate > 5% for > 2 minutes
- Critical functionality broken
- Data corruption detected

---

## Environment Strategy

| Environment | Purpose | Infrastructure |
|-------------|---------|----------------|
| **Local** | Development | Docker Compose, local MySQL |
| **Production** | Live application | ECS Fargate, EC2 MySQL, ALB |

For MVP, we skip a dedicated dev/staging environment and go local → production. A staging environment can be added later when the team grows.

---

## Environment Variables Summary

### Backend (Production)

| Variable | Source | Description |
|----------|--------|-------------|
| `NODE_ENV` | Task Definition | `production` |
| `PORT` | Task Definition | `3000` |
| `DB_HOST` | Task Definition | EC2 private IP |
| `DB_PASSWORD` | Secrets Manager | MySQL app user password |
| `JWT_ACCESS_SECRET` | Secrets Manager | Access token signing key |
| `JWT_REFRESH_SECRET` | Secrets Manager | Refresh token signing key |
| `ENCRYPTION_KEY` | Secrets Manager | API key encryption master key |
| `AWS_REGION` | Task Definition | `us-west-2` |
| `S3_BUCKET` | Task Definition | `atelier-prod` |
| `CORS_ORIGINS` | Task Definition | `https://atelier.app` |

### Frontend (Build-time)

| Variable | Source | Description |
|----------|--------|-------------|
| `VITE_API_URL` | Docker build arg | `https://atelier.app/api` |

---

## Monitoring Deployments

### Useful CloudWatch Log Queries

**Recent errors:**
```
fields @timestamp, @message
| filter @message like /error/i
| sort @timestamp desc
| limit 50
```

**Request latency:**
```
fields @timestamp, @duration
| stats avg(@duration), max(@duration), p99(@duration) by bin(5m)
```

### Health Check URLs

```
Production Backend:  https://atelier.app/api/health
Production Frontend: https://atelier.app/
```

### Useful AWS CLI Commands

```bash
# View running tasks
aws ecs list-tasks --cluster atelier-cluster --service-name atelier-backend

# View service events (deployment status)
aws ecs describe-services --cluster atelier-cluster --services atelier-backend \
  --query 'services[0].events[:5]'

# View recent logs
aws logs tail /ecs/atelier-backend --since 1h --follow

# Describe task (get IP, status)
aws ecs describe-tasks --cluster atelier-cluster --tasks <task-id>
```
