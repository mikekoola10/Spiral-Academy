import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Loader2, BookOpen, ArrowLeft, GraduationCap, Calendar } from "lucide-react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { useEffect } from "react";

export default function MyCourses() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { data: enrollments, isLoading } = trpc.enrollments.myEnrollments.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [authLoading, isAuthenticated]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Spiral.AI Academy</span>
          </div>
          <nav className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setLocation("/")}>
              Courses
            </Button>
            <Button variant="ghost" onClick={() => setLocation("/my-courses")}>
              My Courses
            </Button>
            {user?.role === 'admin' && (
              <Button variant="ghost" onClick={() => setLocation("/admin")}>
                Admin
              </Button>
            )}
            <Button variant="outline" onClick={() => trpc.auth.logout.useMutation()}>
              {user?.name || user?.email}
            </Button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <section className="py-12 px-4">
        <div className="container max-w-6xl">
          <div className="flex items-center gap-4 mb-8">
            <Button 
              variant="ghost" 
              onClick={() => setLocation('/')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Courses
            </Button>
          </div>

          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">My Courses</h1>
            <p className="text-muted-foreground">
              Access all your enrolled courses and continue learning
            </p>
          </div>

          {!enrollments || enrollments.length === 0 ? (
            <Card className="max-w-md mx-auto text-center p-8">
              <CardContent className="pt-6">
                <GraduationCap className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No courses yet</h3>
                <p className="text-muted-foreground mb-6">
                  Start your learning journey by enrolling in a course
                </p>
                <Button onClick={() => setLocation('/')}>
                  Browse Courses
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {enrollments.map((enrollment) => {
                const course = enrollment.course;
                if (!course) return null;

                return (
                  <Card key={enrollment.id} className="flex flex-col hover:shadow-lg transition-shadow">
                    {course.imageUrl && (
                      <div className="aspect-video w-full overflow-hidden rounded-t-lg bg-muted">
                        <img 
                          src={course.imageUrl} 
                          alt={course.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                          Enrolled
                        </Badge>
                        <Badge variant="secondary">
                          {course.level}
                        </Badge>
                      </div>
                      <CardTitle className="line-clamp-2">{course.title}</CardTitle>
                      <CardDescription className="line-clamp-3">
                        {course.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>
                          Enrolled {new Date(enrollment.enrolledAt).toLocaleDateString()}
                        </span>
                      </div>
                    </CardContent>
                    <div className="p-6 pt-0">
                      <Button className="w-full">
                        Continue Learning
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
