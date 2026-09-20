import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  BookOpen,
  Clock,
  TrendingUp,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  GraduationCap,
} from "lucide-react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";

export default function Courses() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { data: courses, isLoading } = trpc.courses.list.useQuery();
  const { data: enrollments } = trpc.enrollments.myEnrollments.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const enrolledCourseIds = new Set(enrollments?.map(e => e.courseId) || []);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'beginner': return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20';
      case 'intermediate': return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20';
      case 'advanced': return 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20';
      default: return 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20';
    }
  };

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2.5 cursor-pointer"
            aria-label="Spiral.AI Academy home"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-md shadow-violet-600/25">
              <GraduationCap className="h-5 w-5 text-white" />
            </span>
            <span className="text-xl font-bold font-display tracking-tight">
              Spiral.AI <span className="text-muted-foreground font-semibold">Academy</span>
            </span>
          </button>
          <nav className="flex items-center gap-1 sm:gap-2">
            <Button variant="ghost" onClick={() => setLocation("/")}>
              Courses
            </Button>
            {isAuthenticated ? (
              <>
                <Button variant="ghost" onClick={() => setLocation("/my-courses")}>
                  My Courses
                </Button>
                {user?.role === 'admin' && (
                  <Button variant="ghost" onClick={() => setLocation("/admin")}>
                    Admin
                  </Button>
                )}
                <Button variant="outline" onClick={() => setLocation("/my-courses")}>
                  {user?.name || user?.email}
                </Button>
              </>
            ) : (
              <Button onClick={() => window.location.href = getLoginUrl()}>
                Sign In
              </Button>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10" aria-hidden="true">
          <div className="absolute inset-0 bg-gradient-to-b from-violet-600/[0.07] via-indigo-600/[0.04] to-transparent" />
          <div className="absolute -top-24 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-violet-500/15 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,oklch(0.56_0.235_285.2/0.05)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.56_0.235_285.2/0.05)_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,black,transparent)]" />
        </div>
        <div className="container py-20 md:py-28 text-center max-w-3xl">
          <Badge
            variant="outline"
            className="mb-6 gap-1.5 border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300 px-3 py-1"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Practical AI education
          </Badge>
          <h1 className="font-display text-5xl md:text-6xl font-bold tracking-tight mb-6">
            Master{" "}
            <span className="bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-violet-400 dark:to-indigo-400 bg-clip-text text-transparent">
              AI &amp; Technology
            </span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Learn cutting-edge skills from industry experts. Choose from our curated
            collection of courses designed to accelerate your career.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              size="lg"
              className="w-full sm:w-auto shadow-lg shadow-violet-600/25"
              onClick={() => document.getElementById("courses")?.scrollIntoView({ behavior: "smooth" })}
            >
              Browse Courses
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            {!isAuthenticated && (
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => window.location.href = getLoginUrl()}
              >
                Sign In
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="border-y bg-muted/40">
        <div className="container grid grid-cols-1 sm:grid-cols-3 gap-6 py-10">
          {[
            {
              icon: Clock,
              title: "Learn at your own pace",
              text: "Self-paced courses that fit around your schedule.",
            },
            {
              icon: ShieldCheck,
              title: "Secure checkout",
              text: "Payments processed securely through Stripe.",
            },
            {
              icon: TrendingUp,
              title: "Track your progress",
              text: "Your enrollments are always waiting in My Courses.",
            },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-semibold mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Courses Grid */}
      <section id="courses" className="py-16 md:py-20 scroll-mt-16">
        <div className="container">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="font-display text-3xl font-bold tracking-tight mb-3">
              Available Courses
            </h2>
            <p className="text-muted-foreground">
              Enroll today and start building the skills that matter.
            </p>
          </div>
          {!courses || courses.length === 0 ? (
            <Card className="max-w-md mx-auto text-center p-8">
              <CardContent className="pt-6">
                <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No courses available yet. Check back soon!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((course) => {
                const isEnrolled = enrolledCourseIds.has(course.id);

                return (
                  <Card
                    key={course.id}
                    onClick={() => setLocation(`/courses/${course.id}`)}
                    className="group flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-600/10 cursor-pointer"
                  >
                    {course.imageUrl && (
                      <div className="aspect-video w-full overflow-hidden bg-muted">
                        <img
                          src={course.imageUrl}
                          alt={course.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>
                    )}
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <Badge variant="outline" className={getLevelColor(course.level)}>
                          {course.level}
                        </Badge>
                        {isEnrolled && (
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                            Enrolled
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="line-clamp-2 font-display">{course.title}</CardTitle>
                      <CardDescription className="line-clamp-3">
                        {course.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                      {course.duration && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>{course.duration}</span>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="flex items-center justify-between pt-4 border-t bg-muted/30">
                      <div className="text-2xl font-bold font-display">
                        {course.currency === 'USD' ? '$' : course.currency}
                        {parseFloat(course.price).toFixed(2)}
                      </div>
                      {isEnrolled ? (
                        <Button variant="outline" onClick={(e) => { e.stopPropagation(); setLocation(`/courses/${course.id}`); }}>
                          Go to Course
                        </Button>
                      ) : (
                        <Button
                          className="group/btn shadow-md shadow-violet-600/20"
                          onClick={(e) => { e.stopPropagation(); setLocation(`/courses/${course.id}`); }}
                        >
                          View Course
                          <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-4 py-8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600">
              <GraduationCap className="h-4 w-4 text-white" />
            </span>
            <span className="font-semibold font-display">Spiral.AI Academy</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Spiral.AI Academy. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
