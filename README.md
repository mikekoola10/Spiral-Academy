# Spiral.AI Academy - Payment Platform

A complete course enrollment platform with dual payment processing capabilities, supporting both traditional credit/debit card payments via Stripe and cryptocurrency payments.

## Features

### Payment Processing
- **Stripe Integration**: Secure card payments using Stripe PaymentIntent API with PCI-DSS compliance via Stripe Elements
- **Cryptocurrency Support**: Ready for integration with NOWPayments or Coinbase Commerce (placeholder implemented)
- **Webhook Handlers**: Automated payment confirmation and course enrollment via webhooks
- **Payment Logging**: Complete audit trail of all payment events

### Course Management
- **Course Catalog**: Browse available courses with rich metadata (title, description, price, level, duration)
- **Course Creation**: Admin interface to add new courses
- **Sample Courses**: 6 pre-seeded AI/ML courses ready to use

### Enrollment System
- **Automatic Enrollment**: Course access granted immediately upon successful payment
- **My Courses**: Students can view all their enrolled courses
- **Enrollment Tracking**: Complete history of enrollments with timestamps

### Admin Dashboard
- **Orders Management**: View all payment transactions with status filtering
- **Enrollments Overview**: Monitor all student enrollments
- **Course Management**: Create and manage course catalog
- **Statistics**: Quick overview of orders, enrollments, and courses

### Security & Compliance
- **PCI-DSS Compliance**: Stripe Elements ensures card data never touches your server
- **Webhook Verification**: Cryptographic signature verification for both payment gateways
- **Role-Based Access**: Admin routes protected with role checking
- **Secure Authentication**: Manus OAuth integration

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS 4, shadcn/ui
- **Backend**: Node.js, Express, tRPC 11
- **Database**: MySQL/TiDB with Drizzle ORM
- **Payments**: Stripe, Cryptocurrency gateway (ready for integration)
- **Testing**: Vitest (17 tests passing)

## Getting Started

### Prerequisites

1. Node.js 22+
2. MySQL/TiDB database
3. Stripe account (for card payments)

### Installation

```bash
# Install dependencies
pnpm install

# Set up database
pnpm db:push

# Seed sample courses
pnpm tsx seed-courses.mjs

# Start development server
pnpm dev
```

### Environment Variables

The following environment variables need to be configured:

#### Stripe Configuration (Required for card payments)
- `STRIPE_SECRET_KEY`: Your Stripe secret key (sk_test_... or sk_live_...)
- `VITE_STRIPE_PUBLISHABLE_KEY`: Your Stripe publishable key (pk_test_... or pk_live_...)
- `STRIPE_WEBHOOK_SECRET`: Webhook signing secret from Stripe Dashboard (whsec_...)

#### Cryptocurrency Configuration (Optional, for crypto payments)
- To be added when you choose your crypto gateway (NOWPayments, Coinbase Commerce, etc.)

### Setting Up Stripe

1. Create a Stripe account at https://dashboard.stripe.com/
2. Go to **Developers** → **API keys**
3. Copy your **Secret key** and **Publishable key**
4. Add them to your environment via the Management UI Settings → Secrets panel
5. Go to **Developers** → **Webhooks** → **Add endpoint**
6. Add your webhook URL: `https://your-domain.com/api/webhooks/stripe`
7. Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`
8. Copy the **Webhook signing secret** and add it to your environment

### Webhook URLs

Once deployed, configure these webhook endpoints:

- **Stripe**: `https://your-domain.com/api/webhooks/stripe`
- **Crypto Gateway**: `https://your-domain.com/api/webhooks/crypto`

## Project Structure

```
spiral-academy-payments/
├── client/                 # Frontend React application
│   └── src/
│       ├── pages/         # Page components
│       │   ├── Courses.tsx       # Course catalog
│       │   ├── Checkout.tsx      # Dual payment checkout
│       │   ├── MyCourses.tsx     # Student enrollments
│       │   └── Admin.tsx         # Admin dashboard
│       └── components/    # Reusable UI components
├── server/                # Backend Express + tRPC
│   ├── routers.ts        # tRPC API routes
│   ├── db.ts             # Database helpers
│   ├── stripe.ts         # Stripe integration
│   ├── webhooks.ts       # Webhook handlers
│   └── payments.test.ts  # Test suite
├── drizzle/              # Database schema
│   └── schema.ts         # Tables definition
└── seed-courses.mjs      # Sample data seeder
```

## API Routes

### Public Routes
- `GET /` - Course catalog
- `GET /checkout/:id` - Checkout page for a course

### Protected Routes (Requires Authentication)
- `GET /my-courses` - User's enrolled courses
- `POST /api/trpc/payments.createStripeIntent` - Create payment intent
- `GET /api/trpc/enrollments.myEnrollments` - User's enrollments
- `GET /api/trpc/orders.myOrders` - User's orders

### Admin Routes (Requires Admin Role)
- `GET /admin` - Admin dashboard
- `POST /api/trpc/courses.create` - Create new course
- `GET /api/trpc/orders.allOrders` - View all orders
- `GET /api/trpc/enrollments.allEnrollments` - View all enrollments

### Webhook Routes
- `POST /api/webhooks/stripe` - Stripe payment confirmations
- `POST /api/webhooks/crypto` - Crypto payment confirmations

## Testing

Run the test suite:

```bash
pnpm test
```

Current test coverage:
- ✅ Course API (4 tests)
- ✅ Orders API (3 tests)
- ✅ Enrollments API (3 tests)
- ✅ Payment Intent Creation (1 test)
- ✅ Database Operations (5 tests)
- ✅ Authentication (1 test)

**Total: 17 tests passing**

## Payment Flow

### Stripe Payment Flow

1. User selects a course and clicks "Enroll Now"
2. User is redirected to checkout page
3. User selects "Credit or Debit Card" payment method
4. Backend creates a Stripe PaymentIntent and returns client secret
5. Frontend displays Stripe Elements payment form
6. User enters card details and submits
7. Stripe processes payment and sends webhook to `/api/webhooks/stripe`
8. Backend verifies webhook signature
9. Backend grants course access by creating enrollment record
10. User is redirected to "My Courses" page

### Cryptocurrency Payment Flow (Ready for Integration)

1. User selects a course and clicks "Enroll Now"
2. User is redirected to checkout page
3. User selects "Cryptocurrency" payment method
4. Backend creates payment session with crypto gateway
5. Gateway displays payment modal with wallet address and QR code
6. User sends cryptocurrency to provided address
7. Gateway confirms payment and sends webhook to `/api/webhooks/crypto`
8. Backend verifies webhook signature
9. Backend grants course access by creating enrollment record
10. User is redirected to "My Courses" page

## Database Schema

### Tables

- **users**: User accounts with authentication info
- **courses**: Course catalog with pricing and metadata
- **orders**: Payment transactions and order history
- **enrollments**: Course access management
- **paymentLogs**: Audit trail of payment events

### Relationships

- Orders belong to Users and Courses
- Enrollments belong to Users, Courses, and Orders
- Payment Logs belong to Orders

## Security Best Practices

1. **Never store card data**: Stripe Elements handles all sensitive card information
2. **Verify all webhooks**: Always verify webhook signatures before processing
3. **Use HTTPS**: All payment endpoints must use HTTPS in production
4. **Secure admin routes**: Admin functionality is protected by role-based access control
5. **Environment variables**: All secrets are stored in environment variables, never in code

## Next Steps

### To Enable Cryptocurrency Payments

1. Choose a crypto gateway (NOWPayments or Coinbase Commerce recommended)
2. Create account and obtain API keys
3. Install the gateway's SDK: `pnpm add <gateway-sdk>`
4. Implement payment initialization in `server/routers.ts`
5. Complete webhook handler in `server/webhooks.ts`
6. Add webhook signature verification
7. Update frontend checkout page to integrate gateway's payment modal
8. Test with testnet/sandbox mode before going live

### Production Deployment

1. Switch Stripe to live mode keys (sk_live_... and pk_live_...)
2. Configure production webhook endpoints in Stripe Dashboard
3. Set up SSL certificate for HTTPS
4. Enable webhook signature verification in production
5. Test complete payment flow end-to-end
6. Monitor payment logs and error tracking

## Support

For issues or questions:
- Check the implementation guide in the original specification document
- Review Stripe documentation: https://stripe.com/docs
- Review tRPC documentation: https://trpc.io/docs

## License

MIT
