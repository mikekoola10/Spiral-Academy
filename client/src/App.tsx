import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import Courses from "./pages/Courses";
import CourseDetail from "./pages/CourseDetail";
import LessonView from "./pages/LessonView";
import Checkout from "./pages/Checkout";
import MyCourses from "./pages/MyCourses";
import PaymentSuccess from "./pages/PaymentSuccess";
import Login from "./pages/Login";
import Admin from "./pages/Admin";

/** Fire-and-forget page view beacon on every route change. Cookieless. */
function PageViewTracker() {
  const [location] = useLocation();
  const track = trpc.analytics.track.useMutation();
  useEffect(() => {
    try {
      track.mutate({ path: location, referrer: document.referrer || undefined });
    } catch {
      // Analytics must never break the page.
    }
    // Only re-fire when the route changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Courses} />
      <Route path={"/courses/:id"} component={CourseDetail} />
      <Route path={"/courses/:id/lessons/:lessonId"} component={LessonView} />
      <Route path={"/login"} component={Login} />
      <Route path={"/checkout/bundle"} component={Checkout} />
      <Route path={"/checkout/:id"} component={Checkout} />
      <Route path={"/payment-success"} component={PaymentSuccess} />
      <Route path={"/my-courses"} component={MyCourses} />
      <Route path={"/admin"} component={Admin} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <PageViewTracker />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
