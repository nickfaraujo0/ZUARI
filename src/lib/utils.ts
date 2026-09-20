import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...i: ClassValue[]) => twMerge(clsx(i));

// ── Time (all business dates are India Standard Time) ──────────
const IST = 5.5 * 3600e3;
const DAY = 864e5;
export const startOfToday = () => new Date(Math.floor((Date.now() + IST) / DAY) * DAY - IST);
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
export const parseDate = (s?: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00+05:30`) : null);
export const toInputDate = (d?: Date | null) => (d ? new Date(d.getTime() + IST).toISOString().slice(0, 10) : "");
const TZ = "Asia/Kolkata";
export const fmtDate = (d?: Date | null) => (d ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: TZ }) : "—");
export const fmtDay = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "long", timeZone: TZ }).toUpperCase();
export const fmtShort = (d?: Date | null) => (d ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: TZ }) : "—");
export const fmtTime = (d: Date) => d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ }).toUpperCase();
export const dayKey = (d: Date) => toInputDate(d);
export function relative(d: Date) {
  const days = Math.round((startOfToday().getTime() - new Date(dayKey(d) + "T00:00:00+05:30").getTime()) / DAY);
  if (days <= 0) return fmtTime(d);
  if (days === 1) return "Yesterday";
  return fmtShort(d);
}
export function dueLabel(d?: Date | null) {
  if (!d) return "No due date";
  const diff = Math.round((d.getTime() - startOfToday().getTime()) / DAY);
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  if (diff === -1) return "1 day overdue";
  if (diff < 0) return `${-diff} days overdue`;
  return `Due ${fmtShort(d)}`;
}

export function formatINR(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(n % 1e7 === 0 ? 0 : 1)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}
export const pct = (n: number) => `${Math.round(n)}%`;
export const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
export const greeting = () => {
  const h = new Date(Date.now() + IST).getUTCHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

// ── Labels & chip tones ────────────────────────────────────────
export const ROLE_LABEL = { DIRECTOR: "Director", PROJECT_MANAGER: "Project Manager", ACCOUNTANT: "Accountant", SITE_ENGINEER: "Site Engineer", SITE_SUPERVISOR: "Site Supervisor", CONTRACTOR: "Contractor" } as const;
export const TYPE_LABEL = { RESIDENTIAL: "Residential", COMMERCIAL: "Commercial", HOSPITALITY: "Hospitality", INSTITUTIONAL: "Institutional", OTHER: "Other" } as const;
export const TASK_STATUS = { NOT_STARTED: "Not Started", IN_PROGRESS: "In Progress", COMPLETED: "Completed", VERIFIED: "Verified" } as const;
export const PRIORITY = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", URGENT: "Urgent" } as const;
export const SEVERITY = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", CRITICAL: "Critical" } as const;
export const ISSUE_STATUS = { OPEN: "Open", ASSIGNED: "Assigned", IN_PROGRESS: "In Progress", RESOLVED: "Resolved", CLOSED: "Closed" } as const;
export const PROJECT_STATUS = { PLANNING: "Planning", ACTIVE: "Active", ON_HOLD: "On Hold", COMPLETED: "Completed" } as const;
export const HEALTH = { ON_TRACK: "On Track", AT_RISK: "At Risk", DELAYED: "Delayed", DONE: "Completed", PAUSED: "On Hold" } as const;
export type Health = keyof typeof HEALTH;

export type Tone = "green" | "amber" | "red" | "teal" | "grey" | "sand" | "dark";
export const HEALTH_TONE: Record<Health, Tone> = { ON_TRACK: "green", AT_RISK: "amber", DELAYED: "red", DONE: "teal", PAUSED: "grey" };
export const TASK_TONE: Record<string, Tone> = { NOT_STARTED: "grey", IN_PROGRESS: "teal", COMPLETED: "green", VERIFIED: "dark" };
export const PRIORITY_TONE: Record<string, Tone> = { LOW: "grey", MEDIUM: "sand", HIGH: "amber", URGENT: "red" };
export const SEVERITY_TONE: Record<string, Tone> = { LOW: "grey", MEDIUM: "sand", HIGH: "amber", CRITICAL: "red" };
export const ISSUE_TONE: Record<string, Tone> = { OPEN: "red", ASSIGNED: "amber", IN_PROGRESS: "teal", RESOLVED: "green", CLOSED: "grey" };
export const opts = (m: Record<string, string>) => Object.entries(m).map(([value, label]) => ({ value, label }));

// ── Phase 2 labels ─────────────────────────────────────────────
export const ATTENDANCE = { PRESENT: "Present", HALF: "Half day", ABSENT: "Absent" } as const;
export const TXN = { RECEIVED: "Received", CONSUMED: "Consumed", ADJUSTMENT: "Adjustment" } as const;
export const REQUEST_STATUS = { REQUESTED: "Requested", APPROVED: "Approved", ORDERED: "Ordered", FULFILLED: "Delivered", REJECTED: "Rejected" } as const;
export const PO_STATUS = { DRAFT: "Draft", APPROVED: "Approved", ORDERED: "Ordered", DELIVERED: "Delivered", CANCELLED: "Cancelled" } as const;
export const EXPENSE_CATEGORY = { LABOUR: "Labour", MATERIALS: "Materials", SUBCONTRACT: "Subcontract", EQUIPMENT: "Equipment", OVERHEADS: "Overheads", OTHER: "Other" } as const;
export const EXPENSE_STATUS = { PENDING: "Pending", APPROVED: "Approved", PAID: "Paid" } as const;
export const DOC_CATEGORY = { DRAWING: "Drawing", CONTRACT: "Contract", BOQ: "BOQ", QUOTATION: "Quotation", PURCHASE_ORDER: "Purchase order", INVOICE: "Invoice", REPORT: "Report", CERTIFICATE: "Certificate", OTHER: "Other" } as const;
export const DOC_AUDIENCE = { MANAGERS: "Managers only", PROJECT: "Project team", EXTERNAL: "Team + contractors" } as const;
export const REQUEST_TONE: Record<string, Tone> = { REQUESTED: "amber", APPROVED: "teal", ORDERED: "sand", FULFILLED: "green", REJECTED: "red" };
export const PO_TONE: Record<string, Tone> = { DRAFT: "grey", APPROVED: "teal", ORDERED: "sand", DELIVERED: "green", CANCELLED: "red" };
export const EXPENSE_TONE: Record<string, Tone> = { PENDING: "amber", APPROVED: "teal", PAID: "green" };
/** Full rupee amount with Indian digit grouping, e.g. ₹12,50,000. */
export const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
export const num = (n: number, d = 1) => (Number.isInteger(n) ? n.toLocaleString("en-IN") : n.toLocaleString("en-IN", { maximumFractionDigits: d }));
export const monthKey = (d: Date) => toInputDate(d).slice(0, 7);

export const BILL_STATUS = { DRAFT: "Draft", SUBMITTED: "Submitted", CERTIFIED: "Certified", INVOICED: "Invoiced" } as const;
export const BILL_TONE: Record<string, Tone> = { DRAFT: "grey", SUBMITTED: "amber", CERTIFIED: "teal", INVOICED: "green" };
