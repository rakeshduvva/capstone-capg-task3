# 📖 Complete Project Explanation — File by File

> This document explains **every single file** in the project, what it does, how it works, and why it exists.

---

## 🗂 Root-Level Files

---

### 1. `main.tf` — The Brain of the Project

**What it does:** This is the entry point. It tells Terraform:
- Which cloud provider to use (AWS)
- Which region to deploy in
- Which modules to call and what inputs to pass them

**How it works:**
```
terraform block     → Sets minimum Terraform version + AWS provider version
provider "aws"      → Configures AWS region + default tags for ALL resources
module "networking" → Calls the networking module, passes VPC/subnet CIDRs
module "compute"    → Calls compute module, passes VPC ID + subnet from networking
module "storage"    → Calls storage module, passes bucket name
module "database"   → Calls database module, passes private subnets + compute SG
```

**Why:** Without this file, Terraform has nothing to do. It's the orchestrator that connects all modules together. Modules depend on each other — for example, compute needs the VPC ID from networking, and database needs the security group ID from compute.

---

### 2. `variables.tf` — Input Definitions

**What it does:** Declares ALL input variables the project accepts — their type, description, default value, and validation rules.

**How it works:** Each `variable` block defines:
- `type` — string, list, number, etc.
- `default` — value used if not overridden
- `sensitive` — hides value from logs (used for passwords)
- `validation` — custom rules (e.g., environment must be dev/staging/prod)

**Why:** Separating variables from logic is a Terraform best practice. It makes the code reusable — you change values in ONE place, not scattered across files.

---

### 3. `outputs.tf` — What You See After Deployment

**What it does:** Defines what information Terraform prints after `terraform apply` — like the EC2 IP address, RDS endpoint, bucket name.

**How it works:** Each `output` block pulls a value from a module's outputs:
```hcl
output "ec2_public_ip" {
  value = module.compute.public_ip   ← pulls from compute module's outputs.tf
}
```

**Why:** Without outputs, you'd have to manually dig through the AWS Console to find your EC2 IP or RDS endpoint. Outputs automate this.

---

### 4. `terraform.tfvars` — Your Actual Values

**What it does:** Provides the ACTUAL values for the variables defined in `variables.tf`.

**How it works:** Terraform automatically loads any file named `terraform.tfvars`. It maps variable names to values:
```hcl
aws_region   = "ap-south-1"
db_password  = "ChangeMe123!"
```

**Why:** Keeps sensitive/environment-specific values separate from code. This file is **gitignored** — never committed to version control.

---

### 5. `terraform.tfvars.example` — Safe Template

**What it does:** A template showing what variables need values, with placeholder data.

**Why:** Since `terraform.tfvars` is gitignored, teammates need to know what variables to set. This file serves as documentation. Safe to commit.

---

### 6. `.gitignore` — Files Git Should Ignore

**What it does:** Tells Git to NOT track:
- `*.tfstate` — state files contain sensitive data (IPs, passwords)
- `.terraform/` — downloaded provider binaries (large)
- `*.tfvars` — contains secrets
- `tfplan.json` — plan output may contain secrets

**Why:** Committing state files or credentials is a **security vulnerability**. This prevents accidental exposure.

---

### 7. `README.md` — Project Documentation

**What it does:** The front page of your GitHub repo. Contains architecture diagram, setup instructions, deployment commands, and security practices.

**Why:** Required deliverable. Evaluators read this FIRST.

---

## 📦 Modules — The Core Infrastructure

Each module has 3 files: `main.tf` (resources), `variables.tf` (inputs), `outputs.tf` (exports).

---

### 8–10. `modules/networking/` — VPC & Network Layer

#### `main.tf`
Creates **7 types of resources**:

| Resource | What It Does |
|----------|-------------|
| `aws_vpc` | The virtual private cloud — your isolated network in AWS |
| `aws_internet_gateway` | Allows public subnets to reach the internet |
| `aws_subnet` (public ×2) | Subnets with auto-assigned public IPs, across 2 AZs |
| `aws_subnet` (private ×2) | Isolated subnets for databases, no public IPs |
| `aws_eip` + `aws_nat_gateway` | Lets private subnets make outbound internet calls (e.g., updates) without being publicly reachable |
| `aws_route_table` (public) | Routes `0.0.0.0/0` → Internet Gateway |
| `aws_route_table` (private) | Routes `0.0.0.0/0` → NAT Gateway |

**Why 2 subnets each?** RDS requires subnets in at least 2 Availability Zones. Multi-AZ is also a best practice for high availability.

**Why separate public/private?** Security. The database should NEVER be directly reachable from the internet. Only the EC2 (in public subnet) can talk to RDS (in private subnet).

#### `variables.tf` — Accepts VPC CIDR, subnet CIDRs, AZ names
#### `outputs.tf` — Exports VPC ID, subnet IDs (needed by compute and database modules)

---

### 11–13. `modules/compute/` — EC2 Instance

#### `main.tf`
Creates **3 things**:

| Resource | What It Does |
|----------|-------------|
| `data "aws_ami"` | Automatically finds the latest Amazon Linux 2023 AMI — no hardcoded AMI IDs |
| `aws_security_group` | Firewall rules: allows SSH (22), HTTP (80), HTTPS (443) inbound; all outbound |
| `aws_instance` | The actual EC2 virtual machine |

**Key features:**
- `user_data` script automatically installs Apache web server on boot
- `root_block_device` — 8GB encrypted SSD (gp3)
- `metadata_options` — enforces IMDSv2 (security best practice, prevents SSRF attacks)
- Uses `t2.micro` — **AWS Free Tier eligible**

**Why data source for AMI?** Hardcoding `ami-123456` breaks when AWS updates images or when you switch regions. The data source always finds the latest one.

#### `variables.tf` — Accepts instance type, VPC ID, subnet ID, SSH key name
#### `outputs.tf` — Exports instance ID, public IP, DNS, security group ID (DB module needs the SG ID)

---

### 14–16. `modules/storage/` — S3 Bucket

#### `main.tf`
Creates **4 things**:

| Resource | What It Does |
|----------|-------------|
| `aws_s3_bucket` | The storage bucket itself |
| `aws_s3_bucket_versioning` | Keeps old versions of files — protects against accidental deletion |
| `aws_s3_bucket_server_side_encryption_configuration` | Encrypts all objects with AES-256 automatically |
| `aws_s3_bucket_public_access_block` | Blocks ALL public access — 4 separate flags, all set to `true` |
| `aws_s3_bucket_lifecycle_configuration` | After 90 days → move to cheaper storage; after 180 days → Glacier; delete old versions after 365 days |

**Why separate resources instead of one?** AWS provider v4+ requires separate resources for each S3 feature. This is the modern, correct way.

#### `variables.tf` — Accepts bucket name
#### `outputs.tf` — Exports bucket name, ARN, ID

---

### 17–19. `modules/database/` — RDS MySQL

#### `main.tf`
Creates **3 things**:

| Resource | What It Does |
|----------|-------------|
| `aws_db_subnet_group` | Tells RDS which subnets to use (private ones only) |
| `aws_security_group` | Allows MySQL port 3306 ONLY from the EC2 security group — not from the internet |
| `aws_db_instance` | MySQL 8.0 database, 20GB encrypted SSD, 7-day backup retention |

**Critical security detail:**
```hcl
publicly_accessible = false   ← Database cannot be reached from internet
security_groups     = [var.compute_sg_id]   ← Only EC2 can connect
```

**Why `skip_final_snapshot = true`?** For dev/learning. In production, you'd set this to `false` to create a backup before deletion.

#### `variables.tf` — Accepts DB name, username, password, instance class, VPC ID, compute SG ID
#### `outputs.tf` — Exports endpoint, port, instance ID, ARN

---

## 🛡 20. `policies/terraform.rego` — Policy-as-Code

**What it does:** Defines 7 security rules written in **Rego** (the OPA policy language). These rules check the Terraform plan BEFORE deployment.

**How it works:**
1. You run `terraform plan -out=tfplan.binary`
2. Convert to JSON: `terraform show -json tfplan.binary > tfplan.json`
3. Run checks: `conftest test tfplan.json -p policies/`

**The 7 rules:**

| Rule | What It Blocks |
|------|---------------|
| No public RDS | `publicly_accessible = true` on any database |
| S3 versioning required | Buckets without versioning |
| Approved instance types only | Anything other than `t2.micro` / `t3.micro` |
| Required tags | Resources missing `Project`, `Environment`, `ManagedBy` tags |
| EBS encryption | Unencrypted EC2 root volumes |
| No public MySQL port | Security groups exposing port 3306 to `0.0.0.0/0` |
| RDS encryption | Unencrypted RDS storage |

**Why:** This is "shift-left security" — catch violations before they reach AWS, not after.

---

## 🗄 21. `bootstrap/main.tf` — Remote State Backend

**What it does:** Creates the S3 bucket + DynamoDB table that Terraform uses to store its own state file remotely.

**Why remote state?**
- Local state (`terraform.tfstate`) is on your laptop — if your laptop dies, you lose track of what's deployed
- Remote state in S3 is backed up, versioned, and encrypted
- DynamoDB locking prevents two people from running `terraform apply` at the same time

**How to use:**
```bash
cd bootstrap/
terraform init && terraform apply    # Create the backend
cd ..
# Uncomment the backend "s3" block in main.tf
terraform init -migrate-state        # Move state to S3
```

---

## 💰 Cost Breakdown — What Will This Cost?

### Free Tier Eligible (12-month AWS Free Tier)

| Resource | Free Tier Allowance | This Project Uses | Monthly Cost |
|----------|-------------------|-------------------|-------------|
| EC2 (t2.micro) | 750 hrs/month | 1 instance | **$0.00** |
| RDS (db.t3.micro) | 750 hrs/month | 1 instance, 20GB | **$0.00** |
| S3 | 5GB storage | ~0 GB | **$0.00** |
| EBS (gp3) | 30GB | 8GB | **$0.00** |

### ⚠️ NOT Free Tier — These WILL Cost Money

| Resource | Cost | Monthly Estimate |
|----------|------|-----------------|
| **NAT Gateway** | $0.045/hr + $0.045/GB | **~$32–35/month** |
| **Elastic IP** (if unused) | $0.005/hr | **~$3.60/month** |
| DynamoDB (state lock) | Pay-per-request | **~$0.00** (minimal) |
| S3 (state bucket) | $0.023/GB | **~$0.00** (tiny file) |

### 📊 Total Estimated Cost

| Scenario | Monthly Cost |
|----------|-------------|
| **With NAT Gateway** (as coded) | **~$35–40/month** |
| **Without NAT Gateway** (remove it) | **~$0/month** (free tier) |

> **💡 Tip:** If you just need this for a submission/demo, deploy → take screenshots → destroy immediately. You'll pay only cents for a few hours.

### How to Remove NAT Gateway to Save Money

If you want $0 cost, remove/comment out these resources from `modules/networking/main.tf`:
- `aws_eip.nat`
- `aws_nat_gateway.main`
- The NAT route in `aws_route_table.private`

The private subnets won't have outbound internet, but RDS doesn't need it.

---

## 🧹 How to Destroy EVERYTHING (Revoke All Configuration)

### Step 1 — Destroy All Infrastructure

```bash
cd e:\sprint\task4\application\iac-project
terraform destroy
```
Type `yes` when prompted. This deletes: VPC, subnets, EC2, S3 bucket, RDS, NAT Gateway, security groups — **everything**.

### Step 2 — Destroy Bootstrap (if you set up remote state)

```bash
cd bootstrap
terraform destroy
```

### Step 3 — Verify Nothing Is Running

```bash
# Check for any remaining resources
aws ec2 describe-instances --query "Reservations[*].Instances[*].[InstanceId,State.Name]" --output table
aws rds describe-db-instances --query "DBInstances[*].[DBInstanceIdentifier,DBInstanceStatus]" --output table
aws s3 ls
```

All should be empty/terminated.

### Step 4 — Revoke AWS CLI Credentials (Optional)

If you want to deactivate your AWS access keys:

```bash
# Remove local credentials
aws configure set aws_access_key_id ""
aws configure set aws_secret_access_key ""

# Or delete the credentials file entirely
del %USERPROFILE%\.aws\credentials
del %USERPROFILE%\.aws\config
```

To deactivate the key in AWS Console:
1. Go to **IAM → Users → Your User → Security Credentials**
2. Find your Access Key → Click **Deactivate** or **Delete**

### Step 5 — Clean Local Terraform Files

```bash
cd e:\sprint\task4\application\iac-project
rmdir /s /q .terraform
del terraform.tfstate
del terraform.tfstate.backup
del .terraform.lock.hcl
```

---

## 📊 Complete Resource Breakdown (22 Resources)

### Networking (12 resources)

| # | Resource | What |
|---|----------|------|
| 1 | `aws_vpc` | The VPC itself |
| 2 | `aws_internet_gateway` | Internet access for public subnets |
| 3 | `aws_subnet` (public 1) | Public subnet in AZ-a |
| 4 | `aws_subnet` (public 2) | Public subnet in AZ-b |
| 5 | `aws_subnet` (private 1) | Private subnet in AZ-a |
| 6 | `aws_subnet` (private 2) | Private subnet in AZ-b |
| 7 | `aws_route_table` (public) | Routes for public subnets |
| 8 | `aws_route_table` (private) | Routes for private subnets |
| 9 | `aws_route_table_association` (public 1) | Links public subnet 1 to public RT |
| 10 | `aws_route_table_association` (public 2) | Links public subnet 2 to public RT |
| 11 | `aws_route_table_association` (private 1) | Links private subnet 1 to private RT |
| 12 | `aws_route_table_association` (private 2) | Links private subnet 2 to private RT |

### Compute (2 resources)

| # | Resource | What |
|---|----------|------|
| 13 | `aws_security_group` (EC2) | Firewall: SSH + HTTP + HTTPS |
| 14 | `aws_instance` | The EC2 virtual machine |

### Storage (5 resources)

| # | Resource | What |
|---|----------|------|
| 15 | `aws_s3_bucket` | The storage bucket |
| 16 | `aws_s3_bucket_versioning` | File versioning |
| 17 | `aws_s3_bucket_server_side_encryption` | AES-256 encryption |
| 18 | `aws_s3_bucket_public_access_block` | Blocks all public access |
| 19 | `aws_s3_bucket_lifecycle_configuration` | Auto-archive old files |

### Database (3 resources)

| # | Resource | What |
|---|----------|------|
| 20 | `aws_db_subnet_group` | Tells RDS which subnets to use |
| 21 | `aws_security_group` (RDS) | Firewall: MySQL only from EC2 |
| 22 | `aws_db_instance` | The MySQL database |

**Total = 12 + 2 + 5 + 3 = 22 resources**

---

## 🔄 How Files Connect Together (Data Flow)

```
terraform.tfvars          ← You provide values here
       │
       ▼
variables.tf              ← Declares what values are expected
       │
       ▼
main.tf                   ← Passes values to modules
       │
       ├──► modules/networking/  ──► Creates VPC, subnets
       │         │
       │         ▼ (exports vpc_id, subnet_ids)
       │
       ├──► modules/compute/     ──► Creates EC2 (needs vpc_id, subnet_id)
       │         │
       │         ▼ (exports security_group_id)
       │
       ├──► modules/storage/     ──► Creates S3 bucket
       │
       └──► modules/database/    ──► Creates RDS (needs vpc_id, private_subnets, compute_sg_id)
                 │
                 ▼
outputs.tf                ← Collects and displays results from all modules
```

**Dependency chain:** Networking → Compute → Database (Terraform figures this out automatically from the variable references).

---

> **Bottom line:** Deploy → screenshot → destroy. Total cost = a few cents. Don't leave resources running overnight unless you want a surprise bill from the NAT Gateway.
