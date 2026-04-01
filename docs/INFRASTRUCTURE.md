# Infrastructure

This document describes the AWS infrastructure for Atelier, including networking, compute, storage, and security configurations.

## Architecture Overview

Atelier runs on AWS using a cost-optimized architecture designed for MVP scale (~100 users).

### MVP Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    AWS Cloud (us-west-2)                              │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                              VPC (10.0.0.0/16)                               │    │
│  │                                                                              │    │
│  │  ┌─────────────────────────────┐    ┌─────────────────────────────┐         │    │
│  │  │   Public Subnet A (AZ-a)    │    │   Public Subnet B (AZ-b)    │         │    │
│  │  │       10.0.1.0/24           │    │       10.0.2.0/24           │         │    │
│  │  │                             │    │                             │         │    │
│  │  │  ┌───────────────────────┐  │    │                             │         │    │
│  │  │  │  ECS Fargate Tasks    │  │    │  (ALB requires 2 AZs)      │         │    │
│  │  │  │  - Backend            │  │    │                             │         │    │
│  │  │  │  - Frontend           │  │    │                             │         │    │
│  │  │  └───────────────────────┘  │    │                             │         │    │
│  │  └─────────────────────────────┘    └─────────────────────────────┘         │    │
│  │                                                                              │    │
│  │  ┌─────────────────────────────┐                                            │    │
│  │  │   Private Subnet A (AZ-a)   │                                            │    │
│  │  │       10.0.10.0/24          │                                            │    │
│  │  │                             │                                            │    │
│  │  │  ┌───────────────────────┐  │                                            │    │
│  │  │  │  EC2 MySQL            │  │                                            │    │
│  │  │  │  t3.micro (free tier) │  │                                            │    │
│  │  │  └───────────────────────┘  │                                            │    │
│  │  └─────────────────────────────┘                                            │    │
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
│  │   - Image generation from text prompts                                         │  │
│  │   - Uses user-provided API keys                                                │  │
│  └───────────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Cost Breakdown

### MVP Monthly Estimate

| Resource | Spec | Est. Cost |
|----------|------|-----------|
| ECS Fargate (Backend) | 1 task, 0.5 vCPU, 1 GB RAM | ~$15 |
| ECS Fargate (Frontend) | 1 task, 0.25 vCPU, 0.5 GB RAM | ~$8 |
| EC2 (Database) | t3.micro (free tier eligible) | $0* |
| EBS Volume | 20 GB gp3 | ~$2 |
| Application Load Balancer | Base + minimal LCU | ~$18 |
| S3 | ~10 GB storage, minimal requests | ~$1 |
| Secrets Manager | 5 secrets | ~$2 |
| ECR | ~2 GB storage | ~$0.20 |
| Data Transfer | ~10 GB/month | ~$1 |
| **Total** | | **~$47/month** |

*Free tier eligible for first 12 months

### Cost Optimization Decisions

| Decision | Savings | Trade-off |
|----------|---------|-----------|
| Public subnets for Fargate | ~$65/month (no NAT Gateway) | Less network isolation |
| EC2 MySQL vs RDS | ~$15-30/month | Manual backups, no Multi-AZ |
| Single AZ deployment | ~$20/month | No automatic failover |
| Single task per service | ~$20/month | No redundancy |
| No CloudFront | ~$10/month | Higher latency for distant users |

---

## Networking

### VPC Configuration

```hcl
# CIDR: 10.0.0.0/16 (65,536 addresses)

VPC:
  CIDR: 10.0.0.0/16
  DNS Hostnames: Enabled
  DNS Support: Enabled
```

### Subnets

| Subnet | CIDR | AZ | Type | Purpose |
|--------|------|----|----- |---------|
| public-a | 10.0.1.0/24 | us-west-2a | Public | ALB, ECS Fargate |
| public-b | 10.0.2.0/24 | us-west-2b | Public | ALB (required for ALB) |
| private-a | 10.0.10.0/24 | us-west-2a | Private | EC2 MySQL |

### Internet Gateway

Attached to VPC for public internet access from public subnets.

### Route Tables

**Public Route Table:**
```
Destination     Target
10.0.0.0/16     local
0.0.0.0/0       igw-xxxxx (Internet Gateway)
```

**Private Route Table:**
```
Destination     Target
10.0.0.0/16     local
```

Note: Private subnet has no internet access in MVP. Database backups use VPC endpoint for S3.

### VPC Endpoints

| Endpoint | Type | Purpose |
|----------|------|---------|
| s3 | Gateway | S3 access from private subnet (backups) |
| secretsmanager | Interface | Secrets access from ECS tasks |
| ecr.api | Interface | ECR API access |
| ecr.dkr | Interface | ECR Docker registry access |
| logs | Interface | CloudWatch Logs |

---

## Security Groups

### ALB Security Group

```
Inbound:
  - Port 443 (HTTPS) from 0.0.0.0/0
  - Port 80 (HTTP) from 0.0.0.0/0 (redirect to HTTPS)

Outbound:
  - All traffic to VPC CIDR (10.0.0.0/16)
```

### ECS Security Group

```
Inbound:
  - Port 3000 (Backend) from ALB Security Group
  - Port 80 (Frontend) from ALB Security Group

Outbound:
  - Port 443 (HTTPS) to 0.0.0.0/0 (external APIs, VPC endpoints)
  - Port 3306 (MySQL) to Database Security Group
```

### Database Security Group

```
Inbound:
  - Port 3306 (MySQL) from ECS Security Group

Outbound:
  - Port 443 (HTTPS) to S3 VPC Endpoint (backups)
```

---

## Application Load Balancer

### Configuration

```yaml
Name: atelier-alb
Scheme: internet-facing
Type: application
IP Address Type: ipv4

Subnets:
  - public-a (us-west-2a)
  - public-b (us-west-2b)

Security Groups:
  - alb-sg

Listeners:
  - Port 443 (HTTPS)
    - Certificate: ACM certificate for atelier.app
    - Default Action: Forward to frontend-tg
    - Rules:
      - Path /api/* -> Forward to backend-tg
      - Path /health -> Forward to backend-tg
  
  - Port 80 (HTTP)
    - Default Action: Redirect to HTTPS
```

### Target Groups

**Backend Target Group:**
```yaml
Name: atelier-backend-tg
Target Type: ip
Protocol: HTTP
Port: 3000
VPC: atelier-vpc

Health Check:
  Path: /health
  Interval: 30s
  Timeout: 5s
  Healthy Threshold: 2
  Unhealthy Threshold: 3
  Success Codes: 200

Stickiness: Disabled
```

**Frontend Target Group:**
```yaml
Name: atelier-frontend-tg
Target Type: ip
Protocol: HTTP
Port: 80
VPC: atelier-vpc

Health Check:
  Path: /
  Interval: 30s
  Timeout: 5s
  Healthy Threshold: 2
  Unhealthy Threshold: 3
  Success Codes: 200

Stickiness: Disabled
```

---

## ECS Cluster

### Cluster Configuration

```yaml
Name: atelier-cluster
Capacity Providers:
  - FARGATE
  - FARGATE_SPOT (for cost savings on non-critical workloads)

Default Capacity Provider Strategy:
  - Provider: FARGATE
    Weight: 1
```

### Backend Service

```yaml
Name: atelier-backend
Launch Type: FARGATE
Platform Version: LATEST
Desired Count: 1

Network Configuration:
  Subnets:
    - public-a
  Security Groups:
    - ecs-sg
  Assign Public IP: ENABLED  # Required for public subnet without NAT

Load Balancer:
  Target Group: atelier-backend-tg
  Container Name: backend
  Container Port: 3000

Deployment Configuration:
  Minimum Healthy Percent: 0
  Maximum Percent: 200
  Deployment Circuit Breaker:
    Enable: true
    Rollback: true
```

### Backend Task Definition

```yaml
Family: atelier-backend
Network Mode: awsvpc
Requires Compatibilities: FARGATE
CPU: 512 (0.5 vCPU)
Memory: 1024 (1 GB)
Execution Role: atelier-ecs-execution-role
Task Role: atelier-backend-task-role

Container Definitions:
  - Name: backend
    Image: <account>.dkr.ecr.us-west-2.amazonaws.com/atelier-backend:latest
    Essential: true
    PortMappings:
      - ContainerPort: 3000
        Protocol: tcp
    
    Environment:
      - Name: NODE_ENV
        Value: production
      - Name: PORT
        Value: "3000"
      - Name: AWS_REGION
        Value: us-west-2
      - Name: S3_BUCKET
        Value: atelier-prod
      - Name: DB_HOST
        Value: 10.0.10.x
    
    Secrets:
      - Name: DB_PASSWORD
        ValueFrom: arn:aws:secretsmanager:us-west-2:ACCOUNT_ID:secret:atelier/prod/db-app-password
      - Name: JWT_ACCESS_SECRET
        ValueFrom: arn:aws:secretsmanager:us-west-2:ACCOUNT_ID:secret:atelier/prod/jwt-access-secret
      - Name: JWT_REFRESH_SECRET
        ValueFrom: arn:aws:secretsmanager:us-west-2:ACCOUNT_ID:secret:atelier/prod/jwt-refresh-secret
      - Name: ENCRYPTION_KEY
        ValueFrom: arn:aws:secretsmanager:us-west-2:ACCOUNT_ID:secret:atelier/prod/encryption-key
    
    LogConfiguration:
      LogDriver: awslogs
      Options:
        awslogs-group: /ecs/atelier-backend
        awslogs-region: us-west-2
        awslogs-stream-prefix: ecs
```

### Frontend Service

```yaml
Name: atelier-frontend
Launch Type: FARGATE
Platform Version: LATEST
Desired Count: 1

Network Configuration:
  Subnets:
    - public-a
  Security Groups:
    - ecs-sg
  Assign Public IP: ENABLED

Load Balancer:
  Target Group: atelier-frontend-tg
  Container Name: frontend
  Container Port: 80
```

### Frontend Task Definition

```yaml
Family: atelier-frontend
Network Mode: awsvpc
Requires Compatibilities: FARGATE
CPU: 256 (0.25 vCPU)
Memory: 512 (0.5 GB)
Execution Role: atelier-ecs-execution-role

Container Definitions:
  - Name: frontend
    Image: <account>.dkr.ecr.us-west-2.amazonaws.com/atelier-frontend:latest
    Essential: true
    PortMappings:
      - ContainerPort: 80
        Protocol: tcp
    
    LogConfiguration:
      LogDriver: awslogs
      Options:
        awslogs-group: /ecs/atelier-frontend
        awslogs-region: us-west-2
        awslogs-stream-prefix: ecs
```

---

## EC2 Database (MVP)

### Instance Configuration

```json
{
  "InstanceType": "t3.micro",
  "SubnetId": "subnet-private-a",
  "SecurityGroupIds": ["sg-database"],
  "IamInstanceProfile": "atelier-db-instance-profile",
  "BlockDeviceMappings": [
    {
      "DeviceName": "/dev/xvda",
      "Ebs": {
        "VolumeSize": 20,
        "VolumeType": "gp3",
        "DeleteOnTermination": false
      }
    }
  ]
}
```

### MySQL Installation Script

```bash
#!/bin/bash
set -e

# Update system
yum update -y

# Install MySQL 8.0
yum install -y mysql-server

# Start and enable MySQL
systemctl start mysqld
systemctl enable mysqld

# Get secrets from Secrets Manager
DB_ROOT_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id atelier/prod/db-root-password \
  --query SecretString --output text)

DB_APP_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id atelier/prod/db-app-password \
  --query SecretString --output text)

# Secure MySQL installation
mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '${DB_ROOT_PASSWORD}';"
mysql -u root -p"${DB_ROOT_PASSWORD}" -e "CREATE DATABASE IF NOT EXISTS atelier;"
mysql -u root -p"${DB_ROOT_PASSWORD}" -e "CREATE USER IF NOT EXISTS 'atelier'@'%' IDENTIFIED BY '${DB_APP_PASSWORD}';"
mysql -u root -p"${DB_ROOT_PASSWORD}" -e "GRANT ALL PRIVILEGES ON atelier.* TO 'atelier'@'%';"
mysql -u root -p"${DB_ROOT_PASSWORD}" -e "FLUSH PRIVILEGES;"

# Configure MySQL to accept remote connections from VPC
sed -i 's/bind-address.*/bind-address = 0.0.0.0/' /etc/my.cnf
systemctl restart mysqld
```

### Backup Script

```bash
#!/bin/bash
# /opt/scripts/backup-mysql.sh

set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/tmp/backups"
S3_BUCKET="atelier-prod"
S3_PATH="backups/mysql"
RETENTION_DAYS=30

# Get password from Secrets Manager
DB_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id atelier/prod/db-root-password \
  --query SecretString --output text)

# Create backup
mkdir -p ${BACKUP_DIR}
mysqldump -u root -p"${DB_PASSWORD}" --all-databases --single-transaction | \
  gzip > ${BACKUP_DIR}/atelier_${TIMESTAMP}.sql.gz

# Upload to S3
aws s3 cp ${BACKUP_DIR}/atelier_${TIMESTAMP}.sql.gz \
  s3://${S3_BUCKET}/${S3_PATH}/atelier_${TIMESTAMP}.sql.gz

# Also maintain a "latest" copy
aws s3 cp ${BACKUP_DIR}/atelier_${TIMESTAMP}.sql.gz \
  s3://${S3_BUCKET}/${S3_PATH}/latest.sql.gz

# Cleanup local file
rm -f ${BACKUP_DIR}/atelier_${TIMESTAMP}.sql.gz

# Cleanup old S3 backups (keep last RETENTION_DAYS days)
aws s3 ls s3://${S3_BUCKET}/${S3_PATH}/ | \
  while read -r line; do
    createDate=$(echo "$line" | awk '{print $1" "$2}')
    createDate=$(date -d "${createDate}" +%s 2>/dev/null || echo 0)
    olderThan=$(date -d "-${RETENTION_DAYS} days" +%s)
    if [[ ${createDate} -lt ${olderThan} ]]; then
      fileName=$(echo "$line" | awk '{print $4}')
      if [[ ${fileName} != "latest.sql.gz" ]]; then
        aws s3 rm s3://${S3_BUCKET}/${S3_PATH}/${fileName}
      fi
    fi
  done

echo "Backup completed: atelier_${TIMESTAMP}.sql.gz"
```

### Cron Configuration

```bash
# /etc/cron.d/atelier-backup
0 3 * * * root /opt/scripts/backup-mysql.sh >> /var/log/atelier-backup.log 2>&1
```

---

## S3

### Bucket Configuration

```json
{
  "BucketName": "atelier-prod",
  "Region": "us-west-2",
  "BlockPublicAccess": {
    "BlockPublicAcls": true,
    "IgnorePublicAcls": true,
    "BlockPublicPolicy": true,
    "RestrictPublicBuckets": true
  },
  "ServerSideEncryption": "AES256",
  "VersioningEnabled": true
}
```

### Bucket Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyUnencryptedUploads",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::atelier-prod/*",
      "Condition": {
        "StringNotEquals": {
          "s3:x-amz-server-side-encryption": "AES256"
        }
      }
    },
    {
      "Sid": "DenyHTTP",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::atelier-prod",
        "arn:aws:s3:::atelier-prod/*"
      ],
      "Condition": {
        "Bool": {
          "aws:SecureTransport": "false"
        }
      }
    }
  ]
}
```

### CORS Configuration

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": [
      "https://atelier.app",
      "https://www.atelier.app"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

### Lifecycle Rules

```yaml
Rules:
  - ID: delete-incomplete-uploads
    Status: Enabled
    AbortIncompleteMultipartUpload:
      DaysAfterInitiation: 7
  
  - ID: transition-old-backups
    Status: Enabled
    Prefix: backups/
    Transitions:
      - Days: 30
        StorageClass: GLACIER
    Expiration:
      Days: 365
```

---

## Secrets Manager

### Secrets

| Secret Name | Description | Rotation |
|-------------|-------------|----------|
| `atelier/prod/db-root-password` | MySQL root password | Manual |
| `atelier/prod/db-app-password` | MySQL application user password | Manual |
| `atelier/prod/jwt-access-secret` | JWT access token signing key | Manual |
| `atelier/prod/jwt-refresh-secret` | JWT refresh token signing key | Manual |
| `atelier/prod/encryption-key` | API key encryption master key | Manual |

### Secret Formats

**jwt-access-secret / jwt-refresh-secret:**
```
<64-character random hex string>
```

**encryption-key:**
```
<64-character hex string (32 bytes)>
```

### Generating Secrets

```bash
# Generate JWT secrets
openssl rand -hex 32

# Generate encryption key
openssl rand -hex 32

# Generate database passwords
openssl rand -base64 24 | tr -d '/+=' | head -c 24
```

---

## IAM Roles

### ECS Execution Role

Allows ECS to pull images and access secrets.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:us-west-2:*:log-group:/ecs/atelier-*:*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:us-west-2:*:secret:atelier/prod/*"
    }
  ]
}
```

### Backend Task Role

Allows backend containers to access S3.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::atelier-prod",
        "arn:aws:s3:::atelier-prod/*"
      ]
    }
  ]
}
```

### Database Instance Role

Allows EC2 database to access Secrets Manager and S3 (for backups).

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:us-west-2:*:secret:atelier/prod/db-*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::atelier-prod/backups/*",
        "arn:aws:s3:::atelier-prod"
      ]
    }
  ]
}
```

---

## ECR Repositories

```yaml
Repositories:
  - Name: atelier-backend
    Image Tag Mutability: MUTABLE
    Scan on Push: true
    Lifecycle Policy:
      - Rule Priority: 1
        Description: Keep last 10 images
        Selection:
          tagStatus: any
          countType: imageCountMoreThan
          countNumber: 10
        Action: expire
  
  - Name: atelier-frontend
    Image Tag Mutability: MUTABLE
    Scan on Push: true
    Lifecycle Policy:
      - Rule Priority: 1
        Description: Keep last 10 images
        Selection:
          tagStatus: any
          countType: imageCountMoreThan
          countNumber: 10
        Action: expire
```

---

## CloudWatch

### Log Groups

```yaml
Log Groups:
  - Name: /ecs/atelier-backend
    Retention: 30 days
  
  - Name: /ecs/atelier-frontend
    Retention: 14 days
```

### Alarms

**Backend CPU Alarm:**
```yaml
Alarm Name: atelier-backend-cpu-high
Metric: CPUUtilization
Namespace: AWS/ECS
Dimensions:
  ClusterName: atelier-cluster
  ServiceName: atelier-backend
Statistic: Average
Period: 300
EvaluationPeriods: 2
Threshold: 80
ComparisonOperator: GreaterThanThreshold
```

**Backend Memory Alarm:**
```yaml
Alarm Name: atelier-backend-memory-high
Metric: MemoryUtilization
Namespace: AWS/ECS
Dimensions:
  ClusterName: atelier-cluster
  ServiceName: atelier-backend
Statistic: Average
Period: 300
EvaluationPeriods: 2
Threshold: 85
ComparisonOperator: GreaterThanThreshold
```

**Unhealthy Targets Alarm:**
```yaml
Alarm Name: atelier-unhealthy-targets
Metric: UnHealthyHostCount
Namespace: AWS/ApplicationELB
Dimensions:
  TargetGroup: atelier-backend-tg
  LoadBalancer: atelier-alb
Statistic: Sum
Period: 60
EvaluationPeriods: 2
Threshold: 1
ComparisonOperator: GreaterThanOrEqualToThreshold
```

**5xx Error Rate Alarm:**
```yaml
Alarm Name: atelier-5xx-errors
Metric: HTTPCode_Target_5XX_Count
Namespace: AWS/ApplicationELB
Dimensions:
  LoadBalancer: atelier-alb
Statistic: Sum
Period: 300
EvaluationPeriods: 1
Threshold: 10
ComparisonOperator: GreaterThanThreshold
```

---

## DNS and SSL

### Route 53

```yaml
Hosted Zone: atelier.app

Records:
  - Name: atelier.app
    Type: A
    Alias: true
    Target: atelier-alb.us-west-2.elb.amazonaws.com
  
  - Name: www.atelier.app
    Type: A
    Alias: true
    Target: atelier-alb.us-west-2.elb.amazonaws.com
```

### ACM Certificate

```yaml
Domain: atelier.app
Subject Alternative Names:
  - www.atelier.app
Validation Method: DNS
Region: us-west-2 (must match ALB region)
```

---

## Scaling Path

When ready to scale beyond MVP, consider these upgrades in order:

### Phase 1: Basic Redundancy (~$100/month additional)

1. **Add second task per service** — Backend: 2 tasks, Frontend: 2 tasks. Provides basic redundancy.
2. **Enable Multi-AZ for database** — Set up MySQL replication to a second AZ. Manual failover procedure.

### Phase 2: Managed Database (~$50-100/month additional)

1. **Migrate to RDS MySQL** — Multi-AZ deployment, automated backups, point-in-time recovery.
2. **Add RDS Proxy** (optional) — Connection pooling, better Fargate integration.

### Phase 3: Performance (~$100-200/month additional)

1. **Add CloudFront CDN** — Cache static frontend assets, S3 image caching, global edge locations.
2. **Increase Fargate resources** — Backend: 1 vCPU, 2 GB RAM. Add auto-scaling policies.

### Phase 4: Full Production (~$300-500/month total)

1. **NAT Gateway** — Move Fargate to private subnets, better network isolation.
2. **WAF** — Rate limiting, SQL injection protection, geo-blocking if needed.
3. **Enhanced monitoring** — X-Ray tracing, Container Insights, custom dashboards.

---

## Disaster Recovery

### Backup Strategy

| Data | Backup Method | Frequency | Retention | RTO | RPO |
|------|--------------|-----------|-----------|-----|-----|
| MySQL Database | mysqldump to S3 | Daily 3 AM UTC | 30 days (hot), 1 year (glacier) | 4 hours | 24 hours |
| S3 Images | Cross-region replication (future) | Continuous | N/A | 1 hour | 0 |
| Secrets | Manual export | On change | Secure storage | 1 hour | 0 |
| Infrastructure | Terraform state in S3 | On change | Versioned | 2 hours | 0 |

### Recovery Procedures

**Database Recovery:**
```bash
# Download latest backup
aws s3 cp s3://atelier-prod/backups/mysql/latest.sql.gz /tmp/

# Decompress
gunzip /tmp/latest.sql.gz

# Restore
mysql -u root -p atelier < /tmp/latest.sql
```

**ECS Service Recovery:**
```bash
# Force new deployment (pulls latest image)
aws ecs update-service \
  --cluster atelier-cluster \
  --service atelier-backend \
  --force-new-deployment

# Scale to desired count
aws ecs update-service \
  --cluster atelier-cluster \
  --service atelier-backend \
  --desired-count 1
```

**Full Environment Recovery:**
```bash
# Re-run Terraform
cd infrastructure/
terraform apply

# Restore database from backup
# (see Database Recovery above)

# Deploy latest application
# (CI/CD will handle this)
```
