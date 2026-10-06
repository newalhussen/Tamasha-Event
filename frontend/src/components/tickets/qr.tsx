import QRCode from "qrcode";

/** Server-rendered QR code (inline SVG, crisp at any size, works offline once the page is loaded). */
export async function QrSvg({ value, label, className = "" }: { value: string; label: string; className?: string }) {
  const svg = await QRCode.toString(value, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#15121F", light: "#FFFFFF" },
  });
  return (
    <div
      role="img"
      aria-label={label}
      className={`bg-white [&>svg]:block [&>svg]:h-full [&>svg]:w-full ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
