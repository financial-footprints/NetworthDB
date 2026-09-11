import logoMark from "@web/assets/images/logo/android-chrome-192x192.png";
import logoFull from "@web/assets/images/logo/networthdb-no-bg.png";
import logoCompact from "@web/assets/images/logo/networthdb-no-bg-small.png";

const LOGO_ALT = "NetworthDB";

const sizeClasses = {
  sm: "h-8",
  md: "h-12",
  lg: "h-28",
  xl: "h-36",
} as const;

type BrandLogoProps = {
  variant?: "full" | "mark" | "icon";
  size?: keyof typeof sizeClasses | "fill";
  className?: string;
};

function logoSrc(variant: "full" | "mark" | "icon", size: keyof typeof sizeClasses | "fill") {
  if (variant === "mark" || variant === "icon") {
    return logoMark;
  }
  if (size === "sm") {
    return logoCompact;
  }
  return logoFull;
}

export function BrandLogo({ variant = "full", size = "md", className }: BrandLogoProps) {
  if (variant === "icon") {
    return (
      <div className={["size-10 shrink-0 overflow-hidden", className].filter(Boolean).join(" ")}>
        <img src={logoMark} alt={LOGO_ALT} className="h-16 w-10 object-contain object-top" />
      </div>
    );
  }

  const sizeClass = size === "fill" ? "h-full w-auto object-contain" : sizeClasses[size];

  return (
    <img
      src={logoSrc(variant, size)}
      alt={LOGO_ALT}
      className={["w-auto", sizeClass, className].filter(Boolean).join(" ")}
    />
  );
}
