import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Shield, LogIn, UserPlus, Mail, Lock, User, ArrowLeft, KeyRound, CheckCircle2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const emailSchema = z.string().email("Invalid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");
const nameSchema = z.string().min(2, "Name must be at least 2 characters");

const Auth = () => {
  const navigate = useNavigate();
  const { user, role, signIn, signUp, isLoading } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("login");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
  });
  const [errors, setErrors] = useState({
    email: "",
    password: "",
    fullName: "",
  });

  useEffect(() => {
    if (!isLoading && user && role) {
      const roleRoutes: Record<string, string> = {
        super_admin: "/admin",
        department_admin: "/department",
        tutor: "/tutor",
        hod: "/hod",
        principal: "/principal",
        student: "/my-complaints",
      };
      
      const route = roleRoutes[role] || "/";
      navigate(route);
    }
  }, [user, role, isLoading, navigate]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validateForm = () => {
    const newErrors = { email: "", password: "", fullName: "" };
    let isValid = true;

    try {
      emailSchema.parse(formData.email);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.email = e.errors[0].message;
        isValid = false;
      }
    }

    try {
      passwordSchema.parse(formData.password);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.password = e.errors[0].message;
        isValid = false;
      }
    }

    if (activeTab === "signup") {
      try {
        nameSchema.parse(formData.fullName);
      } catch (e) {
        if (e instanceof z.ZodError) {
          newErrors.fullName = e.errors[0].message;
          isValid = false;
        }
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    const { error } = await signIn(formData.email, formData.password);
    setIsSubmitting(false);

    if (error) {
      toast({
        title: "Login Failed",
        description: error.message === "Invalid login credentials" 
          ? "Invalid email or password. Please try again."
          : error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Welcome back!",
        description: "You have been logged in successfully.",
      });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    const { error } = await signUp(formData.email, formData.password, formData.fullName);
    setIsSubmitting(false);

    if (error) {
      toast({
        title: "Signup Failed",
        description: error.message.includes("already registered")
          ? "An account with this email already exists. Please login instead."
          : error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Account Created!",
        description: "Your account has been created successfully.",
      });
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    const emailCheck = z.string().email().safeParse(resetEmail);
    if (!emailCheck.success) {
      toast({ title: "Invalid Email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    setIsResetting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${window.location.origin}/auth`,
    });
    setIsResetting(false);
    if (error) {
      toast({ title: "Reset Failed", description: error.message, variant: "destructive" });
    } else {
      setResetSent(true);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      
      <main className="flex flex-1 items-center justify-center py-12">
        <div className="container max-w-md">
          <Card className="border-border/50 shadow-lg animate-slide-up">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary shadow-glow">
                <Shield className="h-8 w-8 text-primary-foreground" />
              </div>
              <CardTitle className="text-2xl">Admin Portal</CardTitle>
              <CardDescription>
                Login to manage complaints and departments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login" className="gap-2">
                    <LogIn className="h-4 w-4" />
                    Login
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="gap-2">
                    <UserPlus className="h-4 w-4" />
                    Sign Up
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="login" className="mt-6">
                  {showForgotPassword ? (
                    <div className="space-y-4">
                      {resetSent ? (
                        <div className="text-center space-y-4 py-4">
                          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
                            <CheckCircle2 className="h-7 w-7 text-success" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">Check your inbox!</p>
                            <p className="text-sm text-muted-foreground mt-1">A password reset link has been sent to <strong>{resetEmail}</strong>.</p>
                          </div>
                          <Button variant="outline" className="w-full gap-2" onClick={() => { setShowForgotPassword(false); setResetSent(false); setResetEmail(""); }}>
                            <ArrowLeft className="h-4 w-4" /> Back to Login
                          </Button>
                        </div>
                      ) : (
                        <form onSubmit={handleForgotPassword} className="space-y-4">
                          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                            Enter your account email and we'll send you a password reset link.
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="reset-email">Email Address</Label>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                id="reset-email"
                                type="email"
                                placeholder="your@email.com"
                                value={resetEmail}
                                onChange={(e) => setResetEmail(e.target.value)}
                                className="pl-10"
                                autoFocus
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" type="button" className="flex-1 gap-2" onClick={() => setShowForgotPassword(false)}>
                              <ArrowLeft className="h-4 w-4" /> Back
                            </Button>
                            <Button type="submit" variant="hero" className="flex-1 gap-2" disabled={isResetting}>
                              {isResetting ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> : <KeyRound className="h-4 w-4" />}
                              Send Reset Link
                            </Button>
                          </div>
                        </form>
                      )}
                    </div>
                  ) : (
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="login-email">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="login-email"
                            type="email"
                            placeholder="admin@college.edu"
                            value={formData.email}
                            onChange={(e) => handleChange("email", e.target.value)}
                            className="pl-10"
                          />
                        </div>
                        {errors.email && (
                          <p className="text-xs text-destructive">{errors.email}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="login-password">Password</Label>
                          <button
                            type="button"
                            onClick={() => setShowForgotPassword(true)}
                            className="text-xs text-primary hover:underline"
                          >
                            Forgot password?
                          </button>
                        </div>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="login-password"
                            type="password"
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={(e) => handleChange("password", e.target.value)}
                            className="pl-10"
                          />
                        </div>
                        {errors.password && (
                          <p className="text-xs text-destructive">{errors.password}</p>
                        )}
                      </div>
                      <Button
                        type="submit"
                        variant="hero"
                        className="w-full gap-2"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                            Logging in...
                          </>
                        ) : (
                          <>
                            <LogIn className="h-4 w-4" />
                            Login
                          </>
                        )}
                      </Button>
                    </form>
                  )}
                </TabsContent>
                
                <TabsContent value="signup" className="mt-6">
                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Full Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="signup-name"
                          placeholder="John Doe"
                          value={formData.fullName}
                          onChange={(e) => handleChange("fullName", e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      {errors.fullName && (
                        <p className="text-xs text-destructive">{errors.fullName}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="admin@college.edu"
                          value={formData.email}
                          onChange={(e) => handleChange("email", e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      {errors.email && (
                        <p className="text-xs text-destructive">{errors.email}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="signup-password"
                          type="password"
                          placeholder="••••••••"
                          value={formData.password}
                          onChange={(e) => handleChange("password", e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      {errors.password && (
                        <p className="text-xs text-destructive">{errors.password}</p>
                      )}
                    </div>
                    <Button
                      type="submit"
                      variant="hero"
                      className="w-full gap-2"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                          Creating account...
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4" />
                          Create Account
                        </>
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Auth;
