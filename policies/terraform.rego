# =============================================================================
# Policy-as-Code — OPA (Open Policy Agent) Rego Policies
# =============================================================================
# These policies enforce security and compliance rules on the Terraform plan.
# Run with: conftest test tfplan.json -p policies/
#
# Workflow:
#   1. terraform plan -out=tfplan.binary
#   2. terraform show -json tfplan.binary > tfplan.json
#   3. conftest test tfplan.json -p policies/
# =============================================================================

package terraform.policies

import rego.v1

# ---------------------------------------------------------------------------
# Policy 1: RDS instances must NOT be publicly accessible
# ---------------------------------------------------------------------------
deny contains msg if {
    resource := input.resource_changes[_]
    resource.type == "aws_db_instance"
    resource.change.after.publicly_accessible == true
    msg := sprintf(
        "DENIED: RDS instance '%s' must not be publicly accessible.",
        [resource.address]
    )
}

# ---------------------------------------------------------------------------
# Policy 2: S3 buckets must have versioning enabled
# ---------------------------------------------------------------------------
deny contains msg if {
    resource := input.resource_changes[_]
    resource.type == "aws_s3_bucket_versioning"
    resource.change.after.versioning_configuration[_].status != "Enabled"
    msg := sprintf(
        "DENIED: S3 bucket versioning '%s' must be enabled.",
        [resource.address]
    )
}

# ---------------------------------------------------------------------------
# Policy 3: EC2 instances must use approved instance types (free tier)
# ---------------------------------------------------------------------------
approved_instance_types := {"t2.micro", "t3.micro"}

deny contains msg if {
    resource := input.resource_changes[_]
    resource.type == "aws_instance"
    not resource.change.after.instance_type in approved_instance_types
    msg := sprintf(
        "DENIED: EC2 instance '%s' uses unapproved type '%s'. Allowed: %v",
        [resource.address, resource.change.after.instance_type, approved_instance_types]
    )
}

# ---------------------------------------------------------------------------
# Policy 4: All resources must have required tags
# ---------------------------------------------------------------------------
required_tags := {"Project", "Environment", "ManagedBy"}

deny contains msg if {
    resource := input.resource_changes[_]
    tags := resource.change.after.tags
    tags != null
    missing := required_tags - {key | tags[key]}
    count(missing) > 0
    msg := sprintf(
        "DENIED: Resource '%s' is missing required tags: %v",
        [resource.address, missing]
    )
}

# ---------------------------------------------------------------------------
# Policy 5: EBS volumes must be encrypted
# ---------------------------------------------------------------------------
deny contains msg if {
    resource := input.resource_changes[_]
    resource.type == "aws_instance"
    block := resource.change.after.root_block_device[_]
    block.encrypted != true
    msg := sprintf(
        "DENIED: EC2 instance '%s' has an unencrypted root volume.",
        [resource.address]
    )
}

# ---------------------------------------------------------------------------
# Policy 6: Security groups must not allow unrestricted ingress (0.0.0.0/0)
#            on the database port (3306)
# ---------------------------------------------------------------------------
deny contains msg if {
    resource := input.resource_changes[_]
    resource.type == "aws_security_group"
    ingress := resource.change.after.ingress[_]
    ingress.from_port <= 3306
    ingress.to_port >= 3306
    cidr := ingress.cidr_blocks[_]
    cidr == "0.0.0.0/0"
    msg := sprintf(
        "DENIED: Security group '%s' allows public access to MySQL port 3306.",
        [resource.address]
    )
}

# ---------------------------------------------------------------------------
# Policy 7: RDS storage must be encrypted
# ---------------------------------------------------------------------------
deny contains msg if {
    resource := input.resource_changes[_]
    resource.type == "aws_db_instance"
    resource.change.after.storage_encrypted != true
    msg := sprintf(
        "DENIED: RDS instance '%s' must have storage encryption enabled.",
        [resource.address]
    )
}
