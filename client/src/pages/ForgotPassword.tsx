import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { GraduationCap, MailCheck, Send } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const mutation = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => {
      setError(null);
      setSent(true);
    },
    onError: err => {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    mutation.mutate({ email });
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
          <CardTitle className="text-2xl font-bold font-display">Forgot your password?</CardTitle>
          <CardDescription>
            Enter your account email and we&apos;ll send you a reset link.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {sent ? (
            <div className="text-center space-y-4 py-4">
              <MailCheck className="h-12 w-12 mx-auto text-violet-600" />
              <p className="text-sm text-slate-600">
                If an account exists for <strong>{email}</strong>, a reset link is on its way.
                It expires in 1 hour.
              </p>
              <Link href="/login" className="text-blue-600 hover:underline font-medium text-sm">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={mutation.isPending}>
                <Send className="w-4 h-4 mr-2" />
                {mutation.isPending ? "Sending…" : "Send reset link"}
              </Button>

              <div className="text-center text-sm text-slate-600">
                <Link href="/login" className="text-blue-600 hover:underline font-medium">
                  Back to sign in
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
