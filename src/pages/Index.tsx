import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { ArrowRight, Brain, Clock, Shield, BarChart3, CheckCircle2, Zap, Sparkles, FileText, Users, Star, MessageCircle } from "lucide-react";

const Index = () => {

  const features = [
    {
      icon: Brain,
      title: "AI-Powered Routing",
      description: "Machine learning algorithms automatically classify and route complaints to the right department.",
    },
    {
      icon: Clock,
      title: "Faster Resolution",
      description: "Reduce response time by up to 60% with intelligent ticket prioritization and assignment.",
    },
    {
      icon: Shield,
      title: "Transparent Tracking",
      description: "Real-time status updates keep students informed throughout the resolution process.",
    },
    {
      icon: BarChart3,
      title: "Analytics Dashboard",
      description: "Comprehensive insights help administrators identify patterns and improve services.",
    },
  ];

  const categories = [
    { name: "Academic", color: "bg-primary/10 text-primary border-primary/20" },
    { name: "Infrastructure", color: "bg-accent/10 text-accent border-accent/20" },
    { name: "Administration", color: "bg-secondary text-secondary-foreground border-border" },
    { name: "Other Services", color: "bg-warning/10 text-warning border-warning/20" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-border/40">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
          <div className="absolute top-20 left-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute bottom-20 right-10 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
          
          <div className="container relative py-20 md:py-32">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-muted-foreground animate-fade-in">
                <Zap className="h-4 w-4 text-primary" />
                AI-Powered Campus Solutions
              </div>
              
              <h1 className="mb-6 text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl animate-slide-up">
                AI-Powered Campus Complaint Resolution
              </h1>
              
              <p className="mb-10 text-lg text-muted-foreground md:text-xl animate-slide-up" style={{ animationDelay: "0.1s" }}>
                Submit, track, and resolve complaints efficiently with our intelligent system
              </p>
              
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row animate-slide-up" style={{ animationDelay: "0.2s" }}>
                <Link to="/complaint">
                  <Button variant="hero" size="xl" className="gap-2 group shadow-xl hover:shadow-glow transition-all duration-300">
                    <FileText className="h-5 w-5 transition-transform group-hover:rotate-6" />
                    Submit Complaint
                    <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
              </div>

              {/* Trust Badges */}
              <div className="mt-12 flex flex-wrap items-center justify-center gap-6 animate-fade-in" style={{ animationDelay: "0.4s" }}>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">10,000+ Students</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Star className="h-5 w-5 text-warning" />
                  <span className="text-sm font-medium">98% Resolution Rate</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-5 w-5 text-success" />
                  <span className="text-sm font-medium">24h Avg Response</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Categories Section */}
        <section className="border-b border-border/40 bg-card/50 py-12">
          <div className="container">
            <p className="mb-6 text-center text-sm font-medium text-muted-foreground">
              Handling complaints across all departments
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {categories.map((category, index) => (
                <div
                  key={category.name}
                  className={`rounded-full border px-4 py-2 text-sm font-medium ${category.color} animate-fade-in`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  {category.name}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 md:py-28">
          <div className="container">
            <div className="mx-auto mb-16 max-w-2xl text-center">
              <h2 className="mb-4 text-3xl font-bold text-foreground sm:text-4xl">
                Why Choose ACE Compliant Management?
              </h2>
              <p className="text-lg text-muted-foreground">
                Built specifically for educational institutions, our platform combines 
                cutting-edge AI with intuitive design.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {features.map((feature, index) => (
                <div
                  key={feature.title}
                  className="group relative rounded-2xl border border-border/50 bg-card p-6 transition-all duration-300 hover:border-primary/30 hover:shadow-lg animate-fade-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mb-2 font-semibold text-foreground">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="border-t border-border/40 bg-card/50 py-20 md:py-28">
          <div className="container">
            <div className="mx-auto mb-16 max-w-2xl text-center">
              <h2 className="mb-4 text-3xl font-bold text-foreground sm:text-4xl">
                How It Works
              </h2>
              <p className="text-lg text-muted-foreground">
                From submission to resolution in three simple steps.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              {[
                {
                  step: "01",
                  title: "Submit Your Complaint",
                  description: "Fill out a simple form describing your issue. Our AI analyzes the text automatically.",
                },
                {
                  step: "02",
                  title: "AI Routes to Department",
                  description: "Machine learning classifies your complaint and assigns it to the appropriate authority.",
                },
                {
                  step: "03",
                  title: "Track & Get Resolved",
                  description: "Monitor progress in real-time. Receive updates until your issue is fully resolved.",
                },
              ].map((item, index) => (
                <div key={item.step} className="relative animate-fade-in" style={{ animationDelay: `${index * 0.15}s` }}>
                  <div className="mb-4 inline-block rounded-lg gradient-primary px-3 py-1 text-sm font-bold text-primary-foreground">
                    Step {item.step}
                  </div>
                  <h3 className="mb-2 text-xl font-semibold text-foreground">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                  {index < 2 && (
                    <ArrowRight className="absolute right-0 top-8 hidden h-6 w-6 text-muted-foreground/30 lg:block" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Live Chat Section */}
        <section className="py-20 md:py-28">
          <div className="container">
            <div className="mx-auto max-w-4xl">
              <div className="grid gap-8 md:grid-cols-2 items-center">
                <div className="animate-fade-in">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
                    <MessageCircle className="h-4 w-4" />
                    In-App Live Chat
                  </div>
                  <h2 className="mb-4 text-3xl font-bold text-foreground sm:text-4xl">
                    Real-Time Communication
                  </h2>
                  <p className="mb-6 text-lg text-muted-foreground">
                    Chat directly with Tutors, HODs, and the Principal about your complaints. 
                    Get instant updates and resolve issues faster through live messaging.
                  </p>
                  <ul className="space-y-3 mb-8">
                    {[
                      "Direct messaging with assigned administrators",
                      "Real-time message delivery & read receipts",
                      "Complete conversation history for every complaint",
                    ].map((item, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Link to="/complaint">
                    <Button variant="hero" size="lg" className="gap-2 group">
                      <MessageCircle className="h-5 w-5" />
                      Submit & Start Chatting
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </Link>
                </div>
                <div className="relative animate-fade-in" style={{ animationDelay: "0.2s" }}>
                  <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-xl">
                    <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border/50">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <MessageCircle className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-sm">Live Chat</p>
                        <p className="text-xs text-muted-foreground">Complaint #CR-2024-0012</p>
                      </div>
                      <div className="ml-auto flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-xs text-green-600 font-medium">Online</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-end">
                        <div className="rounded-xl rounded-br-sm bg-primary/10 px-4 py-2 max-w-[80%]">
                          <p className="text-sm text-foreground">The AC in Room 204 hasn't been working for 3 days now.</p>
                          <p className="text-[10px] text-muted-foreground mt-1 text-right">10:30 AM</p>
                        </div>
                      </div>
                      <div className="flex justify-start">
                        <div className="rounded-xl rounded-bl-sm bg-muted px-4 py-2 max-w-[80%]">
                          <p className="text-xs font-medium text-primary mb-1">Tutor - Mrs. A. Lavanya</p>
                          <p className="text-sm text-foreground">I've forwarded this to maintenance. They'll inspect it by tomorrow.</p>
                          <p className="text-[10px] text-muted-foreground mt-1">10:32 AM</p>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <div className="rounded-xl rounded-br-sm bg-primary/10 px-4 py-2 max-w-[80%]">
                          <p className="text-sm text-foreground">Thank you! 🙏</p>
                          <p className="text-[10px] text-muted-foreground mt-1 text-right">10:33 AM</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 md:py-28">
          <div className="container">
            <div className="relative overflow-hidden rounded-3xl gradient-hero p-8 text-center md:p-16">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
              <div className="relative">
                <CheckCircle2 className="mx-auto mb-6 h-16 w-16 text-primary-foreground/80" />
                <h2 className="mb-4 text-3xl font-bold text-primary-foreground sm:text-4xl">
                  Ready to Transform Your Campus?
                </h2>
                <p className="mx-auto mb-8 max-w-xl text-lg text-primary-foreground/80">
                  Join hundreds of institutions using AI-powered complaint management 
                  to improve student satisfaction.
                </p>
              <Link to="/complaint">
                  <Button size="xl" className="bg-background text-foreground hover:bg-background/90 shadow-xl group">
                    Get Started Now
                    <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
