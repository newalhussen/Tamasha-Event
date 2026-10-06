import { useId } from "react";

// Procedural artwork presets from the design system, drawn in a 400x300 box so they
// scale to any card, hero or ticket header.
const DARK = "#15121F";

function Art({ preset, pid }: { preset: string; pid: string }) {
  switch (preset) {
    case "comedy":
      return (
        <>
          <rect width="400" height="300" fill="#FFD84D" />
          <circle cx="68" cy="296" r="140" fill={DARK} />
          <circle cx="284" cy="110" r="68" fill="#4B2BFF" />
        </>
      );
    case "stripes":
      return (
        <>
          <defs>
            <pattern id={pid} width="30" height="10" patternUnits="userSpaceOnUse">
              <rect x="26" width="4" height="10" fill={DARK} />
            </pattern>
          </defs>
          <rect width="400" height="300" fill="#FF4D8D" />
          <rect width="400" height="300" fill={`url(#${pid})`} />
          <circle cx="328" cy="64" r="112" fill="#fff" />
        </>
      );
    case "market":
      return (
        <>
          <rect width="400" height="300" fill="#A9C7FF" />
          <rect width="176" height="300" fill="#FFD84D" />
          <circle cx="176" cy="160" r="100" fill="#4B2BFF" />
        </>
      );
    case "night":
      return (
        <>
          <rect width="400" height="300" fill={DARK} />
          <rect x="-40" y="190" width="480" height="138" fill="#4B2BFF" transform="rotate(-8 200 260)" />
          <circle cx="292" cy="100" r="52" fill="#FFD84D" />
        </>
      );
    case "tech":
      return (
        <>
          <rect width="400" height="300" fill="#D9D0FF" />
          <rect x="84" y="36" width="232" height="232" fill="#FF4D8D" transform="rotate(45 200 152)" />
          <rect y="234" width="400" height="66" fill={DARK} />
        </>
      );
    case "arts":
      return (
        <>
          <rect width="400" height="300" fill="#C9C5D6" />
          <circle cx="200" cy="140" r="117" fill="none" stroke="#8A859C" strokeWidth="22" />
        </>
      );
    case "film":
      return (
        <>
          <rect width="400" height="300" fill="#4B2BFF" />
          <circle cx="112" cy="170" r="80" fill="#FFD84D" />
          <circle cx="216" cy="170" r="80" fill="#FF4D8D" />
          <circle cx="320" cy="170" r="80" fill="#fff" />
        </>
      );
    case "split":
      return (
        <>
          <rect width="400" height="300" fill="#fff" />
          <rect x="192" width="208" height="300" fill="#FF4D8D" />
          <circle cx="192" cy="146" r="92" fill={DARK} />
        </>
      );
    case "sunburst":
    default:
      return (
        <>
          <defs>
            <pattern id={pid} width="10" height="12" patternUnits="userSpaceOnUse">
              <rect width="10" height="6" fill={DARK} />
            </pattern>
          </defs>
          <rect width="400" height="300" fill="#4B2BFF" />
          <circle cx="330" cy="40" r="160" fill="#FF4D8D" />
          <circle cx="210" cy="292" r="100" fill="#FFD84D" />
          <rect x="0" y="162" width="184" height="72" fill={`url(#${pid})`} />
        </>
      );
  }
}

/**
 * Event artwork. Fills its parent (give the parent a size/aspect ratio).
 * `text` is the big overlay title; `textSize` is a container-width percentage.
 */
export function CoverArt({
  preset,
  text,
  textSize = 15,
  className = "",
}: {
  preset: string;
  text?: string;
  textSize?: number;
  className?: string;
}) {
  const pid = useId().replace(/:/g, "");
  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`} style={{ containerType: "inline-size" }} aria-hidden="true">
      <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <Art preset={preset} pid={`p${pid}`} />
      </svg>
      {text ? (
        <div
          className="absolute left-[7%] top-[9%] whitespace-pre-line font-display font-extrabold uppercase text-white"
          style={{ fontSize: `${textSize}cqw`, lineHeight: 0.9, letterSpacing: "-0.04em" }}
        >
          {text}
        </div>
      ) : null}
    </div>
  );
}
