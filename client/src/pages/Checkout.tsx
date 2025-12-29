import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { Loader2, CreditCard, Coins, ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { getLoginUrl } from "@/const";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useState, useEffect } from "react";
import { toast } from "sonner";

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

function StripePaymentForm({ courseId, onSuccess }: { courseId: number; onSuccess: () => void }) {
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

export default function Checkout() {
  const [, params] = useRoute("/checkout/:id");
  const courseId = params?.id ? parseInt(params.id) : null;
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'crypto' | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const { data: course, isLoading: courseLoading } = trpc.courses.getById.useQuery(
    { id: courseId! },
    { enabled: !!courseId }
  );

  const createStripeIntent = trpc.payments.createStripeIntent.useMutation({
    onSuccess: (data) => {
      setClientSecret(data.clientSecret);
      toast.success('Payment form ready');
    },
    onError: (error) => {
      toast.error(error.message);
      if (error.message.includes('not configured')) {
        toast.info('Stripe is not configured yet. Please contact support.');
      }
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast.error('Please sign in to continue');
      window.location.href = getLoginUrl();
    }
  }, [authLoading, isAuthenticated]);

  const handleSelectPaymentMethod = (method: 'stripe' | 'crypto') => {
    setPaymentMethod(method);
    
    if (method === 'stripe' && courseId) {
      createStripeIntent.mutate({ courseId });
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

  if (authLoading || courseLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!course) {
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
              <div className="flex justify-between items-center text-lg font-semibold">
                <span>Total</span>
                <span className="text-2xl">
                  {course.currency === 'USD' ? '$' : course.currency}
                  {parseFloat(course.price).toFixed(2)}
                </span>
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
                    onClick={() => {
                      setPaymentMethod(null);
                      setClientSecret(null);
                    }}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Change payment method
                  </Button>
                  <Elements stripe={stripePromise} options={{ clientSecret }}>
                    <StripePaymentForm courseId={courseId!} onSuccess={handlePaymentSuccess} />
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
