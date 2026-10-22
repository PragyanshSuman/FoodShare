export const CATEGORY_LABEL: Record<string, string> = {
  PREPARED_MEAL: "Prepared meals",
  BAKERY: "Bakery",
  PRODUCE: "Fruit & veg",
  DAIRY: "Dairy",
  PACKAGED: "Packaged food",
  BEVERAGES: "Beverages",
  GROCERY: "Groceries",
  MIXED: "Mixed",
};

export const DIET_LABEL: Record<string, string> = {
  VEGETARIAN: "Vegetarian",
  VEGAN: "Vegan",
  EGGETARIAN: "Contains egg",
  NON_VEGETARIAN: "Non-veg",
};

export const STORAGE_LABEL: Record<string, string> = { HOT: "Hot", AMBIENT: "Room temp", CHILLED: "Chilled", FROZEN: "Frozen" };

export const CLAIM_STATUS: Record<string, { label: string; tone: "green" | "orange" | "gray" | "red" | "blue" }> = {
  PENDING_PAYMENT: { label: "Awaiting payment", tone: "orange" },
  PENDING_APPROVAL: { label: "Awaiting donor", tone: "orange" },
  CONFIRMED: { label: "Ready for pickup", tone: "blue" },
  IN_DELIVERY: { label: "Out for delivery", tone: "blue" },
  COMPLETED: { label: "Completed", tone: "green" },
  CANCELLED: { label: "Cancelled", tone: "gray" },
  REJECTED: { label: "Declined", tone: "gray" },
  NO_SHOW: { label: "Missed", tone: "red" },
  EXPIRED: { label: "Expired", tone: "gray" },
};

export const LISTING_STATUS: Record<string, { label: string; tone: "green" | "orange" | "gray" | "red" | "blue" }> = {
  DRAFT: { label: "Draft", tone: "gray" },
  ACTIVE: { label: "Live", tone: "green" },
  RESERVED: { label: "Fully reserved", tone: "blue" },
  COMPLETED: { label: "Rescued", tone: "green" },
  EXPIRED: { label: "Expired", tone: "gray" },
  CANCELLED: { label: "Withdrawn", tone: "gray" },
  REMOVED: { label: "Removed", tone: "red" },
};

const tf = new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" });
const df = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

export function formatWindow(start: Date | string, end: Date | string) {
  const s = new Date(start);
  const e = new Date(end);
  const sameDay = s.toDateString() === e.toDateString();
  const day = isToday(s) ? "Today" : df.format(s);
  return sameDay ? `${day}, ${tf.format(s)}–${tf.format(e)}` : `${day} ${tf.format(s)} → ${df.format(e)} ${tf.format(e)}`;
}

export function timeLeft(to: Date | string, now = Date.now()) {
  const ms = new Date(to).getTime() - now;
  if (ms <= 0) return "closed";
  const m = Math.round(ms / 60_000);
  if (m < 60) return `${m} min left`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ${m % 60}m left` : `${Math.floor(h / 24)}d left`;
}

export const formatDateTime = (d: Date | string) => `${df.format(new Date(d))}, ${tf.format(new Date(d))}`;
export const formatNumber = (n: number) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(n);

const isToday = (d: Date) => d.toDateString() === new Date().toDateString();
