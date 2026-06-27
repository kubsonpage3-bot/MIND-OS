import { useMemo } from "react";

export default function OptimizedImage({
  src,
  alt = "",
  className = "",
  style = {},
  width = undefined,
  height = undefined,
  priority = false
}) {
  const imageMeta = useMemo(() => {
    if (!src || typeof src !== "string") return null;

    // Check if it is a Base44 CDN image URL
    const match = src.match(/https:\/\/media\.base44\.com\/images\/public\/[a-f0-9]+\/([^?#]+)/);
    if (!match) return null;

    const filename = match[1];
    const lastDotIndex = filename.lastIndexOf(".");
    const baseName = lastDotIndex !== -1 ? filename.substring(0, lastDotIndex) : filename;

    return {
      filename,
      baseName
    };
  }, [src]);

  if (!src) return null;

  if (!imageMeta) {
    // Fallback for non-CDN images (data URLs, local assets, external links)
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        style={style}
        width={width}
        height={height}
        loading={priority ? "eager" : "lazy"}
      />
    );
  }

  const { filename, baseName } = imageMeta;

  return (
    <picture>
      <source type="image/avif" srcSet={`/images/avif/${baseName}.avif`} />
      <source type="image/webp" srcSet={`/images/webp/${baseName}.webp`} />
      <img
        src={`/images/original/${filename}`}
        alt={alt}
        className={className}
        style={style}
        width={width}
        height={height}
        loading={priority ? "eager" : "lazy"}
        {...(priority ? { fetchpriority: "high" } : {})}
      />
    </picture>
  );
}
