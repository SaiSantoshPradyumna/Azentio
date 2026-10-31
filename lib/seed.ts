import fs from "node:fs";
import path from "node:path";
import { applySchema, createDbFile, dropAllData, dataDir } from "./db";
import { coarseQuarter, coarseRegion, scan } from "./scanner";
import { PRODUCTS, EMPLOYEES, TENANTS, CLIENT_USERS } from "./seed-data-core";
import {
  CONTRIBUTIONS,
  THEMES,
  IDEA,
  MEDIA,
  MEDIA_PLACEHOLDER_LABEL,
  CONTENT_BLOCKS,
  SEED_CREATED_AT,
} from "./seed-data-content";

function run(): void {
  const db = createDbFile();
  dropAllData(db);
  applySchema(db);

  const insert = {
    user: db.prepare("INSERT INTO users (id, email, name, created_at) VALUES (?, ?, ?, ?)"),
    prov: db.prepare("INSERT INTO employee_provisioning (email, active) VALUES (?, 1)"),
    grant: db.prepare("INSERT INTO platform_grants (user_id, permission) VALUES (?, ?)"),
    tenant: db.prepare("INSERT INTO tenants (id, name, industry, region, status) VALUES (?, ?, ?, ?, 'active')"),
    product: db.prepare("INSERT INTO products (id, slug, name, tagline, summary) VALUES (?, ?, ?, ?, ?)"),
    entitlement: db.prepare("INSERT INTO entitlements (tenant_id, product_id) VALUES (?, ?)"),
    membership: db.prepare("INSERT INTO memberships (id, user_id, tenant_id, client_role, status) VALUES (?, ?, ?, ?, ?)"),
    contribution: db.prepare(
      `INSERT INTO contributions (id, tenant_id, author_id, type, title, body, topic, offering_slug, industry, region,
        period, evidence_type, confidence, sharing_choice, attribution_requested, state, version, created_at, updated_at)
       VALUES (@id, @tenant_id, @author_id, @type, @title, @body, @topic, @offering_slug, @industry, @region,
        @period, @evidence_type, @confidence, @sharing_choice, @attribution_requested, @state, 1, @created_at, @updated_at)`,
    ),
    consent: db.prepare("INSERT INTO consents (id, contribution_id, purpose, granted, policy_version, at, actor_id) VALUES (?, ?, ?, ?, 'v1', ?, ?)"),
    sharedView: db.prepare(
      `INSERT INTO shared_views (id, contribution_id, version, title, summary, topic, offering_slug, industry,
        region_coarse, period_quarter, evidence_type, confidence, attribution, state, published_at)
       VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'live', ?)`,
    ),
    flag: db.prepare("INSERT INTO contribution_flags (id, contribution_id, kind, snippet, resolved, resolved_by) VALUES (?, ?, ?, ?, 0, NULL)"),
    decision: db.prepare("INSERT INTO moderation_decisions (id, contribution_id, moderator_id, decision, reason, internal_note, at) VALUES (?, ?, ?, ?, ?, ?, ?)"),
    theme: db.prepare("INSERT INTO themes (id, slug, title, offering_slug, topic_key, description, limitation, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"),
    idea: db.prepare("INSERT INTO ideas (id, title, problem, offering_slug, outcome, owner_team, priority, status, theme_id, created_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"),
    evidence: db.prepare("INSERT INTO idea_evidence_grants (idea_id, shared_view_id) VALUES (?, ?)"),
    history: db.prepare("INSERT INTO idea_status_history (id, idea_id, from_status, to_status, reason, actor_id, at) VALUES (?, ?, ?, ?, ?, ?, ?)"),
    update: db.prepare("INSERT INTO idea_public_updates (id, idea_id, text, approved_by, at) VALUES (?, ?, ?, ?, ?)"),
    media: db.prepare("INSERT INTO media_assets (id, title, file_path, mime, audience, kind) VALUES (?, ?, ?, ?, ?, ?)"),
    block: db.prepare("INSERT INTO content_blocks (id, key, body, audience) VALUES (?, ?, ?, ?)"),
    notification: db.prepare("INSERT OR IGNORE INTO notifications (id, user_id, kind, message, idempotency_key, channel, status, created_at) VALUES (?, ?, ?, ?, ?, 'in_app', 'stored', ?)"),
    config: db.prepare("INSERT INTO config (key, value) VALUES (?, ?)"),
  };

  const productId = new Map<string, string>();
  for (const p of PRODUCTS) {
    const id = `product-${p.slug}`;
    insert.product.run(id, p.slug, p.name, p.tagline, p.summary);
    productId.set(p.slug, id);
  }

  for (const t of TENANTS) {
    insert.tenant.run(t.id, t.name, t.industry, t.region);
    for (const slug of t.entitledProducts) insert.entitlement.run(t.id, productId.get(slug)!);
  }

  for (const e of EMPLOYEES) {
    const id = `user-${e.email.split("@")[0]}`;
    insert.user.run(id, e.email, e.name, SEED_CREATED_AT);
    insert.prov.run(e.email);
    for (const permission of e.grants) insert.grant.run(id, permission);
  }

  const userIdByEmail = new Map<string, string>();
  for (const u of CLIENT_USERS) {
    const local = u.email.split("@")[0].replace(".", "-");
    const id = `user-${local}-${u.email.split("@")[1]}`;
    userIdByEmail.set(u.email, id);
    insert.user.run(id, u.email, u.name, SEED_CREATED_AT);
    for (const m of u.memberships) insert.membership.run(`membership-${id}-${m.tenantId}`, id, m.tenantId, m.role, m.status);
  }

  const tenantById = new Map(TENANTS.map((t) => [t.id, t]));
  const moderatorId = "user-meera.mod";
  const sharedViewIdByKey = new Map<string, string>();

  for (const c of CONTRIBUTIONS) {
    const tenant = tenantById.get(c.tenantKey)!;
    const id = `contribution-${c.key}`;
    const authorId = userIdByEmail.get(c.authorEmail)!;
    insert.contribution.run({
      id,
      tenant_id: tenant.id,
      author_id: authorId,
      type: c.type,
      title: c.title,
      body: c.body,
      topic: c.topic,
      offering_slug: c.offeringSlug,
      industry: tenant.industry,
      region: tenant.region,
      period: c.period,
      evidence_type: c.evidenceType,
      confidence: c.confidence,
      sharing_choice: c.sharingChoice,
      attribution_requested: 0,
      state: c.state,
      created_at: SEED_CREATED_AT,
      updated_at: c.publishedAt ?? SEED_CREATED_AT,
    });

    const publishGranted = c.sharingChoice === "community" ? 1 : 0;
    const purposes: [string, number][] = [
      ["process", 1],
      ["publish", publishGranted],
      ["attribute", 0],
      ["train", 0],
    ];
    for (const [purpose, granted] of purposes) {
      insert.consent.run(`consent-${id}-${purpose}`, id, purpose, granted, SEED_CREATED_AT, authorId);
    }

    if (c.state === "Published" && c.sharedSummary) {
      const svId = `shared-view-${id}`;
      sharedViewIdByKey.set(c.key, svId);
      insert.sharedView.run(
        svId,
        id,
        c.title,
        c.sharedSummary,
        c.topic,
        c.offeringSlug,
        tenant.industry,
        coarseRegion(tenant.region),
        coarseQuarter(c.period),
        c.evidenceType,
        c.confidence,
        c.publishedAt,
      );
      insert.decision.run(
        `moderation-${id}`,
        id,
        moderatorId,
        "Published",
        "De-identified summary approved for community sharing.",
        "Original body retained privately; region and period coarsened before publishing.",
        c.publishedAt,
      );
    }

    if (c.state === "Submitted") {
      // Scanned with the product scanner, not a seed copy, so the queue shows what a moderator would see.
      scan(c.body).forEach((flag, index) => {
        insert.flag.run(`flag-${id}-${index}`, id, flag.kind, flag.snippet);
      });
      insert.notification.run(
        `notification-review-${id}`,
        moderatorId,
        "moderation.queue",
        `A submitted observation "${c.title}" is ready for review.`,
        `moderation-queue-${id}`,
        SEED_CREATED_AT,
      );
    }
  }

  for (const t of THEMES) {
    insert.theme.run(t.key, t.slug, t.title, t.offeringSlug, t.topicKey, t.description, t.limitation, SEED_CREATED_AT);
  }

  const ideaId = IDEA.key;
  const ownerId = "user-rohan.po";
  insert.idea.run(
    ideaId,
    IDEA.title,
    IDEA.problem,
    IDEA.offeringSlug,
    IDEA.outcome,
    IDEA.ownerTeam,
    IDEA.priority,
    IDEA.status,
    IDEA.themeKey,
    ownerId,
    SEED_CREATED_AT,
  );
  for (const key of IDEA.evidenceContributionKeys) {
    insert.evidence.run(ideaId, sharedViewIdByKey.get(key)!);
  }
  insert.history.run("idea-history-1", ideaId, "Proposed", "Under review", "Three organisations describe the same gap.", ownerId, SEED_CREATED_AT);
  insert.update.run("idea-update-1", ideaId, IDEA.publicUpdate, "user-meera.mod", SEED_CREATED_AT);

  const mediaDir = path.join(dataDir(), "private-media");
  fs.mkdirSync(mediaDir, { recursive: true });
  for (const m of MEDIA) {
    const file = path.join(mediaDir, m.relPath);
    fs.writeFileSync(file, `${MEDIA_PLACEHOLDER_LABEL}: ${m.title} (synthetic, no audio/video content)\n`);
    insert.media.run(m.key, m.title, `data/private-media/${m.relPath}`, m.mime, m.audience, m.kind);
  }

  for (const b of CONTENT_BLOCKS) {
    insert.block.run(`content-${b.key}`, b.key, b.body, b.audience);
  }

  insert.config.run("visibility_epoch", "1");
  insert.config.run("policy_version", "v1");

  const counts: Record<string, number> = {};
  for (const table of ["products", "users", "tenants", "memberships", "contributions", "shared_views", "themes", "ideas"]) {
    counts[table] = (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
  }
  db.close();

  console.log("Seed complete (synthetic data).");
  console.log(JSON.stringify(counts, null, 2));
  console.log(`Database: ${path.join(dataDir(), "app.db")}`);
}

run();
