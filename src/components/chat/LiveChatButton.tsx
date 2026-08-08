import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare, X, Send, Bot, User, Shield, Search,
  ArrowLeft, Loader2, Sparkles, Clock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface Complaint {
  id: string;
  title: string;
  category: string;
  status: string;
  current_level: string | null;
  created_at: string;
}

interface ChatMessage {
  id: string;
  sender_id: string | null;
  sender_name: string;
  sender_role: string;
  message: string;
  created_at: string;
  is_ai?: boolean;
}

const AI_INACTIVITY_MS = 2.5 * 60 * 1000; // 2.5 minutes

const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  in_progress: "bg-primary/10 text-primary border-primary/20",
  resolved: "bg-green-500/10 text-green-600 border-green-500/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
};

const levelLabels: Record<string, string> = {
  tutor: "Tutor",
  hod: "HOD",
  principal: "Principal",
};

const LiveChatButton = () => {
  const { user, profile, role } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<"list" | "chat">("list");
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [filteredComplaints, setFilteredComplaints] = useState<Complaint[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoadingComplaints, setIsLoadingComplaints] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch complaints on open
  useEffect(() => {
    if (!isOpen || !user) return;
    setIsLoadingComplaints(true);
    const fetchComplaints = async () => {
      let query = supabase
        .from("complaints")
        .select("id, title, category, status, current_level, created_at")
        .order("created_at", { ascending: false });

      if (role === "student") query = query.eq("submitted_by", user.id);
      else if (role === "tutor") query = query.eq("current_level", "tutor");
      else if (role === "hod") query = query.eq("current_level", "hod");
      else if (role === "principal") query = query.eq("current_level", "principal");

      const { data } = await query;
      setComplaints(data || []);
      setFilteredComplaints(data || []);
      setIsLoadingComplaints(false);
    };
    fetchComplaints();
  }, [isOpen, user, role]);

  // Search filter
  useEffect(() => {
    const q = searchQuery.toLowerCase();
    setFilteredComplaints(
      q
        ? complaints.filter(
            (c) =>
              c.title.toLowerCase().includes(q) ||
              c.category.toLowerCase().includes(q) ||
              c.status.toLowerCase().includes(q)
          )
        : complaints
    );
  }, [searchQuery, complaints]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isAiTyping]);

  const resetAiTimer = useCallback(() => {
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    if (!selectedComplaint) return;

    aiTimerRef.current = setTimeout(async () => {
      // Check if last message is from student — if so, trigger AI reply
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
          messages: [
            {
              role: "user",
              content: `The user has submitted a complaint titled "${complaint.title}" in the ${complaint.category} category. Current status: ${complaint.status}. Currently at level: ${complaint.current_level || "tutor"}. Please provide a helpful, empathetic response acknowledging their concern and giving them an update on what typically happens at this stage. Keep it concise and reassuring.`,
            },
          ],
        },
      });

      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender_id: null,
        sender_name: "ACE Compliant Management AI Assistant",
        sender_role: "ai",
        message:
          response.data?.message ||
          `Your complaint "${complaint.title}" is currently being reviewed at the ${levelLabels[complaint.current_level || "tutor"] || "admin"} level. Our team typically responds within 24-48 hours. Thank you for your patience!`,
        created_at: new Date().toISOString(),
        is_ai: true,
      };

      // Also persist AI message to DB so admins see it
      await supabase.from("complaint_messages").insert({
        complaint_id: complaint.id,
        sender_id: null,
        sender_name: "ACE Compliant Management AI Assistant",
        sender_role: "ai",
        message: aiMessage.message,
      });

      setMessages((prev) => [...prev, aiMessage]);
    } catch {
      // silently fail
    } finally {
      setIsAiTyping(false);
    }
  };

  const openComplaint = async (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    setView("chat");
    setMessages([]);

    // Fetch existing messages
    const { data } = await supabase
      .from("complaint_messages")
      .select("*")
      .eq("complaint_id", complaint.id)
      .order("created_at", { ascending: true });

    setMessages((data as ChatMessage[]) || []);

    // Subscribe to realtime
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    channelRef.current = supabase
      .channel(`livechat-${complaint.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "complaint_messages",
          filter: `complaint_id=eq.${complaint.id}`,
        },
        (payload) => {
          const msg = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            const updated = [...prev, msg];
            // Reset timer only on student send — not on admin/ai reply
            if (msg.sender_role !== "student") {
              if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
            }
            return updated;
          });
        }
      )
      .subscribe();
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || isSending || !selectedComplaint || !user) return;
    setIsSending(true);

    const { error } = await supabase.from("complaint_messages").insert({
      complaint_id: selectedComplaint.id,
      sender_id: user.id,
      sender_name: profile?.full_name || user.email || "Student",
      sender_role: role || "student",
      message: newMessage.trim(),
    });

    if (!error) {
      setNewMessage("");
      resetAiTimer();
    }
    setIsSending(false);
  };

  const handleClose = () => {
    setIsOpen(false);
    setView("list");
    setSelectedComplaint(null);
    setSearchQuery("");
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    if (channelRef.current) supabase.removeChannel(channelRef.current);
  };

  const getRoleBadgeClass = (r: string) => {
    if (r === "ai") return "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300";
    if (r === "tutor") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
    if (r === "hod") return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    if (r === "principal") return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
    return "bg-muted text-muted-foreground";
  };

  const isOwn = (msg: ChatMessage) => msg.sender_id === user?.id;

  return (
    <>
      {/* Floating Button — sits above AIChatbot */}
      <Button
        onClick={() => (isOpen ? handleClose() : setIsOpen(true))}
      className={cn(
          "fixed bottom-24 right-6 z-50 h-14 w-14 rounded-full shadow-xl transition-all duration-300",
          "bg-secondary text-secondary-foreground hover:bg-secondary/90 hover:scale-110 border-2 border-secondary/50",
          isOpen && "rotate-90"
        )}
        size="icon"
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageSquare className="h-6 w-6" />
        )}
      </Button>

      {/* Chat Panel */}
      {isOpen && (
        <Card className="fixed bottom-[10.5rem] right-6 z-50 w-[360px] max-w-[calc(100vw-48px)] shadow-2xl border-border/50 animate-scale-in overflow-hidden flex flex-col" style={{ height: 480 }}>
          {/* Header */}
          <CardHeader className="bg-accent text-accent-foreground p-4 shrink-0 [background:hsl(var(--primary))] [color:hsl(var(--primary-foreground))]">
            <CardTitle className="flex items-center gap-2 text-base">
              {view === "chat" && (
                <button
                  onClick={() => { setView("list"); setSelectedComplaint(null); if (aiTimerRef.current) clearTimeout(aiTimerRef.current); }}
                  className="mr-1 hover:opacity-80"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              )}
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/20">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold leading-tight">24/7 Live Chat</p>
                <p className="text-[11px] opacity-80 truncate">
                  {view === "chat" && selectedComplaint
                    ? selectedComplaint.title
                    : "Select a complaint to chat"}
                </p>
              </div>
              <span className="flex items-center gap-1 text-[11px] bg-primary-foreground/20 px-2 py-0.5 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground/60 animate-pulse" />
                Online
              </span>
            </CardTitle>
          </CardHeader>

          {/* Complaint List */}
          {view === "list" && (
            <div className="flex flex-col flex-1 min-h-0">
              <div className="p-3 border-b shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search complaints..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1.5">
                  {isLoadingComplaints ? (
                    <div className="flex justify-center py-10">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : !user ? (
                    <p className="text-center text-muted-foreground text-sm py-8 px-4">
                      Please log in to access live chat.
                    </p>
                  ) : filteredComplaints.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-8 px-4">
                      {searchQuery ? "No results found." : "No complaints found. Submit a complaint to start chatting."}
                    </p>
                  ) : (
                    filteredComplaints.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => openComplaint(c)}
                        className="w-full text-left rounded-lg border border-border p-3 hover:border-primary/40 hover:bg-primary/5 transition-all"
                      >
                        <p className="font-medium text-sm text-foreground truncate">{c.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={cn("text-[10px] px-2 py-0.5 rounded-full border", statusColors[c.status] || "")}>
                            {c.status.replace("_", " ")}
                          </span>
                          {c.current_level && (
                            <span className="text-[10px] text-muted-foreground">
                              @ {levelLabels[c.current_level]}
                            </span>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Chat View */}
          {view === "chat" && selectedComplaint && (
            <div className="flex flex-col flex-1 min-h-0">
              <ScrollArea className="flex-1 p-3" ref={scrollRef}>
                <div className="space-y-3">
                  {/* Welcome message */}
                  <div className="flex justify-center">
                    <span className="text-[10px] text-muted-foreground bg-muted px-3 py-1 rounded-full flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      AI will reply if no admin responds in 2-3 min
                    </span>
                  </div>

                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn("flex gap-2 animate-fade-in", isOwn(msg) ? "justify-end" : "justify-start")}
                    >
                      {!isOwn(msg) && (
                        <div className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-primary-foreground",
                          msg.is_ai || msg.sender_role === "ai" ? "bg-accent" : "bg-primary/80"
                        )}>
                          {msg.is_ai || msg.sender_role === "ai" ? (
                            <Sparkles className="h-3.5 w-3.5" />
                          ) : msg.sender_role === "student" ? (
                            <User className="h-3.5 w-3.5" />
                          ) : (
                            <Shield className="h-3.5 w-3.5" />
                          )}
                        </div>
                      )}
                      <div className={cn(
                        "max-w-[78%] rounded-2xl px-3 py-2",
                        isOwn(msg)
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted rounded-bl-sm"
                      )}>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[10px] font-semibold leading-tight">
                            {isOwn(msg) ? "You" : msg.sender_name}
                          </span>
                          <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-medium uppercase", isOwn(msg) ? "bg-primary-foreground/20 text-primary-foreground" : getRoleBadgeClass(msg.sender_role))}>
                            {msg.sender_role === "ai" ? "AI" : msg.sender_role}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed">{msg.message}</p>
                        <span className="text-[9px] opacity-60">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      {isOwn(msg) && (
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <User className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </div>
                  ))}

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
                </div>
              </ScrollArea>

              <CardContent className="border-t p-2 shrink-0">
                {!user ? (
                  <p className="text-xs text-muted-foreground text-center py-1">Log in to send messages</p>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type your message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                      disabled={isSending}
                      className="flex-1 h-8 text-sm"
                    />
                    <Button
                      onClick={sendMessage}
                      disabled={!newMessage.trim() || isSending}
                      size="icon"
                      className="h-8 w-8 shrink-0"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </div>
          )}
        </Card>
      )}
    </>
  );
};

export default LiveChatButton;
