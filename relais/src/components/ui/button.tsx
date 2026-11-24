import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap font-medium select-none transition-[background-color,border-color,color,box-shadow] duration-100 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:shadow-focus [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-accent text-white shadow-xs hover:bg-accent-hover active:bg-accent-ink",
        secondary: "border border-line-strong bg-surface text-ink shadow-xs hover:bg-subtle hover:border-ink-4/60 active:bg-muted",
        ghost: "text-ink-2 hover:bg-muted hover:text-ink",
        subtle: "bg-muted text-ink hover:bg-sunken",
        danger: "bg-danger text-white shadow-xs hover:bg-danger-ink",
        "danger-ghost": "text-danger-ink hover:bg-danger-soft",
        success: "bg-success text-white shadow-xs hover:brightness-95",
        whatsapp: "border border-line-strong bg-surface text-ink shadow-xs hover:bg-subtle [&_svg]:text-[#1a8f4c]",
        link: "h-auto px-0 text-accent hover:underline underline-offset-2",
      },
      size: {
        xs: "h-7 rounded-sm px-2 text-xs [&_svg]:size-3.5",
        sm: "h-8 rounded-md px-2.5 text-[13px] [&_svg]:size-4",
        md: "h-9 rounded-md px-3.5 text-[13.5px] [&_svg]:size-4",
        lg: "h-11 rounded-md px-5 text-[15px] [&_svg]:size-[18px]",
        xl: "h-14 rounded-lg px-6 text-base [&_svg]:size-5",
        icon: "size-8 rounded-md [&_svg]:size-4",
        "icon-sm": "size-7 rounded-sm [&_svg]:size-3.5",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean; loading?: boolean };

export function Button({ className, variant, size, block, asChild, loading, children, disabled, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
          {children}
        </>
      )}
    </Comp>
  );
}
