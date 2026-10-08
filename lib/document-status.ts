export type DocumentStatus = "COMPLETE" | "MISSING" | "PENDING" | "FOR_VERIFICATION" | "EXPIRING_SOON" | "EXPIRED" | "NOT_APPLICABLE";
type DocumentRecord = { expiry_date: string | null; review_status?: "PENDING" | "FOR_VERIFICATION" | "COMPLETE" | null } | null | undefined;

export function documentStatus({ document, required, notApplicable = false, asOf = new Date() }: { document: DocumentRecord; required: boolean; notApplicable?: boolean; asOf?: Date }): DocumentStatus {
  if (notApplicable) return "NOT_APPLICABLE";
  if (!document) return required ? "MISSING" : "NOT_APPLICABLE";
  if (document.expiry_date) {
    const today = Date.UTC(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
    const [year, month, day] = document.expiry_date.split("-").map(Number);
    const expiry = Date.UTC(year, month - 1, day);
    if (expiry < today) return "EXPIRED";
    if (expiry - today <= 30 * 86400000) return "EXPIRING_SOON";
  }
  if (document.review_status === "PENDING") return "PENDING";
  if (document.review_status !== "COMPLETE") return "FOR_VERIFICATION";
  return "COMPLETE";
}

export function documentStatusLabel(status: DocumentStatus): string {
  return ({ COMPLETE: "Complete", MISSING: "Missing", PENDING: "Pending", FOR_VERIFICATION: "For Verification", EXPIRING_SOON: "Expiring Soon", EXPIRED: "Expired", NOT_APPLICABLE: "Not Applicable" })[status];
}
