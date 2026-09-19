import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Courses from "./pages/Courses";
import Checkout from "./pages/Checkout";
import MyCourses from "./pages/MyCourses";
import PaymentSuccess from "./pages/PaymentSuccess";
import Login from "./pages/Login";
import Admin from "./pages/Admin";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Courses} />
      <Route path={"/login"} component={Login} />
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
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
