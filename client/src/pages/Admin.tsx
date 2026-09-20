import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { trpc } from "@/lib/trpc";
import CurriculumManager from "@/components/admin/CurriculumManager";
import { Loader2, BookOpen, ShoppingCart, Users, Plus, ArrowLeft, Trash2, Pencil } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function Admin() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { data: orders, isLoading: ordersLoading } = trpc.orders.allOrders.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === 'admin',
  });

  const { data: enrollments, isLoading: enrollmentsLoading } = trpc.enrollments.allEnrollments.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === 'admin',
  });

  const { data: courses, isLoading: coursesLoading } = trpc.courses.list.useQuery();

  const utils = trpc.useUtils();
  const createCourse = trpc.courses.create.useMutation({
    onSuccess: () => {
      toast.success('Course created successfully');
      setIsCreateDialogOpen(false);
      utils.courses.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const [courseToDelete, setCourseToDelete] = useState<{ id: number; title: string } | null>(null);
  const [courseToEdit, setCourseToEdit] = useState<{
    id: number; title: string; description: string; price: string;
    currency: string; imageUrl: string; duration: string;
    level: 'beginner' | 'intermediate' | 'advanced'; isActive: boolean;
  } | null>(null);
  const updateCourse = trpc.courses.update.useMutation({
    onSuccess: () => {
      toast.success('Course updated');
      setCourseToEdit(null);
      utils.courses.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  const deleteCourse = trpc.courses.delete.useMutation({
    onSuccess: () => {
      toast.success('Course deleted');
      setCourseToDelete(null);
      utils.courses.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
      setCourseToDelete(null);
    },
  });

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || user?.role !== 'admin')) {
      toast.error('Admin access required');
      setLocation('/');
    }
  }, [authLoading, isAuthenticated, user, setLocation]);

  const handleCreateCourse = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    createCourse.mutate({
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      price: formData.get('price') as string,
      currency: formData.get('currency') as string,
      imageUrl: formData.get('imageUrl') as string || undefined,
      duration: formData.get('duration') as string || undefined,
      level: formData.get('level') as 'beginner' | 'intermediate' | 'advanced',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'pending': return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
      case 'failed': return 'bg-red-500/10 text-red-700 dark:text-red-400';
      case 'refunded': return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
      default: return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
    }
  };

  if (authLoading || ordersLoading || enrollmentsLoading || coursesLoading) {
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
            <span className="text-xl font-bold">Spiral.AI Academy - Admin</span>
          </div>
          <nav className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setLocation("/")}>
              Courses
            </Button>
            <Button variant="ghost" onClick={() => setLocation("/my-courses")}>
              My Courses
            </Button>
            <Button variant="outline">
              {user?.name || user?.email}
            </Button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <section className="py-12 px-4">
        <div className="container max-w-7xl">
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
            <h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Manage courses, orders, and enrollments
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{orders?.length || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {orders?.filter(o => o.paymentStatus === 'completed').length || 0} completed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Enrollments</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{enrollments?.length || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Active students
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Courses</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{courses?.length || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Available courses
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="orders" className="space-y-4">
            <TabsList>
              <TabsTrigger value="orders">Orders</TabsTrigger>
              <TabsTrigger value="enrollments">Enrollments</TabsTrigger>
              <TabsTrigger value="courses">Courses</TabsTrigger>
              <TabsTrigger value="curriculum">Curriculum</TabsTrigger>
            </TabsList>

            <TabsContent value="orders" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Orders</CardTitle>
                  <CardDescription>View all payment transactions</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order ID</TableHead>
                        <TableHead>User ID</TableHead>
                        <TableHead>Course ID</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders && orders.length > 0 ? (
                        orders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell className="font-medium">#{order.id}</TableCell>
                            <TableCell>{order.userId}</TableCell>
                            <TableCell>{order.courseId}</TableCell>
                            <TableCell>
                              {order.currency === 'USD' ? '$' : order.currency}
                              {parseFloat(order.amount).toFixed(2)}
                            </TableCell>
                            <TableCell className="capitalize">{order.paymentMethod}</TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(order.paymentStatus)}>
                                {order.paymentStatus}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {new Date(order.createdAt).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            No orders yet
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="enrollments" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>All Enrollments</CardTitle>
                  <CardDescription>View all student enrollments</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Enrollment ID</TableHead>
                        <TableHead>User ID</TableHead>
                        <TableHead>Course ID</TableHead>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Enrolled Date</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {enrollments && enrollments.length > 0 ? (
                        enrollments.map((enrollment) => (
                          <TableRow key={enrollment.id}>
                            <TableCell className="font-medium">#{enrollment.id}</TableCell>
                            <TableCell>{enrollment.userId}</TableCell>
                            <TableCell>{enrollment.courseId}</TableCell>
                            <TableCell>#{enrollment.orderId}</TableCell>
                            <TableCell>
                              {new Date(enrollment.enrolledAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Badge variant={enrollment.isActive ? "default" : "secondary"}>
                                {enrollment.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            No enrollments yet
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="courses" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Manage Courses</CardTitle>
                      <CardDescription>Create and manage course catalog</CardDescription>
                    </div>
                    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="mr-2 h-4 w-4" />
                          Add Course
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <form onSubmit={handleCreateCourse}>
                          <DialogHeader>
                            <DialogTitle>Create New Course</DialogTitle>
                            <DialogDescription>
                              Add a new course to the catalog
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                              <Label htmlFor="title">Title *</Label>
                              <Input id="title" name="title" required />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="description">Description</Label>
                              <Textarea id="description" name="description" rows={3} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="grid gap-2">
                                <Label htmlFor="price">Price *</Label>
                                <Input id="price" name="price" type="number" step="0.01" required />
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor="currency">Currency</Label>
                                <Input id="currency" name="currency" defaultValue="USD" />
                              </div>
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="imageUrl">Image URL</Label>
                              <Input id="imageUrl" name="imageUrl" type="url" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="grid gap-2">
                                <Label htmlFor="duration">Duration</Label>
                                <Input id="duration" name="duration" placeholder="e.g., 8 weeks" />
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor="level">Level</Label>
                                <Select name="level" defaultValue="beginner">
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="beginner">Beginner</SelectItem>
                                    <SelectItem value="intermediate">Intermediate</SelectItem>
                                    <SelectItem value="advanced">Advanced</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button type="submit" disabled={createCourse.isPending}>
                              {createCourse.isPending ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Creating...
                                </>
                              ) : (
                                'Create Course'
                              )}
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {courses && courses.length > 0 ? (
                        courses.map((course) => (
                          <TableRow key={course.id}>
                            <TableCell className="font-medium">#{course.id}</TableCell>
                            <TableCell>{course.title}</TableCell>
                            <TableCell>
                              {course.currency === 'USD' ? '$' : course.currency}
                              {parseFloat(course.price).toFixed(2)}
                            </TableCell>
                            <TableCell className="capitalize">{course.level}</TableCell>
                            <TableCell>{course.duration || '-'}</TableCell>
                            <TableCell>
                              <Badge variant={course.isActive ? "default" : "secondary"}>
                                {course.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Edit ${course.title}`}
                                onClick={() => setCourseToEdit({
                                  id: course.id,
                                  title: course.title,
                                  description: course.description ?? "",
                                  price: String(course.price),
                                  currency: course.currency,
                                  imageUrl: course.imageUrl ?? "",
                                  duration: course.duration ?? "",
                                  level: course.level as 'beginner' | 'intermediate' | 'advanced',
                                  isActive: course.isActive,
                                })}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Delete ${course.title}`}
                                onClick={() => setCourseToDelete({ id: course.id, title: course.title })}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            No courses yet
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="curriculum" className="space-y-4">
              <CurriculumManager />
            </TabsContent>
          </Tabs>
        </div>
      </section>

      <AlertDialog open={courseToDelete !== null} onOpenChange={(open) => { if (!open) setCourseToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete course?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{courseToDelete?.title}" along with its curriculum,
              orders, enrollments, and payment logs. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteCourse.isPending}
              onClick={() => courseToDelete && deleteCourse.mutate({ id: courseToDelete.id })}
            >
              {deleteCourse.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={courseToEdit !== null} onOpenChange={(open) => { if (!open) setCourseToEdit(null); }}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!courseToEdit) return;
            updateCourse.mutate({
              id: courseToEdit.id,
              title: courseToEdit.title,
              description: courseToEdit.description || null,
              price: courseToEdit.price,
              currency: courseToEdit.currency,
              imageUrl: courseToEdit.imageUrl || null,
              duration: courseToEdit.duration || null,
              level: courseToEdit.level,
              isActive: courseToEdit.isActive,
            });
          }}>
            <DialogHeader>
              <DialogTitle>Edit Course</DialogTitle>
              <DialogDescription>Update the course details below.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Title *</Label>
                <Input
                  required
                  value={courseToEdit?.title ?? ""}
                  onChange={(e) => setCourseToEdit((c) => c && { ...c, title: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Description</Label>
                <Textarea
                  rows={3}
                  value={courseToEdit?.description ?? ""}
                  onChange={(e) => setCourseToEdit((c) => c && { ...c, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Price *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    required
                    value={courseToEdit?.price ?? ""}
                    onChange={(e) => setCourseToEdit((c) => c && { ...c, price: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Currency</Label>
                  <Input
                    value={courseToEdit?.currency ?? ""}
                    onChange={(e) => setCourseToEdit((c) => c && { ...c, currency: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Image URL</Label>
                <Input
                  type="url"
                  value={courseToEdit?.imageUrl ?? ""}
                  onChange={(e) => setCourseToEdit((c) => c && { ...c, imageUrl: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Duration</Label>
                  <Input
                    value={courseToEdit?.duration ?? ""}
                    onChange={(e) => setCourseToEdit((c) => c && { ...c, duration: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Level</Label>
                  <Select
                    value={courseToEdit?.level ?? "beginner"}
                    onValueChange={(v: 'beginner' | 'intermediate' | 'advanced') =>
                      setCourseToEdit((c) => c && { ...c, level: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={courseToEdit?.isActive ?? true}
                  onChange={(e) => setCourseToEdit((c) => c && { ...c, isActive: e.target.checked })}
                  className="h-4 w-4"
                />
                Active (visible in catalog)
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCourseToEdit(null)}>Cancel</Button>
              <Button type="submit" disabled={updateCourse.isPending}>
                {updateCourse.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
