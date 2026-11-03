import Image from "next/image";
import Link from "next/link";

export default function Logo({ variant = "dark", className = "", width = 180, height = 80, priority = false }) {
  const src = variant === "light" ? "/logo-light.svg" : "/logo.svg";
  return (
    <Link href="/" className={`inline-flex items-center ${className}`} aria-label="The Insight News — Home">
      <Image
        src={src}
        alt="The Insight News"
        width={width}
        height={height}
        priority={priority}
        className="h-auto w-auto"
        style={{ width: "auto", height: `${height}px` }}
      />
    </Link>
  );
}
