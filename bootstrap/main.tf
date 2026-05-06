# =============================================================================
# Remote State Bootstrap — S3 + DynamoDB
# =============================================================================
# Run this FIRST (separately) to create the backend resources that Terraform
# will use for remote state storage and locking.
#
# Usage:
#   cd bootstrap/
#   terraform init
#   terraform apply
#
# After this succeeds, uncomment the backend "s3" block in the root main.tf
# and run `terraform init` to migrate state.
# =============================================================================

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

# ---------------------------------------------------------------------------
# S3 Bucket for Terraform State
# ---------------------------------------------------------------------------
resource "aws_s3_bucket" "terraform_state" {
  bucket = "my-iac-project-tfstate"

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Name      = "Terraform State Bucket"
    ManagedBy = "Terraform"
  }
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ---------------------------------------------------------------------------
# DynamoDB Table for State Locking
# ---------------------------------------------------------------------------
resource "aws_dynamodb_table" "terraform_lock" {
  name         = "terraform-state-lock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = {
    Name      = "Terraform State Lock Table"
    ManagedBy = "Terraform"
  }
}

# ---------------------------------------------------------------------------
# Outputs
# ---------------------------------------------------------------------------
output "state_bucket_name" {
  description = "Name of the S3 bucket for Terraform state"
  value       = aws_s3_bucket.terraform_state.bucket
}

output "lock_table_name" {
  description = "Name of the DynamoDB lock table"
  value       = aws_dynamodb_table.terraform_lock.name
}
