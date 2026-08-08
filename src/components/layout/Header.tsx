import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, LogIn, FileText, Sparkles, LayoutDashboard, LogOut, Phone, Search, MessageCircle, Home } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useEffect } from "react";

const Header = () => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  const { user, role, signOut } = useAuth();
  
  useEffect(() => {
    if (!user) return;

    const fetchUnreadCount = async () => {
      let query = supabase
        .from('complaint_messages')
        .select('id', { count: 'exact' })
        .eq('is_read', false)
        .neq('sender_id', user.id);
      
      if (role === 'student') {
        const { data: myComplaints } = await supabase.from('complaints').select('id').eq('submitted_by', user.id);
        if (myComplaints && myComplaints.length > 0) {
          query = query.in('complaint_id', myComplaints.map(c => c.id));
        } else {
          setUnreadChatCount(0);
          return;
        }
      } else if (role === 'tutor' || role === 'hod' || role === 'principal') {
        const { data: adminComplaints } = await supabase.from('complaints').select('id').eq('current_level', role);
        if (adminComplaints && adminComplaints.length > 0) {
          query = query.in('complaint_id', adminComplaints.map(c => c.id));
        } else {
          setUnreadChatCount(0);
          return;
        }
      }

      const { count } = await query;
      setUnreadChatCount(count || 0);
    };

    fetchUnreadCount();

    const channel = supabase
      .channel('header-unread-chat')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaint_messages' }, () => {
        fetchUnreadCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, role]);
  const navigate = useNavigate();
  
  const getHomeRoute = () => {
    switch (role) {
      case 'super_admin': return '/admin';
      case 'department_admin': return '/department';
      case 'tutor': return '/tutor';
      case 'hod': return '/hod';
      case 'principal': return '/principal';
      default: return '/';
    }
  };
  
  // Admin roles (tutor, hod, principal) only see logout - no navigation
  const isAdminRole = role === "tutor" || role === "hod" || role === "principal";

  const navItems = isAdminRole
    ? [
        { path: "/chat", label: "Live Chat", icon: MessageCircle },
      ]
    : user
    ? [
        { path: "/", label: "Home", icon: null },
        { path: "/complaint", label: "Submit Complaint", icon: FileText },
        { path: "/track", label: "Track Status", icon: Search },
        { path: "/chat", label: "Live Chat", icon: MessageCircle },
        { path: "/contact", label: "Contact", icon: Phone },
        { path: "/my-complaints", label: "My Complaints", icon: LayoutDashboard },
      ]
    : [
        { path: "/", label: "Home", icon: null },
        { path: "/complaint", label: "Submit Complaint", icon: FileText },
        { path: "/track", label: "Track Status", icon: Search },
        { path: "/contact", label: "Contact", icon: Phone },
        { path: "/auth", label: "Login", icon: LogIn },
      ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl gradient-primary shadow-md transition-all duration-300 group-hover:shadow-glow group-hover:scale-105">
            <Sparkles className="h-5 w-5 text-primary-foreground animate-pulse" />
            <div className="absolute inset-0 rounded-xl bg-primary/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="hidden sm:flex flex-col">
            <span className="font-bold text-foreground tracking-tight text-lg leading-none">
              ACE Compliant <span className="text-gradient">Management</span>
            </span>
            <span className="text-[10px] text-muted-foreground font-medium">AI-Powered Solutions</span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link key={item.path} to={item.path} className="relative">
              <Button
                variant={location.pathname === item.path ? "secondary" : "ghost"}
                size="sm"
                className="gap-2"
              >
                {item.icon && <item.icon className="h-4 w-4" />}
                {item.label}
                {item.path === "/chat" && unreadChatCount > 0 && (
                  <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 min-w-4 p-0 flex items-center justify-center text-[10px] animate-pulse">
                    {unreadChatCount}
                  </Badge>
                )}
              </Button>
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {isAdminRole && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate(getHomeRoute())} 
              className="gap-2 text-primary hover:text-primary hover:bg-primary/5 border border-primary/20 mr-2"
            >
              <Home className="h-4 w-4" />
              <span className="font-semibold">Home</span>
            </Button>
          )}
          <NotificationBell />
          <ThemeToggle />
          {user ? (
            <Button variant="ghost" size="sm" onClick={() => signOut()} className="gap-2 text-muted-foreground hover:text-destructive">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          ) : (
            <Link to="/complaint">
              <Button variant="hero" size="sm" className="gap-2 group">
                <FileText className="h-4 w-4 transition-transform group-hover:scale-110" />
                Submit Complaint
              </Button>
            </Link>
          )}
        </div>

        {/* Mobile Menu Button */}
        <div className="flex items-center gap-2 md:hidden">
          <NotificationBell />
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="border-t border-border/40 bg-background md:hidden animate-fade-in">
          <nav className="container flex flex-col gap-2 py-4">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Button
                  variant={location.pathname === item.path ? "secondary" : "ghost"}
                  className="w-full justify-start gap-2"
                >
                  {item.icon && <item.icon className="h-4 w-4" />}
                  {item.label}
                </Button>
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
