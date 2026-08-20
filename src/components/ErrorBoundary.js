import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "var(--chakra-colors-bg, #0a0a0f)",
          color: "var(--chakra-colors-textPrimary, #fff)",
          fontFamily: "Inter, sans-serif",
          textAlign: "center",
        }}>
          <div style={{ maxWidth: 420 }}>
            <h1 style={{ fontSize: "1.4rem", marginBottom: 8 }}>Something went wrong</h1>
            <p style={{ color: "var(--chakra-colors-textSecondary, #aaa)", lineHeight: 1.5, marginBottom: 20 }}>
              An unexpected error occurred. Refresh the page to try again.
            </p>
            {this.state.error && (
              <pre style={{
                textAlign: "left",
                fontSize: "0.75rem",
                color: "#ff6b6b",
                background: "rgba(255,107,107,0.08)",
                padding: 12,
                borderRadius: 8,
                overflow: "auto",
                maxHeight: 120,
                marginBottom: 20,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}>
                {this.state.error.message || String(this.state.error)}
              </pre>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                minHeight: 44,
                padding: "10px 20px",
                borderRadius: 12,
                border: 0,
                background: "var(--chakra-colors-brandPrimary, #ff3f5e)",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Refresh page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
