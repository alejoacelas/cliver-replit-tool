"use client";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Brain, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { HTMLAttributes, ReactNode, useState } from "react";

export type ReasoningProps = HTMLAttributes<HTMLDivElement> & {
  isStreaming?: boolean;
};

export const Reasoning = ({ className, children, isStreaming, ...props }: ReasoningProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn("mb-4", className)} {...props}>
      {children}
    </Collapsible>
  );
};

export const ReasoningTrigger = () => {
  return (
    <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2">
      <Brain className="w-4 h-4" />
      <span>Show reasoning</span>
      <ChevronDown className="w-4 h-4 transition-transform [[data-state=open]>&]:rotate-180" />
    </CollapsibleTrigger>
  );
};

export type ReasoningContentProps = {
  children: ReactNode;
};

export const ReasoningContent = ({ children }: ReasoningContentProps) => {
  return (
    <CollapsibleContent className="mt-2">
      <div className="bg-muted/50 rounded-lg p-4 text-sm border border-border">
        <div className="whitespace-pre-wrap">{children}</div>
      </div>
    </CollapsibleContent>
  );
};
