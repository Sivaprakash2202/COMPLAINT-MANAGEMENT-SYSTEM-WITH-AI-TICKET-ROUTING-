import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, ChevronDown, ChevronUp, Loader2, Link2, ThumbsUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface SimilarComplaint {
  id: string;
  title: string;
  status: string;
  similarity_score: number;
  created_at: string;
}

interface SimilarComplaintsProps {
  title: string;
  description: string;
  category?: string;
  excludeId?: string;
  onSimilarFound?: (count: number) => void;
}

const SimilarComplaints = ({ 
  title, 
  description, 
  category, 
  excludeId,
  onSimilarFound 
}: SimilarComplaintsProps) => {
  const [similar, setSimilar] = useState<SimilarComplaint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [searched, setSearched] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const [upvotingMap, setUpvotingMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Reset when inputs change significantly
    if (title.length < 10 || description.length < 50) {
      setSimilar([]);
      setSearched(false);
      return;
    }

    // Debounce the search
    const timer = setTimeout(() => {
      findSimilar();
    }, 1000);

    return () => clearTimeout(timer);
  }, [title, description, category]);

  const findSimilar = async () => {
    if (title.length < 10 || description.length < 50) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-duplicates", {
        body: { title, description, category, exclude_id: excludeId },
      });

      if (error) {
        console.error("Failed to find similar:", error);
        return;
      }

      const similarComplaints = data?.duplicates || [];
      // Map returned data to SimilarComplaint interface
      const mappedComplaints = similarComplaints.map((c: any) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        similarity_score: c.similarity,
        created_at: new Date().toISOString() // Fallback if created_at not returned
      }));

      setSimilar(mappedComplaints);
      setSearched(true);
      onSimilarFound?.(mappedComplaints.length);

      if (mappedComplaints.length > 0) {
        setIsExpanded(true);
      }
    } catch (error) {
      console.error("Error finding similar complaints:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpvote = async (complaintId: string) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please login to upvote a complaint.",
        variant: "destructive"
      });
      return;
    }

    setUpvotingMap(prev => ({ ...prev, [complaintId]: true }));
    try {
      const { error } = await supabase.from('complaint_upvotes').insert({
        complaint_id: complaintId,
        user_id: user.id
      });

      if (error) {
        // Handle unique constraint violation (already upvoted)
        if (error.code === '23505') {
           toast({
             title: "Already Upvoted",
             description: "You have already registered your issue on this megathread.",
             variant: "default"
           });
        } else {
           throw error;
        }
      } else {
        toast({
          title: "Successfully Linked",
          description: "You've successfully added yourself to this existing issue.",
          variant: "default"
        });
      }
    } catch (err) {
      console.error("Failed to upvote:", err);
      toast({
        title: "Failed to link",
        description: "An error occurred while linking your issue.",
        variant: "destructive"
      });
    } finally {
      setUpvotingMap(prev => ({ ...prev, [complaintId]: false }));
    }
  };

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-600",
    in_progress: "bg-blue-500/10 text-blue-600",
    resolved: "bg-green-500/10 text-green-600",
    rejected: "bg-red-500/10 text-red-600",
  };

  if (!searched && !isLoading) return null;

  return (
    <Card className={`border-border/50 ${similar.length > 0 ? "border-warning/50 bg-warning/5" : ""}`}>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : similar.length > 0 ? (
              <AlertCircle className="h-4 w-4 text-warning" />
            ) : (
              <Link2 className="h-4 w-4 text-muted-foreground" />
            )}
            <CardTitle className="text-sm font-medium">
              {isLoading 
                ? "Checking for similar complaints..." 
                : similar.length > 0 
                  ? `${similar.length} similar issue(s) already exist (Megathread)`
                  : "No similar complaints found"
              }
            </CardTitle>
          </div>
          {similar.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0"
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </CardHeader>

      {isExpanded && similar.length > 0 && (
        <CardContent className="pt-0 px-4 pb-4">
          <p className="text-xs text-muted-foreground mb-3">
            Wait! Others have already reported similar issues. Instead of creating a new ticket, you can join the "Megathread" below:
          </p>
          <div className="space-y-2">
            {similar.map((complaint) => (
              <div
                key={complaint.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background p-3"
              >
                <div className="min-w-0 flex-1 pr-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">
                      {complaint.title}
                    </p>
                    <span className="text-xs font-semibold text-warning bg-warning/10 px-2 py-0.5 rounded-full">
                      {Math.round(complaint.similarity_score * 100)}% match
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className={statusColors[complaint.status]}>
                      {complaint.status.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
                <div className="ml-4 flex-shrink-0">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="gap-2 border-primary/20 text-primary hover:bg-primary/10"
                    onClick={() => handleUpvote(complaint.id)}
                    disabled={upvotingMap[complaint.id]}
                  >
                    {upvotingMap[complaint.id] ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <ThumbsUp className="h-3 w-3" />
                    )}
                    Upvote Instead
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default SimilarComplaints;
