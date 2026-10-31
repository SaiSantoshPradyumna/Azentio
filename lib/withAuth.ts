import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authorize, SESSION_AUDIENCE, type Actor, type Resource } from "./authorize";
import { audit } from "./audit";
import { actorFromSessionId, SESSION_COOKIE } from "./session";

export type RouteParams = Record<string, string | string[]>;

export type AuthContext = { actor: Actor; params: RouteParams };

export type AuthedHandler = (req: NextRequest, ctx: AuthContext) => Response | Promise<Response>;

export type AudienceContext = { params: RouteParams; actor: Actor };

export type WithAuthOptions = {
  /**
   * Resource audience. "session" marks a self-scoped endpoint (Section 17). A function may return
   * null to mean "no such record", which answers 404 so existence does not leak.
   */
  audience: string | ((req: NextRequest, ctx: AudienceContext) => string | null);
  action: string;
  /** Only for endpoints on the Section 7.4 public list. */
  public?: boolean;
  /**
   * The audience was taken from a database record, so a tenant mismatch means "you cannot see that
   * record" and answers 404 rather than 403 (Section 7.4 cross-tenant rule).
   */
  record?: boolean;
};

/** Authorised data is never cached (Section 12). */
function noStore<T extends Response>(response: T): T {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/**
 * Denials that mean "this record is not yours to see". On a record-scoped route they answer 404, so
 * existence never leaks to a caller from another organisation (Section 7.4).
 */
export const CROSS_TENANT_DENY_REASONS: ReadonlySet<string> = new Set([
  "not the active organisation",
  "resource tenant does not match audience",
]);

export function withAuth(handler: AuthedHandler, options: WithAuthOptions) {
  return async function route(request: NextRequest, context?: { params?: RouteParams }): Promise<Response> {
    const params = context?.params ?? {};

    if (options.public) {
      return handler(request, { actor: null, params });
    }

    const { actor } = actorFromSessionId(request.cookies.get(SESSION_COOKIE)?.value);

    // Resolve audience even without a session so public reads (e.g. media) can pass Section 7.3
    // step 2. A missing record still answers 404 without confirming existence to strangers.
    const audience =
      typeof options.audience === "function" ? options.audience(request, { params, actor }) : options.audience;

    if (audience === null) {
      audit(actor, options.action, "record", "deny", actor ? "record not found" : "unauthenticated");
      // Anonymous missing-record: 401 (do not confirm the id). Authenticated missing: 404.
      if (!actor) {
        return noStore(NextResponse.json({ error: "unauthenticated" }, { status: 401 }));
      }
      return noStore(NextResponse.json({ error: "not found" }, { status: 404 }));
    }

    // Self-scoped endpoints: the caller only needs a live session.
    if (audience === SESSION_AUDIENCE) {
      if (!actor) {
        audit(null, options.action, SESSION_AUDIENCE, "deny", "unauthenticated");
        return noStore(NextResponse.json({ error: "unauthenticated" }, { status: 401 }));
      }
      audit(actor, options.action, SESSION_AUDIENCE, "allow", "active session");
      return noStore(await handler(request, { actor, params }));
    }

    const resource: Resource = { audience };
    const decision = authorize(actor, options.action, resource);

    // Unauthenticated + non-public: 401 before revealing whether a private resource exists.
    if (!actor && !decision.allow) {
      audit(null, options.action, audience === "public" ? audience : "record", "deny", "unauthenticated");
      if (options.record && audience !== "public") {
        return noStore(NextResponse.json({ error: "unauthenticated" }, { status: 401 }));
      }
      return noStore(NextResponse.json({ error: "unauthenticated" }, { status: 401 }));
    }

    audit(actor, options.action, audience, decision.allow ? "allow" : "deny", decision.reason);

    if (!decision.allow) {
      const crossTenant = CROSS_TENANT_DENY_REASONS.has(decision.reason);
      if (options.record && crossTenant) return notFound();
      // Section 16: non-public media denial is 404 so existence does not leak.
      if (options.record && audience !== "public") return notFound();
      return noStore(NextResponse.json({ error: "forbidden" }, { status: 403 }));
    }

    return noStore(await handler(request, { actor, params }));
  };
}

/** Cross-tenant or unknown record lookups must not leak existence (Section 7.4). */
export function notFound(): NextResponse {
  return noStore(NextResponse.json({ error: "not found" }, { status: 404 }));
}

export function forbidden(): NextResponse {
  return noStore(NextResponse.json({ error: "forbidden" }, { status: 403 }));
}

export function badRequest(message: string, fields?: Record<string, string>): NextResponse {
  return noStore(NextResponse.json(fields ? { error: message, fields } : { error: message }, { status: 400 }));
}

export function conflict(message: string): NextResponse {
  return noStore(NextResponse.json({ error: message }, { status: 409 }));
}

/** Maps a rejected lifecycle operation onto the Section 7.4 status codes. */
export function failure(status: 403 | 404 | 409, reason: string): NextResponse {
  if (status === 404) return notFound();
  if (status === 409) return conflict(reason);
  return forbidden();
}
