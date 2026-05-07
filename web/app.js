const MODULE_META = {
  "module.networking": { key: "networking", label: "Networking", color: "#3b82f6" },
  "module.compute":    { key: "compute",    label: "Compute",    color: "#22c55e" },
  "module.storage":    { key: "storage",    label: "Storage",    color: "#f59e0b" },
  "module.database":   { key: "database",   label: "Database",   color: "#a855f7" },
};

const TYPE_LABELS = {
  "aws_vpc": "VPC",
  "aws_internet_gateway": "Internet Gateway",
  "aws_subnet": "Subnet",
  "aws_route_table": "Route Table",
  "aws_route_table_association": "Route Table Association",
  "aws_security_group": "Security Group",
  "aws_instance": "EC2 Instance",
  "aws_s3_bucket": "S3 Bucket",
  "aws_s3_bucket_versioning": "S3 Versioning",
  "aws_s3_bucket_server_side_encryption_configuration": "S3 Encryption",
  "aws_s3_bucket_public_access_block": "S3 Public Access Block",
  "aws_s3_bucket_lifecycle_configuration": "S3 Lifecycle",
  "aws_db_subnet_group": "DB Subnet Group",
  "aws_db_instance": "RDS Instance",
};

const KEY_ATTRS = {
  "aws_vpc": ["cidr_block"],
  "aws_subnet": ["cidr_block", "availability_zone", "map_public_ip_on_launch"],
  "aws_instance": ["instance_type", "ami", "public_ip", "public_dns"],
  "aws_s3_bucket": ["bucket"],
  "aws_db_instance": ["engine", "engine_version", "instance_class", "endpoint", "publicly_accessible"],
  "aws_security_group": ["name", "description"],
  "aws_db_subnet_group": ["name"],
};

// Expected resources when infrastructure is deployed
const EXPECTED_RESOURCES = [
  { module: "networking", type: "aws_vpc",                    label: "VPC",                   desc: "10.0.0.0/16" },
  { module: "networking", type: "aws_internet_gateway",       label: "Internet Gateway",      desc: "Public internet access" },
  { module: "networking", type: "aws_subnet",                 label: "Public Subnet 1",       desc: "10.0.1.0/24 | ap-south-1a" },
  { module: "networking", type: "aws_subnet",                 label: "Public Subnet 2",       desc: "10.0.2.0/24 | ap-south-1b" },
  { module: "networking", type: "aws_subnet",                 label: "Private Subnet 1",      desc: "10.0.101.0/24 | ap-south-1a" },
  { module: "networking", type: "aws_subnet",                 label: "Private Subnet 2",      desc: "10.0.102.0/24 | ap-south-1b" },
  { module: "networking", type: "aws_route_table",            label: "Public Route Table",    desc: "Routes to IGW" },
  { module: "networking", type: "aws_route_table",            label: "Private Route Table",   desc: "Local only" },
  { module: "networking", type: "aws_route_table_association",label: "Public RT Assoc 1",     desc: "public-1 -> public-rt" },
  { module: "networking", type: "aws_route_table_association",label: "Public RT Assoc 2",     desc: "public-2 -> public-rt" },
  { module: "networking", type: "aws_route_table_association",label: "Private RT Assoc 1",    desc: "private-1 -> private-rt" },
  { module: "networking", type: "aws_route_table_association",label: "Private RT Assoc 2",    desc: "private-2 -> private-rt" },
  { module: "compute",   type: "aws_security_group",          label: "EC2 Security Group",    desc: "SSH, HTTP, HTTPS" },
  { module: "compute",   type: "aws_instance",                label: "EC2 Instance",          desc: "t3.micro | Amazon Linux 2023" },
  { module: "storage",   type: "aws_s3_bucket",               label: "S3 Bucket",             desc: "iac-capstone-app-storage-2026" },
  { module: "storage",   type: "aws_s3_bucket_versioning",    label: "S3 Versioning",         desc: "Enabled" },
  { module: "storage",   type: "aws_s3_bucket_server_side_encryption_configuration", label: "S3 Encryption", desc: "AES-256" },
  { module: "storage",   type: "aws_s3_bucket_public_access_block", label: "S3 Public Block", desc: "All blocked" },
  { module: "storage",   type: "aws_s3_bucket_lifecycle_configuration", label: "S3 Lifecycle", desc: "90d IA, 180d Glacier" },
  { module: "database",  type: "aws_db_subnet_group",         label: "DB Subnet Group",       desc: "Private subnets" },
  { module: "database",  type: "aws_security_group",          label: "RDS Security Group",    desc: "MySQL from EC2 only" },
  { module: "database",  type: "aws_db_instance",             label: "RDS MySQL Instance",    desc: "MySQL 8.0 | db.t3.micro" },
];

let parsedResources = [];

// --- File Loading ---
const dropZone = document.getElementById("dropZone");
const stateFileInput = document.getElementById("stateFile");

stateFileInput.addEventListener("change", e => {
  if (e.target.files.length > 0) loadFile(e.target.files[0]);
});

dropZone.addEventListener("dragover", e => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", e => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  if (e.dataTransfer.files.length > 0) loadFile(e.dataTransfer.files[0]);
});

function loadFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const state = JSON.parse(e.target.result);
      parsedResources = parseState(state);
      showDashboard(parsedResources, state);
    } catch (err) {
      alert("Error parsing state file: " + err.message);
    }
  };
  reader.readAsText(file);
}

// --- State Parser ---
function parseState(state) {
  const resources = [];
  if (!state.resources) return resources;

  state.resources.forEach(res => {
    if (res.mode === "data") return;
    const modulePath = res.module || "";

    res.instances.forEach(inst => {
      const attrs = inst.attributes || {};
      const indexKey = inst.index_key;

      let address = "";
      if (modulePath) address += modulePath + ".";
      address += res.type + "." + res.name;
      if (indexKey !== undefined && indexKey !== null) address += `[${indexKey}]`;

      let moduleInfo = null;
      for (const [prefix, meta] of Object.entries(MODULE_META)) {
        if (modulePath.startsWith(prefix)) {
          moduleInfo = meta;
          break;
        }
      }

      resources.push({
        address,
        type: res.type,
        name: res.name,
        module: moduleInfo ? moduleInfo.key : "other",
        moduleLabel: moduleInfo ? moduleInfo.label : "Other",
        index: indexKey,
        attributes: attrs,
        dependencies: inst.dependencies || [],
      });
    });
  });

  return resources;
}

// --- Show Dashboard ---
function showDashboard(resources, state) {
  dropZone.classList.add("hidden");
  document.getElementById("dashboard").classList.remove("hidden");

  const version = state.terraform_version || "unknown";
  const serial = state.serial || 0;

  if (resources.length === 0) {
    showOfflineState(version, serial);
  } else {
    showOnlineState(resources, version, serial);
  }
}

// --- Offline State (0 resources) ---
function showOfflineState(version, serial) {
  document.getElementById("headerSub").textContent = `Terraform v${version} | State serial #${serial} | All destroyed`;
  document.getElementById("resourceCount").textContent = "0";
  document.getElementById("moduleCount").textContent = "0";

  // Update header dots to red
  document.querySelectorAll(".dot-green").forEach(d => {
    d.classList.remove("dot-green");
    d.classList.add("dot-red");
  });

  // Hide summary bar when nothing is deployed
  document.getElementById("summaryBar").classList.add("hidden");

  // Resource grid - show all expected resources as offline
  const grid = document.getElementById("resourceGrid");
  const moduleOrder = ["networking", "compute", "storage", "database"];
  const grouped = {};

  EXPECTED_RESOURCES.forEach(r => {
    if (!grouped[r.module]) grouped[r.module] = [];
    grouped[r.module].push(r);
  });

  grid.innerHTML = moduleOrder.map((m, idx) => {
    const items = grouped[m] || [];
    const labels = { networking: "Networking", compute: "Compute", storage: "Storage", database: "Database" };
    const meta = { label: labels[m] };
    return `
      <div class="module-section" style="animation-delay: ${idx * 0.1}s">
        <div class="module-header">
          <div class="module-dot ${m}"></div>
          <h3>${meta.label}</h3>
          <span class="module-count">${items.length} resources - offline</span>
        </div>
        <div class="module-grid">
          ${items.map(r => `
            <div class="resource-card offline">
              <div class="card-type">${r.type}</div>
              <div class="card-name">${r.label}</div>
              <div class="card-id offline-id">Not deployed</div>
              <div class="card-meta">
                <span class="meta-tag">${r.desc}</span>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }).join("");
}

// --- Online State (resources exist) ---
function showOnlineState(resources, version, serial) {
  document.getElementById("headerSub").textContent = `Terraform v${version} | State serial #${serial} | Live`;
  document.getElementById("resourceCount").textContent = resources.length;

  const modules = [...new Set(resources.map(r => r.module))];
  document.getElementById("moduleCount").textContent = modules.length;

  renderSummary(resources);
  renderGrid(resources);
}

function renderSummary(resources) {
  const bar = document.getElementById("summaryBar");
  const moduleOrder = ["networking", "compute", "storage", "database"];
  const totals = { networking: 12, compute: 2, storage: 5, database: 3 };
  const counts = {};
  const highlights = {};

  resources.forEach(r => {
    counts[r.module] = (counts[r.module] || 0) + 1;
    if (!highlights[r.module]) highlights[r.module] = [];
    const a = r.attributes;
    if (r.type === "aws_vpc" && a.cidr_block) highlights[r.module].push(a.cidr_block);
    if (r.type === "aws_instance" && a.instance_type) highlights[r.module].push(a.instance_type);
    if (r.type === "aws_instance" && a.public_ip) highlights[r.module].push(a.public_ip);
    if (r.type === "aws_s3_bucket" && a.bucket) highlights[r.module].push(a.bucket);
    if (r.type === "aws_db_instance" && a.engine) highlights[r.module].push(a.engine + " " + (a.engine_version || ""));
    if (r.type === "aws_db_instance" && a.instance_class) highlights[r.module].push(a.instance_class);
  });

  bar.innerHTML = moduleOrder
    .filter(m => counts[m])
    .map(m => {
      const detail = highlights[m] ? highlights[m].slice(0, 2).join(" | ") : "";
      return `
        <div class="summary-card ${m}">
          <div class="summary-label">${Object.values(MODULE_META).find(v => v.key === m).label}</div>
          <div class="summary-value">${counts[m]} / ${totals[m]}</div>
          <div class="summary-detail">${detail}</div>
        </div>
      `;
    }).join("");
}

function renderGrid(resources) {
  const grid = document.getElementById("resourceGrid");
  const moduleOrder = ["networking", "compute", "storage", "database", "other"];
  const grouped = {};

  resources.forEach(r => {
    if (!grouped[r.module]) grouped[r.module] = [];
    grouped[r.module].push(r);
  });

  grid.innerHTML = moduleOrder
    .filter(m => grouped[m])
    .map((m, idx) => {
      const items = grouped[m];
      const meta = Object.values(MODULE_META).find(v => v.key === m) || { label: "Other", key: "other" };
      return `
        <div class="module-section" style="animation-delay: ${idx * 0.1}s">
          <div class="module-header">
            <div class="module-dot ${meta.key}"></div>
            <h3>${meta.label}</h3>
            <span class="module-count">${items.length} resources - live</span>
          </div>
          <div class="module-grid">
            ${items.map(r => renderCard(r)).join("")}
          </div>
        </div>
      `;
    }).join("");

  document.querySelectorAll(".resource-card:not(.offline)").forEach(card => {
    card.addEventListener("click", () => {
      const addr = card.dataset.address;
      const res = parsedResources.find(r => r.address === addr);
      if (res) openDetail(res);
    });
  });
}

function renderCard(r) {
  const label = TYPE_LABELS[r.type] || r.type;
  const attrs = r.attributes;
  const resourceId = attrs.id || attrs.arn || "";

  const metaTags = [];
  const keyAttrs = KEY_ATTRS[r.type] || [];
  keyAttrs.forEach(k => {
    if (attrs[k] !== undefined && attrs[k] !== null && attrs[k] !== "") {
      let val = attrs[k];
      if (typeof val === "boolean") val = val ? "yes" : "no";
      if (String(val).length > 40) val = String(val).substring(0, 37) + "...";
      metaTags.push(`${k}: ${val}`);
    }
  });

  let indexLabel = "";
  if (r.index !== undefined && r.index !== null) indexLabel = ` [${r.index}]`;

  return `
    <div class="resource-card" data-address="${r.address}">
      <div class="card-type">${r.type}</div>
      <div class="card-name">${label}${indexLabel}</div>
      ${resourceId ? `<div class="card-id">${resourceId}</div>` : ""}
      ${metaTags.length > 0 ? `
        <div class="card-meta">
          ${metaTags.map(t => `<span class="meta-tag">${t}</span>`).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

// --- Detail Panel ---
function openDetail(r) {
  document.getElementById("detailTitle").textContent = TYPE_LABELS[r.type] || r.type;
  const attrs = r.attributes;
  let html = "";

  html += field("Terraform Address", r.address);
  html += field("Resource Type", r.type);
  html += field("Module", r.moduleLabel);
  if (attrs.id) html += field("Resource ID", attrs.id);
  if (attrs.arn) html += field("ARN", attrs.arn);

  html += `<div class="detail-section">Attributes</div>`;
  const skipKeys = new Set(["id", "arn", "tags", "tags_all", "timeouts"]);
  Object.keys(attrs).filter(k => !skipKeys.has(k)).sort().forEach(key => {
    let val = attrs[key];
    if (val === null || val === undefined || val === "") return;
    if (typeof val === "object") val = JSON.stringify(val, null, 2);
    if (typeof val === "boolean") val = val ? "true" : "false";
    html += field(key, String(val));
  });

  const tags = attrs.tags || {};
  const tagEntries = Object.entries(tags).filter(([k]) => k !== "");
  if (tagEntries.length > 0) {
    html += `<div class="detail-section">Tags</div><div class="detail-tags">`;
    tagEntries.forEach(([k, v]) => {
      html += `<span class="detail-tag"><span class="tag-key">${k}:</span> <span class="tag-val">${v}</span></span>`;
    });
    html += `</div>`;
  }

  if (r.dependencies.length > 0) {
    html += `<div class="detail-section">Dependencies (${r.dependencies.length})</div>`;
    r.dependencies.forEach(dep => {
      html += `<div class="detail-field"><div class="detail-value">${dep}</div></div>`;
    });
  }

  document.getElementById("detailBody").innerHTML = html;
  document.getElementById("detailPanel").classList.add("open");
  document.getElementById("overlay").classList.add("open");
}

function field(label, value) {
  return `
    <div class="detail-field">
      <div class="detail-label">${label}</div>
      <div class="detail-value">${escapeHtml(String(value))}</div>
    </div>
  `;
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function closeDetail() {
  document.getElementById("detailPanel").classList.remove("open");
  document.getElementById("overlay").classList.remove("open");
}

document.getElementById("closePanel").addEventListener("click", closeDetail);
document.getElementById("overlay").addEventListener("click", closeDetail);
document.addEventListener("keydown", e => { if (e.key === "Escape") closeDetail(); });
