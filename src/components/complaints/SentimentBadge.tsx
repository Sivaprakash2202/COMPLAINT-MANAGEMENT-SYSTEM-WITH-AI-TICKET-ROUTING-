import { Badge } from "@/components/ui/badge";
import { Smile, Meh, Frown, AlertTriangle, Flame } from "lucide-react";

interface SentimentBadgeProps {
  sentiment: string | null;
  score?: number | null;
  showScore?: boolean;
}

const SentimentBadge = ({ sentiment, score, showScore = false }: SentimentBadgeProps) => {
  if (!sentiment) return null;

  const config: Record<string, { icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    positive: {
      icon: <Smile className="h-3 w-3" />,
      variant: "default",
      label: "Positive",
    },
    neutral: {
      icon: <Meh className="h-3 w-3" />,
      variant: "secondary",
      label: "Neutral",
    },
    negative: {
      icon: <Frown className="h-3 w-3" />,
      variant: "outline",
      label: "Negative",
    },
    frustrated: {
      icon: <AlertTriangle className="h-3 w-3" />,
      variant: "destructive",
      label: "Frustrated",
    },
    angry: {
      icon: <Flame className="h-3 w-3" />,
      variant: "destructive",
      label: "Angry",
    },
  };

  const sentimentConfig = config[sentiment.toLowerCase()] || config.neutral;

  return (
    <Badge variant={sentimentConfig.variant} className="gap-1">
      {sentimentConfig.icon}
      {sentimentConfig.label}
      {showScore && score !== null && score !== undefined && (
        <span className="ml-1 opacity-75">
          ({(score * 100).toFixed(0)}%)
        </span>
      )}
    </Badge>
  );
};

export default SentimentBadge;
