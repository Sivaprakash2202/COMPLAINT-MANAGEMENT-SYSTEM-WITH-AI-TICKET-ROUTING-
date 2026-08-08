import { CheckCircle, Clock, AlertCircle, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "pending" | "in_progress" | "resolved" | "rejected";

interface TimelineStep {
  status: Status;
  label: string;
  description: string;
  icon: React.ElementType;
  activeColor: string;
}

const timelineSteps: TimelineStep[] = [
  {
    status: "pending",
    label: "Submitted",
    description: "Complaint received and queued",
    icon: Clock,
    activeColor: "text-warning bg-warning/10 border-warning/30",
  },
  {
    status: "in_progress",
    label: "In Progress",
    description: "Being reviewed by department",
    icon: Loader2,
    activeColor: "text-info bg-info/10 border-info/30",
  },
  {
    status: "resolved",
    label: "Resolved",
    description: "Issue has been addressed",
    icon: CheckCircle,
    activeColor: "text-success bg-success/10 border-success/30",
  },
];

const statusOrder: Record<Status, number> = {
  pending: 0,
  in_progress: 1,
  resolved: 2,
  rejected: -1,
};

interface ComplaintTimelineProps {
  currentStatus: Status;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
}

const ComplaintTimeline = ({ currentStatus, createdAt, updatedAt, resolvedAt }: ComplaintTimelineProps) => {
  const currentIndex = statusOrder[currentStatus];
  const isRejected = currentStatus === "rejected";

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isRejected) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
          <XCircle className="h-5 w-5 text-destructive" />
        </div>
        <div>
          <p className="font-medium text-destructive">Complaint Rejected</p>
          <p className="text-sm text-muted-foreground">Updated on {formatDate(updatedAt)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Submitted: {formatDate(createdAt)}</span>
        {resolvedAt && <span>Resolved: {formatDate(resolvedAt)}</span>}
      </div>

      <div className="relative">
        {/* Progress bar */}
        <div className="absolute left-5 top-5 h-[calc(100%-40px)] w-0.5 bg-border">
          <div 
            className="h-full w-full bg-primary transition-all duration-500"
            style={{ height: `${(currentIndex / (timelineSteps.length - 1)) * 100}%` }}
          />
        </div>

        {/* Steps */}
        <div className="space-y-6">
          {timelineSteps.map((step, index) => {
            const isPast = index < currentIndex;
            const isCurrent = index === currentIndex;
            const isFuture = index > currentIndex;
            const Icon = step.icon;

            return (
              <div key={step.status} className="relative flex items-start gap-4">
                <div
                  className={cn(
                    "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300",
                    isCurrent && step.activeColor,
                    isPast && "border-primary bg-primary text-primary-foreground",
                    isFuture && "border-border bg-background text-muted-foreground"
                  )}
                >
                  <Icon className={cn("h-5 w-5", isCurrent && step.status === "in_progress" && "animate-spin")} />
                </div>
                <div className={cn("pt-1.5", isFuture && "opacity-50")}>
                  <p className={cn("font-medium", isCurrent && "text-foreground", isPast && "text-foreground", isFuture && "text-muted-foreground")}>
                    {step.label}
                  </p>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
                {isCurrent && (
                  <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    Current
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ComplaintTimeline;
