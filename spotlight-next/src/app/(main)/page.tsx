// ===============================================================
// src/app/page.tsx — temporary home page.
//
// This is a PLACEHOLDER just to verify the shared foundation
// (navbar, theme toggle, footer, design tokens) all work together.
// The real homepage (ported from index.html) comes later in the
// migration batches.
// ===============================================================

export default function Home() {
  return (
    <div
      style={{
        maxWidth: "800px",
        margin: "0 auto",
        padding: "var(--spacing-3xl) var(--spacing-lg)",
        textAlign: "center",
      }}
    >
      <h1
        style={{
          fontSize: "var(--text-5xl)",
          fontWeight: "var(--font-black)",
          color: "var(--color-text-primary)",
          marginBottom: "var(--spacing-md)",
        }}
      >
        Foundation is working ✅
      </h1>

      <p
        style={{
          fontSize: "var(--text-lg)",
          color: "var(--color-text-muted)",
          marginBottom: "var(--spacing-xl)",
          lineHeight: "var(--line-height-normal)",
        }}
      >
        This temporary page confirms the shared foundation is in place:
        the navbar, footer, design tokens, and dark/light theme toggle
        (try the ☀️ / 🌙 button in the navbar) are all live. The real
        pages get ported on top of this next.
      </p>

      <div
        style={{
          display: "flex",
          gap: "var(--spacing-md)",
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-xl)",
            padding: "var(--spacing-lg)",
            boxShadow: "var(--shadow-card)",
            minWidth: "180px",
          }}
        >
          <p
            style={{
              color: "var(--color-primary)",
              fontWeight: "var(--font-bold)",
              fontSize: "var(--text-lg)",
              margin: 0,
            }}
          >
            Design tokens
          </p>
          <p
            style={{
              color: "var(--color-text-muted)",
              fontSize: "var(--text-sm)",
              margin: "var(--spacing-xs) 0 0",
            }}
          >
            Ported from theme.css
          </p>
        </div>

        <div
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-xl)",
            padding: "var(--spacing-lg)",
            boxShadow: "var(--shadow-card)",
            minWidth: "180px",
          }}
        >
          <p
            style={{
              color: "var(--color-primary)",
              fontWeight: "var(--font-bold)",
              fontSize: "var(--text-lg)",
              margin: 0,
            }}
          >
            Dark / light mode
          </p>
          <p
            style={{
              color: "var(--color-text-muted)",
              fontSize: "var(--text-sm)",
              margin: "var(--spacing-xs) 0 0",
            }}
          >
            Toggle in the navbar
          </p>
        </div>
      </div>
    </div>
  );
}
