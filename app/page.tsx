import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowRight, CheckCircle } from "lucide-react"

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">CleanTrack</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Login</Button>
            </Link>
            <Link href="/register">
              <Button>Get Started</Button>
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
                  <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                    Streamline Your Housekeeping Operations
                  </h1>
                  <p className="max-w-[600px] text-muted-foreground md:text-xl">
                    CleanTrack helps you manage housekeeping staff, track cleaning tasks, and ensure quality service for
                    your properties.
                  </p>
                </div>
                <div className="flex flex-col gap-2 min-[400px]:flex-row">
                  <Link href="/register">
                    <Button size="lg" className="gap-1">
                      Get Started <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/login">
                    <Button size="lg" variant="outline">
                      Login
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="flex items-center justify-center">
                <div className="relative h-[350px] w-full overflow-hidden rounded-xl bg-muted">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="grid grid-cols-2 gap-4 p-4">
                      <div className="flex h-24 items-center justify-center rounded-lg bg-background p-4 shadow-sm">
                        <div className="text-center">
                          <div className="text-2xl font-bold">15+</div>
                          <div className="text-sm text-muted-foreground">Staff Members</div>
                        </div>
                      </div>
                      <div className="flex h-24 items-center justify-center rounded-lg bg-background p-4 shadow-sm">
                        <div className="text-center">
                          <div className="text-2xl font-bold">98%</div>
                          <div className="text-sm text-muted-foreground">Satisfaction</div>
                        </div>
                      </div>
                      <div className="flex h-24 items-center justify-center rounded-lg bg-background p-4 shadow-sm">
                        <div className="text-center">
                          <div className="text-2xl font-bold">24/7</div>
                          <div className="text-sm text-muted-foreground">Support</div>
                        </div>
                      </div>
                      <div className="flex h-24 items-center justify-center rounded-lg bg-background p-4 shadow-sm">
                        <div className="text-center">
                          <div className="text-2xl font-bold">100+</div>
                          <div className="text-sm text-muted-foreground">Properties</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="bg-muted py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <div className="mx-auto flex max-w-[58rem] flex-col items-center justify-center gap-4 text-center">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">Features</h2>
              <p className="max-w-[85%] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Everything you need to manage your housekeeping operations efficiently
              </p>
            </div>
            <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 py-12 md:grid-cols-3">
              <div className="flex flex-col items-center gap-2 rounded-lg bg-background p-6 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold">Staff Management</h3>
                <p className="text-center text-muted-foreground">
                  Easily manage your housekeeping staff, schedules, and assignments.
                </p>
              </div>
              <div className="flex flex-col items-center gap-2 rounded-lg bg-background p-6 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold">Task Tracking</h3>
                <p className="text-center text-muted-foreground">
                  Track cleaning tasks, progress, and completion in real-time.
                </p>
              </div>
              <div className="flex flex-col items-center gap-2 rounded-lg bg-background p-6 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold">Quality Assurance</h3>
                <p className="text-center text-muted-foreground">
                  Ensure consistent quality with inspection checklists and reports.
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
          <div className="flex gap-4">
            <Link href="/terms" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
              Terms
            </Link>
            <Link href="/privacy" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

