import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, X, ArrowRight, Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AIResolutionAssistantProps {
  query: string;
  onSolutionAccepted: () => void;
}

const AIResolutionAssistant = ({ query, onSolutionAccepted }: AIResolutionAssistantProps) => {
  const [match, setMatch] = useState<{ question: string; answer: string; similarity: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 10) {
        searchKnowledgeBase();
      } else {
        setMatch(null);
        setIsVisible(false);
      }
    }, 800); // 800ms debounce

    return () => clearTimeout(timer);
  }, [query]);

  const searchKnowledgeBase = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("knowledge-base-search", {
        body: { query }
      });

      if (!error && data?.match && data.match.similarity > 0.8) {
        setMatch(data.match);
        setIsVisible(true);
      } else {
        setMatch(null);
        setIsVisible(false);
      }
    } catch (err) {
      console.error("Knowledge base search failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!match || !isVisible) return null;

  return (
    <Card className="border-primary/30 bg-primary/5 shadow-lg animate-slide-up mb-6 overflow-hidden">
      <CardHeader className="pb-2 bg-primary/10">
        <CardTitle className="text-md flex items-center gap-2 text-primary">
          <Sparkles className="h-5 w-5 fill-primary/20" />
          Wait! We found an instant solution
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="rounded-lg bg-background border border-border p-4 shadow-sm">
          <div className="flex items-start gap-3">
             <div className="mt-1 h-6 w-6 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <Check className="h-4 w-4 text-green-600" />
             </div>
             <div>
                <p className="font-semibold text-sm mb-1">{match.question}</p>
                <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {match.answer}
                </div>
             </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button 
            onClick={onSolutionAccepted} 
            className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white border-none shadow-md"
          >
            <Check className="h-4 w-4" />
            This solved my problem
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setIsVisible(false)}
            className="flex-1 gap-2 border-primary/20 hover:bg-primary/5"
          >
            <ArrowRight className="h-4 w-4" />
            Still need to file complaint
          </Button>
        </div>
        
        <p className="text-[10px] text-center text-muted-foreground italic">
          Helpful hint: Our AI knowledge base covers Wi-Fi, IDs, Library, and and common campus queries.
        </p>
      </CardContent>
    </Card>
  );
};

export default AIResolutionAssistant;
