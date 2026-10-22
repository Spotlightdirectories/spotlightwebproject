// Shown instantly while a vendor profile / product / service page is
// being fetched, so a click on a card or "View Profile" gives
// immediate feedback instead of looking frozen (2026-10-22).
export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        color: "var(--color-text-secondary, #6b7280)",
      }}
    >
      <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: "2rem" }}></i>
      <span>Opening…</span>
    </div>
  );
}
