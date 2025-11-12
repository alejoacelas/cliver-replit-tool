"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HTMLAttributes } from "react";

export type ResponseProps = HTMLAttributes<HTMLDivElement> & {
  children: string;
};

export const Response = ({ children, className, ...props }: ResponseProps) => {
  return (
    <div className={cn("prose prose-sm max-w-none", className)} {...props}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside mb-4 space-y-1">{children}</ol>,
          h1: ({ children }) => <h1 className="text-xl font-semibold mb-3 mt-6 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-semibold mb-2 mt-5 first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-semibold mb-2 mt-4 first:mt-0">{children}</h3>,
          code: ({ children }) => <code className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded">{children}</code>,
          pre: ({ children }) => <pre className="bg-muted p-4 rounded-lg overflow-x-auto mb-4 font-mono text-sm">{children}</pre>,
          table: ({ children }) => <Table className="mb-4">{children}</Table>,
          thead: ({ children }) => <TableHeader>{children}</TableHeader>,
          tbody: ({ children }) => <TableBody>{children}</TableBody>,
          tr: ({ children }) => <TableRow>{children}</TableRow>,
          th: ({ children }) => <TableHead>{children}</TableHead>,
          td: ({ children }) => <TableCell>{children}</TableCell>,
          a: ({ children, href }) => (
            <a href={href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
};
