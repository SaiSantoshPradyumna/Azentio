PRAGMA foreign_keys = ON;

CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE employee_provisioning (email TEXT PRIMARY KEY, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE platform_grants (user_id TEXT NOT NULL, permission TEXT NOT NULL, PRIMARY KEY (user_id, permission));

CREATE TABLE tenants (id TEXT PRIMARY KEY, name TEXT NOT NULL, industry TEXT NOT NULL, region TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active');
CREATE TABLE memberships (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, tenant_id TEXT NOT NULL,
  client_role TEXT NOT NULL CHECK (client_role IN ('client_admin','contributor','viewer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  UNIQUE (user_id, tenant_id));
CREATE TABLE invitations (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, tenant_id TEXT NOT NULL, email TEXT NOT NULL,
  client_role TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT, created_by TEXT NOT NULL);

CREATE TABLE products (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, tagline TEXT NOT NULL, summary TEXT NOT NULL);
CREATE TABLE entitlements (tenant_id TEXT NOT NULL, product_id TEXT NOT NULL, PRIMARY KEY (tenant_id, product_id));

CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, active_tenant_id TEXT, created_at TEXT NOT NULL,
  last_seen TEXT NOT NULL, expires_at TEXT NOT NULL, revoked INTEGER NOT NULL DEFAULT 0);
CREATE TABLE otp_codes (email TEXT NOT NULL, code_hash TEXT NOT NULL, expires_at TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0);

CREATE TABLE contributions (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, author_id TEXT NOT NULL,
  type TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, topic TEXT NOT NULL, offering_slug TEXT NOT NULL,
  industry TEXT NOT NULL, region TEXT NOT NULL, period TEXT NOT NULL, evidence_type TEXT NOT NULL, confidence TEXT NOT NULL,
  sharing_choice TEXT NOT NULL CHECK (sharing_choice IN ('private','organisation','community')),
  attribution_requested INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL CHECK (state IN ('Draft','Submitted','In review','Returned','Published','Unpublished','Rejected','Withdrawn')),
  version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE contribution_flags (id TEXT PRIMARY KEY, contribution_id TEXT NOT NULL, kind TEXT NOT NULL, snippet TEXT NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 0, resolved_by TEXT);
CREATE TABLE shared_views (id TEXT PRIMARY KEY, contribution_id TEXT NOT NULL, version INTEGER NOT NULL,
  title TEXT NOT NULL, summary TEXT NOT NULL, topic TEXT NOT NULL, offering_slug TEXT NOT NULL, industry TEXT NOT NULL,
  region_coarse TEXT NOT NULL, period_quarter TEXT NOT NULL, evidence_type TEXT NOT NULL, confidence TEXT NOT NULL,
  attribution TEXT, state TEXT NOT NULL DEFAULT 'live' CHECK (state IN ('live','superseded','suspended')), published_at TEXT NOT NULL);
CREATE TABLE consents (id TEXT PRIMARY KEY, contribution_id TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('process','publish','attribute','train')),
  granted INTEGER NOT NULL, policy_version TEXT NOT NULL, at TEXT NOT NULL, actor_id TEXT NOT NULL);
CREATE TABLE moderation_decisions (id TEXT PRIMARY KEY, contribution_id TEXT NOT NULL, moderator_id TEXT NOT NULL,
  decision TEXT NOT NULL, reason TEXT NOT NULL, internal_note TEXT, at TEXT NOT NULL);
CREATE TABLE reports (id TEXT PRIMARY KEY, shared_view_id TEXT NOT NULL, reporter_user_id TEXT NOT NULL, reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', at TEXT NOT NULL);

CREATE TABLE themes (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, title TEXT NOT NULL, offering_slug TEXT NOT NULL,
  topic_key TEXT NOT NULL, description TEXT NOT NULL, limitation TEXT NOT NULL, updated_at TEXT NOT NULL);
-- theme membership is computed by topic_key + offering_slug at read time; there is NO stored aggregate.

CREATE TABLE ideas (id TEXT PRIMARY KEY, title TEXT NOT NULL, problem TEXT NOT NULL, offering_slug TEXT NOT NULL,
  outcome TEXT NOT NULL, owner_team TEXT NOT NULL, priority TEXT NOT NULL, status TEXT NOT NULL, theme_id TEXT,
  created_by TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE idea_evidence_grants (idea_id TEXT NOT NULL, shared_view_id TEXT NOT NULL, PRIMARY KEY (idea_id, shared_view_id));
CREATE TABLE idea_status_history (id TEXT PRIMARY KEY, idea_id TEXT NOT NULL, from_status TEXT, to_status TEXT NOT NULL,
  reason TEXT NOT NULL, actor_id TEXT NOT NULL, at TEXT NOT NULL);
CREATE TABLE idea_public_updates (id TEXT PRIMARY KEY, idea_id TEXT NOT NULL, text TEXT NOT NULL, approved_by TEXT NOT NULL, at TEXT NOT NULL);

CREATE TABLE notifications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL, message TEXT NOT NULL,
  idempotency_key TEXT UNIQUE NOT NULL, channel TEXT NOT NULL DEFAULT 'in_app', status TEXT NOT NULL DEFAULT 'stored',
  created_at TEXT NOT NULL, read_at TEXT);
CREATE TABLE audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, actor_id TEXT, active_tenant_id TEXT,
  action TEXT NOT NULL, resource TEXT NOT NULL, decision TEXT NOT NULL, reason TEXT NOT NULL, prev_hash TEXT NOT NULL, hash TEXT NOT NULL);

CREATE TABLE media_assets (id TEXT PRIMARY KEY, title TEXT NOT NULL, file_path TEXT NOT NULL, mime TEXT NOT NULL,
  audience TEXT NOT NULL, kind TEXT NOT NULL);
CREATE TABLE content_blocks (id TEXT PRIMARY KEY, key TEXT UNIQUE NOT NULL, body TEXT NOT NULL, audience TEXT NOT NULL);
CREATE TABLE broadcasts (id TEXT PRIMARY KEY, title TEXT NOT NULL, media_id TEXT, audience TEXT NOT NULL, starts_at TEXT NOT NULL);
CREATE TABLE playground_runs (id TEXT PRIMARY KEY, tenant_id TEXT, user_id TEXT NOT NULL, scenario TEXT NOT NULL,
  input_json TEXT NOT NULL, output_json TEXT NOT NULL, feedback_json TEXT, created_at TEXT NOT NULL);
CREATE TABLE enquiries (id TEXT PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL, org TEXT, message TEXT, created_at TEXT NOT NULL);
CREATE TABLE support_grants (id TEXT PRIMARY KEY, requested_by TEXT NOT NULL, tenant_id TEXT NOT NULL, approved_by_client TEXT,
  approved_by_azentio TEXT, scope TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE TABLE config (key TEXT PRIMARY KEY, value TEXT NOT NULL);
