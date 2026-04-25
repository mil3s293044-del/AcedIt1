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
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { returnUrl } = await req.json();

        console.log('Portal request for user:', user.email);

        // Find or get Stripe customer
        const customers = await stripe.customers.list({
            email: user.email,
            limit: 1
        });

        if (customers.data.length === 0) {
            console.log('No customer found for:', user.email);
            return Response.json({ error: 'No Stripe customer found. Please subscribe first.' }, { status: 404 });
        }

        const customer = customers.data[0];
        console.log('Found customer:', customer.id);

        // Create portal session
        const session = await stripe.billingPortal.sessions.create({
            customer: customer.id,
            return_url: returnUrl || `${new URL(req.url).origin}/Subscription`,
        });

        console.log('Portal session created:', session.url);
        return Response.json({ portalUrl: session.url });
    } catch (error) {
        console.error('Stripe portal error:', error);
        console.error('Error details:', {
            message: error.message,
            type: error.type,
            code: error.code,
            statusCode: error.statusCode
        });
        return Response.json({ 
            error: error.message || 'Failed to create portal session',
            details: error.type || 'stripe_error'
        }, { status: 500 });
    }
});