"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { HTMLAttributes, ReactNode } from "react";

export type ActionsProps = HTMLAttributes<HTMLDivElement>;

export const Actions = ({ className, children, ...props }: ActionsProps) => {
  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-2", className)} {...props}>
        {children}
      </div>
    </TooltipProvider>
  );
};

export type ActionProps = {
  onClick: () => void;
  label: string;
  children: ReactNode;
  className?: string;
};

export const Action = ({ onClick, label, children, className }: ActionProps) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClick}
          className={cn("h-8 w-8", className)}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
};
