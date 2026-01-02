/**
 * Landing page component - Modern, professional design
 */
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowRight,
  Package,
  Scissors,
  BarChart3,
  Shield,
  Zap,
  Users,
  CheckCircle,
  Star
} from "lucide-react";

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const authenticated = await isAuthenticated();
      const data = localStorage.getItem('user_role') || '';
      console.log("User Role from localStorage:", data);
      if (data.toLowerCase() === 'weight_update') {
      router.push('/weight-update');
    } else if (data.toLowerCase() === 'order_puncher'){
      router.push('/masters/orders');
    } else if (data.toLowerCase() === 'security'){
      router.push('/in-out');
    } else if (data.toLowerCase() === 'accountant'){
      router.push('/masters/orders');
    } else if (data.toLowerCase() === 'accountant2'){
      router.push('/masters/orders');
    } else if (data.toLowerCase() === 'mou'){
      router.push('/mou');
    } else if (data.toLowerCase() === 'dispatch'){
      router.push('/dispatch/history');
    } else if (data.toLowerCase() === 'sales_person'){
      router.push('/masters/orders');
    }else {
      router.push('/dashboard');
    }
    // if (authenticated) {
    //     router.push("/dashboard");
    //   }
    };
    checkAuth();
  }, [router]);

  const features = [
    {
      icon: Package,
      title: "Smart Order Management",
      description: "AI-powered message parsing transforms customer orders into actionable production plans automatically."
    },
    {
      icon: Scissors,
      title: "Cutting Optimization",
      description: "Advanced algorithms minimize material waste and maximize efficiency with intelligent cutting plans."
    },
    {
      icon: BarChart3,
      title: "Real-time Tracking",
      description: "Monitor inventory, production status, and order fulfillment with barcodes and live updates."
    }
  ];

  const benefits = [
    "Reduce material waste by up to 30%",
    "Automate order processing workflow",
    "Real-time inventory management",
    "Seamless production tracking"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="container mx-auto px-4 py-20 lg:py-32">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium animate-fade-in hover-lift">
              <Star className="w-4 h-4 animate-float" />
              Industry-Leading Paper Roll Management
            </div>

            {/* Main Heading */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight animate-slide-up">
              Streamline Your
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                {" "}Paper Roll{" "}
              </span>
              Manufacturing
            </h1>

            {/* Subtitle */}
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Transform your production workflow with AI-powered optimization, 
              real-time tracking, and intelligent waste reduction.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8 animate-fade-in">
              <Button asChild size="lg" className="text-lg px-8 py-6 rounded-xl transition-all duration-300 hover:scale-105 group relative z-10">
                <Link href="/auth/register" className="flex items-center gap-2">
                  Register
                  <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-lg px-8 py-6 rounded-xl transition-all duration-300 hover:scale-105 relative z-10">
                <Link href="/auth/login">
                  Login
                </Link>
              </Button>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap justify-center items-center gap-8 pt-12 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Enterprise Security
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                99.9% Uptime
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                500+ Companies Trust Us
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 lg:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
              Everything You Need to
              <span className="text-primary"> Optimize Production</span>
            </h2>
            <p className="text-xl text-muted-foreground">
              Powerful features designed to streamline your paper roll manufacturing 
              from order to delivery.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="group hover:shadow-xl transition-all duration-500 border-0 bg-card/50 backdrop-blur-sm hover-lift animate-fade-in hover:bg-card/80"
                style={{ animationDelay: `${index * 0.2}s` }}
              >
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-all duration-300 group-hover:scale-110">
                    <feature.icon className="w-8 h-8 text-primary transition-transform duration-300 group-hover:scale-110" />
                  </div>
                  <CardTitle className="text-xl font-semibold group-hover:text-primary transition-colors duration-300">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-center text-base leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 lg:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-8">
                <h2 className="text-3xl md:text-4xl font-bold">
                  Proven Results That
                  <span className="text-primary"> Drive Growth</span>
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Join hundreds of manufacturers who have transformed their operations 
                  with our intelligent paper roll management system.
                </p>
                <ul className="space-y-4">
                  {benefits.map((benefit, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <CheckCircle className="w-6 h-6 text-primary flex-shrink-0" />
                      <span className="text-lg">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Card className="p-8 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                <div className="text-center space-y-6">
                  <div className="text-4xl font-bold text-primary">30%</div>
                  <p className="text-lg font-medium">Average Waste Reduction</p>
                  <div className="text-4xl font-bold text-primary">50%</div>
                  <p className="text-lg font-medium">Faster Order Processing</p>
                  <div className="text-4xl font-bold text-primary">99.9%</div>
                  <p className="text-lg font-medium">System Reliability</p>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}