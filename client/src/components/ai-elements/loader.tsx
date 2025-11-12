"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

export type LoaderProps = HTMLAttributes<HTMLDivElement> & {
  size?: "sm" | "md" | "lg";
};

export const Loader = ({ className, size = "md", ...props }: LoaderProps) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8"
  };

  return (
    <div className={cn("flex items-center justify-center py-4", className)} {...props}>
      <Loader2 className={cn("animate-spin text-muted-foreground", sizeClasses[size])} />
    </div>
  );
};
