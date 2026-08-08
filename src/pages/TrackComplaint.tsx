import { useState, useEffect } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { FileSearch, AlertCircle, Clock, CheckCircle, XCircle, Loader2, Forward, Eye, EyeOff, User, Building2, Shield, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import type { Database } from "@/integrations/supabase/types";

type ComplaintStatus = Database["public"]["Enums"]["complaint_status"];
type DepartmentType = Database["public"]["Enums"]["department_type"];
type WorkflowStatus = "not_viewed" | "in_progress" | "completed" | "forwarded" | null;

interface Complaint {
  id: string;
  title: string;
  description: string;
  status: ComplaintStatus;
  priority: string;
  category: DepartmentType;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolution_notes: string | null;
  current_level: "tutor" | "hod" | "principal" | null;
  tutor_status: WorkflowStatus;
  tutor_notes: string | null;
  tutor_processed_at: string | null;
  hod_status: WorkflowStatus;
  hod_notes: string | null;
  hod_processed_at: string | null;
  principal_status: WorkflowStatus;
  principal_notes: string | null;
  principal_processed_at: string | null;
}

const TrackComplaint = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchMyComplaints();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const fetchMyComplaints = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("complaints")
        .select("*")
        .eq("submitted_by", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setComplaints((data as unknown as Complaint[]) || []);
    } catch (error) {
      console.error("Error fetching complaints:", error);
      toast({
        title: "Error",
        description: "Unable to load your complaints.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const departmentLabels: Record<DepartmentType, string> = {
    academic: "Academic",
    infrastructure: "Infrastructure",
    administration: "Administration",
    library: "Library",
    sports: "Sports",
  };

  const getStatusIcon = (status: ComplaintStatus) => {
    switch (status) {
      case "pending":
      case "in_progress":
        return <Loader2 className="h-4 w-4 text-info animate-spin" />;
      case "resolved":
        return <CheckCircle className="h-4 w-4 text-success" />;
      case "rejected":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: ComplaintStatus) => {
    const variants: Record<ComplaintStatus, string> = {
      pending: "bg-info/10 text-info border-info/20",
      in_progress: "bg-info/10 text-info border-info/20",
      resolved: "bg-success/10 text-success border-success/20",
      rejected: "bg-destructive/10 text-destructive border-destructive/20",
    };

    const labels: Record<ComplaintStatus, string> = {
      pending: "Processing",
      in_progress: "Processing",
      resolved: "Completed",
      rejected: "Rejected",
    };

    return (
      <Badge variant="outline" className={variants[status]}>
        {labels[status].toUpperCase()}
      </Badge>
    );
  };

  const getWorkflowStatusBadge = (status: WorkflowStatus) => {
    if (!status) return null;
    
    const config: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
      not_viewed: { label: "Not Viewed", className: "bg-muted text-muted-foreground", icon: <EyeOff className="h-3 w-3" /> },
      in_progress: { label: "In Progress", className: "bg-info/10 text-info border-info/20", icon: <Clock className="h-3 w-3" /> },
      completed: { label: "Completed", className: "bg-success/10 text-success border-success/20", icon: <CheckCircle className="h-3 w-3" /> },
      forwarded: { label: "Forwarded", className: "bg-accent/10 text-accent border-accent/20", icon: <Forward className="h-3 w-3" /> },
    };

    const cfg = config[status];
    return (
      <Badge variant="outline" className={`gap-1 ${cfg.className}`}>
        {cfg.icon}
        {cfg.label}
      </Badge>
    );
  };

  const WorkflowTimeline = ({ complaint }: { complaint: Complaint }) => {
    const levels = [
      { key: "tutor", label: "Tutor", icon: <GraduationCap className="h-5 w-5" />, status: complaint.tutor_status, notes: complaint.tutor_notes, processedAt: complaint.tutor_processed_at },
      { key: "hod", label: "HOD", icon: <Building2 className="h-5 w-5" />, status: complaint.hod_status, notes: complaint.hod_notes, processedAt: complaint.hod_processed_at },
      { key: "principal", label: "Principal", icon: <Shield className="h-5 w-5" />, status: complaint.principal_status, notes: complaint.principal_notes, processedAt: complaint.principal_processed_at },
    ];

    const currentLevelIndex = levels.findIndex(l => l.key === complaint.current_level);

    return (
      <div className="space-y-4">
        <h4 className="font-semibold text-sm text-foreground">Workflow Progress</h4>
        <div className="relative">
          <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-border" />
          <div className="space-y-6">
            {levels.map((level, index) => {
              const isActive = index === currentLevelIndex;
              const isPast = index < currentLevelIndex || level.status === "completed" || level.status === "forwarded";
              const isFuture = index > currentLevelIndex && !level.status;

              return (
                <div key={level.key} className="relative flex gap-4">
                  <div className={`
                    relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2
                    ${isActive ? "border-primary bg-primary text-primary-foreground" : 
                      isPast ? "border-success bg-success/10 text-success" : 
                      "border-muted bg-muted text-muted-foreground"}
                  `}>
                    {level.icon}
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-medium ${isFuture ? "text-muted-foreground" : "text-foreground"}`}>
                        {level.label}
                      </span>
                      {level.status && getWorkflowStatusBadge(level.status)}
                      {isActive && (
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                          Current
                        </Badge>
                      )}
                    </div>
                    {level.processedAt && (
                      <p className="text-xs text-muted-foreground mb-1">
                        Processed: {new Date(level.processedAt).toLocaleString()}
                      </p>
                    )}
                    {level.notes && (
                      <div className={`mt-2 rounded-lg p-3 text-sm ${
                        level.status === "completed" ? "bg-success/5 border border-success/20" :
                        level.status === "forwarded" ? "bg-accent/5 border border-accent/20" :
                        "bg-muted/50"
                      }`}>
                        <p className="text-muted-foreground">{level.notes}</p>
                      </div>
                    )}
                    {isFuture && (
                      <p className="text-xs text-muted-foreground italic">Awaiting review</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 py-12">
          <div className="container max-w-md">
            <Card className="border-border/50 shadow-lg">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-2xl">Login Required</CardTitle>
                <CardDescription>
                  Please sign in to view and track your complaints.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Button variant="hero" onClick={() => navigate("/auth")}>
                  Sign In
                </Button>
                <Button variant="outline" onClick={() => navigate("/")}>
                  Back to Home
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 py-12">
        <div className="container max-w-4xl">
          <div className="mb-8 text-center animate-slide-up">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
              <FileSearch className="h-4 w-4" />
              My Complaints
            </div>
            <h1 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">
              Track Your <span className="text-gradient">Complaints</span>
            </h1>
            <p className="mx-auto max-w-xl text-muted-foreground">
              View all your submitted complaints and monitor their progress as they are reviewed by our faculty.
            </p>
          </div>

          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                {isLoading ? "Loading your complaints..." : `${complaints.length} Complaint${complaints.length !== 1 ? "s" : ""} Found`}
              </h2>
              <Button variant="outline" size="sm" onClick={fetchMyComplaints} disabled={isLoading} className="gap-2">
                <Loader2 className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
                <p className="mt-4 text-muted-foreground font-medium">Fetching your records...</p>
              </div>
            ) : complaints.length === 0 ? (
              <Card className="border-border/50 bg-muted/30">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-center text-muted-foreground mb-4">
                    You haven't submitted any complaints yet.
                  </p>
                  <Button variant="hero" onClick={() => navigate("/complaint")}>
                    Submit Your First Complaint
                  </Button>
                </CardContent>
              </Card>
            ) : (
              complaints.map((complaint, index) => {
                const isSeen = complaint.tutor_status !== "not_viewed" || complaint.hod_status !== "not_viewed" || complaint.principal_status !== "not_viewed";
                
                return (
                  <Card
                    key={complaint.id}
                    className="border-border/50 transition-all duration-300 hover:border-primary/30 hover:shadow-md animate-fade-in cursor-pointer"
                    style={{ animationDelay: `${index * 0.1}s` }}
                    onClick={() => setExpandedId(expandedId === complaint.id ? null : complaint.id)}
                  >
                    <CardContent className="p-6">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            {getStatusIcon(complaint.status)}
                            <h3 className="font-semibold text-foreground">{complaint.title}</h3>
                            {getStatusBadge(complaint.status)}
                            {isSeen && complaint.status !== "resolved" && (
                              <Badge variant="outline" className="bg-info/10 text-info border-info/20 animate-pulse">
                                <Eye className="h-3 w-3 mr-1" />
                                SEEN
                              </Badge>
                            )}
                          </div>
                          <p className="mb-3 text-sm text-muted-foreground line-clamp-2">
                            {complaint.description}
                          </p>
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Badge variant="outline" className="text-xs">
                                {departmentLabels[complaint.category]}
                              </Badge>
                            </span>
                            <span>
                              Submitted: {new Date(complaint.created_at).toLocaleDateString()}
                            </span>
                            {complaint.current_level && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                Current: <span className="capitalize font-medium">{complaint.current_level}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {expandedId === complaint.id && (
                        <div className="mt-6 border-t border-border/50 pt-6 animate-fade-in">
                          <WorkflowTimeline complaint={complaint} />
                          
                          {complaint.resolution_notes && (complaint.status === "resolved" || complaint.status === "rejected") && (
                            <div className={`mt-4 rounded-lg p-4 border ${complaint.status === "resolved" ? "bg-success/5 border-success/20" : "bg-destructive/5 border-destructive/20"}`}>
                              <p className={`text-sm font-medium mb-1 ${complaint.status === "resolved" ? "text-success" : "text-destructive"}`}>
                                {complaint.status === "resolved" ? "Final Resolution:" : "Reason for Rejection:"}
                              </p>
                              <p className="text-sm text-muted-foreground">{complaint.resolution_notes}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TrackComplaint;
