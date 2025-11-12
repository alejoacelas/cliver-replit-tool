"use client";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ExternalLink, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { HTMLAttributes, ReactNode, useState } from "react";

export type SourcesProps = {
  children: ReactNode;
};

export const Sources = ({ children }: SourcesProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-4">
      {children}
    </Collapsible>
  );
};

export type SourcesTriggerProps = {
  count: number;
};

export const SourcesTrigger = ({ count }: SourcesTriggerProps) => {
  return (
    <CollapsibleTrigger asChild>
      <Button variant="ghost" size="sm" className="gap-2 mb-2">
        <ChevronDown className="w-4 h-4 transition-transform [[data-state=open]>&]:rotate-180" />
        <span>{count} source{count !== 1 ? 's' : ''}</span>
      </Button>
    </CollapsibleTrigger>
  );
};

export type SourcesContentProps = {
  children: ReactNode;
};

export const SourcesContent = ({ children }: SourcesContentProps) => {
  return (
    <CollapsibleContent className="space-y-2">
      {children}
    </CollapsibleContent>
  );
};

export type SourceProps = {
  href: string;
  title: string;
  className?: string;
};

export const Source = ({ href, title, className }: SourceProps) => {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex items-center gap-2 p-2 rounded-md hover:bg-muted transition-colors text-sm",
        className
      )}
    >
      <ExternalLink className="w-4 h-4 flex-shrink-0" />
      <span className="truncate">{title}</span>
    </a>
  );
};
