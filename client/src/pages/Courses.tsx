import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Loader2, BookOpen, Clock, TrendingUp } from "lucide-react";
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
      case 'beginner': return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'intermediate': return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
      case 'advanced': return 'bg-red-500/10 text-red-700 dark:text-red-400';
      default: return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
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
      <section className="py-20 px-4">
        <div className="container text-center max-w-3xl">
          <h1 className="text-5xl font-bold tracking-tight mb-6">
            Master AI & Technology
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Learn cutting-edge skills from industry experts. Choose from our curated collection of courses designed to accelerate your career.
          </p>
        </div>
      </section>

      {/* Courses Grid */}
      <section className="pb-20 px-4">
        <div className="container">
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
                  <Card key={course.id} className="flex flex-col hover:shadow-lg transition-shadow">
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
                        <Badge className={getLevelColor(course.level)}>
                          {course.level}
                        </Badge>
                        {isEnrolled && (
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                            Enrolled
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="line-clamp-2">{course.title}</CardTitle>
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
                    <CardFooter className="flex items-center justify-between pt-4 border-t">
                      <div className="text-2xl font-bold">
                        {course.currency === 'USD' ? '$' : course.currency}
                        {parseFloat(course.price).toFixed(2)}
                      </div>
                      {isEnrolled ? (
                        <Button onClick={() => setLocation("/my-courses")}>
                          Go to Course
                        </Button>
                      ) : (
                        <Button 
                          onClick={() => setLocation(`/checkout/${course.id}`)}
                        >
                          Enroll Now
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
    </div>
  );
}
