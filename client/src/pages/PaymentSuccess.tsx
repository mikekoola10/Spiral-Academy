import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, BookOpen, CheckCircle2, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function PaymentSuccess() {
  const [, setLocation] = useLocation();

  const params = new URLSearchParams(window.location.search);
  const redirectStatus = params.get("redirect_status");
  const paymentIntentId = params.get("payment_intent");

  const succeeded = redirectStatus === "succeeded";

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <Card className="w-full max-w-lg mx-4 shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div
                className={`absolute inset-0 rounded-full animate-pulse ${
                  succeeded ? "bg-green-100" : "bg-amber-100"
                }`}
              />
              {succeeded ? (
                <CheckCircle2 className="relative h-16 w-16 text-green-500" />
              ) : (
                <AlertTriangle className="relative h-16 w-16 text-amber-500" />
              )}
            </div>
          </div>

          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            {succeeded ? "Payment Successful" : "Payment Not Completed"}
          </h1>

          <p className="text-slate-600 mb-2 leading-relaxed">
            {succeeded
              ? "Thank you! Your payment was processed successfully."
              : "Your payment did not go through. No charge was made."}
          </p>

          {succeeded && (
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              Your course access is being activated now. Head to My Courses to
              start learning.
              {paymentIntentId && (
                <>
                  <br />
                  <span className="text-xs text-slate-400">
                    Receipt: {paymentIntentId}
                  </span>
                </>
              )}
            </p>
          )}

          {!succeeded && (
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              You can try again or return to browsing courses.
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
            {succeeded ? (
              <Button
                onClick={() => setLocation("/my-courses")}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
              >
                <BookOpen className="w-4 h-4 mr-2" />
                View My Courses
              </Button>
            ) : (
              <Button
                onClick={() => setLocation("/")}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
              >
                <Home className="w-4 h-4 mr-2" />
                Browse Courses
              </Button>
            )}
            <Button
              onClick={() => setLocation("/")}
              variant="outline"
              className="px-6 py-2.5 rounded-lg"
            >
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
