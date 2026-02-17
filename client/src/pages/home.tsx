import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Send, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { ResponseCard } from "@/components/ResponseCard";
import type { Conversation, Message, Response } from "@shared/schema";

interface StreamingState {
  status: string | null;
  toolEvents: Array<{ type: string; tool: string; args?: any; id?: string; count?: number }>;
  text: string;
  complete: any | null;
  error: string | null;
}

const initialStreamingState: StreamingState = {
  status: null,
  toolEvents: [],
  text: "",
  complete: null,
  error: null,
};

interface FormFields {
  name: string;
  email: string;
  institution: string;
  orderDetails: string;
  notes: string;
}

const emptyForm: FormFields = { name: "", email: "", institution: "", orderDetails: "", notes: "" };

const exampleProfiles: (FormFields & { label: string })[] = [
  {
    label: "Academic researcher",
    name: "Sarah Chen",
    email: "s.chen@mit.edu",
    institution: "Massachusetts Institute of Technology",
    orderDetails: "S. cerevisiae TDH3 promoter fragment",
    notes: "",
  },
  {
    label: "Industry scientist",
    name: "James Rivera",
    email: "j.rivera@modernatx.com",
    institution: "Moderna Therapeutics",
    orderDetails: "SARS-CoV-2 spike protein RBD domain",
    notes: "",
  },
  {
    label: "International lab",
    name: "Aiko Tanaka",
    email: "tanaka@riken.jp",
    institution: "RIKEN Center for Biosystems Dynamics Research",
    orderDetails: "Mus musculus Cas9-GFP fusion construct",
    notes: "Gene editing constructs for CRISPR knockout study",
  },
];

function formatFieldsToText(fields: FormFields): string {
  const lines: string[] = [];
  lines.push(`Name: ${fields.name}`);
  lines.push(`Email: ${fields.email}`);
  if (fields.institution) lines.push(`Institution: ${fields.institution}`);
  if (fields.orderDetails) lines.push(`Sequence order details: ${fields.orderDetails}`);
  if (fields.notes) lines.push(`Notes: ${fields.notes}`);
  return lines.join("\n");
}

export default function Home() {
  const { toast } = useToast();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [form, setForm] = useState<FormFields>(emptyForm);
  const [showOptional, setShowOptional] = useState(false);
  const [streaming, setStreaming] = useState<StreamingState>(initialStreamingState);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  const { data: messages = [] } = useQuery<(Message & { responses: Response[] })[]>({
    queryKey: ["/api/conversations", activeConversationId, "messages"],
    enabled: !!activeConversationId,
  });

  const createConversationMutation = useMutation({
    mutationFn: async (title: string) => {
      const res = await apiRequest("POST", "/api/conversations", { title });
      return (await res.json()) as Conversation;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setActiveConversationId(data.id);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create conversation", variant: "destructive" });
    },
  });

  const handleNewChat = () => {
    setForm(emptyForm);
    setShowOptional(false);
    createConversationMutation.mutate("New screening");
  };

  const handleSend = useCallback(async () => {
    if (!form.name.trim() || !form.email.trim() || isStreaming) return;

    let conversationId = activeConversationId;

    // Auto-create conversation if none exists
    if (!conversationId) {
      try {
        const res = await apiRequest("POST", "/api/conversations", { title: "New screening" });
        const conv = (await res.json()) as Conversation;
        queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
        setActiveConversationId(conv.id);
        conversationId = conv.id;
      } catch {
        toast({ title: "Error", description: "Failed to create conversation", variant: "destructive" });
        return;
      }
    }

    const content = formatFieldsToText(form);
    setIsStreaming(true);
    setStreaming(initialStreamingState);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, content }),
      });

      if (!res.ok || !res.body) {
        toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
        setIsStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;

          try {
            const event = JSON.parse(payload);
            setStreaming((prev) => {
              switch (event.type) {
                case "status":
                  return { ...prev, status: event.message };
                case "tool_call":
                  return { ...prev, toolEvents: [...prev.toolEvents, { type: "call", tool: event.tool, args: event.args }] };
                case "tool_result":
                  return { ...prev, toolEvents: [...prev.toolEvents, { type: "result", tool: event.tool, id: event.id, count: event.count }] };
                case "delta":
                  return { ...prev, text: prev.text + event.content };
                case "complete":
                  return { ...prev, complete: event.data };
                case "error":
                  return { ...prev, error: event.message };
                default:
                  return prev;
              }
            });
          } catch {
            // skip malformed events
          }
        }
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Stream failed", variant: "destructive" });
    } finally {
      setIsStreaming(false);
      setForm(emptyForm);
      setShowOptional(false);
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    }
  }, [form, activeConversationId, isStreaming, toast]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && form.name.trim() && form.email.trim()) {
      e.preventDefault();
      handleSend();
    }
  };

  const fillExample = (profile: typeof exampleProfiles[number]) => {
    const { label: _, ...fields } = profile;
    setForm(fields);
    setShowOptional(!!(fields.institution || fields.orderDetails || fields.notes));
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming.text, streaming.status]);

  useEffect(() => {
    if (!activeConversationId && conversations.length > 0) {
      setActiveConversationId(conversations[0].id);
    }
  }, [conversations, activeConversationId]);

  // Show form when conversation has no messages yet (or no conversation)
  const hasMessages = messages.length > 0;
  const showForm = !hasMessages && !isStreaming;

  return (
    <div className="flex h-screen w-full">
      {/* Sidebar */}
      <div className="w-60 border-r border-border flex flex-col shrink-0">
        <div className="px-3 py-3 border-b border-border">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={handleNewChat}>
            <Plus className="w-4 h-4" />
            New screening
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {conversationsLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : conversations.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No screenings yet</p>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setActiveConversationId(conv.id)}
                  className={`w-full text-left text-sm px-2.5 py-1.5 rounded-md truncate transition-colors ${
                    conv.id === activeConversationId
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  }`}
                >
                  {conv.title}
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex items-center px-4 h-12 border-b border-border shrink-0">
          <span className="text-sm font-medium tracking-tight">cliver</span>
        </header>

        <ScrollArea className="flex-1">
          <div className="max-w-2xl mx-auto px-6 py-8">
            {showForm ? (
              <div className="space-y-8">
                {/* Hero */}
                <div>
                  <h1 className="text-xl font-semibold tracking-tight mb-1">Screen a customer</h1>
                  <p className="text-sm text-muted-foreground">
                    Verify institutional affiliation, email domain, sanctions status, and find relevant background work.
                  </p>
                </div>

                {/* Example profiles */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2.5">
                    Try an example
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {exampleProfiles.map((profile) => (
                      <button
                        key={profile.email}
                        onClick={() => fillExample(profile)}
                        className="text-left border border-border rounded-md px-3 py-2 hover:bg-accent/50 transition-colors group"
                      >
                        <span className="text-sm font-medium block">{profile.name}</span>
                        <span className="text-xs text-muted-foreground block">{profile.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Form */}
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="name" className="text-xs font-medium text-muted-foreground block mb-1">
                        Name
                      </label>
                      <input
                        ref={nameInputRef}
                        id="name"
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        onKeyDown={handleKeyPress}
                        placeholder="Jane Smith"
                        className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-foreground/20"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="text-xs font-medium text-muted-foreground block mb-1">
                        Business email
                      </label>
                      <input
                        id="email"
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                        onKeyDown={handleKeyPress}
                        placeholder="jane@university.edu"
                        className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-foreground/20"
                      />
                    </div>
                  </div>

                  {/* Optional fields toggle */}
                  <button
                    onClick={() => setShowOptional(!showOptional)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                  >
                    {showOptional ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    More details (optional)
                  </button>

                  {showOptional && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
                      <div>
                        <label htmlFor="institution" className="text-xs font-medium text-muted-foreground block mb-1">
                          Institution
                        </label>
                        <input
                          id="institution"
                          type="text"
                          value={form.institution}
                          onChange={(e) => setForm((f) => ({ ...f, institution: e.target.value }))}
                          onKeyDown={handleKeyPress}
                          placeholder="University or company name"
                          className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-foreground/20"
                        />
                      </div>
                      <div>
                        <label htmlFor="orderDetails" className="text-xs font-medium text-muted-foreground block mb-1">
                          Sequence order details
                        </label>
                        <input
                          id="orderDetails"
                          type="text"
                          value={form.orderDetails}
                          onChange={(e) => setForm((f) => ({ ...f, orderDetails: e.target.value }))}
                          onKeyDown={handleKeyPress}
                          placeholder="e.g. E. coli K-12 lacZ gene, SARS-CoV-2 spike RBD"
                          className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-foreground/20"
                        />
                      </div>
                      <div>
                        <label htmlFor="notes" className="text-xs font-medium text-muted-foreground block mb-1">
                          Notes
                        </label>
                        <textarea
                          id="notes"
                          value={form.notes}
                          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                          placeholder="Any additional context"
                          rows={2}
                          className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-foreground/20 resize-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Submit */}
                  <Button
                    onClick={handleSend}
                    disabled={!form.name.trim() || !form.email.trim() || isStreaming}
                    className="w-full mt-1"
                  >
                    {isStreaming ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    ) : (
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Screen customer
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((message) => (
                  <div key={message.id} className="space-y-3">
                    {message.role === "user" && (
                      <div className="flex justify-end">
                        <div className="bg-foreground text-background rounded-lg px-4 py-2.5 max-w-xl text-sm whitespace-pre-wrap">
                          {message.content}
                        </div>
                      </div>
                    )}
                    {message.responses?.map((response) => (
                      <ResponseCard key={response.id} response={response} />
                    ))}
                  </div>
                ))}

                {/* Streaming state */}
                {isStreaming && (
                  <div className="space-y-3">
                    <ResponseCard
                      response={{
                        id: "streaming",
                        messageId: "",
                        content: streaming.text,
                        model: "google/gemini-3-pro-preview",
                        status: streaming.error ? "error" : "streaming",
                        toolCalls: streaming.complete?.audit?.toolCalls || null,
                        inputTokens: null,
                        outputTokens: null,
                        duration: null,
                        error: streaming.error,
                        createdAt: new Date(),
                      }}
                      streamingStatus={streaming.status}
                      streamingToolEvents={streaming.toolEvents}
                      completeData={streaming.complete}
                    />
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
