import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

interface SLAIndicatorProps {
  slaDeadline: string | null;
  status: string;
  resolvedAt?: string | null;
}

const SLAIndicator = ({ slaDeadline, status, resolvedAt }: SLAIndicatorProps) => {
  const slaStatus = useMemo(() => {
    if (!slaDeadline) return null;

    const deadline = new Date(slaDeadline);
    const now = new Date();
    
    // If resolved, check if it was within SLA
    if (status === "resolved" && resolvedAt) {
      const resolvedTime = new Date(resolvedAt);
      if (resolvedTime <= deadline) {
        return { type: "met", label: "SLA Met", remaining: null };
      } else {
        return { type: "breached", label: "SLA Breached", remaining: null };
      }
    }

    // For non-resolved complaints
    const diff = deadline.getTime() - now.getTime();
    const hoursRemaining = Math.floor(diff / (1000 * 60 * 60));
    const minutesRemaining = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (diff < 0) {
      const hoursOverdue = Math.abs(hoursRemaining);
      return { 
        type: "breached", 
        label: "SLA Breached", 
        remaining: `${hoursOverdue}h overdue` 
      };
    }

    if (hoursRemaining < 4) {
      return { 
        type: "critical", 
        label: "SLA Critical", 
        remaining: hoursRemaining > 0 
          ? `${hoursRemaining}h ${minutesRemaining}m left` 
          : `${minutesRemaining}m left`
      };
    }

    if (hoursRemaining < 12) {
      return { 
        type: "warning", 
        label: "SLA Warning", 
        remaining: `${hoursRemaining}h left` 
      };
    }

    return { 
      type: "ok", 
      label: "Within SLA", 
      remaining: hoursRemaining >= 24 
        ? `${Math.floor(hoursRemaining / 24)}d ${hoursRemaining % 24}h left`
        : `${hoursRemaining}h left`
    };
  }, [slaDeadline, status, resolvedAt]);

  if (!slaStatus) return null;

  const config = {
    met: {
      icon: <CheckCircle className="h-3 w-3" />,
      className: "bg-green-500/10 text-green-600 border-green-500/30",
    },
    breached: {
      icon: <XCircle className="h-3 w-3" />,
      className: "bg-red-500/10 text-red-600 border-red-500/30",
    },
    critical: {
      icon: <AlertTriangle className="h-3 w-3" />,
      className: "bg-red-500/10 text-red-600 border-red-500/30 animate-pulse",
    },
    warning: {
      icon: <Clock className="h-3 w-3" />,
      className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
    },
    ok: {
      icon: <Clock className="h-3 w-3" />,
      className: "bg-green-500/10 text-green-600 border-green-500/30",
    },
  };

  const statusConfig = config[slaStatus.type as keyof typeof config];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`gap-1 ${statusConfig.className}`}>
            {statusConfig.icon}
            {slaStatus.remaining || slaStatus.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{slaStatus.label}</p>
          {slaDeadline && (
            <p className="text-xs text-muted-foreground">
              Deadline: {new Date(slaDeadline).toLocaleString()}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default SLAIndicator;
