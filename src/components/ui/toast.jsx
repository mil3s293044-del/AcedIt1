/**
 * Toast — AcedIt house style.
 *
 * These were stock shadcn: square-ish `rounded-md`, a flat `bg-background`,
 * 24px of padding and two variants. Next to the rest of the app — 2xl radii,
 * the soft layered card shadow, Nunito display weights, the brand palette —
 * they read as a different product's component.
 *
 * Now: soft card, a coloured icon chip that says at a glance what happened,
 * display-weight title, and a left accent rail in the variant's colour.
 * Every class is a complete literal so Tailwind's JIT emits it.
 */
import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva } from "class-variance-authority"
import { X, CheckCircle2, AlertTriangle, Info, Zap } from "lucide-react"

import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      // Bottom-right on anything above phone width, stacked newest-nearest.
      // Above the bottom nav (z-50) and the exam takeover (z-60).
      "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4",
      "sm:bottom-0 sm:right-0 sm:top-auto sm:max-w-[400px]",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  [
    "group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden",
    "rounded-2xl border bg-surface p-4 pr-9",
    "shadow-[0_1px_2px_rgba(13,22,38,0.04),0_8px_24px_rgba(13,22,38,0.10)]",
    // Left accent rail, coloured per variant via the border-l-* below.
    "border-l-4",
    "transition-all",
    "data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]",
    "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none",
    "data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out",
    "data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full",
    "data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
  ].join(" "),
  {
    variants: {
      variant: {
        default:     "border-border border-l-chart-3",
        success:     "border-border border-l-primary",
        destructive: "border-border border-l-streak",
        xp:          "border-border border-l-xp",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

// Icon chip per variant. Static class strings — never build these from
// template literals or the JIT won't see them.
// /15 not /12 — 12 isn't on Tailwind's opacity scale, so those chips compiled
// away to no background at all. Verified present in the built CSS.
const VARIANT_ICON = {
  default:     { Icon: Info,          chip: "bg-chart-3/15 text-chart-3" },
  success:     { Icon: CheckCircle2,  chip: "bg-primary/15 text-primary" },
  destructive: { Icon: AlertTriangle, chip: "bg-streak/15 text-streak" },
  xp:          { Icon: Zap,           chip: "bg-xp/15 text-xp" },
}

const ToastIcon = ({ variant = "default" }) => {
  const { Icon, chip } = VARIANT_ICON[variant] || VARIANT_ICON.default
  return (
    <span className={cn("mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl", chip)}>
      <Icon className="h-4 w-4" />
    </span>
  )
}

const Toast = React.forwardRef(({ className, variant, ...props }, ref) => (
  <ToastPrimitives.Root
    ref={ref}
    className={cn(toastVariants({ variant }), className)}
    duration={5000}
    {...props}
  />
))
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-xl border-2 border-border bg-surface px-3",
      "text-xs font-bold text-foreground transition-colors hover:bg-secondary",
      "focus:outline-none focus:ring-2 focus:ring-chart-3 disabled:pointer-events-none disabled:opacity-50",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      // Always visible on touch, where there's no hover to reveal it.
      "absolute right-2.5 top-2.5 rounded-lg p-1 text-muted-foreground/50 transition-colors",
      "hover:bg-secondary hover:text-foreground focus:outline-none focus:ring-2 focus:ring-chart-3",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-3.5 w-3.5" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("font-display text-sm font-extrabold leading-snug text-foreground", className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-xs leading-snug text-muted-foreground", className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

export {
  ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription,
  ToastClose, ToastAction, ToastIcon,
}
