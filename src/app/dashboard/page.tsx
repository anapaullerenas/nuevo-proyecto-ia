import { AppFrame, SetupState } from "@/components/AppFrame";
import { ChatWorkspace, type ChatConversation, type ChatMessage } from "@/components/ChatWorkspace";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const workspace = await getWorkspace();
  if (!workspace) return <SetupState />;

  const { data: conversationRows } = await workspace.supabase
    .from("chat_conversations")
    .select("id,title,updated_at")
    .eq("owner_id", workspace.user.id)
    .eq("brand_id", workspace.activeBrand.id)
    .order("updated_at", { ascending: false })
    .limit(40);

  const conversations = (conversationRows || []) as ChatConversation[];
  const initialConversationId = conversations[0]?.id || null;
  let initialMessages: ChatMessage[] = [];

  if (initialConversationId) {
    const { data: messageRows } = await workspace.supabase
      .from("chat_messages")
      .select("id,role,content")
      .eq("conversation_id", initialConversationId)
      .eq("owner_id", workspace.user.id)
      .order("created_at", { ascending: true });

    initialMessages = (messageRows || []).map((message) => ({
      id: message.id,
      role: message.role as "user" | "assistant",
      text: message.content,
    }));
  }

  return (
    <AppFrame active="/dashboard" brand={workspace.activeBrand} brandList={workspace.brandList} credits={workspace.walletBalance} unlimited={workspace.isUnlimited}>
      <ChatWorkspace
        brandName={workspace.activeBrand.name}
        initialConversations={conversations}
        initialConversationId={initialConversationId}
        initialMessages={initialMessages}
      />
    </AppFrame>
  );
}
