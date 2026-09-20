import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  Clock,
  TrendingUp,
  GraduationCap,
  Lock,
  PlayCircle,
  CheckCircle2,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { useRoute, useLocation } from "wouter";
import { getLoginUrl } from "@/const";

function levelColor(level: string) {
  switch (level) {
    case "beginner":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
    case "intermediate":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";
    case "advanced":
      return "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20";
    default:
      return "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20";
  }
}

export default function CourseDetail() {
  const [, params] = useRoute("/courses/:id");
  const [, setLocation] = useLocation();
  const courseId = params?.id ? parseInt(params.id) : null;
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const { data: course, isLoading: courseLoading } = trpc.courses.getById.useQuery(
    { id: courseId! },
    { enabled: courseId !== null }
  );
  const { data: curriculum } = trpc.curriculum.getByCourse.useQuery(
    { courseId: courseId! },
    { enabled: courseId !== null }
  );
  const { data: enrollment } = trpc.enrollments.checkEnrollment.useQuery(
    { courseId: courseId! },
    { enabled: courseId !== null && isAuthenticated }
  );
  const { data: progress } = trpc.curriculum.myProgress.useQuery(
    { courseId: courseId! },
    { enabled: courseId !== null && isAuthenticated }
  );

  if (courseLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-lg text-muted-foreground">Course not found.</p>
        <Button onClick={() => setLocation("/")}>Back to courses</Button>
      </div>
    );
  }

  const allLessons =
    curriculum?.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleTitle: m.title }))) ?? [];
  const completedIds = new Set(progress?.completedIds ?? []);
  const totalLessons = progress?.totalLessons ?? allLessons.length;
  const completedCount = completedIds.size;
  const pct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
  const nextLesson = allLessons.find((l) => !completedIds.has(l.id)) ?? allLessons[0];
  const isEnrolled = Boolean(enrollment) || user?.role === "admin";

  const handleCta = () => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    if (isEnrolled && nextLesson) {
      setLocation(`/courses/${course.id}/lessons/${nextLesson.id}`);
    } else {
      setLocation(`/checkout/${course.id}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
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
          <Button variant="ghost" onClick={() => setLocation("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> All courses
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 via-indigo-600/5 to-transparent" />
        {course.imageUrl && (
          <div className="absolute inset-0 opacity-20">
            <img src={course.imageUrl} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/30" />
          </div>
        )}
        <div className="container relative py-12 md:py-16 max-w-4xl">
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge variant="outline" className={levelColor(course.level)}>
              <TrendingUp className="h-3 w-3 mr-1" />
              {course.level}
            </Badge>
            {course.duration && (
              <Badge variant="outline">
                <Clock className="h-3 w-3 mr-1" />
                {course.duration}
              </Badge>
            )}
            <Badge variant="outline">
              {totalLessons} lesson{totalLessons === 1 ? "" : "s"}
            </Badge>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold font-display tracking-tight mb-4">
            {course.title}
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl">{course.description}</p>

          <div className="flex flex-wrap items-center gap-4">
            {isEnrolled && totalLessons > 0 && (
              <div className="w-full max-w-sm">
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-muted-foreground">Your progress</span>
                  <span className="font-medium">{pct}%</span>
                </div>
                <Progress value={pct} className="h-2" />
              </div>
            )}
            <div className="flex items-center gap-4 ml-auto">
              {!isEnrolled && (
                <span className="text-3xl font-bold font-display">${Number(course.price).toFixed(2)}</span>
              )}
              <Button size="lg" onClick={handleCta} className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">
                {!isAuthenticated
                  ? "Sign in to enroll"
                  : isEnrolled
                    ? nextLesson
                      ? completedCount > 0
                        ? "Continue learning"
                        : "Start learning"
                      : "Course content coming soon"
                    : "Enroll now"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Curriculum */}
      <section className="container max-w-4xl pb-20">
        <h2 className="text-2xl font-bold font-display mb-2">Curriculum</h2>
        <p className="text-muted-foreground mb-6">
          {totalLessons === 0
            ? "Lessons are being added to this course."
            : "Work through each lesson at your own pace. Your progress is saved automatically."}
        </p>

        {curriculum && curriculum.length > 0 ? (
          <Accordion type="multiple" defaultValue={curriculum.map((m) => `module-${m.id}`)} className="space-y-3">
            {curriculum.map((module, mi) => (
              <AccordionItem key={module.id} value={`module-${module.id}`} className="border rounded-xl px-4 bg-card">
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-3 text-left">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600/10 text-violet-700 dark:text-violet-400 text-sm font-bold">
                      {mi + 1}
                    </span>
                    <div>
                      <div className="font-semibold">{module.title}</div>
                      <div className="text-sm text-muted-foreground font-normal">
                        {module.lessons.length} lesson{module.lessons.length === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pb-3 space-y-1">
                    {module.lessons.map((lesson) => {
                      const accessible = lesson.content !== null;
                      const done = completedIds.has(lesson.id);
                      return (
                        <button
                          key={lesson.id}
                          disabled={!accessible}
                          onClick={() => setLocation(`/courses/${course.id}/lessons/${lesson.id}`)}
                          className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                            accessible ? "hover:bg-muted cursor-pointer" : "opacity-70 cursor-not-allowed"
                          }`}
                        >
                          {done ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                          ) : accessible ? (
                            <PlayCircle className="h-5 w-5 text-violet-600 shrink-0" />
                          ) : (
                            <Lock className="h-5 w-5 text-muted-foreground shrink-0" />
                          )}
                          <span className={`flex-1 text-sm font-medium ${done ? "text-muted-foreground line-through" : ""}`}>
                            {lesson.title}
                          </span>
                          {lesson.isFreePreview && (
                            <Badge variant="outline" className="text-xs border-violet-500/30 text-violet-700 dark:text-violet-400">
                              <Sparkles className="h-3 w-3 mr-1" /> Free preview
                            </Badge>
                          )}
                          {lesson.durationMinutes && (
                            <span className="text-xs text-muted-foreground shrink-0">
                              {lesson.durationMinutes} min
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              The curriculum for this course is being prepared. Check back soon.
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
