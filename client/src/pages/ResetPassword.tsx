import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { GraduationCap, KeyRound, CheckCircle2 } from "lucide-react";
import { Link, useParams } from "wouter";
import { trpc } from "@/lib/trpc";

export default function ResetPassword() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mutation = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      setError(null);
      setDone(true);
    },
    onError: err => {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      // tRPC wraps zod messages; surface the first readable one.
      try {
        const parsed = JSON.parse(message);
        if (Array.isArray(parsed) && parsed[0]?.message) {
          setError(String(parsed[0].message));
          return;
        }
      } catch {
        // not JSON, use as-is
      }
      setError(message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    mutation.mutate({ token, password });
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
          <CardTitle className="text-2xl font-bold font-display">Set a new password</CardTitle>
          <CardDescription>Choose a new password for your account.</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {done ? (
            <div className="text-center space-y-4 py-4">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-600" />
              <p className="text-sm text-slate-600">
                Your password has been reset. You&apos;ve been signed out everywhere else.
              </p>
              <Link href="/login" className="text-blue-600 hover:underline font-medium text-sm">
                Sign in with your new password
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm new password</Label>
                <Input
                  id="confirm"
                  type="password"
                  placeholder="Repeat your new password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={mutation.isPending}>
                <KeyRound className="w-4 h-4 mr-2" />
                {mutation.isPending ? "Resetting…" : "Reset password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
