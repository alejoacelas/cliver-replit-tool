"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Loader2, Send, Square, MoreHorizontal, Paperclip, X } from "lucide-react";
import {
  HTMLAttributes,
  FormEvent,
  createContext,
  useContext,
  useRef,
  useState,
  ChangeEvent,
  KeyboardEvent,
  ReactNode,
} from "react";

export type PromptInputMessage = {
  text: string;
  files?: File[];
};

type PromptInputContextType = {
  onSubmit: (message: PromptInputMessage) => void;
  input: string;
  setInput: (value: string) => void;
  files: File[];
  addFiles: (newFiles: File[]) => void;
  removeFile: (index: number) => void;
  status?: "submitted" | "streaming" | "ready";
  multiple?: boolean;
};

const PromptInputContext = createContext<PromptInputContextType | null>(null);

const usePromptInput = () => {
  const context = useContext(PromptInputContext);
  if (!context) throw new Error("PromptInput components must be used within PromptInput");
  return context;
};

export type PromptInputProps = HTMLAttributes<HTMLDivElement> & {
  onSubmit: (message: PromptInputMessage) => void;
  globalDrop?: boolean;
  multiple?: boolean;
  status?: "submitted" | "streaming" | "ready";
};

export const PromptInput = ({
  className,
  onSubmit,
  children,
  globalDrop,
  multiple = false,
  status = "ready",
  ...props
}: PromptInputProps) => {
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const addFiles = (newFiles: File[]) => {
    setFiles(prev => multiple ? [...prev, ...newFiles] : newFiles);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!input.trim() && files.length === 0) return;

    onSubmit({ text: input, files });
    setInput("");
    setFiles([]);
  };

  return (
    <PromptInputContext.Provider
      value={{ onSubmit, input, setInput, files, addFiles, removeFile, status, multiple }}
    >
      <div className={cn("space-y-2", className)} {...props}>
        {children}
      </div>
    </PromptInputContext.Provider>
  );
};

export type PromptInputBodyProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputBody = ({ className, children, ...props }: PromptInputBodyProps) => {
  return (
    <div className={cn("relative border rounded-lg", className)} {...props}>
      {children}
    </div>
  );
};

export type PromptInputAttachmentsProps = {
  children: (attachment: File & { id: string }) => ReactNode;
};

export const PromptInputAttachments = ({ children }: PromptInputAttachmentsProps) => {
  const { files } = usePromptInput();

  if (files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 p-2 border-b">
      {files.map((file, index) =>
        children({ ...file, id: `${index}` } as File & { id: string })
      )}
    </div>
  );
};

export type PromptInputAttachmentProps = {
  data: File & { id: string };
};

export const PromptInputAttachment = ({ data }: PromptInputAttachmentProps) => {
  const { removeFile } = usePromptInput();

  return (
    <div className="flex items-center gap-2 bg-muted px-3 py-2 rounded-md text-sm">
      <Paperclip className="w-4 h-4" />
      <span className="truncate max-w-[200px]">{data.name}</span>
      <Button
        size="icon"
        variant="ghost"
        className="h-5 w-5"
        onClick={() => removeFile(parseInt(data.id))}
      >
        <X className="w-3 h-3" />
      </Button>
    </div>
  );
};

export type PromptInputTextareaProps = Omit<HTMLAttributes<HTMLTextAreaElement>, 'onChange'> & {
  onChange?: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  value?: string;
};

export const PromptInputTextarea = ({ className, onChange, value, ...props }: PromptInputTextareaProps) => {
  const context = usePromptInput();

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    context.setInput(e.target.value);
    onChange?.(e);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (context.input.trim() || context.files.length > 0) {
        context.onSubmit({ text: context.input, files: context.files });
      }
    }
  };

  return (
    <Textarea
      className={cn("min-h-[60px] resize-none border-0 focus-visible:ring-0", className)}
      value={value !== undefined ? value : context.input}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder="Type a message..."
      {...props}
    />
  );
};

export type PromptInputFooterProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputFooter = ({ className, children, ...props }: PromptInputFooterProps) => {
  return (
    <div className={cn("flex items-center justify-between p-2 border-t", className)} {...props}>
      {children}
    </div>
  );
};

export type PromptInputToolsProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputTools = ({ className, children, ...props }: PromptInputToolsProps) => {
  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      {children}
    </div>
  );
};

export type PromptInputButtonProps = HTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "ghost" | "outline";
};

export const PromptInputButton = ({ className, variant = "ghost", children, ...props }: PromptInputButtonProps) => {
  return (
    <Button variant={variant} size="sm" className={className} {...props}>
      {children}
    </Button>
  );
};

export type PromptInputSubmitProps = {
  disabled?: boolean;
  status?: "submitted" | "streaming" | "ready";
};

export const PromptInputSubmit = ({ disabled, status: propStatus }: PromptInputSubmitProps) => {
  const { input, files, onSubmit, status: contextStatus } = usePromptInput();
  const status = propStatus || contextStatus;

  const isDisabled = disabled || (!input.trim() && files.length === 0);
  const isLoading = status === "submitted" || status === "streaming";

  const handleClick = () => {
    if (!isDisabled && !isLoading) {
      onSubmit({ text: input, files });
    }
  };

  return (
    <Button
      size="icon"
      onClick={handleClick}
      disabled={isDisabled || isLoading}
      className="rounded-full"
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Send className="w-4 h-4" />
      )}
    </Button>
  );
};

export type PromptInputActionMenuProps = {
  children: ReactNode;
};

export const PromptInputActionMenu = ({ children }: PromptInputActionMenuProps) => {
  return <>{children}</>;
};

export const PromptInputActionMenuTrigger = () => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <PromptInputActionMenuContent />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const PromptInputActionMenuContent = ({ children }: { children?: ReactNode }) => {
  return <>{children}</>;
};

export const PromptInputActionAddAttachments = () => {
  const { addFiles, multiple } = usePromptInput();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      addFiles(files);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        className="hidden"
        onChange={handleFileChange}
      />
      <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
        <Paperclip className="w-4 h-4 mr-2" />
        Add attachments
      </DropdownMenuItem>
    </>
  );
};

export type PromptInputModelSelectProps = {
  onValueChange: (value: string) => void;
  value: string;
  children: ReactNode;
};

export const PromptInputModelSelect = ({ onValueChange, value, children }: PromptInputModelSelectProps) => {
  return (
    <Select onValueChange={onValueChange} value={value}>
      {children}
    </Select>
  );
};

export const PromptInputModelSelectTrigger = ({ children }: { children?: ReactNode }) => {
  return (
    <SelectTrigger className="w-[180px]">
      {children}
    </SelectTrigger>
  );
};

export const PromptInputModelSelectValue = () => {
  return <SelectValue />;
};

export const PromptInputModelSelectContent = ({ children }: { children?: ReactNode }) => {
  return <SelectContent>{children}</SelectContent>;
};

export const PromptInputModelSelectItem = ({ value, children }: { value: string; children: ReactNode }) => {
  return <SelectItem value={value}>{children}</SelectItem>;
};
