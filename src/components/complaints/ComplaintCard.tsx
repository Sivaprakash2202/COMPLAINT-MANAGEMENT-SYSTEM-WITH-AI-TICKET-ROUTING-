import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Clock, User, Building2, ArrowRight } from "lucide-react";

export interface Complaint {
  id: string;
  title: string;
  description: string;
  category: "academic" | "infrastructure" | "administration" | "other";
  status: "pending" | "in-progress" | "resolved" | "urgent";
  department: string;
  submittedBy: string;
  submittedAt: string;
  priority: "low" | "medium" | "high";
}

interface ComplaintCardProps {
  complaint: Complaint;
  onClick?: () => void;
}

const categoryLabels: Record<Complaint["category"], string> = {
  academic: "Academic",
  infrastructure: "Infrastructure",
  administration: "Administration",
  other: "Other",
};

const statusLabels: Record<Complaint["status"], string> = {
  pending: "Pending",
  "in-progress": "In Progress",
  resolved: "Resolved",
  urgent: "Urgent",
};

const ComplaintCard = ({ complaint, onClick }: ComplaintCardProps) => {
  return (
    <Card
      className="group cursor-pointer border-border/50 bg-card transition-all duration-300 hover:border-primary/30 hover:shadow-lg animate-fade-in"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-1">
            <h3 className="font-semibold text-foreground leading-tight line-clamp-1 group-hover:text-primary transition-colors">
              {complaint.title}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {complaint.description}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-1" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={complaint.category}>{categoryLabels[complaint.category]}</Badge>
          <Badge variant={complaint.status === "urgent" ? "urgent" : complaint.status === "resolved" ? "resolved" : "pending"}>
            {statusLabels[complaint.status]}
          </Badge>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Building2 className="h-3 w-3" />
            <span>{complaint.department}</span>
          </div>
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            <span>{complaint.submittedBy}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{complaint.submittedAt}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ComplaintCard;
