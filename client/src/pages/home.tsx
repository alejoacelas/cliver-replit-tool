import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Settings, Send, Loader2, Download, Key } from "lucide-react";
import { Link } from "wouter";
import { ConversationList } from "@/components/ConversationList";
import { ResponseCard } from "@/components/ResponseCard";
import { ControlPanel } from "@/components/ControlPanel";
import { ExportDialog } from "@/components/ExportDialog";
import type { Conversation, Message, MessageResponse, UserCallConfig } from "@shared/schema";

export default function Home() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [controlPanelOpen, setControlPanelOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [streamingResponses, setStreamingResponses] = useState<Map<string, string>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
    enabled: !!user,
    retry: false,
  });

  const { data: messages = [] } = useQuery<(Message & { responses: MessageResponse[] })[]>({
    queryKey: ["/api/conversations", activeConversationId, "messages"],
    enabled: !!activeConversationId,
    retry: false,
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasStreamingResponses = data?.some(msg =>
        msg.responses?.some(r => r.status === "streaming")
      );
      return hasStreamingResponses ? 1000 : false;
    },
  });

  const { data: callConfigs = [] } = useQuery<UserCallConfig[]>({
    queryKey: ["/api/call-configs"],
    enabled: !!user,
    retry: false,
  });

  const createConversationMutation = useMutation({
    mutationFn: async (title: string) => {
      const res = await apiRequest("POST", "/api/conversations", { title });
      return await res.json() as Conversation;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      queryClient.removeQueries({ queryKey: ["/api/conversations", activeConversationId, "messages"] });
      setActiveConversationId(data.id);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to create conversation", variant: "destructive" });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: string; content: string }) => {
      const res = await apiRequest("POST", `/api/conversations/${conversationId}/messages`, { content });
      return await res.json() as { message: Message };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", activeConversationId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      }, 2000);
      setInput("");
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
    },
  });

  const updateCallConfigsMutation = useMutation({
    mutationFn: async (configs: UserCallConfig[]) => {
      return await apiRequest("PUT", "/api/call-configs", { configs });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/call-configs"] });
      toast({ title: "Saved", description: "Configuration updated" });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to update configurations", variant: "destructive" });
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!activeConversationId && conversations.length > 0) {
      setActiveConversationId(conversations[0].id);
    }
  }, [conversations, activeConversationId]);

  const sidebarStyle = {
    "--sidebar-width": "260px",
  } as React.CSSProperties;

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <SidebarProvider style={sidebarStyle}>
      <div className="flex h-screen w-full">
        <Sidebar>
          <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={handleNewChat}
                  className="w-full"
                  data-testid="button-new-chat"
                >
                  <Plus className="w-4 h-4" />
                  <span>New chat</span>
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
          <SidebarFooter className="border-t border-sidebar-border px-3 py-3">
            {user?.isGuest ? (
              <button
                onClick={() => window.location.href = '/api/login'}
                className="w-full text-xs text-muted-foreground hover:text-foreground rounded-md p-2.5 text-left transition-colors"
                data-testid="button-guest-signin-prompt"
              >
                Sign in to save conversations
              </button>
            ) : (
              <Link
                href="/api-keys"
                className="flex items-center gap-2 w-full text-xs text-muted-foreground hover:text-foreground rounded-md p-2.5 text-left transition-colors"
                data-testid="link-api-keys"
              >
                <Key className="w-3.5 h-3.5" />
                <span>API Keys</span>
              </Link>
            )}
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between px-4 h-12 border-b border-border shrink-0">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <span className="text-sm font-medium tracking-tight">cliver</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setExportDialogOpen(true)}
                data-testid="button-export"
              >
                <Download className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setControlPanelOpen(true)}
                data-testid="button-control-panel"
              >
                <Settings className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs ml-1"
                onClick={() => window.location.href = user?.isGuest ? '/api/login' : '/api/logout'}
                data-testid={user?.isGuest ? "button-signin" : "button-logout"}
              >
                {user?.isGuest ? "Sign in" : "Log out"}
              </Button>
            </div>
          </header>

          <ScrollArea className="flex-1">
            <div className="max-w-3xl mx-auto px-6 py-8">
              {!activeConversationId ? (
                <div className="flex flex-col items-center justify-center text-center py-24">
                  <h2 className="text-lg font-medium mb-1.5">No conversation selected</h2>
                  <p className="text-sm text-muted-foreground mb-5">
                    Start a new chat to begin screening
                  </p>
                  <Button size="sm" onClick={handleNewChat} data-testid="button-start-chat">
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    New chat
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {messages.map((message) => (
                    <div key={message.id} className="space-y-3">
                      <div className="flex justify-end">
                        <div
                          className="bg-foreground text-background rounded-lg px-4 py-2.5 max-w-xl text-sm"
                          data-testid={`message-user-${message.id}`}
                        >
                          {message.content}
                        </div>
                      </div>
                      <div className="space-y-3">
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

          {activeConversationId && (
            <div className="border-t border-border p-4 shrink-0">
              <div className="max-w-3xl mx-auto relative">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Paste customer information..."
                  className="pr-12 resize-none min-h-[52px] text-sm"
                  disabled={sendMessageMutation.isPending}
                  data-testid="input-message"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!input.trim() || sendMessageMutation.isPending}
                  size="icon"
                  className="absolute right-2 bottom-2 h-7 w-7 rounded-md"
                  data-testid="button-send"
                >
                  {sendMessageMutation.isPending ? (
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

      <ControlPanel
        open={controlPanelOpen}
        onOpenChange={setControlPanelOpen}
        configs={callConfigs}
        userId={user?.id || ''}
        onSave={(configs) => updateCallConfigsMutation.mutate(configs)}
      />

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
      />
    </SidebarProvider>
  );
}
