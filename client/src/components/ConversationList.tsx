import { SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { MessageSquare, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Conversation } from "@shared/schema";

interface ConversationListProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  isLoading?: boolean;
}

export function ConversationList({ 
  conversations, 
  activeConversationId, 
  onSelectConversation,
  isLoading 
}: ConversationListProps) {
  
  if (isLoading) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (conversations.length === 0) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <div className="flex flex-col items-center justify-center py-8 text-center px-4">
            <MessageSquare className="w-8 h-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              No conversations yet
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Start a new chat to begin
            </p>
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  // Group conversations by time
  const now = new Date();
  const today = conversations.filter(c => {
    const date = new Date(c.updatedAt);
    return date.toDateString() === now.toDateString();
  });

  const yesterday = conversations.filter(c => {
    const date = new Date(c.updatedAt);
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    return date.toDateString() === yesterdayDate.toDateString();
  });

  const lastWeek = conversations.filter(c => {
    const date = new Date(c.updatedAt);
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return date > weekAgo && date.toDateString() !== now.toDateString() && 
           date.toDateString() !== new Date(now.setDate(now.getDate() - 1)).toDateString();
  });

  const older = conversations.filter(c => {
    const date = new Date(c.updatedAt);
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return date <= weekAgo;
  });

  return (
    <div className="space-y-6">
      {today.length > 0 && (
        <SidebarGroup>
          <div className="px-3 py-2 text-xs font-medium text-muted-foreground">Today</div>
          <SidebarGroupContent>
            <SidebarMenu>
              {today.map((conversation) => (
                <SidebarMenuItem key={conversation.id}>
                  <SidebarMenuButton
                    onClick={() => onSelectConversation(conversation.id)}
                    isActive={activeConversationId === conversation.id}
                    className="w-full"
                    data-testid={`conversation-item-${conversation.id}`}
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span className="truncate flex-1 text-left">{conversation.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}

      {yesterday.length > 0 && (
        <SidebarGroup>
          <div className="px-3 py-2 text-xs font-medium text-muted-foreground">Yesterday</div>
          <SidebarGroupContent>
            <SidebarMenu>
              {yesterday.map((conversation) => (
                <SidebarMenuItem key={conversation.id}>
                  <SidebarMenuButton
                    onClick={() => onSelectConversation(conversation.id)}
                    isActive={activeConversationId === conversation.id}
                    className="w-full"
                    data-testid={`conversation-item-${conversation.id}`}
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span className="truncate flex-1 text-left">{conversation.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}

      {lastWeek.length > 0 && (
        <SidebarGroup>
          <div className="px-3 py-2 text-xs font-medium text-muted-foreground">Last 7 Days</div>
          <SidebarGroupContent>
            <SidebarMenu>
              {lastWeek.map((conversation) => (
                <SidebarMenuItem key={conversation.id}>
                  <SidebarMenuButton
                    onClick={() => onSelectConversation(conversation.id)}
                    isActive={activeConversationId === conversation.id}
                    className="w-full"
                    data-testid={`conversation-item-${conversation.id}`}
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span className="truncate flex-1 text-left">{conversation.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}

      {older.length > 0 && (
        <SidebarGroup>
          <div className="px-3 py-2 text-xs font-medium text-muted-foreground">Older</div>
          <SidebarGroupContent>
            <SidebarMenu>
              {older.map((conversation) => (
                <SidebarMenuItem key={conversation.id}>
                  <SidebarMenuButton
                    onClick={() => onSelectConversation(conversation.id)}
                    isActive={activeConversationId === conversation.id}
                    className="w-full"
                    data-testid={`conversation-item-${conversation.id}`}
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span className="truncate flex-1 text-left">{conversation.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}
    </div>
  );
}
