import React, { useState } from "react";

export default function TitleIcon({ title, className = "w-6 h-6 shrink-0" }) {
  const [hasError, setHasError] = useState(false);
  
  if (!title || !title.id) return null;
  
  const iconUrl = `/static/titles/${title.id}.webp`;

  if (hasError) {
    return <span className={`${className} select-none flex items-center justify-center`}>{title.icon || "👑"}</span>;
  }

  return (
    <div className={`${className} flex items-center justify-center shrink-0`}>
      <img
        src={iconUrl}
        alt={title.name}
        className="w-full h-full object-contain"
        style={{ imageRendering: "pixelated" }}
        onError={() => setHasError(true)}
      />
    </div>
  );
}
