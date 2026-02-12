import { SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { Loader2 } from "lucide-react";
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
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
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
            <p className="text-xs text-muted-foreground">
              No conversations yet
            </p>
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

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

  const renderGroup = (label: string, items: Conversation[]) => {
    if (items.length === 0) return null;
    return (
      <SidebarGroup>
        <div className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</div>
        <SidebarGroupContent>
          <SidebarMenu>
            {items.map((conversation) => (
              <SidebarMenuItem key={conversation.id}>
                <SidebarMenuButton
                  onClick={() => onSelectConversation(conversation.id)}
                  isActive={activeConversationId === conversation.id}
                  className="w-full text-xs"
                  data-testid={`conversation-item-${conversation.id}`}
                >
                  <span className="truncate flex-1 text-left">{conversation.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <div className="space-y-2 py-1">
      {renderGroup("Today", today)}
      {renderGroup("Yesterday", yesterday)}
      {renderGroup("Last 7 days", lastWeek)}
      {renderGroup("Older", older)}
    </div>
  );
}
