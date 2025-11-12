"use client";

import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: "user" | "assistant";
};

export const Message = ({ className, from, children, ...props }: MessageProps) => (
  <div
    className={cn(
      "flex w-full",
      from === "user" ? "justify-end" : "justify-start",
      className
    )}
    {...props}
  >
    <div
      className={cn(
        "rounded-lg px-4 py-3 max-w-2xl",
        from === "user"
          ? "bg-primary text-primary-foreground"
          : "bg-muted"
      )}
    >
      {children}
    </div>
  </div>
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageContent = ({ className, children, ...props }: MessageContentProps) => (
  <div className={cn("text-sm", className)} {...props}>
    {children}
  </div>
);
