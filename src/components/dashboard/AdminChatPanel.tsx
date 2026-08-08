import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MessageCircle, Send, User, Shield, Sparkles,
  Loader2, X, ArrowLeft, Search, Clock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface Complaint {
  id: string;
  title: string;
  status: string;
  current_level: string | null;
  submitter_name: string;
}

interface ChatMessage {
  id: string;
  complaint_id: string;
  sender_id: string | null;
  sender_name: string;
  sender_role: string;
  message: string;
  created_at: string;
  is_read: boolean | null;
  is_ai?: boolean;
}

interface UnreadMap {
  [complaintId: string]: number;
}

const AI_INACTIVITY_MS = 2.5 * 60 * 1000;

const getRoleBadgeClass = (r: string) => {
  if (r === "ai") return "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300";
  if (r === "tutor") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
  if (r === "hod") return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
  if (r === "principal") return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
  return "bg-muted text-muted-foreground";
};

interface AdminChatPanelProps {
  complaints: Complaint[];
  onUnreadChange?: (count: number) => void;
}

export const AdminChatPanel = ({ complaints, onUnreadChange }: AdminChatPanelProps) => {
  const { user, profile, role } = useAuth();
  const [view, setView] = useState<"list" | "chat">("list");
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [unreadMap, setUnreadMap] = useState<UnreadMap>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const listChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Subscribe to all complaint messages for unread counts
  useEffect(() => {
    if (!complaints.length || !user) return;

    // Fetch initial unread counts
    const fetchUnread = async () => {
      const ids = complaints.map((c) => c.id);
      const { data } = await supabase
        .from("complaint_messages")
        .select("complaint_id, is_read, sender_role")
        .in("complaint_id", ids)
        .eq("is_read", false)
        .neq("sender_id", user.id);

      const counts: UnreadMap = {};
      data?.forEach((m) => {
        if (m.sender_role === "student") {
          counts[m.complaint_id] = (counts[m.complaint_id] || 0) + 1;
        }
      });
      setUnreadMap(counts);

      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      onUnreadChange?.(total);
    };

    fetchUnread();

    // Subscribe to new messages across all complaints
    if (listChannelRef.current) supabase.removeChannel(listChannelRef.current);
    listChannelRef.current = supabase
      .channel("admin-chat-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "complaint_messages" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const msg = payload.new as ChatMessage;
          if (msg.sender_role === "student" && msg.sender_id !== user.id) {
            setUnreadMap((prev) => {
              const updated = { ...prev, [msg.complaint_id as unknown as string]: (prev[msg.complaint_id as unknown as string] || 0) + 1 };
              const total = Object.values(updated).reduce((a, b) => a + b, 0);
              onUnreadChange?.(total);
              return updated;
            });
          }
        } else if (payload.eventType === "UPDATE") {
          const updatedMsg = payload.new as ChatMessage;
          if (updatedMsg.is_read) {
            // Re-fetch unread count for this specific complaint to be accurate
            reFetchUnreadForComplaint(updatedMsg.complaint_id);
          }
        }
      })
      .subscribe();

    return () => {
      if (listChannelRef.current) supabase.removeChannel(listChannelRef.current);
    };
  }, [complaints, user]);

  const refetchDebounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const reFetchUnreadForComplaint = async (complaintId: string) => {
    // If we have an active timer for this complaint, clear it
    if (refetchDebounceRef.current[complaintId]) {
      clearTimeout(refetchDebounceRef.current[complaintId]);
    }

    // Debounce re-fetch to handle bulk updates and prevent race conditions
    refetchDebounceRef.current[complaintId] = setTimeout(async () => {
      // Don't re-fetch if this complaint is currently opened in chat view 
      // as it might overwrite the local "0" count with a stale DB value
      if (selectedComplaint?.id === complaintId && view === "chat") {
        delete refetchDebounceRef.current[complaintId];
        return;
      }

      const { data } = await supabase
        .from("complaint_messages")
        .select("id")
        .eq("complaint_id", complaintId)
        .eq("is_read", false)
        .neq("sender_id", user?.id)
        .eq("sender_role", "student");
      
      setUnreadMap((prev) => {
        // Double check if selected complaint changed during async fetch
        if (selectedComplaint?.id === complaintId && view === "chat") return prev;
        
        const updated = { ...prev, [complaintId]: data?.length || 0 };
        const total = Object.values(updated).reduce((a, b) => a + b, 0);
        onUnreadChange?.(total);
        return updated;
      });

      delete refetchDebounceRef.current[complaintId];
    }, 300);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAiTyping]);

  const openComplaint = async (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    setView("chat");
    setMessages([]);

    const { data } = await supabase
      .from("complaint_messages")
      .select("*")
      .eq("complaint_id", complaint.id)
      .order("created_at", { ascending: true });

    setMessages((data as ChatMessage[]) || []);

    // Mark all as read
    await supabase
      .from("complaint_messages")
      .update({ is_read: true })
      .eq("complaint_id", complaint.id)
      .eq("sender_role", "student")
      .eq("is_read", false);

    // Mark related notifications as read
    await supabase
      .from("escalation_reminders")
      .update({ is_read: true })
      .eq("complaint_id", complaint.id)
      .eq("reminder_type", "live_chat")
      .eq("is_read", false);

    setUnreadMap((prev) => {
      const updated = { ...prev, [complaint.id]: 0 };
      const total = Object.values(updated).reduce((a, b) => a + b, 0);
      onUnreadChange?.(total);
      return updated;
    });

    if (channelRef.current) supabase.removeChannel(channelRef.current);
    channelRef.current = supabase
      .channel(`admin-chat-${complaint.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "complaint_messages",
        filter: `complaint_id=eq.${complaint.id}`,
      }, (payload) => {
        const msg = payload.new as ChatMessage;
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          // Stop AI timer if admin/AI replied
          if (msg.sender_role !== "student") {
            if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
          }
          return [...prev, msg];
        });

        // Mark message as read if it is from student and we are an admin
        if (msg.sender_role === "student" && msg.sender_id !== user?.id) {
          supabase
            .from("complaint_messages")
            .update({ is_read: true })
            .eq("id", msg.id)
            .then();
        }
      })
      .subscribe();
  };

  const resetAiTimer = useCallback(() => {
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    if (!selectedComplaint) return;
    aiTimerRef.current = setTimeout(() => {
      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (!lastMsg || lastMsg.sender_role !== "student") return prev;
        triggerAiReply(selectedComplaint);
        return prev;
      });
    }, AI_INACTIVITY_MS);
  }, [selectedComplaint]);

  const triggerAiReply = async (complaint: Complaint) => {
    setIsAiTyping(true);
    try {
      const response = await supabase.functions.invoke("ai-chatbot", {
        body: {
          messages: [{
            role: "user",
            content: `A student has a complaint titled "${complaint.title}" currently at ${complaint.current_level || "tutor"} level with status "${complaint.status}". Reply as a helpful campus assistant acknowledging their query and explaining what typically happens next. Be concise and reassuring.`,
          }],
        },
      });

      const aiMsg = response.data?.message || `Your complaint "${complaint.title}" is under active review. Our team will respond shortly. Thank you for your patience!`;

      await supabase.from("complaint_messages").insert({
        complaint_id: complaint.id,
        sender_id: null,
        sender_name: "ACE Compliant Management AI Assistant",
        sender_role: "ai",
        message: aiMsg,
      });
    } catch {
      // silently fail
    } finally {
      setIsAiTyping(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || isSending || !selectedComplaint || !user) return;
    setIsSending(true);

    const { error } = await supabase.from("complaint_messages").insert({
      complaint_id: selectedComplaint.id,
      sender_id: user.id,
      sender_name: profile?.full_name || user.email || "Admin",
      sender_role: role || "tutor",
      message: newMessage.trim(),
    });

    if (!error) {
      setNewMessage("");
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    }
    setIsSending(false);
  };

  const filtered = searchQuery
    ? complaints.filter((c) =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.submitter_name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : complaints;

  const totalUnread = Object.values(unreadMap).reduce((a, b) => a + b, 0);

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardHeader className="py-3 px-4 border-b bg-gradient-to-r from-primary/5 to-primary/10">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            Live Chat
            {totalUnread > 0 && (
              <Badge className="bg-destructive text-destructive-foreground text-[10px] h-5 min-w-5 px-1.5">
                {totalUnread}
              </Badge>
            )}
          </div>
          {view === "chat" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => {
                setView("list");
                setSelectedComplaint(null);
                if (channelRef.current) supabase.removeChannel(channelRef.current);
              }}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Button>
          )}
        </CardTitle>
      </CardHeader>

      {/* Complaint list */}
      {view === "list" && (
        <div className="flex flex-col" style={{ height: 380 }}>
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search complaints or students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <MessageCircle className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No complaints to chat about</p>
              </div>
            ) : (
              <div className="p-2 space-y-1.5">
                {filtered.map((c) => {
                  const unread = unreadMap[c.id] || 0;
                  return (
                    <button
                      key={c.id}
                      onClick={() => openComplaint(c)}
                      className="w-full text-left rounded-lg border border-border p-3 hover:border-primary/40 hover:bg-primary/5 transition-all relative"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm text-foreground truncate">{c.title}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                            From: {c.submitter_name}
                          </p>
                        </div>
                        {unread > 0 && (
                          <Badge className="bg-destructive text-destructive-foreground text-[10px] h-5 min-w-5 px-1.5 shrink-0">
                            {unread}
                          </Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      {/* Chat view */}
      {view === "chat" && selectedComplaint && (
        <div className="flex flex-col" style={{ height: 380 }}>
          <ScrollArea className="flex-1 p-3">
            <div className="space-y-3">
              <div className="flex justify-center">
                <span className="text-[10px] text-muted-foreground bg-muted px-3 py-1 rounded-full flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  AI auto-replies if you don't respond in 2-3 min
                </span>
              </div>

              {messages.map((msg) => {
                const isOwn = msg.sender_id === user?.id;
                return (
                  <div
                    key={msg.id}
                    className={cn("flex gap-2 animate-fade-in", isOwn ? "justify-end" : "justify-start")}
                  >
                    {!isOwn && (
                      <div className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-primary-foreground",
                        msg.sender_role === "ai" ? "bg-accent" : msg.sender_role === "student" ? "bg-muted" : "bg-primary/80"
                      )}>
                        {msg.sender_role === "ai" ? (
                          <Sparkles className="h-3.5 w-3.5" />
                        ) : msg.sender_role === "student" ? (
                          <User className="h-3.5 w-3.5 text-foreground" />
                        ) : (
                          <Shield className="h-3.5 w-3.5" />
                        )}
                      </div>
                    )}
                    <div className={cn(
                      "max-w-[75%] rounded-2xl px-3 py-2",
                      isOwn
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted rounded-bl-sm"
                    )}>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] font-semibold">{isOwn ? "You" : msg.sender_name}</span>
                        <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-medium uppercase", isOwn ? "bg-primary-foreground/20 text-primary-foreground" : getRoleBadgeClass(msg.sender_role))}>
                          {msg.sender_role === "ai" ? "AI" : msg.sender_role}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed">{msg.message}</p>
                      <span className="text-[9px] opacity-60">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    {isOwn && (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Shield className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </div>
                );
              })}

              {isAiTyping && (
                <div className="flex gap-2 justify-start animate-fade-in">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <CardContent className="border-t p-2 shrink-0">
            <div className="flex gap-2">
              <Input
                placeholder="Reply to student..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }}}
                disabled={isSending}
                className="flex-1 h-8 text-sm"
              />
              <Button
                onClick={sendMessage}
                disabled={!newMessage.trim() || isSending}
                size="icon"
                className="h-8 w-8"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </div>
      )}
    </Card>
  );
};
