/** Platform permission keys (Section 7.1). Safe for client and server imports. */
export const PLATFORM_PERMISSIONS = [
  "content.publish",
  "video.publish",
  "learning.moderate",
  "learning.investigate",
  "product.owner",
  "platform.role.grant",
  "org.manage",
  "audit.read",
  "support.private.read",
] as const;

export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number];
