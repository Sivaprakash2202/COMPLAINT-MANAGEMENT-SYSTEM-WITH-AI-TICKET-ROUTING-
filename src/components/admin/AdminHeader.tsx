import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { GraduationCap, LogOut, User, Home } from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
}

const AdminHeader = ({ title, subtitle }: AdminHeaderProps) => {
  const navigate = useNavigate();
  const { profile, signOut, role } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

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

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={getHomeRoute()} className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary shadow-sm group-hover:shadow-glow">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="hidden font-bold text-foreground sm:inline-block">
              ACE Management
            </span>
          </Link>
          <div className="hidden h-6 w-px bg-border md:block" />
          <div className="hidden md:block">
            <h1 className="text-lg font-semibold text-foreground">{title}</h1>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate(getHomeRoute())} 
            className="gap-2 text-primary hover:text-primary hover:bg-primary/5 border border-primary/20"
          >
            <Home className="h-4 w-4" />
            <span className="font-semibold">Home</span>
          </Button>
          {role !== 'super_admin' && <NotificationBell />}
          <div className="hidden items-center gap-2 text-sm md:flex">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="h-4 w-4" />
            </div>
            <span className="text-muted-foreground">{profile?.full_name}</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut} className="gap-2">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;
