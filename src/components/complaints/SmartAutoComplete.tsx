import { useState, useEffect, useCallback } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface SmartAutoCompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  field: "title" | "description";
  category?: string;
}

export const SmartAutoComplete = ({
  value,
  onChange,
  placeholder,
  field,
  category,
}: SmartAutoCompleteProps) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const fetchSuggestions = useCallback(async (text: string) => {
    if (text.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('smart-autocomplete', {
        body: { text, field, category },
      });

      if (data?.suggestions && !error) {
        setSuggestions(data.suggestions);
        setShowSuggestions(true);
      }
    } catch (err) {
      console.error('Autocomplete error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [field, category]);

  useEffect(() => {
    if (!isTyping) {
      // If value changes but we aren't typing, clear suggestions
      if (suggestions.length > 0) {
        setSuggestions([]);
        setShowSuggestions(false);
      }
      return;
    }

    const debounceTimer = setTimeout(() => {
      if (value.length >= 3) {
        fetchSuggestions(value);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [value, fetchSuggestions, isTyping]);

  const handleInputChange = (val: string) => {
    setIsTyping(true);
    onChange(val);
  };

  const handleSelect = (suggestion: string) => {
    setIsTyping(false);
    onChange(suggestion);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const isTextArea = field === "description";

  return (
    <div className="relative">
      <div className="relative">
        {isTextArea ? (
          <textarea
            value={value}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder={placeholder}
            className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pr-10"
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder={placeholder}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pr-10"
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          />
        )}
        
        <div className="absolute right-3 top-3">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : value.length >= 3 ? (
            <Sparkles className="h-4 w-4 text-primary animate-pulse" />
          ) : null}
        </div>
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg animate-fade-in">
          <div className="p-2 border-b border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" />
              AI Suggestions
            </div>
          </div>
          <ul className="py-1 max-h-48 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <li
                key={index}
                onClick={() => handleSelect(suggestion)}
                className={cn(
                  "px-3 py-2 text-sm cursor-pointer hover:bg-muted transition-colors",
                  "border-b border-border/50 last:border-0"
                )}
              >
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
