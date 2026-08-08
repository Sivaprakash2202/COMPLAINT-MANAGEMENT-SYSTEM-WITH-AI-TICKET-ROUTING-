import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminHeader from "@/components/admin/AdminHeader";
import Footer from "@/components/layout/Footer";
import ComplaintActionPanel from "@/components/complaints/ComplaintActionPanel";
import { Button } from "@/components/ui/button";
import StatCard from "@/components/complaints/StatCard";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText, Clock, CheckCircle, Forward, AlertTriangle, GraduationCap, Sparkles, MessageSquare } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { AdminChatPanel } from "@/components/dashboard/AdminChatPanel";
import { QuickActionsPanel } from "@/components/dashboard/QuickActionsPanel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Complaint {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  created_at: string;
  submitter_name: string;
  submitter_email: string;
  submitter_mobile: string | null;
  current_level: "tutor" | "hod" | "principal";
  tutor_status: "not_viewed" | "in_progress" | "completed" | "forwarded" | "rejected" | null;
  tutor_notes: string | null;
  hod_status: "not_viewed" | "in_progress" | "completed" | "forwarded" | "rejected" | null;
  hod_notes: string | null;
  principal_status: "not_viewed" | "in_progress" | "completed" | "forwarded" | "rejected" | null;
  principal_notes: string | null;
  resolved_at: string | null;
}

const TutorDashboard = () => {
  const { user, role, isLoading: authLoading, profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [filterStatus, setFilterStatus] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");

  const filteredComplaints = complaints.filter(c => {
    const matchesStatus = filterStatus === "all" 
      ? true 
      : filterStatus === "not_viewed" 
        ? (!c.tutor_status || c.tutor_status === "not_viewed")
        : c.tutor_status === filterStatus;
    
    const matchesDepartment = departmentFilter === "all"
      ? true
      : c.category.toLowerCase() === departmentFilter.toLowerCase();

    return matchesStatus && matchesDepartment;
  });

  useEffect(() => {
    if (!authLoading && (!user || role !== "tutor")) {
      navigate("/auth");
    }
  }, [user, role, authLoading, navigate]);

  const fetchComplaints = async () => {
    try {
      const { data, error } = await supabase
        .from("complaints")
        .select("*")
        .or("current_level.eq.tutor,tutor_status.is.not.null")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setComplaints((data as unknown as Complaint[]) || []);
    } catch (error) {
      console.error("Error fetching complaints:", error);
      toast({
        title: "Error",
        description: "Failed to load complaints",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user && role === "tutor") {
      fetchComplaints();
    }
  }, [user, role]);

  const stats = {
    total: complaints.length,
    notViewed: complaints.filter(c => !c.tutor_status || c.tutor_status === "not_viewed").length,
    inProgress: complaints.filter(c => c.tutor_status === "in_progress").length,
    completed: complaints.filter(c => c.tutor_status === "completed").length,
    forwarded: complaints.filter(c => c.tutor_status === "forwarded").length,
    rejected: complaints.filter(c => c.tutor_status === "rejected").length
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <GraduationCap className="h-16 w-16 text-primary animate-bounce" />
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user || role !== "tutor") {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-background via-background to-emerald-500/5">
      <AdminHeader title="Tutor Dashboard" subtitle="Manage and resolve student complaints" />
      
      <main className="flex-1 py-8">
        <div className="container">
          {/* Hero Header */}
          <div className="mb-8 animate-fade-in">
            <Card className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 border-emerald-500/20 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <CardContent className="p-8 relative">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-emerald-500/20 animate-scale-in">
                      <GraduationCap className="h-10 w-10 text-emerald-600" />
                    </div>
                    <div>
                      <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                        Welcome, Mrs. A. Lavanya
                        <Sparkles className="h-6 w-6 text-emerald-500 animate-pulse" />
                      </h1>
                      <p className="text-muted-foreground">
                        Review and process incoming complaints • Forward complex issues to HOD
                      </p>
                    </div>
                  </div>
                  <QuickActionsPanel role="tutor" unreadChatCount={unreadChatCount} />
                </div>
                <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  First Line of Resolution
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Stats Grid */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <StatCard
                title="Total Assigned"
                value={stats.total}
                subtitle="At your level"
                icon={FileText}
                variant="primary"
              />
            </div>
            <div className="animate-fade-in" style={{ animationDelay: "0.15s" }}>
              <StatCard
                title="Not Viewed"
                value={stats.notViewed}
                subtitle="Needs attention"
                icon={AlertTriangle}
                variant="warning"
              />
            </div>
            <div className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
              <StatCard
                title="In Progress"
                value={stats.inProgress}
                subtitle="Being processed"
                icon={Clock}
                variant="accent"
              />
            </div>
            <div className="animate-fade-in" style={{ animationDelay: "0.25s" }}>
              <StatCard
                title="Completed"
                value={stats.completed}
                subtitle="Resolved by you"
                icon={CheckCircle}
                variant="success"
              />
            </div>
            <div className="animate-fade-in" style={{ animationDelay: "0.3s" }}>
              <StatCard
                title="Forwarded"
                value={stats.forwarded}
                subtitle="Sent to HOD"
                icon={Forward}
                variant="default"
              />
            </div>
          </div>

          {/* Complaints */}
          <div className="animate-fade-in" style={{ animationDelay: "0.35s" }}>
            {/* Filter Bar */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6 bg-card p-4 rounded-xl border border-border/50 shadow-sm">
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "all",        label: "All",         count: complaints.length,     color: "border-border/50 data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:border-primary" },
                  { key: "not_viewed", label: "New",         count: stats.notViewed,       color: "data-[active=true]:bg-red-500 data-[active=true]:text-white data-[active=true]:border-red-500" },
                  { key: "in_progress",label: "In Progress", count: stats.inProgress,      color: "data-[active=true]:bg-warning data-[active=true]:text-warning-foreground data-[active=true]:border-warning" },
                  { key: "completed",  label: "Completed",   count: stats.completed,       color: "data-[active=true]:bg-success data-[active=true]:text-success-foreground data-[active=true]:border-success" },
                  { key: "forwarded",  label: "Forwarded",   count: stats.forwarded,       color: "data-[active=true]:bg-accent data-[active=true]:text-accent-foreground data-[active=true]:border-accent" },
                  { key: "rejected",   label: "Rejected",    count: stats.rejected,        color: "data-[active=true]:bg-destructive data-[active=true]:text-destructive-foreground data-[active=true]:border-destructive" },
                ].map(f => (
                  <button
                    key={f.key}
                    data-active={filterStatus === f.key}
                    onClick={() => setFilterStatus(f.key)}
                    className={`flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm font-medium transition-all duration-200 hover:shadow-sm ${f.color}`}
                  >
                    {f.label}
                    <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-xs font-semibold">{f.count}</span>
                  </button>
                ))}
                <button
                  className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm font-medium transition-all duration-200 hover:shadow-sm hover:bg-primary/5"
                  onClick={() => navigate("/admin/feedback")}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  User Feedback
                </button>
              </div>

              <div className="flex items-center gap-2 min-w-[200px]">
                <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Department:</span>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger className="w-[180px] rounded-full bg-background border-border/50 h-9">
                    <SelectValue placeholder="All Departments" />
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
              </div>
            </div>

            {/* Complaint List */}
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredComplaints.map((complaint, index) => (
                <div key={complaint.id} className="animate-fade-in" style={{ animationDelay: `${0.05 * index}s` }}>
                  <ComplaintActionPanel
                    complaint={complaint}
                    level="tutor"
                    onUpdate={fetchComplaints}
                  />
                </div>
              ))}
              {filteredComplaints.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/5 py-16 text-center animate-scale-in">
                  <CheckCircle className="mb-4 h-12 w-12 text-emerald-500/50" />
                  <p className="text-lg font-medium text-foreground">No complaints</p>
                  <p className="text-sm text-muted-foreground">No complaints match this filter</p>
                </div>
              )}
            </div>
          </div>

          {/* Live Chat Panel */}
          <div className="mt-8 animate-fade-in">
            <AdminChatPanel
              complaints={complaints.map(c => ({ id: c.id, title: c.title, status: c.tutor_status || "not_viewed", current_level: c.current_level, submitter_name: c.submitter_name }))}
              onUnreadChange={setUnreadChatCount}
            />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default TutorDashboard;
