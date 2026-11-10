"use client";

// <img> for cards that shows the photo's small copy (see lib/thumbUrl.ts)
// and quietly switches to the full photo if the small copy can't load.
// Accepts the same props as a normal <img>; pass the ORIGINAL photo URL
// as src.
import { useState, type ImgHTMLAttributes } from "react";
import { thumbUrl } from "@/lib/thumbUrl";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { src: string };

export default function ThumbImg({ src, alt = "", onError, ...rest }: Props) {
  // The original URL whose small copy failed to load, if any.
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const small = thumbUrl(src);
  const current = failedFor === src ? src : small;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...rest}
      // If the small copy already failed before the page's code was ready
      // (so onError never ran), switch to the original as soon as we can.
      ref={(el) => {
        if (el && el.complete && el.naturalWidth === 0 && current !== src) setFailedFor(src);
      }}
      src={current}
      alt={alt}
      onError={(e) => {
        if (current !== src) setFailedFor(src);
        else onError?.(e);
      }}
    />
  );
}
