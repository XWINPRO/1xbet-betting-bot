import { cn, initials } from "@/lib/utils";

const palette = ["bg-[#E8EEF9] text-[#1E40AF]", "bg-[#E7F4EC] text-[#166534]", "bg-[#FBEFE3] text-[#9A4A08]", "bg-[#EEF0F3] text-[#3A4555]", "bg-[#F3EAF0] text-[#7A2E5B]"];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Avatar({ name, src, size = 28, className }: { name?: string | null; src?: string | null; size?: number; className?: string }) {
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" style={style} className={cn("shrink-0 rounded-md object-cover ring-1 ring-line", className)} />;
  }
  return (
    <span
      style={style}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-md font-semibold", palette[hash(name ?? "?") % palette.length], className)}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
