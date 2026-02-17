import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Send, Loader2 } from "lucide-react";
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

export default function Home() {
  const { toast } = useToast();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState<StreamingState>(initialStreamingState);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    createConversationMutation.mutate("New screening");
  };

  const handleSend = useCallback(async () => {
    if (!input.trim() || !activeConversationId || isStreaming) return;
    const content = input.trim();
    setInput("");
    setIsStreaming(true);
    setStreaming(initialStreamingState);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeConversationId, content }),
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
      // Refresh messages and conversations
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", activeConversationId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    }
  }, [input, activeConversationId, isStreaming, toast]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming.text, streaming.status]);

  useEffect(() => {
    if (!activeConversationId && conversations.length > 0) {
      setActiveConversationId(conversations[0].id);
    }
  }, [conversations, activeConversationId]);

  return (
    <div className="flex h-screen w-full">
      {/* Sidebar */}
      <div className="w-60 border-r border-border flex flex-col shrink-0">
        <div className="px-3 py-3 border-b border-border">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={handleNewChat}>
            <Plus className="w-4 h-4" />
            New chat
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {conversationsLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : conversations.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No conversations</p>
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
          <div className="max-w-3xl mx-auto px-6 py-8">
            {!activeConversationId ? (
              <div className="flex flex-col items-center justify-center text-center py-24">
                <h2 className="text-lg font-medium mb-1.5">No conversation selected</h2>
                <p className="text-sm text-muted-foreground mb-5">Start a new chat to begin screening</p>
                <Button size="sm" onClick={handleNewChat}>
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  New chat
                </Button>
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

        {activeConversationId && (
          <div className="border-t border-border p-4 shrink-0">
            <div className="max-w-3xl mx-auto relative">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Paste customer information..."
                className="pr-12 resize-none min-h-[52px] text-sm"
                disabled={isStreaming}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isStreaming}
                size="icon"
                className="absolute right-2 bottom-2 h-7 w-7 rounded-md"
              >
                {isStreaming ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
