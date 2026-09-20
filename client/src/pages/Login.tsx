import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { GraduationCap, LogIn, UserPlus } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

function friendlyError(message: string): string {
  // tRPC wraps zod/validation messages; surface the first readable one.
  try {
    const parsed = JSON.parse(message);
    if (Array.isArray(parsed) && parsed[0]?.message) return String(parsed[0].message);
  } catch {
    // not JSON, use as-is
  }
  return message;
}

export default function Login() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSuccess = async () => {
    setError(null);
    await utils.auth.me.invalidate();
    setLocation("/");
  };

  const onError = (err: unknown) => {
    const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
    setError(friendlyError(message));
  };

  const loginMutation = trpc.auth.login.useMutation({ onSuccess, onError });
  const registerMutation = trpc.auth.register.useMutation({ onSuccess, onError });

  const pending = loginMutation.isPending || registerMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === "login") {
      loginMutation.mutate({ email, password });
    } else {
      registerMutation.mutate({ email, password, name: name.trim() || undefined });
    }
  };

  const switchMode = (next: "login" | "register") => {
    setMode(next);
    setError(null);
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden px-4 py-8">
      <div className="absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/[0.08] via-background to-indigo-600/[0.06]" />
        <div className="absolute -top-20 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-violet-500/15 blur-3xl" />
      </div>
      <Card className="w-full max-w-md shadow-xl border bg-card/80 backdrop-blur-sm">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl p-3 shadow-lg shadow-violet-600/25">
              <GraduationCap className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold font-display">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </CardTitle>
          <CardDescription>
            {mode === "login"
              ? "Sign in to access your courses."
              : "Sign up to start learning today."}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoComplete="name"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={mode === "register" ? 8 : 1}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={pending}>
              {mode === "login" ? (
                <>
                  <LogIn className="w-4 h-4 mr-2" /> Sign in
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" /> Create account
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-600">
            {mode === "login" ? (
              <>
                New here?{" "}
                <button
                  type="button"
                  className="text-blue-600 hover:underline font-medium"
                  onClick={() => switchMode("register")}
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  className="text-blue-600 hover:underline font-medium"
                  onClick={() => switchMode("login")}
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
