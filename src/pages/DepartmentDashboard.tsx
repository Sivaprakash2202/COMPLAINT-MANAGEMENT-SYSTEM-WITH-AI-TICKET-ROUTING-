import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AdminHeader from "@/components/admin/AdminHeader";
import StatCard from "@/components/complaints/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { downloadCSV } from "@/utils/export";
import {
  FileText, Clock, CheckCircle, AlertTriangle,
  Search, Eye, Edit, RefreshCw, ShieldCheck, Download, Loader2, X, XCircle
} from "lucide-react";
import FileUpload, { UploadedFile } from "@/components/complaints/FileUpload";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

type ComplaintStatus = "pending" | "in_progress" | "resolved" | "rejected";
type DepartmentType = "academic" | "infrastructure" | "administration" | "library" | "sports";

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
  resolution_image: string | null;
  verification_status: "pending" | "verified" | "rejected";
}

const departmentLabels: Record<DepartmentType, string> = {
  academic: "Academic",
  infrastructure: "Infrastructure",
  administration: "Administration",
  library: "Library",
  sports: "Sports",
};

const statusLabels: Record<ComplaintStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  resolved: "Resolved",
  rejected: "Rejected",
};

const COLORS = ["hsl(231, 48%, 48%)", "hsl(38, 92%, 50%)", "hsl(142, 71%, 45%)", "hsl(0, 84%, 60%)"];

const DepartmentDashboard = () => {
  const navigate = useNavigate();
  const { user, role, profile, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  
  const [editForm, setEditForm] = useState({
    status: "" as ComplaintStatus,
    priority: "" as string,
    admin_notes: "",
    resolution_notes: "",
    resolution_image: "",
  });

  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || role !== "department_admin")) {
      navigate("/auth");
    }
  }, [user, role, authLoading, navigate]);

  const fetchComplaints = async () => {
    if (!profile?.department) return;
    
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from("complaints")
      .select("*")
      .eq("category", profile.department)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: "Failed to load complaints", variant: "destructive" });
    } else {
      setComplaints(data as Complaint[]);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    if (user && role === "department_admin" && profile?.department) {
      fetchComplaints();
    }
  }, [user, role, profile]);

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
      updateData.resolution_image = editForm.resolution_image;
      updateData.resolved_at = new Date().toISOString();
      if (editForm.status === "resolved") {
        updateData.verification_status = "pending";
      }
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
            <p>Your complaint titled <strong>"${selectedComplaint.title}"</strong> is now being actively processed by the department.</p>
            <p>We will keep you updated on its progress.</p>`,
        },
        resolved: {
          type: "resolution",
          subject: "Your complaint has been resolved — ACE Compliant Management",
          bodyHtml: `<h2>Your complaint has been resolved ✓</h2>
            <p>Dear ${selectedComplaint.submitter_name},</p>
            <p>Your complaint titled <strong>"${selectedComplaint.title}"</strong> has been successfully resolved.</p>
            ${editForm.resolution_notes ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:12px;margin:12px 0"><strong>Resolution Notes:</strong><br/>${editForm.resolution_notes}</div>` : ""}
            ${editForm.admin_notes ? `<div style="background:#f5f5f5;border:1px solid #e5e7eb;border-radius:6px;padding:12px;margin:12px 0"><strong>Admin Notes:</strong><br/>${editForm.admin_notes}</div>` : ""}
            <p>If you are satisfied with the resolution, please leave feedback on the portal.</p>`,
        },
        rejected: {
          type: "status_change",
          subject: "Update on your complaint — ACE Compliant Management",
          bodyHtml: `<h2>Your complaint has been reviewed</h2>
            <p>Dear ${selectedComplaint.submitter_name},</p>
            <p>After review, your complaint titled <strong>"${selectedComplaint.title}"</strong> has been closed by the department.</p>
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

      // Trigger verification if resolved with image
      if (editForm.status === "resolved" && editForm.resolution_image) {
        toast({ title: "AI Verification", description: "Analyzing resolution proof..." });
        supabase.functions.invoke("verify-resolution", {
          body: { complaint_id: selectedComplaint.id }
        }).then(({ data, error }) => {
          if (!error && data?.verified) {
             toast({ 
               title: "Verified!", 
               description: "AI confirmed the issue is fixed.", 
               variant: "default" 
             });
          } else if (data && !data.verified) {
             toast({ 
               title: "Verification Failed", 
               description: data.ai_result?.reason || "AI could not verify the fix.", 
               variant: "destructive" 
             });
          }
           fetchComplaints();
        });
      }

      setIsEditOpen(false);
      fetchComplaints();
    }
  };

  // Filter complaints
  const filteredComplaints = complaints.filter((c) => {
    const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         c.submitter_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || c.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
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
  const statusData = [
    { name: "Pending", value: stats.pending },
    { name: "In Progress", value: stats.inProgress },
    { name: "Resolved", value: stats.resolved },
    { name: "Rejected", value: stats.rejected },
  ];

  const priorityData = [
    { name: "Low", value: complaints.filter((c) => c.priority === "low").length },
    { name: "Medium", value: complaints.filter((c) => c.priority === "medium").length },
    { name: "High", value: complaints.filter((c) => c.priority === "high").length },
    { name: "Urgent", value: complaints.filter((c) => c.priority === "urgent").length },
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
      <AdminHeader 
        title={`${profile?.department ? departmentLabels[profile.department] : ""} Department`} 
        subtitle="Manage your department's complaints"
      />
      
      <main className="flex-1 py-6">
        <div className="container">
          {/* Stats Grid */}
          <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total Complaints" value={stats.total} icon={FileText} variant="primary" />
            <StatCard title="Pending" value={stats.pending} icon={Clock} variant="warning" />
            <StatCard title="In Progress" value={stats.inProgress} icon={AlertTriangle} variant="accent" />
            <StatCard title="Resolved" value={stats.resolved} icon={CheckCircle} variant="success" />
            <StatCard title="Rejected" value={stats.rejected} icon={X} variant="destructive" />
          </div>

          {/* Charts Row */}
          <div className="mb-8 grid gap-6 lg:grid-cols-2">
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

            {/* Priority Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Priority Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={priorityData}>
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
          </div>

          {/* Filters */}
          <div className="mb-6 flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search complaints..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[150px]">
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
            <Button variant="outline" size="icon" onClick={fetchComplaints}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button 
                variant="outline" 
                onClick={() => downloadCSV(filteredComplaints, "dept_complaints_export.csv")}
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
          </div>

          {/* Complaints Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-border bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Title</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
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
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground line-clamp-1">{complaint.title}</p>
                            {complaint.verification_status === "verified" && (
                              <span title="AI Verified Fix" className="flex items-center">
                                <ShieldCheck className="h-4 w-4 text-success" />
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-1">{complaint.description}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={complaint.status === "resolved" ? "resolved" : complaint.status === "rejected" ? "urgent" : "pending"}>
                            {statusLabels[complaint.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={complaint.priority === "urgent" ? "urgent" : complaint.priority === "high" ? "warning" : "secondary"}>
                            {complaint.priority}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-foreground">{complaint.submitter_name}</p>
                          <p className="text-xs text-muted-foreground">{complaint.submitter_email}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {new Date(complaint.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon"
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
                              onClick={() => {
                                setSelectedComplaint(complaint);
                                setEditForm({
                                  status: complaint.status,
                                  priority: complaint.priority,
                                  admin_notes: complaint.admin_notes || "",
                                  resolution_notes: complaint.resolution_notes || "",
                                  resolution_image: complaint.resolution_image || "",
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
                        <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                          No complaints found for your department
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
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
              <Badge variant={selectedComplaint?.status === "resolved" ? "resolved" : "pending"}>
                {selectedComplaint && statusLabels[selectedComplaint.status]}
              </Badge>
              <Badge variant={selectedComplaint?.priority === "urgent" ? "urgent" : "secondary"}>
                {selectedComplaint?.priority}
              </Badge>
            </div>
            <div>
              <h4 className="font-medium mb-2">Description</h4>
              <p className="text-muted-foreground whitespace-pre-wrap">{selectedComplaint?.description}</p>
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
            <div>
              <h4 className="font-medium mb-2">Contact</h4>
              <p className="text-muted-foreground">{selectedComplaint?.submitter_email}</p>
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
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Resolution Notes</Label>
                  <Textarea
                    value={editForm.resolution_notes}
                    onChange={(e) => setEditForm({ ...editForm, resolution_notes: e.target.value })}
                    placeholder="Describe how the issue was resolved..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Resolution Proof (Required for AI Verification)</Label>
                  <FileUpload 
                    onFilesChange={(files) => {
                      if (files.length > 0) {
                        setEditForm({ ...editForm, resolution_image: files[0].path });
                      }
                    }} 
                    maxFiles={1}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button variant="hero" onClick={handleUpdateComplaint}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DepartmentDashboard;
