import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow",
        outline: "text-foreground",
        success:
          "border-transparent bg-success/10 text-success border-success/20",
        warning:
          "border-transparent bg-warning/10 text-warning border-warning/20",
        info:
          "border-transparent bg-info/10 text-info border-info/20",
        pending:
          "border-transparent bg-warning/10 text-warning border-warning/20",
        resolved:
          "border-transparent bg-success/10 text-success border-success/20",
        urgent:
          "border-transparent bg-destructive/10 text-destructive border-destructive/20",
        academic:
          "border-transparent bg-primary/10 text-primary border-primary/20",
        infrastructure:
          "border-transparent bg-accent/10 text-accent border-accent/20",
        administration:
          "border-transparent bg-secondary text-secondary-foreground border-border",
        other:
          "border-transparent bg-muted text-muted-foreground border-border",
        "in-progress":
          "border-transparent bg-accent/10 text-accent border-accent/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
