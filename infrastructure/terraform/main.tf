# ============================================================
# HealthGuard Platform - AWS Infrastructure
# ============================================================

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "healthguard-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "healthguard-terraform-lock"
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project     = "HealthGuard"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Compliance  = "HIPAA"
    }
  }
}

# ── Variables ────────────────────────────────────────────────

variable "aws_region" {
  description = "AWS region"
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  default     = "production"
}

variable "db_instance_class" {
  description = "RDS instance class"
  default     = "db.r6g.large"
}

# ── VPC ──────────────────────────────────────────────────────

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = { Name = "healthguard-vpc" }
}

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 1}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = { Name = "healthguard-private-${count.index + 1}" }
}

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.${count.index + 10}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = { Name = "healthguard-public-${count.index + 1}" }
}

data "aws_availability_zones" "available" {
  state = "available"
}

# ── RDS PostgreSQL (HIPAA-compliant) ─────────────────────────

resource "aws_db_subnet_group" "main" {
  name       = "healthguard-db-subnet"
  subnet_ids = aws_subnet.private[*].id

  tags = { Name = "healthguard-db-subnet-group" }
}

resource "aws_db_instance" "postgres" {
  identifier     = "healthguard-db"
  engine         = "postgres"
  engine_version = "16.1"
  instance_class = var.db_instance_class

  allocated_storage     = 100
  max_allocated_storage = 500
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = "healthguard"
  username = "healthguard_admin"
  password = data.aws_ssm_parameter.db_password.value

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]

  multi_az            = true
  publicly_accessible = false

  backup_retention_period = 30
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  deletion_protection       = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "healthguard-db-final"

  performance_insights_enabled = true

  tags = { Name = "healthguard-postgres" }
}

data "aws_ssm_parameter" "db_password" {
  name = "/healthguard/production/db_password"
}

# ── Security Groups ─────────────────────────────────────────

resource "aws_security_group" "db" {
  name_prefix = "healthguard-db-"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.backend.id]
  }

  tags = { Name = "healthguard-db-sg" }
}

resource "aws_security_group" "backend" {
  name_prefix = "healthguard-backend-"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "healthguard-backend-sg" }
}

# ── ElastiCache Redis ────────────────────────────────────────

resource "aws_elasticache_subnet_group" "main" {
  name       = "healthguard-cache-subnet"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "healthguard-redis"
  description          = "HealthGuard Redis cluster"
  node_type            = "cache.r6g.large"
  num_cache_clusters   = 2

  engine               = "redis"
  engine_version       = "7.0"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.db.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  automatic_failover_enabled = true

  tags = { Name = "healthguard-redis" }
}

# ── EKS Cluster ──────────────────────────────────────────────

resource "aws_eks_cluster" "main" {
  name     = "healthguard-cluster"
  role_arn = aws_iam_role.eks_cluster.arn
  version  = "1.29"

  vpc_config {
    subnet_ids              = concat(aws_subnet.private[*].id, aws_subnet.public[*].id)
    endpoint_private_access = true
    endpoint_public_access  = true
  }

  encryption_config {
    provider {
      key_arn = aws_kms_key.eks.arn
    }
    resources = ["secrets"]
  }

  tags = { Name = "healthguard-eks" }
}

resource "aws_kms_key" "eks" {
  description = "EKS Secret Encryption Key"
}

resource "aws_iam_role" "eks_cluster" {
  name = "healthguard-eks-cluster-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "eks.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks_cluster.name
}

# ── Outputs ──────────────────────────────────────────────────

output "db_endpoint" {
  value = aws_db_instance.postgres.endpoint
}

output "redis_endpoint" {
  value = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "eks_cluster_endpoint" {
  value = aws_eks_cluster.main.endpoint
}

output "eks_cluster_name" {
  value = aws_eks_cluster.main.name
}
