import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Star, MessageSquare, User, Calendar, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AdminHeader from "@/components/admin/AdminHeader";
import Footer from "@/components/layout/Footer";

interface Feedback {
  id: string;
  title: string;
  submitter_name: string;
  satisfaction_rating: number;
  satisfaction_feedback: string | null;
  resolved_at: string | null;
  updated_at: string;
  category: string;
}

const AdminFeedback = () => {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchFeedback = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from("complaints")
        .select("id, title, submitter_name, satisfaction_rating, satisfaction_feedback, resolved_at, updated_at, category")
        .not("satisfaction_rating", "is", null)
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("Error fetching feedback:", error);
      } else {
        setFeedbacks((data || []) as unknown as Feedback[]);
      }
      setIsLoading(false);
    };

    fetchFeedback();
  }, [user]);

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AdminHeader title="User Feedback" subtitle="View ratings and comments from resolved complaints" />
      
      <main className="flex-1 py-8">
        <div className="container max-w-5xl">
          <div className="mb-6 flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="animate-pulse border-border/50">
                  <CardHeader className="h-24 bg-muted/50" />
                  <CardContent className="h-32" />
                </Card>
              ))}
            </div>
          ) : feedbacks.length === 0 ? (
            <Card className="border-border/50 border-dashed py-12 text-center">
              <CardContent>
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
                <h3 className="text-lg font-semibold">No feedback yet</h3>
                <p className="text-muted-foreground">Once users rate resolved complaints, they will appear here.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {feedbacks.map((fb) => (
                <Card key={fb.id} className="border-border/50 hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-1">
                        <CardTitle className="text-base line-clamp-1">{fb.title}</CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {fb.category}
                          </Badge>
                          {renderStars(fb.satisfaction_rating)}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {fb.satisfaction_feedback ? (
                      <div className="rounded-lg bg-muted/50 p-3 italic text-sm relative">
                        <span className="absolute -top-2 -left-1 text-2xl text-primary/20 leading-none">"</span>
                        {fb.satisfaction_feedback}
                        <span className="absolute -bottom-4 -right-1 text-2xl text-primary/20 leading-none">"</span>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No written comments provided.</p>
                    )}
                    
                    <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3 w-3" />
                        {fb.submitter_name}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        {fb.resolved_at ? `Resolved: ${new Date(fb.resolved_at).toLocaleDateString()}` : `Rated on: ${new Date(fb.updated_at).toLocaleDateString()}`}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AdminFeedback;
