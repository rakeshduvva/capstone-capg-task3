# =============================================================================
# Project 3 — Infrastructure as Code (IaC) for Core Cloud Resources
# =============================================================================
# This Terraform configuration deploys a complete AWS infrastructure stack:
#   - VPC with public and private subnets
#   - EC2 compute instance
#   - S3 storage bucket
#   - RDS MySQL database
#
# Author:  Student
# Tool:    Terraform v1.6+
# Cloud:   AWS (us-east-1)
# =============================================================================

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # ---------------------------------------------------------------------------
  # Remote State — S3 Backend
  # ---------------------------------------------------------------------------
  # Stores the Terraform state file remotely in an S3 bucket with DynamoDB
  # locking to prevent concurrent modifications.
  #
  # IMPORTANT: Before enabling this backend, you must first create the S3
  # bucket and DynamoDB table. See README.md for bootstrap instructions.
  # ---------------------------------------------------------------------------
  # backend "s3" {
  #   bucket         = "my-iac-project-tfstate"
  #   key            = "prod/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "terraform-state-lock"
  # }
}

# ---------------------------------------------------------------------------
# AWS Provider Configuration
# ---------------------------------------------------------------------------
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# ---------------------------------------------------------------------------
# Module: Networking (VPC, Subnets, Route Tables, IGW, NAT)
# ---------------------------------------------------------------------------
module "networking" {
  source = "./modules/networking"

  project_name       = var.project_name
  environment        = var.environment
  vpc_cidr           = var.vpc_cidr
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  availability_zones   = var.availability_zones
}

# ---------------------------------------------------------------------------
# Module: Compute (EC2 Instance + Security Group)
# ---------------------------------------------------------------------------
module "compute" {
  source = "./modules/compute"

  project_name    = var.project_name
  environment     = var.environment
  vpc_id          = module.networking.vpc_id
  subnet_id       = module.networking.public_subnet_ids[0]
  instance_type   = var.instance_type
  key_name        = var.key_name
  allowed_ssh_cidr = var.allowed_ssh_cidr
}

# ---------------------------------------------------------------------------
# Module: Storage (S3 Bucket with versioning + encryption)
# ---------------------------------------------------------------------------
module "storage" {
  source = "./modules/storage"

  project_name = var.project_name
  environment  = var.environment
  bucket_name  = var.bucket_name
}

# ---------------------------------------------------------------------------
# Module: Database (RDS MySQL + Security Group)
# ---------------------------------------------------------------------------
module "database" {
  source = "./modules/database"

  project_name         = var.project_name
  environment          = var.environment
  vpc_id               = module.networking.vpc_id
  private_subnet_ids   = module.networking.private_subnet_ids
  db_name              = var.db_name
  db_username          = var.db_username
  db_password          = var.db_password
  db_instance_class    = var.db_instance_class
  compute_sg_id        = module.compute.security_group_id
}
