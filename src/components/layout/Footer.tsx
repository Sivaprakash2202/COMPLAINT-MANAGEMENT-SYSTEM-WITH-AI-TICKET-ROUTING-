import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="border-t border-border/40 bg-card">
      <div className="container py-8">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary shadow-sm transition-all duration-300 group-hover:shadow-glow">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-foreground tracking-tight">
                ACE Compliant <span className="text-gradient">Management</span>
              </span>
              <span className="text-[10px] text-muted-foreground">AI-Powered Solutions</span>
            </div>
          </Link>
          
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            © {new Date().getFullYear()} ACE Compliant Management. Ensuring excellence and compliance across campus.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
