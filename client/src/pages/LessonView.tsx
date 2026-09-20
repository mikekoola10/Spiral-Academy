import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";
import { useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  GraduationCap,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  Lock,
  Sparkles,
  Clock,
  Mail,
  MailCheck,
} from "lucide-react";
import { useRoute, useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import AuthNav from "@/components/AuthNav";

function FreePreviewEmailCapture() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const subscribe = trpc.newsletter.subscribe.useMutation({
    onSuccess: () => {
      setDone(true);
      toast.success("You're on the list!");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    subscribe.mutate({ email: email.trim(), source: "free-preview" });
  };

  if (done) {
    return (
      <div className="mt-10 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.07] p-6 md:p-8 text-center">
        <MailCheck className="h-8 w-8 mx-auto mb-3 text-emerald-600 dark:text-emerald-400" />
        <h3 className="font-display text-xl font-bold mb-1">You're in!</h3>
        <p className="text-sm text-muted-foreground">
          Watch your inbox for more free lessons and launch discounts.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-10 rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-600/[0.08] to-indigo-600/[0.05] p-6 md:p-8">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600">
          <Mail className="h-5 w-5 text-white" />
        </span>
        <div className="flex-1">
          <h3 className="font-display text-xl font-bold mb-1">
            Enjoying this free lesson?
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Get more free lessons plus launch discounts — straight to your inbox. No spam, unsubscribe anytime.
          </p>
          <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2">
            <Input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 bg-background"
            />
            <Button
              type="submit"
              disabled={subscribe.isPending}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
            >
              {subscribe.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Send me free lessons"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LessonView() {
  const [, params] = useRoute("/courses/:id/lessons/:lessonId");
  const [, setLocation] = useLocation();
  const courseId = params?.id ? parseInt(params.id) : null;
  const lessonId = params?.lessonId ? parseInt(params.lessonId) : null;
  const { isAuthenticated, loading: authLoading } = useAuth();

  const { data: course } = trpc.courses.getById.useQuery(
    { id: courseId! },
    { enabled: courseId !== null }
  );
  const { data: lesson, isLoading: lessonLoading, error } = trpc.curriculum.getLesson.useQuery(
    { lessonId: lessonId! },
    { enabled: lessonId !== null, retry: false }
  );
  const { data: curriculum } = trpc.curriculum.getByCourse.useQuery(
    { courseId: courseId! },
    { enabled: courseId !== null }
  );
  const { data: progress, refetch: refetchProgress } = trpc.curriculum.myProgress.useQuery(
    { courseId: courseId! },
    { enabled: courseId !== null && isAuthenticated }
  );

  const utils = trpc.useUtils();
  const markComplete = trpc.curriculum.markComplete.useMutation({
    onSuccess: () => {
      refetchProgress();
      utils.curriculum.myProgress.invalidate();
    },
  });
  const markIncomplete = trpc.curriculum.markIncomplete.useMutation({
    onSuccess: () => {
      refetchProgress();
      utils.curriculum.myProgress.invalidate();
    },
  });

  if (lessonLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !lesson) {
    const forbidden = (error as unknown as { data?: { code?: string } })?.data?.code === "FORBIDDEN";
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
        <Lock className="h-10 w-10 text-muted-foreground" />
        <p className="text-lg font-medium">
          {forbidden ? "This lesson is for enrolled students." : "Lesson not found."}
        </p>
        <div className="flex gap-3">
          {forbidden && !isAuthenticated && (
            <Button onClick={() => (window.location.href = getLoginUrl())}>Sign in</Button>
          )}
          <Button variant="outline" onClick={() => setLocation(courseId ? `/courses/${courseId}` : "/")}>
            Back to course
          </Button>
        </div>
      </div>
    );
  }

  const flatLessons = curriculum?.flatMap((m) => m.lessons) ?? [];
  const idx = flatLessons.findIndex((l) => l.id === lesson.id);
  const prev = idx > 0 ? flatLessons[idx - 1] : null;
  const next = idx >= 0 && idx < flatLessons.length - 1 ? flatLessons[idx + 1] : null;
  const completedIds = new Set(progress?.completedIds ?? []);
  const isDone = completedIds.has(lesson.id);
  const nextAccessible = next && next.content !== null;

  const toggleComplete = () => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    if (isDone) markIncomplete.mutate({ lessonId: lesson.id });
    else markComplete.mutate({ lessonId: lesson.id });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between gap-2">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2.5 cursor-pointer"
            aria-label="Spiral.AI Academy home"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-md shadow-violet-600/25">
              <GraduationCap className="h-5 w-5 text-white" />
            </span>
            <span className="text-xl font-bold font-display tracking-tight hidden sm:inline">
              Spiral.AI <span className="text-muted-foreground font-semibold">Academy</span>
            </span>
          </button>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button variant="ghost" onClick={() => setLocation(courseId ? `/courses/${courseId}` : "/")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">{course?.title ?? "Course"}</span>
              <span className="sm:hidden">Course</span>
            </Button>
            <AuthNav compact />
          </div>
        </div>
      </header>

      <main className="container max-w-3xl py-8 md:py-12 flex-1">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {lesson.isFreePreview && (
            <Badge variant="outline" className="border-violet-500/30 text-violet-700 dark:text-violet-400">
              <Sparkles className="h-3 w-3 mr-1" /> Free preview
            </Badge>
          )}
          {lesson.durationMinutes && (
            <Badge variant="outline">
              <Clock className="h-3 w-3 mr-1" /> {lesson.durationMinutes} min
            </Badge>
          )}
          {isDone && (
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Completed
            </Badge>
          )}
        </div>

        <h1 className="text-3xl md:text-4xl font-bold font-display tracking-tight mb-8">
          {lesson.title}
        </h1>

        {lesson.videoUrl && (
          <div className="mb-8 rounded-xl overflow-hidden border bg-black aspect-video">
            <video src={lesson.videoUrl} controls className="w-full h-full" />
          </div>
        )}

        {lesson.content ? (
          <article className="prose prose-neutral dark:prose-invert max-w-none prose-headings:font-display prose-a:text-violet-600 dark:prose-a:text-violet-400">
            <Streamdown>{lesson.content}</Streamdown>
          </article>
        ) : (
          <p className="text-muted-foreground">Content for this lesson is coming soon.</p>
        )}

        {lesson.isFreePreview && !isAuthenticated && <FreePreviewEmailCapture />}

        {isAuthenticated && (
          <div className="mt-10 flex justify-center">
            <Button
              size="lg"
              variant={isDone ? "outline" : "default"}
              onClick={toggleComplete}
              disabled={markComplete.isPending || markIncomplete.isPending}
              className={isDone ? "" : "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"}
            >
              {markComplete.isPending || markIncomplete.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : isDone ? (
                <Circle className="h-4 w-4 mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              {isDone ? "Mark as not completed" : "Mark as complete"}
            </Button>
          </div>
        )}

        <div className="mt-10 flex items-center justify-between gap-3 border-t pt-6">
          {prev ? (
            <Button variant="outline" onClick={() => setLocation(`/courses/${courseId}/lessons/${prev.id}`)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="truncate max-w-[140px] sm:max-w-[220px]">{prev.title}</span>
            </Button>
          ) : (
            <span />
          )}
          {nextAccessible && next ? (
            <Button onClick={() => setLocation(`/courses/${courseId}/lessons/${next.id}`)}>
              <span className="truncate max-w-[140px] sm:max-w-[220px]">{next.title}</span>
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <span />
          )}
        </div>
      </main>
    </div>
  );
}
