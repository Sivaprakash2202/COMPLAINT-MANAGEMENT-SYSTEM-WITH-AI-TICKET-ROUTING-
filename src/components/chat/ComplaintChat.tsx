import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, MessageCircle, User, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  sender_id: string | null;
  sender_name: string;
  sender_role: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

interface ComplaintChatProps {
  complaintId: string;
  complaintTitle: string;
}

export const ComplaintChat = ({ complaintId, complaintTitle }: ComplaintChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user, profile, role } = useAuth();

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('complaint_messages')
      .select('*')
      .eq('complaint_id', complaintId)
      .order('created_at', { ascending: true });

    if (data && !error) {
      const msgs = data as Message[];
      setMessages(msgs);
      
      // Mark other participants' messages as read
      const unreadOthersMsgs = msgs.filter(m => !m.is_read && m.sender_id !== user?.id);
      if (unreadOthersMsgs.length > 0) {
        await supabase
          .from('complaint_messages')
          .update({ is_read: true })
          .eq('complaint_id', complaintId)
          .eq('is_read', false)
          .neq('sender_id', user?.id || '');
      }
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    fetchMessages();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel(`chat-${complaintId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'complaint_messages',
          filter: `complaint_id=eq.${complaintId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          // If it's a message from someone else, mark it read
          if (newMsg.sender_id !== user?.id) {
            await supabase
              .from('complaint_messages')
              .update({ is_read: true })
              .eq('id', newMsg.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [complaintId, role]);

  const sendMessage = async () => {
    if (!newMessage.trim() || isLoading) return;

    setIsLoading(true);
    const senderName = profile?.full_name || user?.email || 'Anonymous';
    const senderRole = role || 'student';

    const { error } = await supabase.from('complaint_messages').insert({
      complaint_id: complaintId,
      sender_id: user?.id,
      sender_name: senderName,
      sender_role: senderRole,
      message: newMessage.trim(),
    });

    if (!error) {
      setNewMessage("");
    }
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getRoleColor = (msgRole: string) => {
    switch (msgRole) {
      case 'tutor': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
      case 'hod': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'principal': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
      case 'super_admin': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const isOwnMessage = (msg: Message) => {
    return msg.sender_id === user?.id;
  };

  return (
    <Card className="h-[400px] flex flex-col">
      <CardHeader className="py-3 border-b">
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          Live Chat - {complaintTitle}
        </CardTitle>
      </CardHeader>
      
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {messages.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">
              No messages yet. Start the conversation!
            </p>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-2 animate-fade-in",
                  isOwnMessage(msg) ? "justify-end" : "justify-start"
                )}
              >
                {!isOwnMessage(msg) && (
                  <div className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    msg.sender_role !== 'student' ? 'bg-primary/10' : 'bg-muted'
                  )}>
                    {msg.sender_role !== 'student' ? (
                      <Shield className="h-4 w-4 text-primary" />
                    ) : (
                      <User className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                )}
                
                <div className={cn(
                  "max-w-[75%] rounded-2xl px-4 py-2",
                  isOwnMessage(msg)
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted rounded-bl-md"
                )}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium">
                      {isOwnMessage(msg) ? 'You' : msg.sender_name}
                    </span>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full uppercase font-medium",
                      isOwnMessage(msg) ? 'bg-primary-foreground/20' : getRoleColor(msg.sender_role)
                    )}>
                      {msg.sender_role}
                    </span>
                  </div>
                  <p className="text-sm">{msg.message}</p>
                  <span className="text-[10px] opacity-70">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                
                {isOwnMessage(msg) && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
      
      <CardContent className="border-t p-3">
        <div className="flex gap-2">
          <Input
            placeholder="Type your message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading || !user}
            className="flex-1"
          />
          <Button
            onClick={sendMessage}
            disabled={!newMessage.trim() || isLoading || !user}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {!user && (
          <p className="text-xs text-muted-foreground mt-2">
            Please log in to send messages.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
