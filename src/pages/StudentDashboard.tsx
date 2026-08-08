import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import ComplaintTimeline from "@/components/complaints/ComplaintTimeline";
import SatisfactionRating from "@/components/complaints/SatisfactionRating";
import { FileText, Plus, Clock, CheckCircle, XCircle, Loader2, ChevronDown, ChevronUp, Eye, Star, Edit, User, Mail, Phone, Save, X, Trash2 } from "lucide-react";
import { Database } from "@/integrations/supabase/types";
import { QuickActionsPanel } from "@/components/dashboard/QuickActionsPanel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Complaint = Record<string, any>;

const statusConfig = {
  pending: { label: "Pending", color: "bg-warning/10 text-warning border-warning/30", icon: Clock },
  in_progress: { label: "In Progress", color: "bg-info/10 text-info border-info/30", icon: Loader2 },
  resolved: { label: "Resolved", color: "bg-success/10 text-success border-success/30", icon: CheckCircle },
  rejected: { label: "Rejected", color: "bg-destructive/10 text-destructive border-destructive/30", icon: XCircle },
};

const priorityConfig = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-warning/10 text-warning",
  high: "bg-destructive/10 text-destructive",
  urgent: "bg-destructive text-destructive-foreground",
};

const departmentLabels: Record<string, string> = {
  academic: "Academic",
  infrastructure: "Infrastructure",
  administration: "Administration",
  library: "Library",
  sports: "Sports",
};

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [feedbackComplaint, setFeedbackComplaint] = useState<Complaint | null>(null);
  
  // Profile editing state
  const { profile, signOut, refreshProfile } = useAuth();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: "",
    email: "",
    countryCode: "+91",
    phone: "",
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // Complaint editing state
  const [isEditComplaintOpen, setIsEditComplaintOpen] = useState(false);
  const [complaintEditForm, setComplaintEditForm] = useState({
    id: "",
    title: "",
    description: "",
  });
  const [isUpdatingComplaint, setIsUpdatingComplaint] = useState(false);

  useEffect(() => {
    if (profile && user) {
      // Try to parse country code from phone_number (simple logic: first 3 chars if starts with +)
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

      setEditForm({
        fullName: profile.full_name || "",
        email: profile.email || user.email || "",
        countryCode: cCode,
        phone: phoneBody,
      });
    }
  }, [profile, user]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchComplaints = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("complaints")
          .select("*")
          .eq("submitted_by", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setComplaints(data || []);
      } catch (error) {
        console.error("Error fetching complaints:", error);
        toast({
          title: "Error",
          description: "Failed to load your complaints.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchComplaints();
    }
  }, [user, toast]);

  const stats = {
    total: complaints.length,
    pending: complaints.filter((c) => c.status === "pending").length,
    inProgress: complaints.filter((c) => c.status === "in_progress").length,
    resolved: complaints.filter((c) => c.status === "resolved").length,
    rejected: complaints.filter((c) => c.status === "rejected").length,
  };

  const handleSaveProfile = async () => {
    if (!user || !editForm.fullName.trim() || !editForm.email.trim()) return;
    setIsSavingProfile(true);
    
    try {
      if (editForm.email.trim() !== user.email) {
        const { error: authError } = await supabase.auth.updateUser({ email: editForm.email.trim() });
        if (authError) throw authError;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ 
          full_name: editForm.fullName.trim(), 
          email: editForm.email.trim(),
          phone_number: `${editForm.countryCode} ${editForm.phone.trim()}` 
        })
        .eq("user_id", user.id);

      if (profileError) throw profileError;

      await refreshProfile();
      toast({ title: "Profile updated", description: "Your information has been saved successfully." });
      setIsEditingProfile(false);
    } catch (error: any) {
      toast({ 
        title: "Update failed", 
        description: error.message || "An error occurred while saving your profile.", 
        variant: "destructive" 
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleWithdrawComplaint = async (complaintId: string) => {
    if (!confirm("Are you sure you want to withdraw this complaint? This action cannot be undone.")) return;
    
    setIsDeletingId(complaintId);
    try {
      const { error } = await supabase
        .from("complaints")
        .delete()
        .eq("id", complaintId)
        .eq("status", "pending");

      if (error) throw error;
      
      toast({ title: "Complaint Withdrawn", description: "Your complaint has been successfully withdrawn/deleted." });
      setComplaints(prev => prev.filter(c => c.id !== complaintId));
    } catch (error: any) {
      console.error("Delete error:", error);
      toast({ title: "Failed to withdraw", description: error.message || "Could not withdraw complaint.", variant: "destructive" });
    } finally {
      setIsDeletingId(null);
    }
  };

  const handleUpdateComplaint = async () => {
    if (!complaintEditForm.title.trim() || !complaintEditForm.description.trim()) {
      toast({ title: "Validation Error", description: "Title and description cannot be empty.", variant: "destructive" });
      return;
    }
    
    setIsUpdatingComplaint(true);
    try {
      const { error } = await supabase
        .from("complaints")
        .update({
          title: complaintEditForm.title.trim(),
          description: complaintEditForm.description.trim(),
          updated_at: new Date().toISOString()
        })
        .eq("id", complaintEditForm.id)
        .eq("status", "pending");

      if (error) throw error;
      
      toast({ title: "Complaint Updated", description: "Your complaint changes have been saved." });
      setComplaints(prev => prev.map(c => 
        c.id === complaintEditForm.id 
          ? { ...c, title: complaintEditForm.title.trim(), description: complaintEditForm.description.trim() } 
          : c
      ));
      setIsEditComplaintOpen(false);
    } catch (error: any) {
      console.error("Update error:", error);
      toast({ title: "Failed to update", description: error.message || "Could not update complaint.", variant: "destructive" });
    } finally {
      setIsUpdatingComplaint(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 py-8">
          <div className="container max-w-4xl">
            <Skeleton className="h-8 w-48 mb-6" />
            <div className="grid gap-4 md:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1 py-8 md:py-12">
        <div className="container max-w-4xl">
          {/* Header */}
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-slide-up">
            <div>
              <h1 className="text-3xl font-bold text-foreground">My Complaints</h1>
              <p className="text-muted-foreground">Track and manage your submitted complaints</p>
            </div>
            <div className="flex items-center gap-2">
              <QuickActionsPanel role="student" />
              <Button variant="hero" onClick={() => navigate("/complaint")} className="gap-2">
                <Plus className="h-4 w-4" />
                New Complaint
              </Button>
            </div>
          </div>

          {/* Profile Card */}
          <Card className="mb-8 border-border/50 bg-card shadow-sm animate-fade-in">
            <CardHeader className="pb-3 border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground shadow-sm">
                    <User className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-lg">My Profile</CardTitle>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsEditingProfile(!isEditingProfile)}
                  className="h-8 gap-2"
                >
                  {isEditingProfile ? (
                    <><X className="h-3.5 w-3.5" /> Cancel</>
                  ) : (
                    <><Edit className="h-3.5 w-3.5" /> Edit Profile</>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {isEditingProfile ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-xs">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input 
                        id="fullName" 
                        value={editForm.fullName} 
                        onChange={(e) => setEditForm(prev => ({ ...prev, fullName: e.target.value }))}
                        className="pl-9 h-9"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-xs">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input 
                        id="email" 
                        type="email"
                        value={editForm.email} 
                        onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                        className="pl-9 h-9"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-xs">Phone Number</Label>
                    <div className="flex gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-md border bg-muted text-muted-foreground shrink-0">
                        <Phone className="h-4 w-4" />
                      </div>
                      <Select
                        value={editForm.countryCode}
                        onValueChange={(value) => setEditForm(prev => ({ ...prev, countryCode: value }))}
                      >
                        <SelectTrigger className="w-[85px] h-9">
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
                        value={editForm.phone} 
                        onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value.replace(/\D/g, '').substring(0, 10) }))}
                        placeholder="9876543210"
                        className="h-9 flex-1"
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-3 flex justify-end pt-2">
                    <Button 
                      size="sm" 
                      onClick={handleSaveProfile} 
                      disabled={isSavingProfile}
                      className="gap-2"
                    >
                      {isSavingProfile ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save Changes
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Name</p>
                      <p className="text-sm font-semibold">{profile?.full_name || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Email</p>
                      <p className="text-sm font-semibold truncate max-w-[200px]">{profile?.email || user?.email || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                      <Phone className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Phone</p>
                      <p className="text-sm font-semibold">{profile?.phone_number || "—"}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-fade-in">
            <Card className="border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10 text-warning">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10 text-info">
                  <Loader2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.inProgress}</p>
                  <p className="text-xs text-muted-foreground">In Progress</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.resolved}</p>
                  <p className="text-xs text-muted-foreground">Resolved</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                  <XCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.rejected}</p>
                  <p className="text-xs text-muted-foreground">Rejected</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Complaints List */}
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : complaints.length === 0 ? (
            <Card className="border-border/50 animate-scale-in">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No Complaints Yet</h3>
                <p className="text-muted-foreground mb-4">
                  You haven't submitted any complaints. Submit one to get started.
                </p>
                <Button variant="hero" onClick={() => navigate("/complaint")} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Submit Your First Complaint
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {complaints.map((complaint, index) => {
                const StatusIcon = statusConfig[complaint.status].icon;
                const isExpanded = expandedId === complaint.id;

                return (
                  <Card
                    key={complaint.id}
                    className="border-border/50 overflow-hidden transition-all duration-300 hover:shadow-lg animate-fade-in"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg truncate">{complaint.title}</CardTitle>
                          <CardDescription className="flex flex-wrap items-center gap-2 mt-1">
                            <Badge variant="outline" className={priorityConfig[complaint.priority]}>
                              {complaint.priority}
                            </Badge>
                            <Badge variant="outline">{departmentLabels[complaint.category]}</Badge>
                            <span className="text-xs">
                              {new Date(complaint.created_at).toLocaleDateString()}
                            </span>
                          </CardDescription>
                        </div>
                        <Badge className={`${statusConfig[complaint.status].color} shrink-0`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConfig[complaint.status].label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {complaint.description}
                      </p>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedId(isExpanded ? null : complaint.id)}
                          className="flex-1 justify-between"
                        >
                          <span className="flex items-center gap-2">
                            <Eye className="h-4 w-4" />
                            {isExpanded ? "Hide Timeline" : "View Timeline"}
                          </span>
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        
                        {complaint.status === "pending" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-primary border-primary/30 hover:bg-primary/10"
                              onClick={() => {
                                setComplaintEditForm({
                                  id: complaint.id,
                                  title: complaint.title,
                                  description: complaint.description
                                });
                                setIsEditComplaintOpen(true);
                              }}
                              title="Edit Complaint"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive border-destructive/30 hover:bg-destructive/10"
                              onClick={() => handleWithdrawComplaint(complaint.id)}
                              disabled={isDeletingId === complaint.id}
                              title="Withdraw Complaint"
                            >
                              {isDeletingId === complaint.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                          </>
                        )}
                      </div>

                      {/* Feedback button for resolved complaints */}
                      {complaint.status === "resolved" && (
                        (complaint as any).satisfaction_rating ? (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground justify-center">
                            <span>Your rating:</span>
                            {[1,2,3,4,5].map(s => (
                              <Star key={s} className={`h-3.5 w-3.5 ${ s <= (complaint as any).satisfaction_rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                            ))}
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 w-full gap-2 border-yellow-400/50 text-yellow-600 hover:bg-yellow-50 hover:text-yellow-700"
                            onClick={() => setFeedbackComplaint(complaint)}
                          >
                            <Star className="h-4 w-4" />
                            Rate This Resolution
                          </Button>
                        )
                      )}

                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-border/50 animate-fade-in">
                          <ComplaintTimeline
                            currentStatus={complaint.status}
                            createdAt={complaint.created_at}
                            updatedAt={complaint.updated_at}
                            resolvedAt={complaint.resolved_at}
                          />
                          {complaint.resolution_notes && (
                            <div className="mt-4 rounded-lg bg-success/5 border border-success/20 p-3">
                              <p className="text-sm font-medium text-success mb-1">Resolution Notes</p>
                              <p className="text-sm text-muted-foreground">{complaint.resolution_notes}</p>
                            </div>
                          )}
                          {complaint.status === "rejected" && (complaint.admin_notes || complaint.tutor_notes || complaint.hod_notes || complaint.principal_notes) && (
                            <div className="mt-4 rounded-lg bg-destructive/5 border border-destructive/20 p-3">
                              <p className="text-sm font-medium text-destructive mb-1">Rejection Reason</p>
                              <p className="text-sm text-muted-foreground">
                                {complaint.admin_notes || complaint.principal_notes || complaint.hod_notes || complaint.tutor_notes}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Feedback Dialog */}
      {feedbackComplaint && (
        <SatisfactionRating
          complaintId={feedbackComplaint.id}
          complaintTitle={feedbackComplaint.title}
          isOpen={!!feedbackComplaint}
          onClose={() => setFeedbackComplaint(null)}
          onSubmit={() => {
            setComplaints(prev =>
              prev.map(c =>
                c.id === feedbackComplaint.id
                  ? { ...c, satisfaction_rating: 1 } as any  // trigger UI update
                  : c
              )
            );
            setFeedbackComplaint(null);
          }}
        />
      )}

      {/* Edit Complaint Dialog */}
      <Dialog open={isEditComplaintOpen} onOpenChange={setIsEditComplaintOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Complaint</DialogTitle>
            <DialogDescription>
              Update your complaint details. You can only edit complaints that are still pending.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={complaintEditForm.title}
                onChange={(e) => setComplaintEditForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Brief summary of the issue"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Description</Label>
              <Textarea
                id="edit-desc"
                value={complaintEditForm.description}
                onChange={(e) => setComplaintEditForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Detailed explanation of your complaint"
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditComplaintOpen(false)}>Cancel</Button>
            <Button variant="hero" onClick={handleUpdateComplaint} disabled={isUpdatingComplaint}>
              {isUpdatingComplaint ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default StudentDashboard;
