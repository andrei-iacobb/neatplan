import React from "react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowRight, CheckCircle, Sparkles, Shield, Clock, Users } from "lucide-react"

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b sticky top-0 z-50 bg-background/80 backdrop-blur-sm">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              CleanTrack
            </span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" className="hover:bg-primary/10">Login</Button>
            </Link>
            <Link href="/register">
              <Button className="bg-primary hover:bg-primary/90">Get Started</Button>
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <section className="py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-2 lg:gap-12 xl:grid-cols-2">
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    Streamline Your Room Cleaning Operations
                  </h1>
                  <p className="max-w-[600px] text-muted-foreground md:text-xl">
                    CleanTrack helps you manage cleaning staff, track cleaning tasks, and ensure quality service for
                    your properties.
                  </p>
                </div>
                <div className="flex flex-col gap-2 min-[400px]:flex-row">
                  <Link href="/register">
                    <Button size="lg" className="gap-1 bg-primary hover:bg-primary/90">
                      Get Started <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/login">
                    <Button size="lg" variant="outline" className="hover:bg-primary/10">
                      Login
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="flex items-center justify-center">
                <div className="relative h-[350px] w-full overflow-hidden rounded-xl bg-muted card-hover">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="grid grid-cols-2 gap-4 p-4">
                      <div className="flex h-24 items-center justify-center rounded-lg bg-background/80 backdrop-blur-sm p-4 shadow-sm card-hover">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-primary">15+</div>
                          <div className="text-sm text-muted-foreground">Staff Members</div>
                        </div>
                      </div>
                      <div className="flex h-24 items-center justify-center rounded-lg bg-background/80 backdrop-blur-sm p-4 shadow-sm card-hover">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-primary">98%</div>
                          <div className="text-sm text-muted-foreground">Satisfaction</div>
                        </div>
                      </div>
                      <div className="flex h-24 items-center justify-center rounded-lg bg-background/80 backdrop-blur-sm p-4 shadow-sm card-hover">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-primary">24/7</div>
                          <div className="text-sm text-muted-foreground">Support</div>
                        </div>
                      </div>
                      <div className="flex h-24 items-center justify-center rounded-lg bg-background/80 backdrop-blur-sm p-4 shadow-sm card-hover">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-primary">100+</div>
                          <div className="text-sm text-muted-foreground">Rooms</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-12 md:py-24 lg:py-32 bg-muted/50">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 md:grid-cols-3">
              <div className="flex flex-col items-center space-y-4 p-6 rounded-lg bg-background/80 backdrop-blur-sm card-hover">
                <Sparkles className="h-12 w-12 text-primary" />
                <h3 className="text-xl font-bold">Smart Scheduling</h3>
                <p className="text-center text-muted-foreground">
                  Automatically assign and optimize cleaning schedules based on staff availability and room status.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 p-6 rounded-lg bg-background/80 backdrop-blur-sm card-hover">
                <Shield className="h-12 w-12 text-primary" />
                <h3 className="text-xl font-bold">Quality Control</h3>
                <p className="text-center text-muted-foreground">
                  Ensure consistent cleaning standards with our comprehensive quality control system.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 p-6 rounded-lg bg-background/80 backdrop-blur-sm card-hover">
                <Clock className="h-12 w-12 text-primary" />
                <h3 className="text-xl font-bold">Real-time Updates</h3>
                <p className="text-center text-muted-foreground">
                  Get instant notifications and updates on cleaning progress and room status.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t py-6 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} CleanTrack. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
