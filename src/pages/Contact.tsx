import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Phone, MapPin, Clock, MessageSquare, Users } from "lucide-react";

const Contact = () => {
  const contactInfo = [
    {
      icon: Mail,
      title: "Email Us",
      details: ["support@acecompliantmanagement.edu", "admin@acecompliantmanagement.edu"],
      description: "We typically respond within 24 hours",
    },
    {
      icon: Phone,
      title: "Call Us",
      details: ["+91 1234 567 890", "+91 9876 543 210"],
      description: "Available Mon-Fri, 9AM - 5PM",
    },
    {
      icon: MapPin,
      title: "Visit Us",
      details: ["Administrative Block", "Room 101, Ground Floor"],
      description: "Campus Main Building",
    },
    {
      icon: Clock,
      title: "Office Hours",
      details: ["Monday - Friday: 9:00 AM - 5:00 PM", "Saturday: 10:00 AM - 2:00 PM"],
      description: "Closed on Sundays and holidays",
    },
  ];

  const departments = [
    {
      name: "Academic Affairs",
      email: "academic@acecompliantmanagement.edu",
      phone: "+91 1234 567 001",
      head: "Dr. Arulselvam M.",
    },
    {
      name: "Infrastructure",
      email: "infrastructure@acecompliantmanagement.edu",
      phone: "+91 1234 567 003",
      head: "Mrs. Meenakshi S.",
    },
    {
      name: "Administration",
      email: "admin@acecompliantmanagement.edu",
      phone: "+91 1234 567 004",
      head: "Mrs. Anitha Rajasekaran S.",
    },
    {
      name: "Library Services",
      email: "library@acecompliantmanagement.edu",
      phone: "+91 1234 567 005",
      head: "Dr. Senthil Kumar A.",
    },
    {
      name: "Sports Department",
      email: "sports@acecompliantmanagement.edu",
      phone: "+91 1234 567 006",
      head: "Mr. Karthikeyan P.",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1 py-12">
        <div className="container">
          {/* Hero Section */}
          <div className="mb-12 text-center animate-slide-up">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
              <MessageSquare className="h-4 w-4" />
              Get in Touch
            </div>
            <h1 className="mb-4 text-4xl font-bold text-foreground md:text-5xl">
              Contact <span className="text-gradient">Us</span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Have questions? Need assistance? Reach out to us through any of the channels below.
              We're here to help!
            </p>
          </div>

          {/* Contact Cards */}
          <div className="mb-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {contactInfo.map((item, index) => (
              <Card
                key={item.title}
                className="group border-border/50 transition-all duration-300 hover:border-primary/30 hover:shadow-lg animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardContent className="p-6">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <item.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mb-2 font-semibold text-foreground">{item.title}</h3>
                  {item.details.map((detail, i) => (
                    <p key={i} className="text-sm text-foreground/80">{detail}</p>
                  ))}
                  <p className="mt-2 text-xs text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Department Contacts */}
          <div className="animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <div className="mb-8 text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-muted-foreground">
                <Users className="h-4 w-4 text-primary" />
                Department Contacts
              </div>
              <h2 className="text-2xl font-bold text-foreground md:text-3xl">
                Reach Out to Specific Departments
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {departments.map((dept, index) => (
                <Card
                  key={dept.name}
                  className="border-border/50 transition-all duration-300 hover:border-primary/30 hover:shadow-md animate-fade-in"
                  style={{ animationDelay: `${0.4 + index * 0.05}s` }}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-semibold text-foreground">
                      {dept.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">Head:</span> {dept.head}
                    </p>
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">Email:</span>{" "}
                      <a href={`mailto:${dept.email}`} className="text-primary hover:underline">
                        {dept.email}
                      </a>
                    </p>
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">Phone:</span> {dept.phone}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Contact;
