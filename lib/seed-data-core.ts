// Synthetic seed data from BUILD_SPEC.md Section 19. Use exactly.

export type ProductSeed = { slug: string; name: string; tagline: string; summary: string };

export const PRODUCTS: ProductSeed[] = [
  {
    slug: "credit-strategy-simulator",
    name: "Credit Strategy Simulator",
    tagline: "Simulate credit policy changes before deployment.",
    summary:
      "Compare credit policy variants against a representative portfolio in a guided, synthetic simulation, and review the trade-offs before any change is proposed for deployment.",
  },
  {
    slug: "sme-credit-decisioning",
    name: "SME Credit Decisioning Workbench",
    tagline:
      "Financial analysis, policy evaluation and recommendations with evidence and human oversight.",
    summary:
      "Structured financial analysis and policy evaluation for SME applications, with an explicit evidence list and a mandatory human approval step. Recommendations are simulated output, never credit decisions.",
  },
  {
    slug: "similar-portfolio-intelligence",
    name: "Similar Portfolio Intelligence",
    tagline: "Compare applications with relevant historical portfolio segments.",
    summary:
      "Places an application against synthetic historical portfolio segments and returns the closest matches with outcome statistics, so reviewers can reason from relevant comparisons.",
  },
  {
    slug: "riva",
    name: "RIVA",
    tagline: "Reporting intelligence, validation and analytics.",
    summary:
      "Reporting intelligence with validation checks and analytics for credit and risk reporting workflows, built for human review of every flagged item.",
  },
];

export type EmployeeSeed = {
  email: string;
  name: string;
  grants: string[];
};

export const EMPLOYEES: EmployeeSeed[] = [
  { email: "priya.admin@azentio.com", name: "Priya (Admin)", grants: ["org.manage", "platform.role.grant", "audit.read"] },
  { email: "arjun.admin@azentio.com", name: "Arjun (Admin 2)", grants: ["platform.role.grant", "audit.read"] },
  { email: "meera.mod@azentio.com", name: "Meera (Moderator)", grants: ["learning.moderate"] },
  { email: "rohan.po@azentio.com", name: "Rohan (Product Owner)", grants: ["product.owner"] },
  { email: "kavya.pub@azentio.com", name: "Kavya (Publisher)", grants: ["content.publish", "video.publish"] },
  { email: "dev.emp@azentio.com", name: "Dev (Employee)", grants: [] },
];

export type TenantSeed = {
  id: string;
  name: string;
  industry: string;
  region: string;
  entitledProducts: string[];
};

export const TENANTS: TenantSeed[] = [
  {
    id: "tenant-aurora",
    name: "Aurora Microfinance",
    industry: "Microfinance",
    region: "Bengaluru",
    entitledProducts: ["sme-credit-decisioning", "credit-strategy-simulator"],
  },
  {
    id: "tenant-beacon",
    name: "Beacon Credit",
    industry: "NBFC",
    region: "Pune",
    entitledProducts: ["sme-credit-decisioning", "similar-portfolio-intelligence"],
  },
  {
    id: "tenant-cedar",
    name: "Cedar Bank",
    industry: "Bank",
    region: "Chennai",
    entitledProducts: ["sme-credit-decisioning"],
  },
  {
    id: "tenant-delta",
    name: "Delta Leasing",
    industry: "Leasing",
    region: "Kolkata",
    entitledProducts: ["credit-strategy-simulator"],
  },
];

export type ClientUserSeed = {
  email: string;
  name: string;
  memberships: { tenantId: string; role: "client_admin" | "contributor" | "viewer"; status: "active" | "revoked" }[];
};

export const CLIENT_USERS: ClientUserSeed[] = [
  { email: "admin@aurora.example", name: "Aurora Admin", memberships: [{ tenantId: "tenant-aurora", role: "client_admin", status: "active" }] },
  { email: "maya@aurora.example", name: "Maya", memberships: [{ tenantId: "tenant-aurora", role: "contributor", status: "active" }] },
  { email: "admin@beacon.example", name: "Beacon Admin", memberships: [{ tenantId: "tenant-beacon", role: "client_admin", status: "active" }] },
  { email: "sam@beacon.example", name: "Sam", memberships: [{ tenantId: "tenant-beacon", role: "contributor", status: "active" }] },
  { email: "admin@cedar.example", name: "Cedar Admin", memberships: [{ tenantId: "tenant-cedar", role: "client_admin", status: "active" }] },
  { email: "admin@delta.example", name: "Delta Admin", memberships: [{ tenantId: "tenant-delta", role: "client_admin", status: "active" }] },
  {
    email: "shared@consult.example",
    name: "Shared Consultant",
    memberships: [
      { tenantId: "tenant-aurora", role: "viewer", status: "active" },
      { tenantId: "tenant-beacon", role: "viewer", status: "active" },
    ],
  },
  { email: "ex.member@aurora.example", name: "Former Aurora Member", memberships: [{ tenantId: "tenant-aurora", role: "contributor", status: "revoked" }] },
];
