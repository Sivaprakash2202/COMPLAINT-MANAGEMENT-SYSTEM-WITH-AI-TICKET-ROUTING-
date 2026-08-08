import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Brain, Send, Sparkles, CheckCircle, FileText, Zap, EyeOff, Building2, Mic, MicOff, AlertCircle, Shield } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import FileUpload, { UploadedFile } from "@/components/complaints/FileUpload";
import SimilarComplaints from "@/components/complaints/SimilarComplaints";
import { SmartAutoComplete } from "@/components/complaints/SmartAutoComplete";
import AIResolutionAssistant from "@/components/complaints/AIResolutionAssistant";
import { Camera } from "lucide-react";

type DepartmentType = Database["public"]["Enums"]["department_type"];

const formSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().email("Invalid email address").max(255),
  mobile: z.string().trim().regex(/^[+]?[\d\s\-()]{7,15}$/, "Invalid mobile number").optional().or(z.literal("")),
  title: z.string().trim().min(5, "Title must be at least 5 characters").max(200),
  description: z.string().trim().min(50, "Description must be at least 50 characters").max(5000),
});

const departmentOptions: { value: DepartmentType; label: string }[] = [
  { value: "academic", label: "Academic" },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "administration", label: "Administration" },
  { value: "library", label: "Library Services" },
  { value: "sports", label: "Sports / Other Services" },
];

const Complaint = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentType | "">("");
  const [useAIRouting, setUseAIRouting] = useState(true);
  const [aiResult, setAiResult] = useState<{ department: string; priority: string; confidence: number } | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.user_metadata?.full_name || "",
    email: user?.email || "",
    mobile: "",
    title: "",
    description: "",
  });

  // Keep form in sync with user/profile if they log in/out while on page
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: prev.name || profile?.full_name || user.user_metadata?.full_name || "",
        email: prev.email || user.email || "",
        mobile: prev.mobile || profile?.phone_number || "",
      }));
    }
  }, [user, profile]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [similarCount, setSimilarCount] = useState(0);
  const [isLensAnalyzing, setIsLensAnalyzing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [urgencyScore, setUrgencyScore] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
    
    if (field === "description" || field === "title") {
      updateUrgencyScore(value);
    }
  };

  const updateUrgencyScore = (text: string) => {
    const criticalWords = ["danger", "emergency", "urgent", "broken", "leak", "fire", "safety", "hurt", "immediate", "flood", "shock"];
    const warningWords = ["bad", "issue", "problem", "waiting", "slow", "poor", "crowded"];
    
    let score = 0;
    const words = text.toLowerCase().split(/\W+/);
    
    words.forEach(word => {
      if (criticalWords.includes(word)) score += 25;
      if (warningWords.includes(word)) score += 10;
    });
    
    setUrgencyScore(Math.min(100, score));
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: "Not Supported", description: "Voice typing is not supported in your browser.", variant: "destructive" });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      handleChange("description", formData.description + " " + transcript);
    };

    recognition.start();
  };

  const handleSmartLensUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Please upload an image smaller than 5MB", variant: "destructive" });
      return;
    }

    setIsLensAnalyzing(true);
    toast({ title: "Smart Lens Analyzing...", description: "AI is looking at your image to write the complaint." });

    try {
      const base64String = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      console.log("Invoking AI analyzer via chatbot gateway...");
      const response = await supabase.functions.invoke('ai-chatbot', {
        body: { 
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: "Analyze this image for a campus complaint system. Return a JSON object with: 'title', 'description', 'department' (academic, infrastructure, administration, library, sports), and 'priority' (low, medium, high, urgent). Be concise and professional."
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${file.type || 'image/jpeg'};base64,${base64String}`
                  }
                }
              ]
            }
          ]
        }
      });

      console.log("Smart Lens Gateway Response:", response);

      if (response.error) {
        throw new Error(response.error.message);
      }

      // The ai-chatbot returns text/plain, so we parse it
      let aiData;
      try {
        const rawContent = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        console.log("Processing gateway content:", rawContent);
        
        const extractJSON = (str: string) => {
          const s = str.indexOf('{');
          const e = str.lastIndexOf('}');
          if (s !== -1 && e !== -1) {
            return JSON.parse(str.substring(s, e + 1));
          }
          return JSON.parse(str);
        };

        const firstPass = extractJSON(rawContent);
        // If the gateway wrapped it in a 'message' field (standard ai-chatbot behavior)
        if (firstPass.message && typeof firstPass.message === 'string' && firstPass.message.includes('{')) {
          console.log("Extracting nested JSON from message field...");
          aiData = extractJSON(firstPass.message);
        } else {
          aiData = firstPass;
        }
      } catch (e) {
        console.error("Failed to parse gateway response:", e, response.data);
        throw new Error("Invalid response format from AI gateway");
      }

      console.log("Parsed Smart Lens Data:", aiData);

      // Support various key naming conventions from AI
      const title = (aiData.title || aiData.Title || aiData.subject || "").trim();
      const description = (aiData.description || aiData.Description || aiData.detailed_description || aiData.content || "").trim();
      const department = (aiData.department || aiData.category || aiData.Department || aiData.Category || "").trim();
      
      console.log("Extracted fields:", { title, descriptionLength: description.length, department });

      if (title || description) {
        setFormData(prev => ({
          ...prev,
          title: title || prev.title,
          description: description || prev.description,
        }));
        
        if (department) {
          const dept = department.toLowerCase() as DepartmentType;
          const validDepts: DepartmentType[] = ["academic", "infrastructure", "administration", "library", "sports"];
          if (validDepts.includes(dept)) {
            setSelectedDepartment(dept);
            setUseAIRouting(false); // Switch to manual to show the filled department
          }
        }
      }

      toast({
        title: "Smart Lens Complete!",
        description: "We've auto-filled the form based on your image.",
        variant: "default"
      });
    } catch (error: any) {
      console.error("Smart Lens Error:", error);
      const errorMessage = error.message || "Unknown error";
      toast({ 
        title: "Analysis Failed", 
        description: `Could not analyze the image: ${errorMessage}`, 
        variant: "destructive" 
      });
    } finally {
      setIsLensAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const validateForm = () => {
    try {
      formSchema.parse(formData);
      setErrors({});
      return true;
    } catch (e) {
      if (e instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        e.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const classifyWithAI = async (): Promise<{ department: string; priority: string; confidence: number }> => {
    setIsAnalyzing(true);
    try {
      const response = await supabase.functions.invoke('classify-complaint', {
        body: { title: formData.title, description: formData.description }
      });

      if (response.error) {
        console.error('AI classification error:', response.error);
        throw new Error(response.error.message || 'Classification failed');
      }

      const result = response.data;
      setAiResult(result);
      return result;
    } catch (error) {
      console.error('Classification failed:', error);
      // Default fallback
      return { department: 'administration', priority: 'medium', confidence: 0 };
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors in the form.",
        variant: "destructive",
      });
      return;
    }

    // Validate department selection if not using AI routing
    if (!useAIRouting && !selectedDepartment) {
      toast({
        title: "Department Required",
        description: "Please select a department for your complaint.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let finalDepartment: DepartmentType;
      let finalPriority: string = "medium";

      if (useAIRouting) {
        // Step 1: AI Classification
        toast({
          title: "Analyzing your message...",
          description: "AI is classifying your complaint to route it correctly.",
        });

        const classification = await classifyWithAI();
        finalDepartment = classification.department as DepartmentType;
        finalPriority = classification.priority;

        toast({
          title: "AI Analysis Complete",
          description: `Routed to ${departmentLabels[finalDepartment]} with ${finalPriority} priority.`,
        });
      } else {
        finalDepartment = selectedDepartment as DepartmentType;
        toast({
          title: "Processing...",
          description: "Submitting your complaint.",
        });
      }

      // Step 2: Save to database
      // NOTE: We avoid `.select()` here because anonymous users don't have SELECT access to complaints.
      // We generate the id client-side so we can reference it for attachments/analysis without needing a SELECT.
      const complaintId = crypto.randomUUID();
      const { error: insertError } = await supabase.from('complaints').insert({
        id: complaintId,
        title: formData.title,
        description: formData.description,
        submitter_name: isAnonymous ? "Anonymous" : formData.name,
        submitter_email: isAnonymous ? "anonymous@college.edu" : formData.email,
        submitter_mobile: isAnonymous ? null : (formData.mobile || null),
        submitted_by: user!.id,
        category: finalDepartment,
        priority: finalPriority as any,
        status: 'pending',
      } as any);

      if (insertError) {
        console.error('Insert error:', insertError);
        throw new Error('Failed to submit complaint');
      }

      // Step 3: Save file attachments if any
      if (uploadedFiles.length > 0) {
        const attachments = uploadedFiles.map(file => ({
          complaint_id: complaintId,
          file_name: file.name,
          file_path: file.path,
          file_size: file.size,
          file_type: file.type,
        }));

        await supabase.from('complaint_attachments').insert(attachments);
      }

      // Step 4: Analyze sentiment in background
      supabase.functions.invoke('analyze-sentiment', {
        body: {
          complaint_id: complaintId,
          title: formData.title,
          description: formData.description,
        }
      }).catch(err => console.log('Sentiment analysis queued:', err));

      // Step 5: Send notification
      supabase.functions.invoke('send-notification', {
        body: {
          complaint_id: complaintId,
          notification_type: 'status_change',
          recipient_email: isAnonymous ? "anonymous@college.edu" : formData.email,
          recipient_mobile: isAnonymous ? null : (formData.mobile || null),
          recipient_name: isAnonymous ? "Anonymous User" : formData.name,
          subject: 'Complaint Received - ACE Compliant Management',
          body: `
            <h2>Your complaint has been received</h2>
            <p>Dear ${isAnonymous ? "User" : formData.name},</p>
            <p>Thank you for submitting your complaint. Here are the details:</p>
            <ul>
              <li><strong>Title:</strong> ${formData.title}</li>
              <li><strong>Department:</strong> ${departmentLabels[finalDepartment]}</li>
              <li><strong>Priority:</strong> ${finalPriority}</li>
              <li><strong>Status:</strong> Pending Review</li>
            </ul>
            <p>We will review your complaint and keep you updated via email${!isAnonymous && formData.mobile ? ' and SMS' : ''}.</p>
          `,
        }
      }).catch(err => console.log('Notification queued:', err));

      toast({
        title: "Message Submitted Successfully!",
        description: `Your complaint has been routed to the ${departmentLabels[finalDepartment]}.`,
      });

      // Reset form (keeping user details)
      setFormData(prev => ({ 
        ...prev,
        title: "", 
        description: "" 
      }));
      setAiResult(null);
      setIsAnonymous(false);
      setSelectedDepartment("");
      setUploadedFiles([]);
      setSimilarCount(0);
      
    } catch (error) {
      console.error('Submit error:', error);
      toast({
        title: "Submission Failed",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const departmentLabels: Record<string, string> = {
    academic: "Academic Department",
    infrastructure: "Infrastructure",
    administration: "Administration",
    library: "Library Services",
    sports: "Sports Department",
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
                  Please sign in to your student or faculty account to submit a complaint.
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
      
      <main className="flex-1 py-8 md:py-12">
        <div className="container max-w-3xl">
          <div className="mb-8 text-center animate-slide-up">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary animate-fade-in">
              <Zap className="h-4 w-4" />
              AI-Powered Routing
            </div>
            <h1 className="mb-3 text-3xl font-bold text-foreground md:text-4xl">
              Submit Your <span className="text-gradient">Complaint</span>
            </h1>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Describe your issue and our AI will intelligently route it to the right department for faster resolution.
            </p>
          </div>

          <Card className="border-border/50 shadow-xl animate-scale-in overflow-hidden">
            <CardHeader className="border-b border-border/40 bg-gradient-to-r from-primary/5 to-accent/5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary shadow-md">
                  <FileText className="h-6 w-6 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg">Smart Complaint Form</CardTitle>
                  <CardDescription>
                    Our AI will automatically classify and prioritize your complaint
                  </CardDescription>
                </div>
                <div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef} 
                    onChange={handleSmartLensUpload} 
                    disabled={isLensAnalyzing}
                  />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={(e) => { e.preventDefault(); fileInputRef.current?.click(); }}
                    disabled={isLensAnalyzing}
                    className="gap-2 bg-primary/10 hover:bg-primary/20 text-primary border-primary/20"
                  >
                    {isLensAnalyzing ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                    Smart Lens Auto-Fill
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Anonymous Toggle */}
                <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <EyeOff className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Submit Anonymously</p>
                      <p className="text-xs text-muted-foreground">
                        Your identity will be hidden from administrators
                      </p>
                    </div>
                  </div>
                  <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} />
                </div>

                {!isAnonymous && (
                  <div className="space-y-4 animate-fade-in">
                    <h3 className="text-sm font-medium text-muted-foreground">Your Information</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                          id="name"
                          placeholder="Enter your full name"
                          value={formData.name}
                          onChange={(e) => handleChange("name", e.target.value)}
                          required={!isAnonymous}
                        />
                        {errors.name && (
                          <p className="text-xs text-destructive">{errors.name}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="your.email@college.edu"
                          value={formData.email}
                          onChange={(e) => handleChange("email", e.target.value)}
                          required={!isAnonymous}
                        />
                        {errors.email && (
                          <p className="text-xs text-destructive">{errors.email}</p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mobile">Mobile Number <span className="text-muted-foreground text-xs">(Optional — for SMS notifications)</span></Label>
                      <Input
                        id="mobile"
                        type="tel"
                        placeholder="+91 9876543210"
                        value={formData.mobile}
                        onChange={(e) => handleChange("mobile", e.target.value)}
                      />
                      {errors.mobile && (
                        <p className="text-xs text-destructive">{errors.mobile}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Enter your mobile number to receive SMS updates about your complaint
                      </p>
                    </div>
                  </div>
                )}

                {/* Department Selection */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Department Selection
                    </h3>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="ai-routing" className="text-xs text-muted-foreground">
                        AI Auto-Routing
                      </Label>
                      <Switch
                        id="ai-routing"
                        checked={useAIRouting}
                        onCheckedChange={setUseAIRouting}
                      />
                    </div>
                  </div>

                  {!useAIRouting && (
                    <div className="space-y-2 animate-fade-in">
                      <Label htmlFor="department">Select Department</Label>
                      <Select value={selectedDepartment} onValueChange={(v) => setSelectedDepartment(v as DepartmentType)}>
                        <SelectTrigger id="department">
                          <SelectValue placeholder="Choose a department" />
                        </SelectTrigger>
                        <SelectContent>
                          {departmentOptions.map((dept) => (
                            <SelectItem key={dept.value} value={dept.value}>
                              {dept.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Select the department that best matches your complaint
                      </p>
                    </div>
                  )}

                  {useAIRouting && (
                    <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm text-muted-foreground animate-fade-in">
                      <p className="flex items-center gap-2">
                        <Brain className="h-4 w-4 text-primary" />
                        AI will automatically route your complaint to the appropriate department
                      </p>
                    </div>
                  )}
                </div>

                {/* Message Details */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground">Your Message</h3>
                  <div className="space-y-2">
                    <Label htmlFor="title">Subject</Label>
                    <SmartAutoComplete
                      value={formData.title}
                      onChange={(val) => handleChange("title", val)}
                      placeholder="Brief summary of your issue"
                      field="title"
                      category={useAIRouting ? undefined : selectedDepartment || undefined}
                    />
                    {errors.title && (
                      <p className="text-xs text-destructive">{errors.title}</p>
                    )}
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="description">Detailed Description</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={startListening}
                        className={`gap-2 h-8 ${isListening ? "text-destructive animate-pulse" : "text-primary"}`}
                      >
                        {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                        {isListening ? "Listening..." : "Voice Type"}
                      </Button>
                    </div>
                    <SmartAutoComplete
                      value={formData.description}
                      onChange={(val) => handleChange("description", val)}
                      placeholder="Please provide as much detail as possible about your issue. Include dates, locations, and any relevant information that will help us address your concern efficiently."
                      field="description"
                      category={useAIRouting ? undefined : selectedDepartment || undefined}
                    />
                    {errors.description && (
                      <p className="text-xs text-destructive">{errors.description}</p>
                    )}
                    {useAIRouting && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-primary" />
                        AI will automatically classify and route your message
                      </p>
                    )}
                    
                    {/* Urgency Radar */}
                    {urgencyScore > 0 && (
                      <div className="mt-2 space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-bold">
                          <span className={`${urgencyScore > 70 ? "text-destructive" : "text-amber-500"} flex items-center gap-1`}>
                            <AlertCircle className="h-3 w-3" />
                            Urgency Radar
                          </span>
                          <span className="text-muted-foreground">{urgencyScore}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-500 ${urgencyScore > 70 ? "bg-destructive" : urgencyScore > 40 ? "bg-amber-500" : "bg-primary"}`}
                            style={{ width: `${urgencyScore}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Tier-0 Resolution Assistant */}
                <AIResolutionAssistant 
                  query={formData.title} 
                  onSolutionAccepted={() => {
                    toast({
                      title: "Great! Issue Resolved",
                      description: "We're glad we could help you instantly. Your complaint has not been filed.",
                    });
                    navigate("/");
                  }}
                />

                {/* File Attachments */}
                <FileUpload 
                  onFilesChange={setUploadedFiles}
                  maxFiles={5}
                  maxSizeMB={10}
                />

                {/* Similar Complaints Detection */}
                {formData.title.length >= 10 && formData.description.length >= 50 && (
                  <SimilarComplaints
                    title={formData.title}
                    description={formData.description}
                    category={useAIRouting ? undefined : selectedDepartment || undefined}
                    onSimilarFound={setSimilarCount}
                  />
                )}

                {/* AI Analysis Indicator */}
                {isAnalyzing && (
                  <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 animate-fade-in">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                      <Brain className="h-4 w-4 text-primary animate-pulse" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">AI Analyzing Your Message...</p>
                      <p className="text-xs text-muted-foreground">Classifying content and determining optimal routing</p>
                    </div>
                  </div>
                )}

                {/* AI Result */}
                {aiResult && !isAnalyzing && (
                  <div className="flex items-center gap-3 rounded-lg border border-success/20 bg-success/5 p-4 animate-fade-in">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/10">
                      <CheckCircle className="h-4 w-4 text-success" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Routed to: {departmentLabels[aiResult.department] || aiResult.department}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Priority: {aiResult.priority} • Confidence: {Math.round(aiResult.confidence * 100)}%
                      </p>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/")}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="hero"
                    disabled={isSubmitting || !formData.title || !formData.description || formData.description.length < 50}
                    className="gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Send Message
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Tips Card */}
          <Card className="mt-6 border-border/50 bg-card/50 animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <CardContent className="p-6">
              <h3 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
                <CheckCircle className="h-5 w-5 text-success" />
                Tips for Faster Resolution
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Be specific about dates, times, and locations when applicable
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Include relevant reference numbers (room number, course code, etc.)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Describe the impact of the issue on your academic life
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Suggest potential solutions if you have any
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Complaint;
