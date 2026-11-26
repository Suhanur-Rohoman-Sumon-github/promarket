export function UserSkeleton() {
  return (
    <>
      <style>{`
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .skeleton-box {
          background-color: #e2e8f0;
          animation: skeleton-pulse 1.5s ease-in-out infinite;
        }
      `}</style>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "12px",
        }}
      >
        {/* Circle avatar */}
        <div
          className="skeleton-box"
          style={{ width: "40px", height: "40px", borderRadius: "50%" }}
        />
        {/* Text lines */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div
            className="skeleton-box"
            style={{ width: "120px", height: "14px", borderRadius: "4px" }}
          />
          <div
            className="skeleton-box"
            style={{ width: "80px", height: "12px", borderRadius: "4px" }}
          />
        </div>
      </div>
    </>
  );
}
