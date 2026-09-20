// Role groupings shared by server and client code.
export const SITE_ROLES = ["SITE_ENGINEER", "SITE_SUPERVISOR", "CONTRACTOR"] as const;
export const isSiteRole = (role: string) => (SITE_ROLES as readonly string[]).includes(role);
