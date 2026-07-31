// ToastPanel.jsx — toast notifications + milestone toast + pause indicator
// Props: toasts, milestoneToast, onDismiss(id), onDismissAll

export default function ToastPanel({ toasts, milestoneToast, onDismiss, onDismissAll }) {
  return (<>
    {/* Milestone toast */}
    {milestoneToast && (
      <div style={{
        position: "fixed", top: "38vh", left: "50%", transform: "translateX(-50%)",
        background: "#0d0f00", border: "2px solid #ffd700",
        borderRadius: 8, padding: "14px 22px",
        minWidth: 260, maxWidth: 360,
        boxShadow: "0 0 30px #ffd70066",
        zIndex: 1001, pointerEvents: "none",
        animation: "toastIn 0.2s ease-out",
        textAlign: "center",
      }}>
        <div style={{ color: "#ffd700", fontSize: 11, fontWeight: "bold", letterSpacing: 2, marginBottom: 5 }}>
          ★ {milestoneToast.title}
        </div>
        <div style={{ color: "#c8c0a0", fontSize: 9, lineHeight: 1.6 }}>{milestoneToast.text}</div>
      </div>
    )}

    {/* Regular toasts */}
    {toasts.length > 0 && (
      <div style={{
        position: "fixed", top: "38vh", left: "50%", transform: "translateX(-50%)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        zIndex: 1000,
      }}>
        {/* This used to read "PAUSED — notifications active", left over from when
            toasts stopped the clock. They no longer do (they are not pause
            reasons), so the label was telling the player the game was paused
            while it carried on running. */}
        <div style={{ fontSize: 8, color: "#f5a623", letterSpacing: 2, background: "#1a0d00", border: "1px solid #f5a62344", borderRadius: 4, padding: "2px 10px" }}>
          ⚠ {toasts.length} NOTIFICATION{toasts.length === 1 ? "" : "S"}
        </div>
        {toasts.map(toast => {
          const styles = {
            raid:    { bg: "#1a0000", border: "#ff4444", title: "#ff4444" },
            injury:  { bg: "#1a0a00", border: "#f5a623", title: "#f5a623" },
            success: { bg: "#001a08", border: "#7ed321", title: "#7ed321" },
            info:    { bg: "#00101a", border: "#4ab3f4", title: "#4ab3f4" },
          }[toast.type] || { bg: "#0a0a14", border: "#4ab3f4", title: "#4ab3f4" };

          const lines = toast.message.split("\n");
          const titleLine = lines[0];
          const bodyLines = lines.slice(1);

          return (
            <div key={toast.id} style={{
              background: styles.bg,
              border: `1px solid ${styles.border}`,
              borderLeft: `3px solid ${styles.border}`,
              borderRadius: 6, padding: "10px 16px",
              minWidth: 260, maxWidth: 360,
              boxShadow: `0 0 20px ${styles.border}44`,
              animation: "toastIn 0.2s ease-out",
              position: "relative",
            }}>
              <button onClick={() => onDismiss(toast.id)} style={{
                position: "absolute", top: 6, right: 8,
                background: "none", border: "none", cursor: "pointer",
                color: styles.border, fontSize: 13, lineHeight: 1, opacity: 0.7, padding: 2,
              }}>✕</button>
              <div style={{ color: styles.title, fontSize: 11, fontWeight: "bold", letterSpacing: 1.5, marginBottom: bodyLines.length ? 4 : 0, paddingRight: 16 }}>
                {titleLine}
              </div>
              {bodyLines.map((line, i) => (
                <div key={i} style={{ color: "#8a9aaa", fontSize: 10, lineHeight: 1.6 }}>{line}</div>
              ))}
            </div>
          );
        })}
        {toasts.length > 1 && (
          <button onClick={onDismissAll} style={{
            background: "#0a0c14", border: "1px solid #2a3545", borderRadius: 4,
            color: "#445", padding: "4px 14px", cursor: "pointer", fontSize: 9, letterSpacing: 1,
          }}>DISMISS ALL</button>
        )}
      </div>
    )}

    <style>{`
      @keyframes toastIn {
        from { opacity: 0; transform: translateY(-8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `}</style>
  </>);
}
