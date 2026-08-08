import { useState, useEffect } from "react";
import { 
  Bell, X, Clock, AlertTriangle, CheckCircle, MessageCircle, 
  FilePlus, RefreshCw, Star, Forward 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface Notification {
  id: string;
  complaint_id: string;
  reminder_type: string;
  message: string;
  is_read: boolean;
  created_at: string;
  sent_to: string | null;
}

export const NotificationBell = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const { user, role } = useAuth();
  const navigate = useNavigate();
  
  const isAdmin = role && ['tutor', 'hod', 'principal', 'super_admin'].includes(role);

  useEffect(() => {
    if (!user) return;

    fetchNotifications();

    // Subscribe to direct reminders (sent_to = me)
    const directChannel = supabase
      .channel(`notifications-direct-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'escalation_reminders',
        filter: `sent_to=eq.${user.id}`,
      }, (payload) => {
        const n = payload.new as Notification;
        setNotifications((prev) => [n, ...prev]);
        if (Notification.permission === 'granted') {
          new Notification('ACE Compliant Management Alert', { body: n.message, icon: '/favicon.ico' });
        }
      })
      .subscribe();

    // Subscribe to new student chat messages on complaint_messages
    const chatChannel = supabase
      .channel(`notifications-chat-msgs-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'complaint_messages',
      }, async (payload) => {
        const msg = payload.new as { id: string; complaint_id: string; sender_role: string; sender_name: string; message: string; created_at: string; sender_id: string | null };
        
        // Only notify if message is NOT from the current user
        if (msg.sender_id === user.id) return;

        // Logic for Admins: Notify on student messages
        const shouldNotifyAdmin = isAdmin && msg.sender_role === 'student';
        
        // Logic for Students: Notify on admin/ai messages if it's their complaint
        let shouldNotifyStudent = false;
        if (!isAdmin) {
          const { data: isMyComplaint } = await supabase
            .from('complaints')
            .select('id')
            .eq('id', msg.complaint_id)
            .eq('submitted_by', user.id)
            .maybeSingle();
          
          if (isMyComplaint) shouldNotifyStudent = true;
        }

        if (shouldNotifyAdmin || shouldNotifyStudent) {
          const { data: complaintData } = await supabase
            .from('complaints')
            .select('title')
            .eq('id', msg.complaint_id)
            .single();
          
          const complaintTitle = complaintData?.title || 'Unknown Complaint';

          const fakeNotif: Notification = {
            id: `chat-${msg.id}`,
            complaint_id: msg.complaint_id,
            reminder_type: 'live_chat',
            message: `💬 ${msg.sender_name} on "${complaintTitle}": "${msg.message.slice(0, 80)}${msg.message.length > 80 ? '...' : ''}"`,
            is_read: false,
            created_at: msg.created_at,
            sent_to: null,
          };
          setNotifications((prev) => {
            if (prev.some(x => x.id === fakeNotif.id)) return prev;
            return [fakeNotif, ...prev];
          });
          if (Notification.permission === 'granted') {
            new Notification('New Chat Message', { body: fakeNotif.message, icon: '/favicon.ico' });
          }
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'complaint_messages',
      }, (payload) => {
        const msg = payload.new as { id: string; complaint_id: string; is_read: boolean };
        if (msg.is_read) {
          // If a student message is read, mark all notifications for this complaint as read
          setNotifications((prev) => prev.map(n => 
            n.complaint_id === msg.complaint_id ? { ...n, is_read: true } : n
          ));
        }
      })
      .subscribe();

    // Subscribe to escalation reminder updates so bell correctly clears
    const reminderUpdateChannel = supabase
      .channel(`notifications-reminders-opts-${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'escalation_reminders',
      }, (payload) => {
        const notif = payload.new as { id: string; complaint_id: string; is_read: boolean };
        if (notif.is_read) {
          // When a reminder is read, also mark all other notifications for that complaint as read
          setNotifications((prev) => prev.map(n => 
            n.complaint_id === notif.complaint_id ? { ...n, is_read: true } : n
          ));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(directChannel);
      supabase.removeChannel(chatChannel);
      supabase.removeChannel(reminderUpdateChannel);
    };
  }, [user, isAdmin]);

  const fetchNotifications = async () => {
    if (!user) return;

    // Fetch direct reminders + recent live_chat ones
    const [directRes, chatRes] = await Promise.all([
      supabase
        .from('escalation_reminders')
        .select('*')
        .eq('sent_to', user.id)
        .order('created_at', { ascending: false })
        .limit(15),
      supabase
        .from('escalation_reminders')
        .select('*')
        .eq('reminder_type', 'live_chat')
        .is('sent_to', null)
        .order('created_at', { ascending: false })
        .limit(15),
    ]);

    const combined = [
      ...(directRes.data || []),
      ...(chatRes.data || []),
    ];

    // Fetch unread complaint_messages for BOTH admins and students
    let chatQuery = supabase
      .from('complaint_messages')
      .select(`
        id, 
        complaint_id, 
        message, 
        created_at, 
        sender_name,
        complaints!inner(title, submitted_by, current_level)
      `)
      .eq('is_read', false)
      .neq('sender_id', user.id);

    if (isAdmin) {
      // Admins only see messages if the complaint is at their level
      if (role === 'tutor') chatQuery = chatQuery.eq('complaints.current_level', 'tutor');
      else if (role === 'hod') chatQuery = chatQuery.eq('complaints.current_level', 'hod');
      else if (role === 'principal') chatQuery = chatQuery.eq('complaints.current_level', 'principal');
    } else {
      // Students only see messages for their own complaints
      chatQuery = chatQuery.eq('complaints.submitted_by', user.id);
    }

    const { data: unreadMsgs } = await chatQuery.limit(10);

    const chatNotifs: Notification[] = (unreadMsgs || []).map(m => ({
      id: `chat-${m.id}`,
      complaint_id: m.complaint_id,
      reminder_type: 'live_chat',
      message: `💬 ${m.sender_name} on "${(m.complaints as any).title}": "${m.message.slice(0, 80)}${m.message.length > 80 ? '...' : ''}"`,
      is_read: false,
      created_at: m.created_at,
      sent_to: null,
    }));

    const allNotifs = [...combined, ...chatNotifs];
    const seen = new Set<string>();
    setNotifications(
      (allNotifs
        .filter((n: Notification) => { if (seen.has(n.id)) return false; seen.add(n.id); return true; })
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 20)) as Notification[]
    );
  };

  const markAsRead = async (id: string, reminderType: string, complaintId?: string) => {
    // Update local state first for immediate UI feedback
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    
    // Only update DB if it's a real DB notification id (UUID), not our fake 'chat-' ids
    if (!id.startsWith('chat-')) {
      await supabase
        .from('escalation_reminders')
        .update({ is_read: true })
        .eq('id', id);
    }

    // Navigation logic
    if (complaintId) {
      if (reminderType === 'feedback') {
        navigate('/admin/feedback');
      } else if (isAdmin) {
        // For admins, navigation depends on the dashboard structure
        // Usually, they are already on a dashboard that shows complaints
        // but we can try to navigate to a specific view if supported.
        // For now, let's keep it simple or navigate to their specific dashboard.
        if (role === 'tutor') navigate('/tutor');
        else if (role === 'hod') navigate('/hod');
        else if (role === 'principal') navigate('/principal');
        else if (role === 'super_admin') navigate('/super-admin');
      } else {
        // For students, navigate to my-complaints
        navigate('/my-complaints');
      }
    }
    setIsOpen(false);
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'sla_warning': return <AlertTriangle className="h-4 w-4 text-warning" />;
      case 'sla_breach': return <Clock className="h-4 w-4 text-destructive" />;
      case 'resolved': return <CheckCircle className="h-4 w-4 text-success" />;
      case 'live_chat': return <MessageCircle className="h-4 w-4 text-primary" />;
      case 'new_complaint': return <FilePlus className="h-4 w-4 text-primary" />;
      case 'status_change': return <RefreshCw className="h-4 w-4 text-info" />;
      case 'level_change': return <Forward className="h-4 w-4 text-accent" />;
      case 'feedback': return <Star className="h-4 w-4 text-yellow-500" />;
      default: return <Bell className="h-4 w-4 text-primary" />;
    }
  };

  // No longer returning null for non-admins

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={requestNotificationPermission}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs animate-bounce-in"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {unreadCount} new
            </Badge>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={cn(
                    "p-3 hover:bg-muted/50 cursor-pointer transition-colors",
                    !notif.is_read && "bg-primary/5"
                  )}
                  onClick={() => markAsRead(notif.id, notif.reminder_type, notif.complaint_id)}
                >
                  <div className="flex gap-3">
                    <div className="mt-0.5">{getIcon(notif.reminder_type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{notif.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(notif.created_at).toLocaleString()}
                      </p>
                    </div>
                    {!notif.is_read && (
                      <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
