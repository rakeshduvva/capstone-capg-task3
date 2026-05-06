# Project 3 - Infrastructure as Code (IaC) for Core Cloud Resources

Automated deployment of AWS infrastructure using Terraform with modular architecture, remote state management, and policy-as-code enforcement.

---

## Architecture Overview

```
+-------------------------------------------------------------+
|                        AWS Cloud                             |
|  +-------------------------------------------------------+  |
|  |                  VPC (10.0.0.0/16)                     |  |
|  |                                                        |  |
|  |  +------------------+     +---------------------+     |  |
|  |  |  Public Subnet    |     |  Public Subnet      |     |  |
|  |  |  10.0.1.0/24      |     |  10.0.2.0/24        |     |  |
|  |  |  (ap-south-1a)    |     |  (ap-south-1b)      |     |  |
|  |  |                   |     |                     |     |  |
|  |  |  +-------------+  |     |                     |     |  |
|  |  |  | EC2 (App)   |  |     |                     |     |  |
|  |  |  | t3.micro    |  |     |                     |     |  |
|  |  |  +-------------+  |     |                     |     |  |
|  |  +--------+---------+     +---------------------+     |  |
|  |           |                                            |  |
|  |           | Internet Gateway                           |  |
|  |           |                                            |  |
|  |  +------------------+     +---------------------+     |  |
|  |  | Private Subnet    |     | Private Subnet      |     |  |
|  |  | 10.0.101.0/24     |     | 10.0.102.0/24       |     |  |
|  |  | (ap-south-1a)     |     | (ap-south-1b)       |     |  |
|  |  |                   |     |                     |     |  |
|  |  |  +-------------+  |     |                     |     |  |
|  |  |  | RDS MySQL   |  |     |                     |     |  |
|  |  |  | db.t3.micro |  |     |                     |     |  |
|  |  |  +-------------+  |     |                     |     |  |
|  |  +-------------------+     +---------------------+     |  |
|  +-------------------------------------------------------+  |
|                                                              |
|  +--------------+                                            |
|  |  S3 Bucket   |  (Encrypted + Versioned + Lifecycle)       |
|  +--------------+                                            |
+-------------------------------------------------------------+
```

---

## Project Structure

```
iac-project/
|-- main.tf                          # Root configuration - wires all modules
|-- variables.tf                     # Input variable definitions
|-- outputs.tf                       # Output value definitions
|-- terraform.tfvars                 # Variable values (gitignored)
|-- terraform.tfvars.example         # Example values (safe to commit)
|-- .gitignore
|-- README.md
|
|-- modules/
|   |-- networking/                  # VPC, Subnets, IGW, Route Tables
|   |   |-- main.tf
|   |   |-- variables.tf
|   |   +-- outputs.tf
|   |
|   |-- compute/                     # EC2 Instance + Security Group
|   |   |-- main.tf
|   |   |-- variables.tf
|   |   +-- outputs.tf
|   |
|   |-- storage/                     # S3 Bucket (versioned, encrypted)
|   |   |-- main.tf
|   |   |-- variables.tf
|   |   +-- outputs.tf
|   |
|   +-- database/                    # RDS MySQL + Security Group
|       |-- main.tf
|       |-- variables.tf
|       +-- outputs.tf
|
|-- policies/                        # Policy-as-Code (OPA / Conftest)
|   +-- terraform.rego               # Rego policy rules
|
+-- bootstrap/                       # Remote state backend setup
    +-- main.tf                      # S3 + DynamoDB for state management
```

---

## Infrastructure Components

| Component | Resource | Details |
|-----------|----------|---------|
| Networking | VPC | 10.0.0.0/16 CIDR, DNS support enabled |
| | Public Subnets (x2) | Multi-AZ, auto-assign public IPs |
| | Private Subnets (x2) | Multi-AZ, isolated from internet |
| | Internet Gateway | Public subnet internet access |
| | Route Tables (x2) | Public to IGW, Private isolated |
| Compute | EC2 Instance | Amazon Linux 2023, t3.micro (free tier) |
| | Security Group | SSH (22), HTTP (80), HTTPS (443) |
| | User Data | Apache web server auto-install |
| Storage | S3 Bucket | Versioned, AES-256 encrypted, lifecycle rules |
| | Public Access Block | All public access denied |
| Database | RDS MySQL 8.0 | db.t3.micro (free tier), encrypted storage |
| | DB Subnet Group | Spans private subnets |
| | Security Group | MySQL port open only from EC2 SG |

---

## Prerequisites

1. Terraform >= v1.6 - https://developer.hashicorp.com/terraform/install
2. AWS CLI v2 - https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
3. AWS Account with IAM credentials configured
4. Conftest (optional, for policy-as-code) - https://www.conftest.dev/install/

### Configure AWS Credentials

```bash
aws configure
# Enter your:
#   AWS Access Key ID
#   AWS Secret Access Key
#   Default region: ap-south-1
#   Default output: json
```

---

## Getting Started

### Step 1 - Clone the Repository

```bash
git clone https://github.com/rakeshduvva/capstone-capg-task3.git
cd capstone-capg-task3
```

### Step 2 - Configure Variables

```bash
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values (especially db_password and bucket_name)
```

### Step 3 - Initialize Terraform

```bash
terraform init
```

This downloads the AWS provider and initializes the modules.

### Step 4 - Preview the Plan

```bash
terraform plan
```

Review the execution plan - it shows what will be created.

### Step 5 - Deploy Infrastructure

```bash
terraform apply
```

Type `yes` when prompted. Deployment takes approximately 8-12 minutes (RDS is the slowest).

### Step 6 - Verify Outputs

After deployment, Terraform displays:

```
Outputs:

ec2_public_ip   = "54.xx.xx.xx"
rds_endpoint    = "iac-capstone-dev-mysql.xxxxx.ap-south-1.rds.amazonaws.com:3306"
s3_bucket_name  = "iac-capstone-app-storage-2026"
vpc_id          = "vpc-xxxxxxxxx"
```

Visit `http://<ec2_public_ip>` in your browser to see the Apache welcome page.

---

## Remote State Configuration

Remote state stores terraform.tfstate in S3 with DynamoDB locking to prevent concurrent modifications.

### Step 1 - Bootstrap the Backend

```bash
cd bootstrap/
terraform init
terraform apply
cd ..
```

### Step 2 - Enable Remote Backend

Uncomment the backend "s3" block in main.tf:

```hcl
backend "s3" {
  bucket         = "my-iac-project-tfstate"
  key            = "prod/terraform.tfstate"
  region         = "us-east-1"
  encrypt        = true
  dynamodb_table = "terraform-state-lock"
}
```

### Step 3 - Migrate State

```bash
terraform init -migrate-state
```

---

## Policy-as-Code (OPA)

This project uses Open Policy Agent (OPA) with Conftest to enforce security policies before deployment.

### Policies Enforced

| # | Policy | Description |
|---|--------|-------------|
| 1 | No Public RDS | Database must not be publicly accessible |
| 2 | S3 Versioning | Buckets must have versioning enabled |
| 3 | Instance Type | Only t2.micro and t3.micro allowed |
| 4 | Required Tags | All resources must have Project, Environment, ManagedBy tags |
| 5 | EBS Encryption | Root volumes must be encrypted |
| 6 | No Public MySQL | Security groups must not expose port 3306 to 0.0.0.0/0 |
| 7 | RDS Encryption | RDS storage must be encrypted |

### Running Policy Checks

```bash
# Generate the plan in JSON format
terraform plan -out=tfplan.binary
terraform show -json tfplan.binary > tfplan.json

# Run policy checks
conftest test tfplan.json -p policies/

# Expected output (all policies pass):
# 7 tests, 7 passed, 0 warnings, 0 failures
```

### Install Conftest

```bash
# macOS
brew install conftest

# Windows (scoop)
scoop install conftest

# Linux
wget https://github.com/open-policy-agent/conftest/releases/latest/download/conftest_Linux_x86_64.tar.gz
tar xzf conftest_Linux_x86_64.tar.gz
sudo mv conftest /usr/local/bin/
```

---

## Deployment Commands - Quick Reference

| Command | Description |
|---------|-------------|
| terraform init | Initialize providers and modules |
| terraform validate | Validate configuration syntax |
| terraform fmt -recursive | Format all .tf files |
| terraform plan | Preview infrastructure changes |
| terraform apply | Deploy infrastructure |
| terraform output | Show output values |
| terraform state list | List all managed resources |
| terraform destroy | Tear down all infrastructure |

---

## Outputs

| Output | Description |
|--------|-------------|
| vpc_id | ID of the created VPC |
| public_subnet_ids | IDs of the public subnets |
| private_subnet_ids | IDs of the private subnets |
| ec2_instance_id | ID of the EC2 instance |
| ec2_public_ip | Public IP of the EC2 instance |
| ec2_public_dns | Public DNS of the EC2 instance |
| s3_bucket_name | Name of the S3 bucket |
| s3_bucket_arn | ARN of the S3 bucket |
| rds_endpoint | RDS connection endpoint |
| rds_port | RDS port number |

---

## Cleanup

To avoid AWS charges, destroy all resources when done:

```bash
terraform destroy
```

Type `yes` when prompted. This removes all infrastructure created by this project.

If you set up remote state, destroy the bootstrap resources separately:

```bash
cd bootstrap/
terraform destroy
```

---

## Security Best Practices Implemented

- RDS in private subnets - no public internet access
- Security group whitelisting - DB only accepts traffic from EC2 SG
- S3 public access blocked - all public ACLs and policies denied
- Encryption at rest - S3 (AES-256), EBS (gp3), RDS (encrypted)
- IMDSv2 enforced - EC2 metadata requires token-based access
- Versioning enabled - S3 bucket versioning for data protection
- Sensitive variables - db_password and db_username marked sensitive
- Policy-as-Code - OPA policies validate plan before apply
- Remote state encryption - state file encrypted at rest in S3
- State locking - DynamoDB prevents concurrent state modifications

---

## Author

Rakesh Duvva - Cloud and DevSecOps Capstone