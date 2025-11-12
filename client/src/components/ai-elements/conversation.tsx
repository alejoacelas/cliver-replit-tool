"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { HTMLAttributes, useEffect, useRef, useState } from "react";

export type ConversationProps = HTMLAttributes<HTMLDivElement>;

export const Conversation = ({ className, children, ...props }: ConversationProps) => {
  return (
    <div className={cn("flex flex-col h-full relative", className)} {...props}>
      {children}
    </div>
  );
};

export type ConversationContentProps = HTMLAttributes<HTMLDivElement>;

export const ConversationContent = ({ className, children, ...props }: ConversationContentProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  };

  useEffect(() => {
    const viewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!viewport) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom);
    };

    viewport.addEventListener('scroll', handleScroll);
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    // Auto-scroll on new content
    const timer = setTimeout(() => {
      if (!showScrollButton) {
        scrollToBottom();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [children, showScrollButton]);

  return (
    <>
      <div ref={scrollRef} className={cn("flex-1 relative", className)}>
        <ScrollArea className="h-full" {...props}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            {children}
          </div>
        </ScrollArea>
      </div>
      {showScrollButton && (
        <Button
          onClick={scrollToBottom}
          size="icon"
          variant="outline"
          className="absolute bottom-4 right-4 rounded-full shadow-lg z-10"
        >
          <ArrowDown className="w-4 h-4" />
        </Button>
      )}
    </>
  );
};

export type ConversationScrollButtonProps = {};

export const ConversationScrollButton = () => {
  // This is now integrated into ConversationContent
  return null;
};
