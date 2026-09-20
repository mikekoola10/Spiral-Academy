import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";

/**
 * Shared auth navigation for page headers.
 * Logged out: a "Sign In" button.
 * Logged in: optional My Courses / Admin links plus a "Sign out" button.
 */
export default function AuthNav({ compact = false }: { compact?: boolean }) {
  const { user, isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();

  const handleSignOut = async () => {
    await logout();
    setLocation("/");
  };

  if (!isAuthenticated) {
    return (
      <Button onClick={() => (window.location.href = getLoginUrl())}>
        Sign In
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      {!compact && (
        <Button variant="ghost" onClick={() => setLocation("/my-courses")}>
          My Courses
        </Button>
      )}
      {!compact && user?.role === "admin" && (
        <Button variant="ghost" onClick={() => setLocation("/admin")}>
          Admin
        </Button>
      )}
      <Button variant="outline" onClick={handleSignOut} title="Sign out">
        <LogOut className="h-4 w-4 sm:mr-2" />
        <span className="hidden sm:inline">Sign out</span>
      </Button>
    </div>
  );
}
