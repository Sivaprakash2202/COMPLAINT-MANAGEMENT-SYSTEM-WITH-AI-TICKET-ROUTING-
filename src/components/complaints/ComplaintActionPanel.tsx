import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Play, 
  CheckCircle, 
  Forward, 
  Upload, 
  Loader2, 
  X,
  FileText,
  Clock,
  User,
  Calendar,
  Wand2,
  Sparkles
} from "lucide-react";

type WorkflowLevel = "tutor" | "hod" | "principal";
type WorkflowStatus = "not_viewed" | "in_progress" | "completed" | "forwarded" | "rejected";

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
  current_level: WorkflowLevel;
  tutor_status: WorkflowStatus | null;
  tutor_notes: string | null;
  hod_status: WorkflowStatus | null;
  hod_notes: string | null;
  principal_status: WorkflowStatus | null;
  principal_notes: string | null;
  resolved_at: string | null;
}

interface ComplaintActionPanelProps {
  complaint: Complaint;
  level: WorkflowLevel;
  onUpdate: () => void;
}

const ComplaintActionPanel = ({ complaint, level, onUpdate }: ComplaintActionPanelProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const levelLabels: Record<WorkflowLevel, string> = {
    tutor: "Tutor",
    hod: "Head of Department",
    principal: "Principal"
  };

  const nextLevel: Record<WorkflowLevel, WorkflowLevel | null> = {
    tutor: "hod",
    hod: "principal",
    principal: null
  };

  const categoryLabels: Record<string, string> = {
    academic: "Academic",
    infrastructure: "Infrastructure",
    administration: "Administration",
    library: "Library",
    sports: "Sports"
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select a file smaller than 5MB",
          variant: "destructive"
        });
        return;
      }
      setProofFile(file);
    }
  };

  const uploadProof = async (complaintId: string): Promise<string | null> => {
    if (!proofFile) return null;

    const fileExt = proofFile.name.split(".").pop();
    const filePath = `${complaintId}/${level}/${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from("resolution-proofs")
      .upload(filePath, proofFile);

    if (error) {
      console.error("Upload error:", error);
      return null;
    }

    return filePath;
  };

  const generateAISuggestion = async () => {
    setIsSuggesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-reply", {
        body: { complaint: { title: complaint.title, description: complaint.description, category: complaint.category }, level }
      });
      if (error) throw error;
      setNotes(data.suggestion);
      toast({
        title: "AI Suggestion Ready",
        description: "Drafted a professional response for you.",
      });
    } catch (error) {
      console.error("Suggestion error:", error);
      toast({
        title: "AI Error",
        description: "Failed to generate suggestion",
        variant: "destructive"
      });
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleAction = async (action: "in_progress" | "completed" | "forwarded" | "rejected") => {
    if ((action === "completed" || action === "forwarded" || action === "rejected") && !notes.trim()) {
      toast({
        title: "Notes Required",
        description: "Please provide notes explaining your action.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      // Upload proof if provided
      let proofPath: string | null = null;
      if (proofFile) {
        proofPath = await uploadProof(complaint.id);
        if (proofPath) {
          const { data: { user } } = await supabase.auth.getUser();
          await supabase.from("resolution_attachments").insert({
            complaint_id: complaint.id,
            uploaded_by: user?.id,
            level,
            file_name: proofFile.name,
            file_path: proofPath,
            file_size: proofFile.size,
            file_type: proofFile.type
          });
        }
      }

      // Build update object
      const updateData: Record<string, any> = {
        [`${level}_status`]: action,
        [`${level}_notes`]: notes.trim() || null,
        [`${level}_processed_at`]: new Date().toISOString()
      };

      // Get current user for processed_by
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        updateData[`${level}_processed_by`] = user.id;
      }

      // If forwarding, update current_level
      if (action === "forwarded" && nextLevel[level]) {
        updateData.current_level = nextLevel[level];
      }

      // If completed, update overall status
      if (action === "completed") {
        updateData.status = "resolved";
        updateData.resolved_at = new Date().toISOString();
        updateData.resolution_notes = notes.trim();
      }
      
      // If rejected, update overall status
      if (action === "rejected") {
        updateData.status = "rejected";
        updateData.resolved_at = new Date().toISOString();
        updateData.admin_notes = notes.trim();
      }

      // If in_progress, update overall status
      if (action === "in_progress") {
        updateData.status = "in_progress";
      }

      const { error } = await supabase
        .from("complaints")
        .update(updateData)
        .eq("id", complaint.id);

      if (error) throw error;

      // Send notification to the student
      const notificationMessages: Record<string, { subject: string; bodyHtml: string; type: string }> = {
        in_progress: {
          type: "status_change",
          subject: "Your complaint is being reviewed — ACE Compliant Management",
          bodyHtml: `<h2>Your complaint is being reviewed</h2>
            <p>Dear ${complaint.submitter_name},</p>
            <p>Good news! Your complaint titled <strong>"${complaint.title}"</strong> is now being actively reviewed by the <strong>${levelLabels[level]}</strong>.</p>
            <p>We'll notify you once there's further progress.</p>`,
        },
        completed: {
          type: "resolution",
          subject: "Your complaint has been resolved — ACE Compliant Management",
          bodyHtml: `<h2>Your complaint has been resolved ✓</h2>
            <p>Dear ${complaint.submitter_name},</p>
            <p>Your complaint titled <strong>"${complaint.title}"</strong> has been successfully resolved by the <strong>${levelLabels[level]}</strong>.</p>
            ${notes.trim() ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:12px;margin:12px 0"><strong>Resolution Notes:</strong><br/>${notes.trim()}</div>` : ""}
            <p>If you are satisfied with the resolution, please leave feedback on the portal.</p>`,
        },
        forwarded: {
          type: "escalation",
          subject: `Your complaint has been escalated to ${levelLabels[nextLevel[level]!]} — ACE Compliant Management`,
          bodyHtml: `<h2>Your complaint has been escalated</h2>
            <p>Dear ${complaint.submitter_name},</p>
            <p>Your complaint titled <strong>"${complaint.title}"</strong> has been reviewed by the <strong>${levelLabels[level]}</strong> and escalated to the <strong>${levelLabels[nextLevel[level]!]}</strong> for further action.</p>
            <p>We'll keep you updated as things progress.</p>`,
        },
        rejected: {
          type: "status_change",
          subject: "Update on your complaint — ACE Compliant Management",
          bodyHtml: `<h2>Your complaint has been reviewed</h2>
            <p>Dear ${complaint.submitter_name},</p>
            <p>After review by the <strong>${levelLabels[level]}</strong>, your complaint titled <strong>"${complaint.title}"</strong> has been closed.</p>
            ${notes.trim() ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px;margin:12px 0"><strong>Reason:</strong><br/>${notes.trim()}</div>` : ""}
            <p>If you believe this was done in error, please contact support.</p>`,
        },
      };

      const notifMsg = notificationMessages[action];
      if (notifMsg) {
        supabase.functions.invoke("send-notification", {
          body: {
            complaint_id: complaint.id,
            notification_type: notifMsg.type,
            recipient_email: complaint.submitter_email,
            recipient_mobile: complaint.submitter_mobile,
            recipient_name: complaint.submitter_name,
            subject: notifMsg.subject,
            body: notifMsg.bodyHtml,
          },
        }).catch((err) => console.log("Notification queued:", err));
      }

      toast({
        title: "Success",
        description: action === "forwarded"
          ? `Complaint forwarded to ${levelLabels[nextLevel[level]!]}`
          : action === "completed"
          ? "Complaint marked as resolved"
          : action === "rejected"
          ? "Complaint has been rejected"
          : "Status updated to In Progress"
      });

      setNotes("");
      setProofFile(null);
      onUpdate();
    } catch (error) {
      console.error("Action error:", error);
      toast({
        title: "Error",
        description: "Failed to update complaint. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const currentStatus = complaint[`${level}_status` as keyof Complaint] as WorkflowStatus | null;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="text-lg mb-2">{complaint.title}</CardTitle>
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge variant="outline">{categoryLabels[complaint.category] || complaint.category}</Badge>
              <Badge 
                variant="outline" 
                className={complaint.priority === "high" ? "border-destructive text-destructive" : complaint.priority === "medium" ? "border-warning text-warning" : ""}
              >
                {complaint.priority.toUpperCase()}
              </Badge>
              {currentStatus && (
                <Badge 
                  variant="outline"
                  className={
                    currentStatus === "completed" ? "bg-success/10 text-success border-success/20" :
                    currentStatus === "in_progress" ? "bg-info/10 text-info border-info/20" :
                    currentStatus === "forwarded" ? "bg-accent/10 text-accent border-accent/20" :
                    currentStatus === "rejected" ? "bg-destructive/10 text-destructive border-destructive/20" :
                    "bg-muted text-muted-foreground"
                  }
                >
                  {currentStatus.replace("_", " ").toUpperCase()}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{complaint.description}</p>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4" />
            <span>{complaint.submitter_name}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>{new Date(complaint.created_at).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Previous level notes if available */}
        {level === "hod" && complaint.tutor_notes && (
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Tutor Notes:</p>
            <p className="text-sm">{complaint.tutor_notes}</p>
          </div>
        )}
        {level === "principal" && (
          <>
            {complaint.tutor_notes && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Tutor Notes:</p>
                <p className="text-sm">{complaint.tutor_notes}</p>
              </div>
            )}
            {complaint.hod_notes && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">HOD Notes:</p>
                <p className="text-sm">{complaint.hod_notes}</p>
              </div>
            )}
          </>
        )}

        {/* Action form - only show if not completed, forwarded, or rejected */}
        {currentStatus !== "completed" && currentStatus !== "forwarded" && currentStatus !== "rejected" && (
          <div className="space-y-4 pt-4 border-t border-border/50">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={`notes-${complaint.id}`}>Resolution Notes / Comments</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={generateAISuggestion}
                  disabled={isSuggesting}
                  className="h-8 gap-2 text-primary hover:text-primary/80 hover:bg-primary/5"
                >
                  {isSuggesting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Wand2 className="h-3 w-3" />
                  )}
                  Suggest Reply
                </Button>
              </div>
              <Textarea
                id={`notes-${complaint.id}`}
                placeholder="Describe how the complaint was handled or why it's being forwarded..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`proof-${complaint.id}`}>Proof Attachment (Optional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id={`proof-${complaint.id}`}
                  type="file"
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={handleFileChange}
                  className="flex-1"
                />
                {proofFile && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setProofFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {proofFile && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {proofFile.name}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {currentStatus !== "in_progress" && (
                <Button
                  variant="outline"
                  onClick={() => handleAction("in_progress")}
                  disabled={isLoading}
                  className="gap-2"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Mark In Progress
                </Button>
              )}
              
              <Button
                variant="success"
                onClick={() => handleAction("completed")}
                disabled={isLoading}
                className="gap-2"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Mark Completed
              </Button>
              
              <Button
                variant="destructive"
                onClick={() => handleAction("rejected")}
                disabled={isLoading}
                className="gap-2"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                Reject
              </Button>

              {nextLevel[level] && (
                <Button
                  variant="accent"
                  onClick={() => handleAction("forwarded")}
                  disabled={isLoading}
                  className="gap-2"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Forward className="h-4 w-4" />}
                  Forward to {levelLabels[nextLevel[level]!]}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Show completion/forward/rejected status */}
        {(currentStatus === "completed" || currentStatus === "forwarded" || currentStatus === "rejected") && (
          <div className={`rounded-lg p-4 ${currentStatus === "completed" ? "bg-success/10 border border-success/20" : currentStatus === "rejected" ? "bg-destructive/10 border border-destructive/20" : "bg-accent/10 border border-accent/20"}`}>
            <p className={`text-sm font-medium ${currentStatus === "completed" ? "text-success" : currentStatus === "rejected" ? "text-destructive" : "text-accent"} mb-1`}>
              {currentStatus === "completed" ? "✓ Resolved by you" : currentStatus === "rejected" ? "✕ Rejected by you" : `→ Forwarded to ${levelLabels[nextLevel[level]!]}`}
            </p>
            {complaint[`${level}_notes` as keyof Complaint] && (
              <p className="text-sm text-muted-foreground">{complaint[`${level}_notes` as keyof Complaint] as string}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ComplaintActionPanel;
