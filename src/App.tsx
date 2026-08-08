import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import Index from "./pages/Index";
import Complaint from "./pages/Complaint";
import Contact from "./pages/Contact";
import TrackComplaint from "./pages/TrackComplaint";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import DepartmentDashboard from "./pages/DepartmentDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import TutorDashboard from "./pages/TutorDashboard";
import HODDashboard from "./pages/HODDashboard";
import PrincipalDashboard from "./pages/PrincipalDashboard";
import NotFound from "./pages/NotFound";
import LiveChat from "./pages/LiveChat";
import AdminFeedback from "./pages/AdminFeedback";
import AIChatbot from "./components/chat/AIChatbot";
import LiveChatButton from "./components/chat/LiveChatButton";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/complaint" element={<Complaint />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/track" element={<TrackComplaint />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/my-complaints" element={<StudentDashboard />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/admin" element={<SuperAdminDashboard />} />
              <Route path="/department" element={<DepartmentDashboard />} />
              <Route path="/tutor" element={<TutorDashboard />} />
              <Route path="/hod" element={<HODDashboard />} />
              <Route path="/principal" element={<PrincipalDashboard />} />
              <Route path="/admin/feedback" element={<AdminFeedback />} />
              <Route path="/chat" element={<LiveChat />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <LiveChatButton />
            <AIChatbot />
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
