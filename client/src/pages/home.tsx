import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Plus, Settings, Send, Loader2 } from "lucide-react";
import { ConversationList } from "@/components/ConversationList";
import { ResponseCard } from "@/components/ResponseCard";
import { ControlPanel } from "@/components/ControlPanel";
import type { Conversation, Message, MessageResponse, UserCallConfig } from "@shared/schema";

export default function Home() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [controlPanelOpen, setControlPanelOpen] = useState(false);
  const [streamingResponses, setStreamingResponses] = useState<Map<string, string>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [user, authLoading, toast]);

  // Fetch conversations
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
    enabled: !!user,
    retry: false,
  });

  // Fetch active conversation messages with polling for streaming responses
  const { data: messages = [] } = useQuery<(Message & { responses: MessageResponse[] })[]>({
    queryKey: ["/api/conversations", activeConversationId, "messages"],
    enabled: !!activeConversationId,
    retry: false,
    refetchInterval: (query) => {
      // Poll every 1 second if there are streaming responses
      const data = query.state.data;
      const hasStreamingResponses = data?.some(msg => 
        msg.responses?.some(r => r.status === "streaming")
      );
      return hasStreamingResponses ? 1000 : false;
    },
  });

  // Fetch user call configs
  const { data: callConfigs = [] } = useQuery<UserCallConfig[]>({
    queryKey: ["/api/call-configs"],
    enabled: !!user,
    retry: false,
  });

  // Create conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: async (title: string) => {
      const res = await apiRequest("POST", "/api/conversations", { title });
      return await res.json() as Conversation;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      // Clear previous conversation's messages from cache
      queryClient.removeQueries({ queryKey: ["/api/conversations", activeConversationId, "messages"] });
      setActiveConversationId(data.id);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to create conversation",
        variant: "destructive",
      });
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: string; content: string }) => {
      const res = await apiRequest("POST", `/api/conversations/${conversationId}/messages`, { content });
      return await res.json() as { message: Message };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", activeConversationId, "messages"] });
      setInput("");
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    },
  });

  // Update call configs mutation
  const updateCallConfigsMutation = useMutation({
    mutationFn: async (configs: UserCallConfig[]) => {
      return await apiRequest("PUT", "/api/call-configs", { configs });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/call-configs"] });
      toast({
        title: "Success",
        description: "Call configurations updated",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update configurations",
        variant: "destructive",
      });
    },
  });

  const handleNewChat = () => {
    createConversationMutation.mutate("New Conversation");
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !activeConversationId) return;
    
    sendMessageMutation.mutate({
      conversationId: activeConversationId,
      content: input,
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Select first conversation if none selected
  useEffect(() => {
    if (!activeConversationId && conversations.length > 0) {
      setActiveConversationId(conversations[0].id);
    }
  }, [conversations, activeConversationId]);

  const sidebarStyle = {
    "--sidebar-width": "280px",
  } as React.CSSProperties;

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <SidebarProvider style={sidebarStyle}>
      <div className="flex h-screen w-full">
        {/* Sidebar */}
        <Sidebar>
          <SidebarHeader className="border-b border-sidebar-border p-4">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={handleNewChat}
                  className="w-full"
                  data-testid="button-new-chat"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Chat</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent>
            <ScrollArea className="flex-1">
              <ConversationList
                conversations={conversations}
                activeConversationId={activeConversationId}
                onSelectConversation={setActiveConversationId}
                isLoading={conversationsLoading}
              />
            </ScrollArea>
          </SidebarContent>
        </Sidebar>

        {/* Main Content */}
        <div className="flex flex-col flex-1">
          {/* Header */}
          <header className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <h1 className="text-lg font-semibold">Cliver</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setControlPanelOpen(true)}
                data-testid="button-control-panel"
              >
                <Settings className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                onClick={() => window.location.href = '/api/logout'}
                data-testid="button-logout"
              >
                Log Out
              </Button>
            </div>
          </header>

          {/* Messages Area */}
          <ScrollArea className="flex-1">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {!activeConversationId ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-20">
                  <Sparkles className="w-12 h-12 text-muted-foreground mb-4" />
                  <h2 className="text-2xl font-semibold mb-2">Welcome to Cliver</h2>
                  <p className="text-muted-foreground mb-6 max-w-md">
                    Start a new conversation to begin AI-powered customer background research
                  </p>
                  <Button onClick={handleNewChat} data-testid="button-start-chat">
                    <Plus className="w-4 h-4 mr-2" />
                    New Chat
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {messages.map((message) => (
                    <div key={message.id} className="space-y-4">
                      {/* User Message */}
                      <div className="flex justify-end">
                        <div className="bg-primary text-primary-foreground rounded-lg px-4 py-3 max-w-2xl" data-testid={`message-user-${message.id}`}>
                          {message.content}
                        </div>
                      </div>

                      {/* AI Responses */}
                      <div className="space-y-4">
                        {message.responses?.map((response) => (
                          <ResponseCard
                            key={response.id}
                            response={response}
                            streamingText={streamingResponses.get(response.id)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input Area */}
          {activeConversationId && (
            <div className="border-t border-border p-6 bg-background">
              <div className="max-w-5xl mx-auto relative">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Paste customer information to research..."
                  className="pr-12 resize-none min-h-[60px]"
                  disabled={sendMessageMutation.isPending}
                  data-testid="input-message"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!input.trim() || sendMessageMutation.isPending}
                  size="icon"
                  className="absolute right-2 bottom-2 rounded-full"
                  data-testid="button-send"
                >
                  {sendMessageMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Control Panel */}
      <ControlPanel
        open={controlPanelOpen}
        onOpenChange={setControlPanelOpen}
        configs={callConfigs}
        userId={user?.id || ''}
        onSave={(configs) => updateCallConfigsMutation.mutate(configs)}
      />
    </SidebarProvider>
  );
}
