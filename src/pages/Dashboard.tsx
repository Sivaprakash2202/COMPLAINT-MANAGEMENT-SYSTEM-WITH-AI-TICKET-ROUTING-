import { useState } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ComplaintCard, { Complaint } from "@/components/complaints/ComplaintCard";
import StatCard from "@/components/complaints/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Clock, CheckCircle2, AlertTriangle, Search, Filter, TrendingUp } from "lucide-react";

const Dashboard = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Sample data - in production, this would come from the backend
  const complaints: Complaint[] = [
    {
      id: "CMP-2024-001",
      title: "Library Air Conditioning Not Working",
      description: "The AC in the main library reading hall has been non-functional for the past week, making it difficult to study during afternoon hours.",
      category: "infrastructure",
      status: "in-progress",
      department: "Maintenance Dept.",
      submittedBy: "John Doe",
      submittedAt: "2 hours ago",
      priority: "high",
    },
    {
      id: "CMP-2024-002",
      title: "Delayed Exam Results for CS301",
      description: "The mid-term exam results for CS301 - Data Structures have not been published despite it being 3 weeks since the exam.",
      category: "academic",
      status: "pending",
      department: "Computer Science",
      submittedBy: "Jane Smith",
      submittedAt: "5 hours ago",
      priority: "medium",
    },
    {
      id: "CMP-2024-004",
      title: "Scholarship Disbursement Delay",
      description: "Merit scholarship for the current semester has not been credited despite approval confirmation 2 months ago.",
      category: "administration",
      status: "resolved",
      department: "Finance Office",
      submittedBy: "Sarah Williams",
      submittedAt: "3 days ago",
      priority: "medium",
    },
    {
      id: "CMP-2024-005",
      title: "Lab Equipment Malfunction",
      description: "Multiple workstations in Physics Lab 2 have faulty oscilloscopes affecting practical sessions.",
      category: "infrastructure",
      status: "pending",
      department: "Physics Dept.",
      submittedBy: "Alex Brown",
      submittedAt: "4 days ago",
      priority: "medium",
    },
  ];

  const filteredComplaints = complaints.filter((complaint) => {
    const matchesSearch = complaint.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      complaint.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || complaint.status === statusFilter;
    const matchesCategory = categoryFilter === "all" || complaint.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const stats = {
    total: complaints.length,
    pending: complaints.filter(c => c.status === "pending").length,
    inProgress: complaints.filter(c => c.status === "in-progress").length,
    resolved: complaints.filter(c => c.status === "resolved").length,
    urgent: complaints.filter(c => c.status === "urgent").length,
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      
      <main className="flex-1 py-8">
        <div className="container">
          {/* Page Header */}
          <div className="mb-8 animate-fade-in">
            <h1 className="mb-2 text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">
              Track and manage all complaints in real-time
            </p>
          </div>

          {/* Stats Grid */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard
              title="Total Complaints"
              value={stats.total}
              subtitle="All time"
              icon={FileText}
              variant="primary"
            />
            <StatCard
              title="Pending"
              value={stats.pending}
              subtitle="Awaiting review"
              icon={Clock}
              variant="warning"
            />
            <StatCard
              title="In Progress"
              value={stats.inProgress}
              subtitle="Being addressed"
              icon={TrendingUp}
              variant="accent"
            />
            <StatCard
              title="Resolved"
              value={stats.resolved}
              subtitle="Successfully closed"
              icon={CheckCircle2}
              variant="success"
              trend={{ value: 12, isPositive: true }}
            />
            <StatCard
              title="Urgent"
              value={stats.urgent}
              subtitle="Needs attention"
              icon={AlertTriangle}
              variant="default"
            />
          </div>

          {/* Filters and Search */}
          <div className="mb-6 flex flex-col gap-4 rounded-xl border border-border/50 bg-card p-4 sm:flex-row sm:items-center animate-fade-in">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search complaints..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="academic">Academic</SelectItem>
                  <SelectItem value="infrastructure">Infrastructure</SelectItem>
                  <SelectItem value="administration">Administration</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Complaints Tabs */}
          <Tabs defaultValue="all" className="animate-fade-in">
            <TabsList className="mb-6 h-auto flex-wrap gap-2 bg-transparent p-0">
              <TabsTrigger
                value="all"
                className="rounded-lg border border-border/50 bg-card data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                All ({stats.total})
              </TabsTrigger>
              <TabsTrigger
                value="pending"
                className="rounded-lg border border-border/50 bg-card data-[state=active]:border-warning data-[state=active]:bg-warning data-[state=active]:text-warning-foreground"
              >
                Pending ({stats.pending})
              </TabsTrigger>
              <TabsTrigger
                value="in-progress"
                className="rounded-lg border border-border/50 bg-card data-[state=active]:border-accent data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
              >
                In Progress ({stats.inProgress})
              </TabsTrigger>
              <TabsTrigger
                value="resolved"
                className="rounded-lg border border-border/50 bg-card data-[state=active]:border-success data-[state=active]:bg-success data-[state=active]:text-success-foreground"
              >
                Resolved ({stats.resolved})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-0">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredComplaints.map((complaint, index) => (
                  <div key={complaint.id} style={{ animationDelay: `${index * 0.05}s` }}>
                    <ComplaintCard complaint={complaint} />
                  </div>
                ))}
              </div>
              {filteredComplaints.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
                  <FileText className="mb-4 h-12 w-12 text-muted-foreground/50" />
                  <p className="text-lg font-medium text-muted-foreground">No complaints found</p>
                  <p className="text-sm text-muted-foreground/70">Try adjusting your filters</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="pending" className="mt-0">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredComplaints.filter(c => c.status === "pending").map((complaint) => (
                  <ComplaintCard key={complaint.id} complaint={complaint} />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="in-progress" className="mt-0">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredComplaints.filter(c => c.status === "in-progress").map((complaint) => (
                  <ComplaintCard key={complaint.id} complaint={complaint} />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="resolved" className="mt-0">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredComplaints.filter(c => c.status === "resolved").map((complaint) => (
                  <ComplaintCard key={complaint.id} complaint={complaint} />
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Dashboard;
