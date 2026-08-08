import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AdminHeader from "@/components/admin/AdminHeader";
import StatCard from "@/components/complaints/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { QuickActionsPanel } from "@/components/dashboard/QuickActionsPanel";
import { AdminChatPanel } from "@/components/dashboard/AdminChatPanel";
import { downloadCSV } from "@/utils/export";
import {
  FileText, Clock, CheckCircle, AlertTriangle, Users, Building2,
  TrendingUp, Search, Eye, Edit, UserPlus, RefreshCw,
  GraduationCap, Crown, ArrowRight, Layers, MessageSquare, Trash2, Loader2, Download
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

type ComplaintStatus = "pending" | "in_progress" | "resolved" | "rejected";
type DepartmentType = "academic" | "infrastructure" | "administration" | "library" | "sports" | "other";
type WorkflowLevel = "tutor" | "hod" | "principal";

interface Complaint {
  id: string;
  title: string;
  description: string;
  category: DepartmentType;
  status: ComplaintStatus;
  priority: "low" | "medium" | "high" | "urgent";
  submitter_name: string;
  submitter_email: string;
  submitter_mobile: string | null;
  created_at: string;
  updated_at: string;
  admin_notes: string | null;
  resolution_notes: string | null;
  current_level: WorkflowLevel | null;
  tutor_status: string | null;
  hod_status: string | null;
  principal_status: string | null;
  tutor_notes: string | null;
  hod_notes: string | null;
  principal_notes: string | null;
  assigned_to: string | null;
  resolved_at: string | null;
}

interface DepartmentAdmin {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department: DepartmentType | null;
}

const departmentLabels: Record<DepartmentType, string> = {
  academic: "Academic",
  infrastructure: "Infrastructure",
  administration: "Administration",
  library: "Library",
  sports: "Sports",
  other: "Other Services",
};

const statusLabels: Record<ComplaintStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  resolved: "Resolved",
  rejected: "Rejected",
};

const COLORS = ["hsl(231, 48%, 48%)", "hsl(38, 92%, 50%)", "hsl(142, 71%, 45%)", "hsl(0, 84%, 60%)"];

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const { user, role, isLoading: authLoading, profile } = useAuth();
  const { toast } = useToast();
  
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [adminUsers, setAdminUsers] = useState<Array<{ id: string; user_id: string; full_name: string; email: string; role: string }>>([]);
  const [admins, setAdmins] = useState<DepartmentAdmin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddAdminOpen, setIsAddAdminOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [assignLevel, setAssignLevel] = useState<WorkflowLevel>("tutor");
  const [isRemovingAdminId, setIsRemovingAdminId] = useState<string | null>(null);
  const [selectedComplaints, setSelectedComplaints] = useState<string[]>([]);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  
  const [editForm, setEditForm] = useState({
    status: "" as ComplaintStatus,
    priority: "" as string,
    admin_notes: "",
    resolution_notes: "",
  });
  
  const [newAdmin, setNewAdmin] = useState({
    email: "",
    fullName: "",
    password: "",
    department: "" as DepartmentType,
  });

  useEffect(() => {
    if (!authLoading && (!user || role !== "super_admin")) {
      navigate("/auth");
    }
  }, [user, role, authLoading, navigate]);

  const fetchData = async () => {
    setIsLoading(true);
    
    // Fetch complaints
    const { data: complaintsData, error: complaintsError } = await supabase
      .from("complaints")
      .select("*")
      .order("created_at", { ascending: false });

    if (complaintsError) {
      toast({ title: "Error", description: "Failed to load complaints", variant: "destructive" });
    } else {
      setComplaints(complaintsData as Complaint[]);
    }

    // Fetch department admins profiles
    const { data: adminsData, error: adminsError } = await supabase
      .from("profiles")
      .select("*")
      .not("department", "is", null);

    if (!adminsError && adminsData) {
      setAdmins(adminsData as DepartmentAdmin[]);
    }

    // Fetch tutor/hod/principal user profiles
    const { data: adminRolesData } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["tutor", "hod", "principal"]);

    if (adminRolesData && adminRolesData.length > 0) {
      const ids = adminRolesData.map((r) => r.user_id);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", ids);

      if (profilesData) {
        const merged = adminRolesData.map((r) => {
          const p = profilesData.find((p) => p.user_id === r.user_id);
          return { id: r.user_id, user_id: r.user_id, full_name: p?.full_name || "Unknown", email: p?.email || "", role: r.role };
        });
        setAdminUsers(merged);
      }
    }

    setIsLoading(false);
  };

  const handleAssignComplaint = async () => {
    if (!selectedComplaint) return;
    const updateData: Record<string, unknown> = {
      current_level: assignLevel,
    };
    // Reset lower-level statuses if escalating
    if (assignLevel === "hod") {
      updateData.tutor_status = "forwarded";
    } else if (assignLevel === "principal") {
      updateData.tutor_status = "forwarded";
      updateData.hod_status = "forwarded";
    } else if (assignLevel === "tutor") {
      updateData.tutor_status = "not_viewed";
    }

    const { error } = await supabase
      .from("complaints")
      .update(updateData)
      .eq("id", selectedComplaint.id);

    if (error) {
      toast({ title: "Error", description: "Failed to assign complaint", variant: "destructive" });
    } else {
      toast({ title: "Assigned!", description: `Complaint routed to ${assignLevel.toUpperCase()} level.` });

      // Send notification about escalation/routing
      supabase.functions.invoke("send-notification", {
        body: {
          complaint_id: selectedComplaint.id,
          notification_type: "status_change",
          recipient_email: selectedComplaint.submitter_email,
          recipient_mobile: selectedComplaint.submitter_mobile,
          recipient_name: selectedComplaint.submitter_name,
          subject: `Your complaint has been escalated to ${assignLevel.toUpperCase()} — ACE`,
          body: `<h2>Your complaint has been escalated</h2>
            <p>Dear ${selectedComplaint.submitter_name},</p>
            <p>Your complaint titled <strong>"${selectedComplaint.title}"</strong> has been forwarded to the <strong>${assignLevel.toUpperCase()}</strong> for further review.</p>
            <p>This usually happens to ensure the best possible resolution for your issue.</p>`,
        },
      }).catch(e => console.error("Notification error:", e));

      setIsAssignOpen(false);
      fetchData();
    }
  };

  useEffect(() => {
    if (user && role === "super_admin") {
      fetchData();
    }
  }, [user, role]);

  useEffect(() => {
    if (isDetailOpen && selectedComplaint) {
      fetchAuditLogs(selectedComplaint.id);
    }
  }, [isDetailOpen, selectedComplaint]);

  const fetchAuditLogs = async (complaintId: string) => {
    setIsLoadingLogs(true);
    const { data, error } = await supabase
      .from("audit_logs")
      .select(`
        *,
        profiles:admin_id (full_name)
      `)
      .eq("complaint_id", complaintId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setAuditLogs(data);
    }
    setIsLoadingLogs(false);
  };

  const handleUpdateComplaint = async () => {
    if (!selectedComplaint) return;

    if (editForm.status === "rejected" && !editForm.admin_notes.trim()) {
      toast({ title: "Reason Required", description: "Please provide a reason for rejection in Admin Notes.", variant: "destructive" });
      return;
    }

    const updateData: Record<string, unknown> = {
      status: editForm.status,
      priority: editForm.priority,
      admin_notes: editForm.admin_notes,
    };

    if (editForm.status === "resolved" || editForm.status === "rejected") {
      updateData.resolution_notes = editForm.resolution_notes;
      updateData.resolved_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("complaints")
      .update(updateData)
      .eq("id", selectedComplaint.id);

    if (error) {
      toast({ title: "Error", description: "Failed to update complaint", variant: "destructive" });
    } else {
      // Add audit log
      await supabase.from("audit_logs").insert({
        complaint_id: selectedComplaint.id,
        admin_id: user!.id,
        action: "update_complaint",
        old_value: { status: selectedComplaint.status, priority: selectedComplaint.priority },
        new_value: { status: editForm.status, priority: editForm.priority }
      });

      toast({ title: "Success", description: "Complaint updated successfully" });

      // Send notification to the student about status change
      const statusMessages: Record<string, { subject: string; bodyHtml: string; type: string }> = {
        in_progress: {
          type: "status_change",
          subject: "Your complaint is being processed — ACE Compliant Management",
          bodyHtml: `<h2>Your complaint is being processed</h2>
            <p>Dear ${selectedComplaint.submitter_name},</p>
            <p>Your complaint titled <strong>"${selectedComplaint.title}"</strong> is now being actively processed.</p>
            <p>We will keep you updated on its progress.</p>`,
        },
        resolved: {
          type: "resolution",
          subject: "Your complaint has been resolved — ACE Compliant Management",
          bodyHtml: `<h2>Your complaint has been resolved ✓</h2>
            <p>Dear ${selectedComplaint.submitter_name},</p>
            <p>Your complaint titled <strong>"${selectedComplaint.title}"</strong> has been successfully resolved.</p>
            ${editForm.resolution_notes ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:12px;margin:12px 0"><strong>Resolution Notes:</strong><br/>${editForm.resolution_notes}</div>` : ""}
            <p>If you are satisfied with the resolution, please leave feedback on the portal.</p>`,
        },
        rejected: {
          type: "status_change",
          subject: "Update on your complaint — ACE Compliant Management",
          bodyHtml: `<h2>Your complaint has been reviewed</h2>
            <p>Dear ${selectedComplaint.submitter_name},</p>
            <p>After review, your complaint titled <strong>"${selectedComplaint.title}"</strong> has been closed.</p>
            ${editForm.admin_notes ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px;margin:12px 0"><strong>Reason:</strong><br/>${editForm.admin_notes}</div>` : ""}
            <p>If you believe this was done in error, please contact support.</p>`,
        },
      };

      const notifMsg = statusMessages[editForm.status];
      if (notifMsg) {
        supabase.functions.invoke("send-notification", {
          body: {
            complaint_id: selectedComplaint.id,
            notification_type: notifMsg.type,
            recipient_email: selectedComplaint.submitter_email,
            recipient_mobile: selectedComplaint.submitter_mobile,
            recipient_name: selectedComplaint.submitter_name,
            subject: notifMsg.subject,
            body: notifMsg.bodyHtml,
          },
        }).catch(e => console.error("Notification error:", e));
      }

      setIsEditOpen(false);
      fetchData();
    }
  };

  const handleBulkAction = async (action: "resolve" | "reject" | "delete") => {
    if (selectedComplaints.length === 0) return;
    if (!confirm(`Are you sure you want to ${action} ${selectedComplaints.length} selected complaints?`)) return;

    setIsBulkLoading(true);
    try {
      if (action === "delete") {
        const { error } = await supabase.from("complaints").delete().in("id", selectedComplaints);
        if (error) throw error;
      } else {
        const updateData: Record<string, unknown> = {
          status: action === "resolve" ? "resolved" : "rejected",
          updated_at: new Date().toISOString()
        };
        if (action === "resolve" || action === "reject") {
          updateData.resolved_at = new Date().toISOString();
        }
        const { error } = await supabase.from("complaints").update(updateData).in("id", selectedComplaints);
        if (error) throw error;
      }

      // Add audit logs for bulk action
      const auditEntries = selectedComplaints.map(id => ({
        complaint_id: id,
        admin_id: user!.id,
        action: `bulk_${action}`,
        new_value: action === "delete" ? null : { status: action === "resolve" ? "resolved" : "rejected" }
      }));
      await supabase.from("audit_logs").insert(auditEntries);

      toast({ title: "Success", description: `Successfully performed bulk action: ${action}` });
      setSelectedComplaints([]);
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Bulk action failed", variant: "destructive" });
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleCreateAdmin = async () => {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: newAdmin.email,
      password: newAdmin.password,
      options: {
        data: { full_name: newAdmin.fullName },
      },
    });

    if (authError || !authData.user) {
      toast({ title: "Error", description: authError?.message || "Failed to create admin", variant: "destructive" });
      return;
    }

    // Add role
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({ user_id: authData.user.id, role: "department_admin" });

    if (roleError) {
      toast({ title: "Error", description: "Failed to assign admin role", variant: "destructive" });
      return;
    }

    // Update profile with department
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ department: newAdmin.department })
      .eq("user_id", authData.user.id);

    if (profileError) {
      toast({ title: "Error", description: "Failed to assign department", variant: "destructive" });
      return;
    }

    toast({ title: "Success", description: "Department admin created successfully" });
    setIsAddAdminOpen(false);
    setNewAdmin({ email: "", fullName: "", password: "", department: "" as DepartmentType });
    fetchData();
  };

  const handleRemoveAdmin = async (admin: DepartmentAdmin) => {
    if (!confirm(`Are you sure you want to remove ${admin.full_name} as a department admin?`)) return;
    
    setIsRemovingAdminId(admin.id);
    try {
      // Remove department_admin role
      const { error: roleError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", admin.user_id)
        .eq("role", "department_admin");

      if (roleError) throw roleError;

      // Clear department from profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ department: null })
        .eq("user_id", admin.user_id);

      if (profileError) throw profileError;

      toast({ title: "Admin Removed", description: `${admin.full_name} is no longer a department admin.` });
      fetchData();
    } catch (error: any) {
      toast({ title: "Failed to remove admin", description: error.message || "An error occurred.", variant: "destructive" });
    } finally {
      setIsRemovingAdminId(null);
    }
  };

  // Filter complaints
  const filteredComplaints = complaints.filter((c) => {
    const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         c.submitter_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    const matchesCategory = categoryFilter === "all" || c.category === categoryFilter;
    const matchesPriority = priorityFilter === "all" || c.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesCategory && matchesPriority;
  });

  // Stats
  const stats = {
    total: complaints.length,
    pending: complaints.filter((c) => c.status === "pending").length,
    inProgress: complaints.filter((c) => c.status === "in_progress").length,
    resolved: complaints.filter((c) => c.status === "resolved").length,
    rejected: complaints.filter((c) => c.status === "rejected").length,
  };

  // Chart data
  const categoryData = Object.keys(departmentLabels).map((key) => ({
    name: departmentLabels[key as DepartmentType],
    value: complaints.filter((c) => c.category === key).length,
  }));

  const statusData = [
    { name: "Pending", value: stats.pending },
    { name: "In Progress", value: stats.inProgress },
    { name: "Resolved", value: stats.resolved },
    { name: "Rejected", value: stats.rejected },
  ];

  // Weekly trend data (mock for now)
  const weeklyData = [
    { name: "Mon", complaints: 12, resolved: 8 },
    { name: "Tue", complaints: 19, resolved: 14 },
    { name: "Wed", complaints: 15, resolved: 10 },
    { name: "Thu", complaints: 22, resolved: 18 },
    { name: "Fri", complaints: 18, resolved: 15 },
    { name: "Sat", complaints: 8, resolved: 6 },
    { name: "Sun", complaints: 5, resolved: 4 },
  ];

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AdminHeader title="Super Admin Dashboard" />
      
      <main className="flex-1 py-6">
        <div className="container">
          {/* Page Header with QuickActions */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground">Welcome, {profile?.full_name || "Super Admin"}</h2>
              <p className="text-sm text-muted-foreground">Full system oversight — manage all complaints & users</p>
            </div>
            <QuickActionsPanel role="super_admin" />
          </div>

          {/* Workflow Level Summary */}
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            {(["tutor", "hod", "principal"] as WorkflowLevel[]).map((lvl) => {
              const Icon = lvl === "tutor" ? GraduationCap : lvl === "hod" ? Building2 : Crown;
              const count = complaints.filter(c => c.current_level === lvl && c.status !== "resolved" && c.status !== "rejected").length;
              const color = lvl === "tutor" ? "text-emerald-600 bg-emerald-500/10" : lvl === "hod" ? "text-blue-600 bg-blue-500/10" : "text-amber-600 bg-amber-500/10";
              return (
                <Card key={lvl} className="border-border/50">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{count}</p>
                      <p className="text-xs text-muted-foreground capitalize">Active at {lvl} level</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <StatCard title="Total Complaints" value={stats.total} icon={FileText} variant="primary" />
            <StatCard title="Pending" value={stats.pending} icon={Clock} variant="warning" />
            <StatCard title="In Progress" value={stats.inProgress} icon={TrendingUp} variant="accent" />
            <StatCard title="Resolved" value={stats.resolved} icon={CheckCircle} variant="success" />
            <StatCard title="Departments" value={Object.keys(departmentLabels).length} icon={Building2} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3 mb-8">
            <div className="lg:col-span-2">
              <AdminChatPanel
                complaints={complaints.map(c => ({ 
                  id: c.id, 
                  title: c.title, 
                  status: c.status, 
                  current_level: c.current_level, 
                  submitter_name: c.submitter_name 
                }))}
                onUnreadChange={(count) => console.log("Super Admin Unread Chat Count:", count)}
              />
            </div>
            <Card className="h-full border-border/50">
              <CardHeader className="py-3 border-b bg-muted/30">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Quick Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Response Rate</span>
                  <span className="font-semibold text-emerald-600">92%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: "92%" }} />
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Resolution Time</span>
                  <span className="font-semibold text-amber-600">~2.4 days</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: "65%" }} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="mb-8 grid gap-6 lg:grid-cols-3">
            {/* Weekly Trend */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Weekly Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }} 
                    />
                    <Line type="monotone" dataKey="complaints" stroke="hsl(231, 48%, 48%)" strokeWidth={2} />
                    <Line type="monotone" dataKey="resolved" stroke="hsl(142, 71%, 45%)" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 flex flex-wrap justify-center gap-4">
                  {statusData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                      <span className="text-xs text-muted-foreground">{entry.name}: {entry.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Category Distribution */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-lg">Complaints by Department</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }} 
                  />
                  <Bar dataKey="value" fill="hsl(231, 48%, 48%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Tabs for Complaints and Admins */}
          <Tabs defaultValue="complaints">
            <TabsList className="mb-6">
              <TabsTrigger value="complaints" className="gap-2">
                <FileText className="h-4 w-4" />
                Complaints
              </TabsTrigger>
              <TabsTrigger value="workflow" className="gap-2">
                <Layers className="h-4 w-4" />
                Workflow Admins
              </TabsTrigger>
              <TabsTrigger value="admins" className="gap-2">
                <Users className="h-4 w-4" />
                Dept Admins
              </TabsTrigger>
              <TabsTrigger value="feedback" className="gap-2" onClick={() => navigate("/admin/feedback")}>
                <MessageSquare className="h-4 w-4" />
                User Feedback
              </TabsTrigger>
            </TabsList>

            <TabsContent value="complaints">
              {/* Filters */}
              <div className="mb-6 space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search complaints..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-10"
                    />
                  </div>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[180px] h-10">
                      <SelectValue placeholder="Department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      <SelectItem value="academic">Academic</SelectItem>
                      <SelectItem value="infrastructure">Infrastructure</SelectItem>
                      <SelectItem value="administration">Administration</SelectItem>
                      <SelectItem value="library">Library</SelectItem>
                      <SelectItem value="sports">Sports</SelectItem>
                      <SelectItem value="other">Other Services</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="w-[150px] h-10">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priorities</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" onClick={fetchData} className="h-10 w-10">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-10"
                    onClick={() => downloadCSV(filteredComplaints, "complaints_export.csv")}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "all",         label: "All",         count: stats.total,      color: "border-border/50 data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:border-primary" },
                    { key: "pending",     label: "Pending",     count: stats.pending,    color: "data-[active=true]:bg-red-500 data-[active=true]:text-white data-[active=true]:border-red-500" },
                    { key: "in_progress", label: "In Progress", count: stats.inProgress, color: "data-[active=true]:bg-warning data-[active=true]:text-warning-foreground data-[active=true]:border-warning" },
                    { key: "resolved",    label: "Resolved",    count: stats.resolved,   color: "data-[active=true]:bg-success data-[active=true]:text-success-foreground data-[active=true]:border-success" },
                    { key: "rejected",    label: "Rejected",    count: stats.rejected,   color: "data-[active=true]:bg-destructive data-[active=true]:text-destructive-foreground data-[active=true]:border-destructive" },
                  ].map(f => (
                    <button
                      key={f.key}
                      data-active={statusFilter === f.key}
                      onClick={() => setStatusFilter(f.key)}
                      className={`flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm font-medium transition-all duration-200 hover:shadow-sm ${f.color}`}
                    >
                      {f.label}
                      <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-xs font-semibold">{f.count}</span>
                    </button>
                  ))}
                  <div className="ml-auto flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2 border-primary/30 text-primary hover:bg-primary/5 h-9"
                      onClick={() => navigate("/admin/feedback")}
                    >
                      <MessageSquare className="h-4 w-4" />
                      User Feedback
                    </Button>
                  </div>
                </div>
              </div>

              {/* Bulk Actions Bar */}
              {selectedComplaints.length > 0 && (
                <div className="mb-4 flex items-center gap-4 rounded-lg border bg-muted/50 p-3 text-sm">
                  <span className="font-medium">{selectedComplaints.length} selected</span>
                  <div className="h-4 w-px bg-border"></div>
                  <Select onValueChange={(val: any) => handleBulkAction(val)}>
                    <SelectTrigger className="w-[180px] h-8 bg-background">
                      <SelectValue placeholder="Bulk Actions..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="resolve">Mark as Resolved</SelectItem>
                      <SelectItem value="reject">Mark as Rejected</SelectItem>
                      <SelectItem value="delete" className="text-destructive">Delete Selected</SelectItem>
                    </SelectContent>
                  </Select>
                  {isBulkLoading && <Loader2 className="h-4 w-4 animate-spin text-primary ml-2" />}
                </div>
              )}

              {/* Complaints Table */}
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b border-border bg-muted/50">
                        <tr>
                          <th className="px-4 py-3 text-left">
                            <input 
                              type="checkbox" 
                              className="h-4 w-4 rounded border-border"
                              checked={filteredComplaints.length > 0 && selectedComplaints.length === filteredComplaints.length}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedComplaints(filteredComplaints.map(c => c.id));
                                else setSelectedComplaints([]);
                              }}
                            />
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Title</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Department</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Level</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Priority</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Submitted By</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Date</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredComplaints.map((complaint) => (
                          <tr key={complaint.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3">
                              <input 
                                type="checkbox" 
                                className="h-4 w-4 rounded border-border"
                                checked={selectedComplaints.includes(complaint.id)}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedComplaints(prev => [...prev, complaint.id]);
                                  else setSelectedComplaints(prev => prev.filter(id => id !== complaint.id));
                                }}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-foreground line-clamp-1">{complaint.title}</p>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="academic">{departmentLabels[complaint.category]}</Badge>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={complaint.status === "resolved" ? "resolved" : complaint.status === "rejected" ? "urgent" : "pending"}>
                                {statusLabels[complaint.status]}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              {complaint.current_level ? (
                                <div className="flex items-center gap-1">
                                  {complaint.current_level === "tutor" && <GraduationCap className="h-3 w-3 text-success" />}
                                  {complaint.current_level === "hod" && <Building2 className="h-3 w-3 text-info" />}
                                  {complaint.current_level === "principal" && <Crown className="h-3 w-3 text-warning" />}
                                  <span className="text-xs capitalize text-muted-foreground">{complaint.current_level}</span>
                                </div>
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={complaint.priority === "urgent" ? "urgent" : complaint.priority === "high" ? "warning" : "secondary"}>
                                {complaint.priority}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">{complaint.submitter_name}</td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">
                              {new Date(complaint.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  title="View details"
                                  onClick={() => {
                                    setSelectedComplaint(complaint);
                                    setIsDetailOpen(true);
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  title="Assign to admin level"
                                  onClick={() => {
                                    setSelectedComplaint(complaint);
                                    setAssignLevel(complaint.current_level || "tutor");
                                    setIsAssignOpen(true);
                                  }}
                                >
                                  <ArrowRight className="h-4 w-4 text-primary" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  title="Edit status / notes"
                                  onClick={() => {
                                    setSelectedComplaint(complaint);
                                    setEditForm({
                                      status: complaint.status,
                                      priority: complaint.priority,
                                      admin_notes: complaint.admin_notes || "",
                                      resolution_notes: complaint.resolution_notes || "",
                                    });
                                    setIsEditOpen(true);
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {filteredComplaints.length === 0 && (
                          <tr>
                            <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                              No complaints found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Workflow Admins Tab */}
            <TabsContent value="workflow">
              <div className="grid gap-4 md:grid-cols-3">
                {(["tutor", "hod", "principal"] as WorkflowLevel[]).map((lvl) => {
                  const Icon = lvl === "tutor" ? GraduationCap : lvl === "hod" ? Building2 : Crown;
                  const color = lvl === "tutor" ? "text-emerald-600 bg-emerald-500/10 border-emerald-500/20" : lvl === "hod" ? "text-blue-600 bg-blue-500/10 border-blue-500/20" : "text-amber-600 bg-amber-500/10 border-amber-500/20";
                  const lvlAdmins = adminUsers.filter(a => a.role === lvl);
                  const activeComplaints = complaints.filter(c => c.current_level === lvl && c.status !== "resolved" && c.status !== "rejected");
                  return (
                    <Card key={lvl} className={`border ${color}`}>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Icon className="h-5 w-5" />
                          <span className="capitalize">{lvl === "hod" ? "Head of Department" : lvl}</span>
                          <Badge variant="outline" className={`ml-auto text-xs ${color} border-current`}>
                            {activeComplaints.length} active
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {lvlAdmins.length > 0 ? lvlAdmins.map(admin => (
                          <div key={admin.id} className="flex items-center gap-2 rounded-lg bg-background p-2 border border-border/50">
                            <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{admin.full_name}</p>
                              <p className="text-xs text-muted-foreground truncate">{admin.email}</p>
                            </div>
                          </div>
                        )) : (
                          <p className="text-sm text-muted-foreground text-center py-3">No {lvl} accounts found</p>
                        )}
                        <div className="pt-2 border-t border-border/50">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Complaints at this level:</p>
                          {activeComplaints.slice(0, 3).map(c => (
                            <div key={c.id} className="text-xs text-muted-foreground truncate py-0.5">• {c.title}</div>
                          ))}
                          {activeComplaints.length > 3 && (
                            <p className="text-xs text-muted-foreground">+ {activeComplaints.length - 3} more</p>
                          )}
                          {activeComplaints.length === 0 && <p className="text-xs text-muted-foreground">No active complaints</p>}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="admins">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Department Administrators</h3>
                <Button variant="hero" onClick={() => setIsAddAdminOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Admin
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {admins.map((admin) => (
                  <Card key={admin.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Users className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground">{admin.full_name}</h4>
                          <p className="text-sm text-muted-foreground">{admin.email}</p>
                          <Badge variant="academic" className="mt-2">
                            {admin.department ? departmentLabels[admin.department] : "No Department"}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8"
                          onClick={() => handleRemoveAdmin(admin)}
                          disabled={isRemovingAdminId === admin.id}
                          title="Remove Admin"
                        >
                          {isRemovingAdminId === admin.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {admins.length === 0 && (
                  <Card className="col-span-full">
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No department admins found. Click "Add Admin" to create one.
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Complaint Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedComplaint?.title}</DialogTitle>
            <DialogDescription>
              Submitted by {selectedComplaint?.submitter_name} on {selectedComplaint && new Date(selectedComplaint.created_at).toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Badge variant="academic">{selectedComplaint && departmentLabels[selectedComplaint.category]}</Badge>
              <Badge variant={selectedComplaint?.status === "resolved" ? "resolved" : "pending"}>
                {selectedComplaint && statusLabels[selectedComplaint.status]}
              </Badge>
              <Badge variant={selectedComplaint?.priority === "urgent" ? "urgent" : "secondary"}>
                {selectedComplaint?.priority}
              </Badge>
            </div>
            <div>
              <h4 className="font-medium mb-2">Description</h4>
              <p className="text-muted-foreground">{selectedComplaint?.description}</p>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-2 text-sm">Audit History</h4>
              <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                {isLoadingLogs ? (
                  <div className="flex justify-center p-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
                ) : auditLogs.length > 0 ? (
                  auditLogs.map((log) => (
                    <div key={log.id} className="text-xs border-l-2 border-primary/20 pl-3 py-1">
                      <div className="flex justify-between text-muted-foreground mb-1">
                        <span className="font-medium text-foreground">{log.profiles?.full_name || "Admin"}</span>
                        <span>{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                      <p className="italic underline mb-1 capitalize text-primary/80">{log.action.replace(/_/g, ' ')}</p>
                      {log.new_value && (
                        <div className="grid grid-cols-2 gap-2 mt-1 bg-muted/30 p-1.5 rounded">
                           {log.old_value && (
                             <div className="text-[10px]">
                               <span className="text-muted-foreground">From: </span>
                               {JSON.stringify(log.old_value)}
                             </div>
                           )}
                           <div className="text-[10px]">
                             <span className="text-muted-foreground font-medium">To: </span>
                             {JSON.stringify(log.new_value)}
                           </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">No audit history recorded.</p>
                )}
              </div>
            </div>

            {selectedComplaint?.admin_notes && (
              <div>
                <h4 className="font-medium mb-2">Admin Notes</h4>
                <p className="text-muted-foreground">{selectedComplaint.admin_notes}</p>
              </div>
            )}
            {selectedComplaint?.resolution_notes && (
              <div>
                <h4 className="font-medium mb-2">Resolution Notes</h4>
                <p className="text-muted-foreground">{selectedComplaint.resolution_notes}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Complaint Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Complaint</DialogTitle>
            <DialogDescription>
              Update the status and add notes for this complaint.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v as ComplaintStatus })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={editForm.priority} onValueChange={(v) => setEditForm({ ...editForm, priority: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Admin Notes</Label>
              <Textarea
                value={editForm.admin_notes}
                onChange={(e) => setEditForm({ ...editForm, admin_notes: e.target.value })}
                placeholder="Add internal notes..."
              />
            </div>
            {editForm.status === "resolved" && (
              <div className="space-y-2">
                <Label>Resolution Notes</Label>
                <Textarea
                  value={editForm.resolution_notes}
                  onChange={(e) => setEditForm({ ...editForm, resolution_notes: e.target.value })}
                  placeholder="Describe how the issue was resolved..."
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button variant="hero" onClick={handleUpdateComplaint}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Admin Dialog */}
      <Dialog open={isAddAdminOpen} onOpenChange={setIsAddAdminOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Department Admin</DialogTitle>
            <DialogDescription>
              Create a new administrator account for a department.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={newAdmin.fullName}
                onChange={(e) => setNewAdmin({ ...newAdmin, fullName: e.target.value })}
                placeholder="Admin name"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={newAdmin.email}
                onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                placeholder="admin@college.edu"
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={newAdmin.password}
                onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={newAdmin.department} onValueChange={(v) => setNewAdmin({ ...newAdmin, department: v as DepartmentType })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(departmentLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddAdminOpen(false)}>Cancel</Button>
            <Button variant="hero" onClick={handleCreateAdmin}>Create Admin</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Complaint Dialog */}
      <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5 text-primary" />
              Assign / Route Complaint
            </DialogTitle>
            <DialogDescription>
              Route this complaint to a specific admin level in the hierarchy.
            </DialogDescription>
          </DialogHeader>
          {selectedComplaint && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-sm font-medium">{selectedComplaint.title}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{selectedComplaint.description}</p>
              </div>

              <div className="space-y-2">
                <Label>Assign to Level</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["tutor", "hod", "principal"] as WorkflowLevel[]).map((lvl) => {
                    const Icon = lvl === "tutor" ? GraduationCap : lvl === "hod" ? Building2 : Crown;
                    const color = lvl === "tutor" ? "border-emerald-500 bg-emerald-500/10 text-emerald-700" : lvl === "hod" ? "border-blue-500 bg-blue-500/10 text-blue-700" : "border-amber-500 bg-amber-500/10 text-amber-700";
                    return (
                      <button
                        key={lvl}
                        onClick={() => setAssignLevel(lvl)}
                        className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 text-xs font-medium transition-all ${assignLevel === lvl ? color : "border-border bg-background text-muted-foreground hover:bg-muted"}`}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="capitalize">{lvl === "hod" ? "HOD" : lvl}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Current level: <span className="font-medium capitalize">{selectedComplaint.current_level || "unassigned"}</span>
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignOpen(false)}>Cancel</Button>
            <Button variant="hero" onClick={handleAssignComplaint}>
              <ArrowRight className="h-4 w-4 mr-2" />
              Assign to {assignLevel?.toUpperCase()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminDashboard;
