# =============================================================================
# Outputs — Root Module
# =============================================================================
# These outputs are displayed after `terraform apply` and can be consumed
# by other Terraform configurations or CI/CD pipelines.
# =============================================================================

# ---------------------------------------------------------------------------
# Networking Outputs
# ---------------------------------------------------------------------------
output "vpc_id" {
  description = "ID of the created VPC"
  value       = module.networking.vpc_id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = module.networking.public_subnet_ids
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = module.networking.private_subnet_ids
}

# ---------------------------------------------------------------------------
# Compute Outputs
# ---------------------------------------------------------------------------
output "ec2_instance_id" {
  description = "ID of the EC2 instance"
  value       = module.compute.instance_id
}

output "ec2_public_ip" {
  description = "Public IP address of the EC2 instance"
  value       = module.compute.public_ip
}

output "ec2_public_dns" {
  description = "Public DNS name of the EC2 instance"
  value       = module.compute.public_dns
}

# ---------------------------------------------------------------------------
# Storage Outputs
# ---------------------------------------------------------------------------
output "s3_bucket_name" {
  description = "Name of the S3 bucket"
  value       = module.storage.bucket_name
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket"
  value       = module.storage.bucket_arn
}

# ---------------------------------------------------------------------------
# Database Outputs
# ---------------------------------------------------------------------------
output "rds_endpoint" {
  description = "Connection endpoint for the RDS instance"
  value       = module.database.db_endpoint
}

output "rds_port" {
  description = "Port number for the RDS instance"
  value       = module.database.db_port
}
