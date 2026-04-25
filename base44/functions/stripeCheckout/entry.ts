import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@14.10.0';

const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
if (!stripeKey) {
    throw new Error('STRIPE_SECRET_KEY not configured');
}

const stripe = new Stripe(stripeKey, {
    apiVersion: '2023-10-16',
});

Deno.serve(async (req) => {
    let userEmail = null;
    let priceId = null;
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        userEmail = user.email;

        const body = await req.json();
        priceId = body.priceId;
        const { successUrl, cancelUrl } = body;

        if (!priceId) {
            return Response.json({ error: 'Missing priceId' }, { status: 400 });
        }

        // Get or create Stripe customer
        const customers = await stripe.customers.list({ email: user.email, limit: 1 });

        let customer;
        if (customers.data.length > 0) {
            customer = customers.data[0];
        } else {
            customer = await stripe.customers.create({
                email: user.email,
                name: user.full_name,
                metadata: { user_id: user.id, user_email: user.email }
            });
        }

        const session = await stripe.checkout.sessions.create({
            customer: customer.id,
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],
            mode: 'subscription',
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: { user_id: user.id, user_email: user.email },
            allow_promotion_codes: true,
        });

        return Response.json({ checkoutUrl: session.url });
    } catch (error) {
        console.error('Stripe checkout error:', error.message, { userEmail, priceId });
        return Response.json({ 
            error: error.message || 'Checkout failed',
        }, { status: 500 });
    }
});