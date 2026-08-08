import { useState } from "react";
import { useTheme } from "next-themes";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  User,
  Settings,
  Bell,
  LogOut,
  Edit3,
  FileText,
  MessageCircle,
  ChevronRight,
  Shield,
  GraduationCap,
  Building2,
  Crown,
  CheckCircle,
  MoreVertical,
  BookOpen,
  Search,
  Sun,
  Moon,
  Monitor,
  ArrowLeft,
  BellRing,
  BellOff,
  Smartphone,
  Phone,
  Mail,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";


type PanelRole = "student" | "tutor" | "hod" | "principal" | "super_admin";
type PanelView = "main" | "notifications" | "preferences" | "security";

interface QuickActionsPanelProps {
  role: PanelRole;
  unreadChatCount?: number;
}

const roleConfig: Record<PanelRole, { color: string; icon: React.ElementType; label: string; gradient: string }> = {
  student: { color: "text-primary", icon: GraduationCap, label: "Student", gradient: "from-primary/10 to-primary/5" },
  tutor: { color: "text-emerald-600", icon: GraduationCap, label: "Tutor", gradient: "from-emerald-500/10 to-emerald-500/5" },
  hod: { color: "text-blue-600", icon: Building2, label: "Head of Department", gradient: "from-blue-500/10 to-blue-500/5" },
  principal: { color: "text-amber-600", icon: Crown, label: "Principal", gradient: "from-amber-500/10 to-amber-500/5" },
  super_admin: { color: "text-destructive", icon: Shield, label: "Super Admin", gradient: "from-destructive/10 to-destructive/5" },
};

export const QuickActionsPanel = ({ role, unreadChatCount = 0 }: QuickActionsPanelProps) => {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [view, setView] = useState<PanelView>("main");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  useEffect(() => {
    if (profile && user) {
      // Try to parse country code from phone_number
      let cCode = "+91";
      let phoneBody = profile.phone_number || "";
      if (phoneBody.startsWith("+")) {
        const spaceIdx = phoneBody.indexOf(" ");
        if (spaceIdx > 0) {
          cCode = phoneBody.substring(0, spaceIdx);
          phoneBody = phoneBody.substring(spaceIdx + 1);
        } else if (phoneBody.startsWith("+91")) {
          cCode = "+91";
          phoneBody = phoneBody.substring(3);
        } else if (phoneBody.startsWith("+1")) {
          cCode = "+1";
          phoneBody = phoneBody.substring(2);
        }
      }

      setFullName(profile.full_name || "");
      setEmail(profile.email || user.email || "");
      setCountryCode(cCode);
      setPhone(phoneBody);
    }
  }, [profile, user, isEditingProfile]);

  // Notification preferences (stored locally, can be persisted)
  const [notifPrefs, setNotifPrefs] = useState({
    emailAlerts: true,
    smsAlerts: true,
    chatMessages: true,
    statusUpdates: true,
    escalations: true,
  });

  const cfg = roleConfig[role];
  const RoleIcon = cfg.icon;

  const handleSaveProfile = async () => {
    if (!user || !fullName.trim() || !email.trim()) return;
    setIsSaving(true);
    
    // Update auth user if email changed
    let authUpdateError = null;
    if (email.trim() !== user.email) {
      const { error } = await supabase.auth.updateUser({ email: email.trim() });
      authUpdateError = error;
    }

    if (authUpdateError) {
      toast({ title: "Email Update Error", description: authUpdateError.message || "Failed to update email.", variant: "destructive" });
    }

    const { error } = await supabase
      .from("profiles")
      .update({ 
        full_name: fullName.trim(), 
        email: email.trim(),
        phone_number: `${countryCode} ${phone.trim()}` 
      })
      .eq("user_id", user.id);

    if (error) {
      toast({ title: "Error", description: "Failed to update profile details.", variant: "destructive" });
    } else {
      await refreshProfile();
      toast({ title: "Profile updated", description: "Your info has been saved." + (authUpdateError ? " (Email update failed)" : "") });
      setIsEditingProfile(false);
    }
    setIsSaving(false);
  };

  const handleRequestNotificationPermission = async () => {
    if ("Notification" in window && Notification.permission === "default") {
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        toast({ title: "Notifications enabled", description: "You'll receive browser alerts for updates." });
      } else {
        toast({ title: "Notifications blocked", description: "Enable in browser settings to receive alerts.", variant: "destructive" });
      }
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword !== confirmPassword) {
      toast({ title: "Validation Error", description: "Passwords do not match.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Validation Error", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }

    setIsUpdatingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsUpdatingPassword(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Password updated successfully." });
      setNewPassword("");
      setConfirmPassword("");
      setView("main");
    }
  };

  const studentActions = [
    { icon: FileText, label: "Submit New Complaint", description: "File a new grievance", action: () => navigate("/complaint"), badge: null, color: "text-primary" },
    { icon: Search, label: "Track Complaint", description: "Check status by ID", action: () => navigate("/track"), badge: null, color: "text-info" },
    { icon: MessageCircle, label: "Live Chat", description: "Chat with your admin", action: () => navigate("/chat"), badge: unreadChatCount > 0 ? unreadChatCount : null, color: "text-success" },
    { icon: Phone, label: "Contact Support", description: "Reach out for help", action: () => navigate("/contact"), badge: null, color: "text-muted-foreground" },
  ];

  const tutorActions = [
    { icon: FileText, label: "My Complaints", description: "View pending cases", action: () => navigate("/tutor"), badge: null, color: "text-emerald-600" },
    { icon: MessageCircle, label: "Student Chats", description: "Respond to student queries", action: () => navigate("/chat"), badge: unreadChatCount > 0 ? unreadChatCount : null, color: "text-primary" },
    { icon: CheckCircle, label: "Resolved Cases", description: "View your resolved complaints", action: () => navigate("/tutor"), badge: null, color: "text-success" },
  ];

  const hodActions = [
    { icon: FileText, label: "Escalated Complaints", description: "Cases forwarded by tutors", action: () => navigate("/hod"), badge: null, color: "text-blue-600" },
    { icon: MessageCircle, label: "Student Chats", description: "Respond to queries", action: () => navigate("/chat"), badge: unreadChatCount > 0 ? unreadChatCount : null, color: "text-primary" },
    { icon: BookOpen, label: "Department Overview", description: "View department stats", action: () => navigate("/hod"), badge: null, color: "text-info" },
  ];

  const principalActions = [
    { icon: FileText, label: "Final Escalations", description: "Cases forwarded by HOD", action: () => navigate("/principal"), badge: null, color: "text-amber-600" },
    { icon: MessageCircle, label: "Student Chats", description: "Address student concerns", action: () => navigate("/chat"), badge: unreadChatCount > 0 ? unreadChatCount : null, color: "text-primary" },
    { icon: Shield, label: "Institution Overview", description: "System-wide analytics", action: () => navigate("/principal"), badge: null, color: "text-info" },
  ];

  const superAdminActions = [
    { icon: FileText, label: "All Complaints", description: "View & manage every complaint", action: () => navigate("/admin"), badge: null, color: "text-destructive" },
    { icon: MessageCircle, label: "Live Chats", description: "Monitor student-admin chats", action: () => navigate("/chat"), badge: unreadChatCount > 0 ? unreadChatCount : null, color: "text-primary" },
    { icon: Shield, label: "System Overview", description: "Analytics & reports", action: () => navigate("/admin"), badge: null, color: "text-info" },
    { icon: User, label: "Manage Admins", description: "Add/view department admins", action: () => navigate("/admin"), badge: null, color: "text-amber-600" },
  ];

  const actionsMap: Record<PanelRole, typeof studentActions> = {
    student: studentActions,
    tutor: tutorActions,
    hod: hodActions,
    principal: principalActions,
    super_admin: superAdminActions,
  };

  const quickActions = actionsMap[role];

  const browserNotifStatus =
    !("Notification" in window)
      ? "unsupported"
      : Notification.permission === "granted"
      ? "granted"
      : Notification.permission === "denied"
      ? "denied"
      : "default";

  return (
    <Sheet onOpenChange={() => setView("main")}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="relative shrink-0">
          <MoreVertical className="h-4 w-4" />
          {unreadChatCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] text-destructive-foreground font-bold">
              {unreadChatCount > 9 ? "9+" : unreadChatCount}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent className="w-[320px] sm:w-[380px] p-0 flex flex-col">
        {/* ── MAIN VIEW ── */}
        {view === "main" && (
          <>
            {/* Profile Header */}
            <div className={`bg-gradient-to-br ${cfg.gradient} p-6 border-b border-border/40`}>
              <SheetHeader className="text-left space-y-0 mb-4">
                <SheetTitle className="flex items-center gap-2 text-base">
                  <RoleIcon className={`h-5 w-5 ${cfg.color}`} />
                  Quick Actions
                </SheetTitle>
                <SheetDescription className="text-xs">
                  Manage your account and navigate quickly
                </SheetDescription>
              </SheetHeader>

              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-background shadow-sm">
                  <User className={`h-6 w-6 ${cfg.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm">{profile?.full_name || user?.user_metadata?.full_name || "User"}</p>
                  <p className="text-xs text-muted-foreground truncate max-w-[180px]">{profile?.email || user?.email}</p>
                  <p className="text-xs text-muted-foreground">{profile?.phone_number || "No phone added"}</p>
                  <Badge variant="outline" className={`text-[10px] mt-0.5 ${cfg.color} border-current`}>
                    {cfg.label}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Edit Profile */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Edit Profile</p>
                  <Button variant="ghost" size="sm" onClick={() => setIsEditingProfile(!isEditingProfile)} className="h-7 text-xs gap-1">
                    <Edit3 className="h-3 w-3" />
                    {isEditingProfile ? "Cancel" : "Edit"}
                  </Button>
                </div>

                {isEditingProfile ? (
                  <Card className="border-border/50">
                    <CardContent className="p-3 space-y-3">
                      <div>
                        <Label className="text-xs">Full Name</Label>
                        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-8 text-sm mt-1" placeholder="Your full name" />
                      </div>
                      <div>
                        <Label className="text-xs">Email</Label>
                        <Input value={email} onChange={(e) => setEmail(e.target.value)} className="h-8 text-sm mt-1" type="email" placeholder="Your email address" />
                        <p className="text-[10px] text-muted-foreground mt-1">Updates may require email confirmation</p>
                      </div>
                      <div>
                        <Label className="text-xs">Phone Number</Label>
                        <div className="flex gap-2 mt-1">
                          <div className="flex h-8 w-8 items-center justify-center rounded-md border bg-muted text-muted-foreground shrink-0">
                            <Phone className="h-3 w-3" />
                          </div>
                          <Select
                            value={countryCode}
                            onValueChange={setCountryCode}
                          >
                            <SelectTrigger className="w-[85px] h-8 text-sm">
                              <SelectValue placeholder="Code" />
                            </SelectTrigger>
                            <SelectContent className="z-[100]">
                              <SelectItem value="+91">+91 (IN)</SelectItem>
                              <SelectItem value="+1">+1 (US)</SelectItem>
                              <SelectItem value="+44">+44 (UK)</SelectItem>
                              <SelectItem value="+971">+971 (UAE)</SelectItem>
                              <SelectItem value="+61">+61 (AU)</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            id="phone"
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').substring(0, 10))}
                            placeholder="9876543210"
                            className="h-8 text-sm flex-1"
                          />
                        </div>
                      </div>
                      <Button size="sm" className="w-full h-8 text-xs" onClick={handleSaveProfile} disabled={isSaving}>
                        {isSaving ? "Saving…" : "Save Changes"}
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-border/50">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground text-xs">Name</span>
                        <span className="font-medium text-xs truncate max-w-[160px]">{profile?.full_name || "—"}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground text-xs">Email</span>
                        <span className="font-medium text-xs truncate max-w-[160px]">{user?.email || "—"}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground text-xs">Phone</span>
                        <span className="font-medium text-xs truncate max-w-[160px]">{profile?.phone_number || "—"}</span>
                      </div>
                      {profile?.department && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground text-xs">Department</span>
                          <span className="font-medium text-xs capitalize">{profile.department}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              <Separator />

              {/* Quick Actions */}
              <div className="p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Navigation</p>
                <div className="space-y-1">
                  {quickActions.map((action) => {
                    const ActionIcon = action.icon;
                    return (
                      <button
                        key={action.label}
                        onClick={action.action}
                        className="w-full flex items-center gap-3 rounded-lg p-3 text-left hover:bg-muted transition-colors group"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background border border-border/50 group-hover:border-primary/30">
                          <ActionIcon className={`h-4 w-4 ${action.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{action.label}</p>
                          <p className="text-[11px] text-muted-foreground">{action.description}</p>
                        </div>
                        {action.badge ? (
                          <Badge className="bg-destructive text-destructive-foreground text-[10px] h-5 min-w-5 flex items-center justify-center px-1.5">
                            {action.badge}
                          </Badge>
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Settings & Notifications */}
              <div className="p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Settings</p>
                <div className="space-y-1">
                  <button
                    onClick={() => setView("security")}
                    className="w-full flex items-center gap-3 rounded-lg p-3 text-left hover:bg-muted transition-colors group"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background border border-border/50">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">Login Credentials</p>
                      <p className="text-[11px] text-muted-foreground">Email & Password</p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                  <button
                    onClick={() => setView("notifications")}
                    className="w-full flex items-center gap-3 rounded-lg p-3 text-left hover:bg-muted transition-colors group"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background border border-border/50">
                      <Bell className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">Notifications</p>
                      <p className="text-[11px] text-muted-foreground">Manage your alerts</p>
                    </div>
                    {browserNotifStatus === "granted" && (
                      <Badge variant="outline" className="text-[9px] text-success border-success/30 px-1">ON</Badge>
                    )}
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                  <button
                    onClick={() => setView("preferences")}
                    className="w-full flex items-center gap-3 rounded-lg p-3 text-left hover:bg-muted transition-colors group"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background border border-border/50">
                      <Settings className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">Preferences</p>
                      <p className="text-[11px] text-muted-foreground">App settings & theme</p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </div>
              </div>
            </div>

            {/* Sign Out */}
            <div className="p-4 border-t border-border/40">
              <Button
                variant="outline"
                className="w-full gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                onClick={async () => { await signOut(); navigate("/auth"); }}
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </>
        )}

        {/* ── NOTIFICATIONS VIEW ── */}
        {view === "notifications" && (
          <>
            <div className="p-4 border-b border-border/40 flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setView("main")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <SheetTitle className="text-base">Notifications</SheetTitle>
                <SheetDescription className="text-xs">Control how you receive alerts</SheetDescription>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Browser Notification Permission */}
              <Card className="border-border/50">
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Browser Notifications</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {browserNotifStatus === "granted" ? <BellRing className="h-4 w-4 text-success" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
                      <div>
                        <p className="text-sm font-medium">Desktop Alerts</p>
                        <p className="text-[11px] text-muted-foreground">
                          {browserNotifStatus === "granted" ? "Active — you'll get real-time alerts" :
                           browserNotifStatus === "denied" ? "Blocked in browser settings" :
                           browserNotifStatus === "unsupported" ? "Not supported by browser" :
                           "Click to enable browser alerts"}
                        </p>
                      </div>
                    </div>
                    <Badge variant={browserNotifStatus === "granted" ? "default" : "secondary"} className={`text-[10px] ${browserNotifStatus === "granted" ? "bg-success text-success-foreground" : ""}`}>
                      {browserNotifStatus === "granted" ? "Active" : browserNotifStatus === "denied" ? "Blocked" : "Off"}
                    </Badge>
                  </div>
                  {browserNotifStatus !== "granted" && browserNotifStatus !== "denied" && (
                    <Button size="sm" className="w-full h-8 text-xs gap-2" onClick={handleRequestNotificationPermission}>
                      <Bell className="h-3 w-3" />
                      Enable Browser Notifications
                    </Button>
                  )}
                  {browserNotifStatus === "denied" && (
                    <p className="text-[11px] text-warning mt-1">To enable: click the 🔒 icon in your browser address bar → Allow notifications</p>
                  )}
                </CardContent>
              </Card>

              {/* In-app notification toggles */}
              <Card className="border-border/50">
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Alert Types</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-4">
                  {[
                    { key: "emailAlerts", icon: Mail, label: "Email Alerts", desc: "Status changes sent to your email" },
                    { key: "smsAlerts", icon: Smartphone, label: "SMS Alerts", desc: "Text messages for urgent updates" },
                    { key: "chatMessages", icon: MessageCircle, label: "Chat Messages", desc: "New messages in complaint chats" },
                    { key: "statusUpdates", icon: CheckCircle, label: "Status Updates", desc: "When complaint status changes" },
                    { key: "escalations", icon: Bell, label: "Escalations", desc: "When complaints are forwarded" },
                  ].map(({ key, icon: Icon, label, desc }) => (
                    <div key={key} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{label}</p>
                          <p className="text-[11px] text-muted-foreground">{desc}</p>
                        </div>
                      </div>
                      <Switch
                        checked={notifPrefs[key as keyof typeof notifPrefs]}
                        onCheckedChange={(v) => {
                          setNotifPrefs(prev => ({ ...prev, [key]: v }));
                          toast({ title: v ? `${label} enabled` : `${label} disabled`, description: v ? "You will receive these alerts." : "These alerts are now off." });
                        }}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="p-4 border-t border-border/40">
              <Button variant="outline" className="w-full text-xs" onClick={() => setView("main")}>
                <ArrowLeft className="h-3.5 w-3.5 mr-2" />
                Back to Menu
              </Button>
            </div>
          </>
        )}

        {/* ── PREFERENCES VIEW ── */}
        {view === "preferences" && (
          <>
            <div className="p-4 border-b border-border/40 flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setView("main")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <SheetTitle className="text-base">Preferences</SheetTitle>
                <SheetDescription className="text-xs">Customize your experience</SheetDescription>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Theme */}
              <Card className="border-border/50">
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Theme</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { value: "light", icon: Sun, label: "Light" },
                      { value: "dark", icon: Moon, label: "Dark" },
                      { value: "system", icon: Monitor, label: "System" },
                    ] as const).map(({ value, icon: Icon, label }) => (
                      <button
                        key={value}
                        onClick={() => { setTheme(value); toast({ title: `Theme: ${label}`, description: `Switched to ${label.toLowerCase()} mode.` }); }}
                        className={`flex flex-col items-center gap-2 rounded-lg border p-3 text-xs font-medium transition-all ${theme === value ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:bg-muted"}`}
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Account Info */}
              <Card className="border-border/50">
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Account</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Role</span>
                    <Badge variant="outline" className={`text-[10px] ${cfg.color} border-current`}>{cfg.label}</Badge>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">User ID</span>
                    <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[160px]">{user?.id?.slice(0, 8)}…</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Member since</span>
                    <span className="text-[11px]">{user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="p-4 border-t border-border/40">
              <Button variant="outline" className="w-full text-xs" onClick={() => setView("main")}>
                <ArrowLeft className="h-3.5 w-3.5 mr-2" />
                Back to Menu
              </Button>
            </div>
          </>
        )}
        {/* ── SECURITY VIEW ── */}
        {view === "security" && (
          <>
            <div className="p-4 border-b border-border/40 flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setView("main")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <SheetTitle className="text-base">Login Credentials</SheetTitle>
                <SheetDescription className="text-xs">Update your security settings</SheetDescription>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <Card className="border-border/50">
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Address</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Login Email</Label>
                    <Input 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      className="h-9 text-sm" 
                      type="email" 
                      placeholder="Enter new email" 
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">Changes require verification at the new address.</p>
                  </div>
                  <Button size="sm" className="w-full h-8 text-xs" onClick={handleSaveProfile} disabled={isSaving}>
                    {isSaving ? "Updating…" : "Update Email"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Change Password</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs">New Password</Label>
                    <Input 
                      value={newPassword} 
                      onChange={(e) => setNewPassword(e.target.value)} 
                      className="h-9 text-sm" 
                      type="password" 
                      placeholder="At least 6 characters" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Confirm Password</Label>
                    <Input 
                      value={confirmPassword} 
                      onChange={(e) => setConfirmPassword(e.target.value)} 
                      className="h-9 text-sm" 
                      type="password" 
                      placeholder="Confirm new password" 
                    />
                  </div>
                  <Button 
                    size="sm" 
                    className="w-full h-8 text-xs gradient-primary" 
                    onClick={handleUpdatePassword} 
                    disabled={isUpdatingPassword}
                  >
                    {isUpdatingPassword ? "Updating…" : "Update Password"}
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="p-4 border-t border-border/40">
              <Button variant="outline" className="w-full text-xs" onClick={() => setView("main")}>
                <ArrowLeft className="h-3.5 w-3.5 mr-2" />
                Back to Menu
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
