import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";
import AdminHeader from "@/components/admin/AdminHeader";
import Footer from "@/components/layout/Footer";
import { ComplaintChat } from "@/components/chat/ComplaintChat";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, Loader2, ArrowLeft, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComplaintSummary {
  id: string;
  title: string;
  category: string;
  status: string;
  current_level: string | null;
  created_at: string;
}

const LiveChat = () => {
  const { user, role, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState<ComplaintSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedComplaint, setSelectedComplaint] = useState<ComplaintSummary | null>(null);
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;

    const fetchComplaints = async () => {
      try {
        let query = supabase
          .from("complaints")
          .select("id, title, category, status, current_level, created_at")
          .order("created_at", { ascending: false });

        // Students see their own complaints, admins see complaints at their level
        if (role === "student") {
          query = query.eq("submitted_by", user.id);
        } else if (role === "tutor") {
          query = query.eq("current_level", "tutor");
        } else if (role === "hod") {
          query = query.eq("current_level", "hod");
        } else if (role === "principal") {
          query = query.eq("current_level", "principal");
        }

        const { data, error } = await query;
        if (error) throw error;
        setComplaints(data || []);

        // Initial unread counts
        if (data && data.length > 0) {
          const ids = data.map(c => c.id);
          const { data: unreadMsgs } = await supabase
            .from("complaint_messages")
            .select("complaint_id, is_read, sender_id")
            .in("complaint_id", ids)
            .eq("is_read", false)
            .neq("sender_id", user.id);

          const counts: Record<string, number> = {};
          unreadMsgs?.forEach(m => {
            counts[m.complaint_id] = (counts[m.complaint_id] || 0) + 1;
          });
          setUnreadMap(counts);
        }
      } catch (err) {
        console.error("Failed to fetch complaints for chat:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchComplaints();

    // Subscribe to new messages for unread counts
    const channel = supabase
      .channel('live-chat-unread')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for all events (INSERT and UPDATE)
          schema: 'public',
          table: 'complaint_messages',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as { complaint_id: string; sender_id: string };
            if (newMsg.sender_id !== user.id) {
              setUnreadMap(prev => ({
                ...prev,
                [newMsg.complaint_id]: (prev[newMsg.complaint_id] || 0) + 1
              }));
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedMsg = payload.new as { complaint_id: string; is_read: boolean; sender_id: string };
            // If messages are marked as read (and it wasn't by us, though usually it would be an admin marking student msgs read)
            if (updatedMsg.is_read) {
              // We need to re-fetch unread count for this specific complaint to be accurate
              // or just decrement if we know exactly how many were marked read.
              // Re-fetching is safer for real-time consistency.
              fetchUnreadForComplaint(updatedMsg.complaint_id);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, role]);

  const refetchDebounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const fetchUnreadForComplaint = async (complaintId: string) => {
    if (refetchDebounceRef.current[complaintId]) {
      clearTimeout(refetchDebounceRef.current[complaintId]);
    }

    refetchDebounceRef.current[complaintId] = setTimeout(async () => {
      // Don't re-fetch if this complaint is currently opened 
      if (selectedComplaint?.id === complaintId) {
        delete refetchDebounceRef.current[complaintId];
        return;
      }

      const { data } = await supabase
        .from("complaint_messages")
        .select("id")
        .eq("complaint_id", complaintId)
        .eq("is_read", false)
        .neq("sender_id", user?.id);
      
      setUnreadMap(prev => {
        if (selectedComplaint?.id === complaintId) return prev;
        return {
          ...prev,
          [complaintId]: data?.length || 0
        };
      });

      delete refetchDebounceRef.current[complaintId];
    }, 300);
  };

  const openComplaint = async (complaint: ComplaintSummary) => {
    setSelectedComplaint(complaint);
    
    // Clear local unread count
    setUnreadMap(prev => {
      const { [complaint.id]: _, ...rest } = prev;
      return rest;
    });

    // Mark as read in database
    await supabase
      .from("complaint_messages")
      .update({ is_read: true })
      .eq("complaint_id", complaint.id)
      .eq("is_read", false)
      .neq("sender_id", user?.id || "");

    // Also clear notification if it exists in escalation_reminders
    if (role && role !== "student") {
      await supabase
        .from("escalation_reminders")
        .update({ is_read: true })
        .eq("complaint_id", complaint.id)
        .eq("reminder_type", "live_chat")
        .eq("is_read", false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const statusColors: Record<string, string> = {
    pending: "bg-warning/10 text-warning border-warning/20",
    in_progress: "bg-primary/10 text-primary border-primary/20",
    resolved: "bg-green-500/10 text-green-600 border-green-500/20",
    rejected: "bg-destructive/10 text-destructive border-destructive/20",
  };

  const statusLabels: Record<string, string> = {
    pending: "Processing",
    in_progress: "Processing",
    resolved: "Resolved",
    rejected: "Rejected",
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {role && role !== "student" ? (
        <AdminHeader title="Live Chat" subtitle="Respond to student queries in real-time" />
      ) : (
        <Header />
      )}

      <main className="flex-1 py-8">
        <div className="container max-w-5xl">
          {/* Page Header */}
          <div className="mb-8 animate-fade-in">
            <div className="flex items-center gap-3 mb-2">
              {selectedComplaint && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedComplaint(null)}
                  className="shrink-0"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              )}
              <div>
                <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                  <MessageCircle className="h-8 w-8 text-primary" />
                  Live Chat
                </h1>
                <p className="text-muted-foreground mt-1">
                  {selectedComplaint
                    ? selectedComplaint.title
                    : "Select a complaint to start chatting"}
                </p>
              </div>
            </div>
          </div>

          {selectedComplaint ? (
            /* Chat View */
            <div className="animate-fade-in">
              <ComplaintChat
                complaintId={selectedComplaint.id}
                complaintTitle={selectedComplaint.title}
              />
            </div>
          ) : (
            /* Complaint List */
            <div className="space-y-3 animate-fade-in">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                  <p className="text-muted-foreground">Loading...</p>
                </div>
              ) : complaints.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
                  <Inbox className="mb-4 h-12 w-12 text-muted-foreground/50" />
                  <p className="text-lg font-medium text-foreground">No complaints found</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Submit a complaint first to start chatting about it.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => navigate("/complaint")}
                  >
                    Submit Complaint
                  </Button>
                </div>
              ) : (
                complaints.map((complaint, index) => (
                  <Card
                    key={complaint.id}
                    className="cursor-pointer transition-all duration-200 hover:border-primary/30 hover:shadow-md animate-fade-in relative overflow-hidden group"
                    style={{ animationDelay: `${index * 0.05}s` }}
                    onClick={() => openComplaint(complaint)}
                  >
                    {unreadMap[complaint.id] > 0 && (
                      <div className="absolute top-0 right-0 h-2 w-2 bg-destructive rounded-bl-lg z-10" />
                    )}
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
                        <MessageCircle className="h-5 w-5 text-primary" />
                        {unreadMap[complaint.id] > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground font-bold border-2 border-background animate-in zoom-in duration-300">
                            {unreadMap[complaint.id] > 9 ? "9+" : unreadMap[complaint.id]}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "font-medium text-foreground truncate transition-colors",
                          unreadMap[complaint.id] > 0 ? "font-bold text-primary" : ""
                        )}>
                          {complaint.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded-full border",
                            statusColors[complaint.status] || ""
                          )}>
                            {statusLabels[complaint.status] || complaint.status}
                          </span>
                          <span className="text-xs text-muted-foreground capitalize">
                            {complaint.category}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground shrink-0">
                        {new Date(complaint.created_at).toLocaleDateString()}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default LiveChat;
