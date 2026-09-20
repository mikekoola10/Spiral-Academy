import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Plus, Pencil, Trash2, Loader2, ChevronDown, ChevronRight, PlayCircle, Sparkles, DatabaseZap } from "lucide-react";
import { toast } from "sonner";

interface ModuleForm {
  id?: number;
  title: string;
  description: string;
}

interface LessonForm {
  id?: number;
  moduleId: number;
  title: string;
  content: string;
  videoUrl: string;
  durationMinutes: string;
  isFreePreview: boolean;
}

const emptyLesson = (moduleId: number): LessonForm => ({
  moduleId,
  title: "",
  content: "",
  videoUrl: "",
  durationMinutes: "",
  isFreePreview: false,
});

export default function CurriculumManager() {
  const { data: courses } = trpc.courses.list.useQuery();
  const [courseId, setCourseId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [moduleDialog, setModuleDialog] = useState<ModuleForm | null>(null);
  const [lessonDialog, setLessonDialog] = useState<LessonForm | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: "module" | "lesson"; id: number; title: string } | null>(null);

  const utils = trpc.useUtils();
  const activeCourseId = courseId ?? courses?.[0]?.id ?? null;

  const { data: curriculum, isLoading } = trpc.curriculum.getByCourse.useQuery(
    { courseId: activeCourseId! },
    { enabled: activeCourseId !== null }
  );

  const invalidate = () => {
    if (activeCourseId) utils.curriculum.getByCourse.invalidate({ courseId: activeCourseId });
  };

  const createModule = trpc.curriculum.createModule.useMutation({ onSuccess: () => { setModuleDialog(null); invalidate(); } });
  const updateModule = trpc.curriculum.updateModule.useMutation({ onSuccess: () => { setModuleDialog(null); invalidate(); } });
  const deleteModule = trpc.curriculum.deleteModule.useMutation({ onSuccess: () => { setDeleteTarget(null); invalidate(); } });
  const createLesson = trpc.curriculum.createLesson.useMutation({ onSuccess: () => { setLessonDialog(null); invalidate(); } });
  const updateLesson = trpc.curriculum.updateLesson.useMutation({ onSuccess: () => { setLessonDialog(null); invalidate(); } });
  const deleteLesson = trpc.curriculum.deleteLesson.useMutation({ onSuccess: () => { setDeleteTarget(null); invalidate(); } });
  const seedAll = trpc.curriculum.seedAll.useMutation({
    onSuccess: (data) => {
      const seeded = data.results.filter((r) => !r.skipped);
      const skipped = data.results.filter((r) => r.skipped);
      const lessons = seeded.reduce((n, r) => n + r.lessons, 0);
      toast.success(
        seeded.length > 0
          ? `Seeded ${lessons} lessons across ${seeded.length} courses${skipped.length > 0 ? ` (${skipped.length} already had content)` : ""}`
          : "All courses already have content — nothing to seed"
      );
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const saveModule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleDialog || !activeCourseId) return;
    if (moduleDialog.id) {
      updateModule.mutate({ id: moduleDialog.id, title: moduleDialog.title, description: moduleDialog.description || undefined });
    } else {
      const position = curriculum?.length ?? 0;
      createModule.mutate({ courseId: activeCourseId, title: moduleDialog.title, description: moduleDialog.description || undefined, position });
    }
  };

  const saveLesson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonDialog) return;
    const payload = {
      title: lessonDialog.title,
      content: lessonDialog.content || undefined,
      videoUrl: lessonDialog.videoUrl || undefined,
      durationMinutes: lessonDialog.durationMinutes ? parseInt(lessonDialog.durationMinutes) : undefined,
      isFreePreview: lessonDialog.isFreePreview,
    };
    if (lessonDialog.id) {
      updateLesson.mutate({ id: lessonDialog.id, ...payload });
    } else {
      const mod = curriculum?.find((m) => m.id === lessonDialog.moduleId);
      createLesson.mutate({ moduleId: lessonDialog.moduleId, position: mod?.lessons.length ?? 0, ...payload });
    }
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === "module") deleteModule.mutate({ id: deleteTarget.id });
    else deleteLesson.mutate({ id: deleteTarget.id });
  };

  const totalLessons = curriculum?.reduce((n, m) => n + m.lessons.length, 0) ?? 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Curriculum</CardTitle>
            <CardDescription>Modules and lessons for each course</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={activeCourseId ? String(activeCourseId) : ""}
              onValueChange={(v) => setCourseId(parseInt(v))}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select a course" />
              </SelectTrigger>
              <SelectContent>
                {courses?.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    #{c.id} {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="secondary"
              onClick={() => seedAll.mutate()}
              disabled={seedAll.isPending}
              title="Load the bundled lesson content into all courses (skips courses that already have lessons)"
            >
              {seedAll.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DatabaseZap className="mr-2 h-4 w-4" />}
              Seed Lessons
            </Button>
            <Button
              onClick={() => setModuleDialog({ title: "", description: "" })}
              disabled={!activeCourseId}
            >
              <Plus className="mr-2 h-4 w-4" /> Add Module
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !curriculum || curriculum.length === 0 ? (
          <p className="text-center text-muted-foreground py-10">
            No modules yet. Add the first module to start building this course's curriculum.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {curriculum.length} module{curriculum.length === 1 ? "" : "s"} · {totalLessons} lesson{totalLessons === 1 ? "" : "s"}
            </p>
            {curriculum.map((module) => {
              const open = expanded.has(module.id);
              return (
                <div key={module.id} className="border rounded-xl">
                  <div className="flex items-center gap-2 px-4 py-3">
                    <button onClick={() => toggle(module.id)} className="flex flex-1 items-center gap-2 text-left">
                      {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <span className="font-semibold">{module.title}</span>
                      <span className="text-sm text-muted-foreground">
                        ({module.lessons.length} lesson{module.lessons.length === 1 ? "" : "s"})
                      </span>
                    </button>
                    <Button variant="ghost" size="icon" aria-label="Edit module"
                      onClick={() => setModuleDialog({ id: module.id, title: module.title, description: module.description ?? "" })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Delete module"
                      onClick={() => setDeleteTarget({ kind: "module", id: module.id, title: module.title })}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  {open && (
                    <div className="border-t px-4 py-3 space-y-1">
                      {module.lessons.map((lesson) => (
                        <div key={lesson.id} className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-muted/50">
                          <PlayCircle className="h-4 w-4 text-violet-600 shrink-0" />
                          <span className="flex-1 text-sm font-medium truncate">{lesson.title}</span>
                          {lesson.isFreePreview && (
                            <Badge variant="outline" className="text-xs border-violet-500/30 text-violet-700 dark:text-violet-400">
                              <Sparkles className="h-3 w-3 mr-1" /> Free
                            </Badge>
                          )}
                          {lesson.durationMinutes && (
                            <span className="text-xs text-muted-foreground">{lesson.durationMinutes} min</span>
                          )}
                          <Button variant="ghost" size="icon" aria-label="Edit lesson"
                            onClick={() => setLessonDialog({
                              id: lesson.id,
                              moduleId: module.id,
                              title: lesson.title,
                              content: lesson.content ?? "",
                              videoUrl: lesson.videoUrl ?? "",
                              durationMinutes: lesson.durationMinutes ? String(lesson.durationMinutes) : "",
                              isFreePreview: lesson.isFreePreview,
                            })}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="Delete lesson"
                            onClick={() => setDeleteTarget({ kind: "lesson", id: lesson.id, title: lesson.title })}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => setLessonDialog(emptyLesson(module.id))}
                      >
                        <Plus className="mr-2 h-4 w-4" /> Add Lesson
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Module dialog */}
      <Dialog open={moduleDialog !== null} onOpenChange={(o) => !o && setModuleDialog(null)}>
        <DialogContent>
          <form onSubmit={saveModule}>
            <DialogHeader>
              <DialogTitle>{moduleDialog?.id ? "Edit Module" : "Add Module"}</DialogTitle>
              <DialogDescription>Group related lessons under a module.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Title *</Label>
                <Input
                  required
                  value={moduleDialog?.title ?? ""}
                  onChange={(e) => setModuleDialog((d) => d && { ...d, title: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Description</Label>
                <Textarea
                  rows={2}
                  value={moduleDialog?.description ?? ""}
                  onChange={(e) => setModuleDialog((d) => d && { ...d, description: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModuleDialog(null)}>Cancel</Button>
              <Button type="submit" disabled={createModule.isPending || updateModule.isPending}>
                {(createModule.isPending || updateModule.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Module
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Lesson dialog */}
      <Dialog open={lessonDialog !== null} onOpenChange={(o) => !o && setLessonDialog(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={saveLesson}>
            <DialogHeader>
              <DialogTitle>{lessonDialog?.id ? "Edit Lesson" : "Add Lesson"}</DialogTitle>
              <DialogDescription>Write the lesson content in Markdown.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Title *</Label>
                <Input
                  required
                  value={lessonDialog?.title ?? ""}
                  onChange={(e) => setLessonDialog((d) => d && { ...d, title: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Duration (minutes)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={lessonDialog?.durationMinutes ?? ""}
                    onChange={(e) => setLessonDialog((d) => d && { ...d, durationMinutes: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Video URL (optional)</Label>
                  <Input
                    type="url"
                    placeholder="https://..."
                    value={lessonDialog?.videoUrl ?? ""}
                    onChange={(e) => setLessonDialog((d) => d && { ...d, videoUrl: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Content (Markdown)</Label>
                <Textarea
                  rows={14}
                  className="font-mono text-sm"
                  value={lessonDialog?.content ?? ""}
                  onChange={(e) => setLessonDialog((d) => d && { ...d, content: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={lessonDialog?.isFreePreview ?? false}
                  onCheckedChange={(v) => setLessonDialog((d) => d && { ...d, isFreePreview: v === true })}
                />
                Free preview (visible without enrollment)
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLessonDialog(null)}>Cancel</Button>
              <Button type="submit" disabled={createLesson.isPending || updateLesson.isPending}>
                {(createLesson.isPending || updateLesson.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Lesson
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget?.kind === "module" ? "Module" : "Lesson"}</DialogTitle>
            <DialogDescription>
              Delete "{deleteTarget?.title}"?
              {deleteTarget?.kind === "module" && " All of its lessons will be deleted too."}
              {" "}This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteModule.isPending || deleteLesson.isPending}
            >
              {(deleteModule.isPending || deleteLesson.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
