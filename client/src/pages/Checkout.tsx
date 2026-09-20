import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { Loader2, CreditCard, Coins, ArrowLeft, CheckCircle2, XCircle, Tag, Package } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { getLoginUrl } from "@/const";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useState, useEffect } from "react";
import { toast } from "sonner";

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

function StripePaymentForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/payment-success`,
      },
    });

    if (error) {
      setErrorMessage(error.message || 'Payment failed');
      setIsProcessing(false);
    } else {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      {errorMessage && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
          <XCircle className="h-4 w-4" />
          {errorMessage}
        </div>
      )}
      <Button 
        type="submit" 
        disabled={!stripe || isProcessing} 
        className="w-full"
        size="lg"
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="mr-2 h-4 w-4" />
            Pay with Card
          </>
        )}
      </Button>
    </form>
  );
}

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

export default function Checkout() {
  const [, params] = useRoute("/checkout/:id");
  const isBundle = params?.id === "bundle";
  const courseId = !isBundle && params?.id ? parseInt(params.id) : null;
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'crypto' | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; percentOff: number } | null>(null);

  const { data: course, isLoading: courseLoading } = trpc.courses.getById.useQuery(
    { id: courseId! },
    { enabled: courseId !== null }
  );
  const { data: bundle, isLoading: bundleLoading } = trpc.payments.getBundle.useQuery(
    undefined,
    { enabled: isBundle }
  );

  const validatePromo = trpc.promos.validate.useQuery(
    { code: promoInput.trim() },
    { enabled: false, retry: false }
  );

  const resetPayment = () => {
    setPaymentMethod(null);
    setClientSecret(null);
  };

  const handleApplyPromo = async () => {
    const code = promoInput.trim();
    if (!code) return;
    resetPayment();
    const result = await validatePromo.refetch();
    if (result.data) {
      setAppliedPromo(result.data);
      toast.success(`Promo applied: ${result.data.percentOff}% off (${result.data.code})`);
    } else {
      setAppliedPromo(null);
      toast.error("That promo code isn't valid.");
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoInput("");
    resetPayment();
  };

  // Display pricing (server recomputes the real charge)
  const basePrice = isBundle
    ? bundle?.price ?? 0
    : course
      ? parseFloat(course.price)
      : 0;
  const discount = appliedPromo ? Math.round(basePrice * (appliedPromo.percentOff / 100) * 100) / 100 : 0;
  const total = Math.round((basePrice - discount) * 100) / 100;

  const intentError = (error: { message: string }) => {
    toast.error(error.message);
    if (error.message.includes('not configured')) {
      toast.info('Stripe is not configured yet. Please contact support.');
    }
  };

  const createStripeIntent = trpc.payments.createStripeIntent.useMutation({
    onSuccess: (data) => {
      setClientSecret(data.clientSecret);
      toast.success('Payment form ready');
    },
    onError: intentError,
  });

  const createBundleIntent = trpc.payments.createBundleIntent.useMutation({
    onSuccess: (data) => {
      setClientSecret(data.clientSecret);
      toast.success('Payment form ready');
    },
    onError: intentError,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast.error('Please sign in to continue');
      window.location.href = getLoginUrl();
    }
  }, [authLoading, isAuthenticated]);

  const handleSelectPaymentMethod = (method: 'stripe' | 'crypto') => {
    setPaymentMethod(method);
    
    if (method === 'stripe') {
      const promoCode = appliedPromo?.code;
      if (isBundle) {
        createBundleIntent.mutate({ promoCode });
      } else if (courseId) {
        createStripeIntent.mutate({ courseId, promoCode });
      }
    } else if (method === 'crypto') {
      toast.info('Cryptocurrency payment coming soon!');
    }
  };

  const handlePaymentSuccess = () => {
    toast.success('Payment successful! Redirecting...');
    setTimeout(() => {
      setLocation('/my-courses');
    }, 2000);
  };

  if (authLoading || courseLoading || bundleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isBundle && !course) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <p className="text-lg font-semibold mb-2">Course not found</p>
            <Button onClick={() => setLocation('/')}>Back to Courses</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isBundle && (!bundle || bundle.count === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <p className="text-lg font-semibold mb-2">Bundle not available</p>
            <Button onClick={() => setLocation('/')}>Back to Courses</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-12 px-4">
      <div className="container max-w-4xl">
        <Button 
          variant="ghost" 
          onClick={() => setLocation('/')}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Courses
        </Button>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
              <CardDescription>Review your purchase</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isBundle && bundle ? (
                <>
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600">
                      <Package className="h-6 w-6 text-white" />
                    </span>
                    <div>
                      <h3 className="font-semibold text-lg">Complete Bundle</h3>
                      <p className="text-sm text-muted-foreground">
                        All {bundle.count} courses, lifetime access
                      </p>
                    </div>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1 max-h-48 overflow-y-auto pr-1">
                    {bundle.courses.map((c) => (
                      <li key={c.id} className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <span className="truncate">{c.title}</span>
                      </li>
                    ))}
                  </ul>
                  <Separator />
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Total value</span>
                    <span className="line-through">{money(bundle.totalValue)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Bundle price</span>
                    <span>{money(bundle.price)}</span>
                  </div>
                </>
              ) : course ? (
                <>
                  {course.imageUrl && (
                    <img 
                      src={course.imageUrl} 
                      alt={course.title}
                      className="w-full aspect-video object-cover rounded-md"
                    />
                  )}
                  <div>
                    <h3 className="font-semibold text-lg">{course.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{course.description}</p>
                  </div>
                  <Separator />
                </>
              ) : null}
              {discount > 0 && appliedPromo && (
                <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400">
                  <span>Promo {appliedPromo.code} ({appliedPromo.percentOff}% off)</span>
                  <span>-{money(discount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-lg font-semibold">
                <span>Total</span>
                <span className="text-2xl">{money(total)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Payment Options */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Method</CardTitle>
              <CardDescription>Choose how you'd like to pay</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Promo code */}
              <div className="space-y-2">
                <Label htmlFor="promo">Promo code</Label>
                {appliedPromo ? (
                  <div className="flex items-center justify-between rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                    <span className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                      <Tag className="h-4 w-4" />
                      {appliedPromo.code} — {appliedPromo.percentOff}% off
                    </span>
                    <Button variant="ghost" size="sm" onClick={handleRemovePromo}>
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      id="promo"
                      placeholder="Enter code (try LAUNCH30)"
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleApplyPromo(); } }}
                    />
                    <Button
                      variant="outline"
                      onClick={handleApplyPromo}
                      disabled={!promoInput.trim() || validatePromo.isFetching}
                    >
                      {validatePromo.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                    </Button>
                  </div>
                )}
              </div>

              <Separator />

              {!paymentMethod ? (
                <>
                  <Button
                    variant="outline"
                    className="w-full h-auto py-6 justify-start"
                    onClick={() => handleSelectPaymentMethod('stripe')}
                  >
                    <div className="flex items-center gap-4 w-full">
                      <CreditCard className="h-8 w-8 text-primary" />
                      <div className="text-left">
                        <div className="font-semibold">Credit or Debit Card</div>
                        <div className="text-sm text-muted-foreground">
                          Pay securely with Stripe
                        </div>
                      </div>
                    </div>
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <Separator />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">Or</span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full h-auto py-6 justify-start"
                    onClick={() => handleSelectPaymentMethod('crypto')}
                  >
                    <div className="flex items-center gap-4 w-full">
                      <Coins className="h-8 w-8 text-primary" />
                      <div className="text-left">
                        <div className="font-semibold">Cryptocurrency</div>
                        <div className="text-sm text-muted-foreground">
                          Bitcoin, Ethereum, USDC & more
                        </div>
                      </div>
                    </div>
                  </Button>
                </>
              ) : paymentMethod === 'stripe' && clientSecret ? (
                <div className="space-y-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetPayment}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Change payment method
                  </Button>
                  <Elements stripe={stripePromise} options={{ clientSecret }}>
                    <StripePaymentForm onSuccess={handlePaymentSuccess} />
                  </Elements>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <p className="text-sm text-muted-foreground mt-2">Loading payment form...</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
