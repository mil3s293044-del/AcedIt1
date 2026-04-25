import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@14.10.0';

Deno.serve(async (req) => {
    console.log('[verifySubscription] ========== START ==========');
    
    try {
        // Step 1: Authenticate user
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            console.log('[verifySubscription] ❌ No authenticated user');
            return Response.json({ 
                success: false, 
                error: 'Unauthorized' 
            }, { status: 401 });
        }
        
        console.log('[verifySubscription] Step 1: User authenticated -', user.email);
        
        // Step 2: Get sessionId from request
        const body = await req.json();
        const sessionId = body.sessionId;
        
        console.log('[verifySubscription] Step 2: Received sessionId -', sessionId);
        
        if (!sessionId) {
            console.log('[verifySubscription] ❌ No sessionId provided');
            return Response.json({ 
                success: false, 
                error: 'No sessionId provided' 
            }, { status: 400 });
        }
        
        // Step 3: Initialize Stripe with secret key
        const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
        if (!stripeKey) {
            console.log('[verifySubscription] ❌ STRIPE_SECRET_KEY not configured');
            return Response.json({ 
                success: false, 
                error: 'Stripe not configured' 
            }, { status: 500 });
        }
        
        const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
        console.log('[verifySubscription] Step 3: Stripe initialized');
        
        // Step 4: Retrieve checkout session from Stripe
        console.log('[verifySubscription] Step 4: Retrieving session from Stripe...');
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        
        console.log('[verifySubscription] Session retrieved:', {
            id: session.id,
            payment_status: session.payment_status,
            customer: session.customer,
            subscription: session.subscription
        });
        
        // Step 5: Check if payment is successful
        if (session.payment_status !== 'paid') {
            console.log('[verifySubscription] ⚠️ Payment not paid. Status:', session.payment_status);
            return Response.json({ 
                success: false, 
                error: 'Payment not completed',
                payment_status: session.payment_status
            });
        }
        
        console.log('[verifySubscription] Step 5: ✅ Payment status is PAID');
        
        // Step 6: Get subscription details
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        // Use exactly 30 days from now as the expiry
        const subscriptionEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        console.log('[verifySubscription] Step 6: Subscription details -', {
            id: subscription.id,
            status: subscription.status,
            expires: subscriptionEndDate.toISOString()
        });
        
        // Step 7: Update user to premium
        console.log('[verifySubscription] Step 7: Updating user to premium...');
        const profiles = await base44.asServiceRole.entities.UserProfile.filter({ 
            created_by: user.email 
        });
        
        const updateData = {
            subscription_tier: 'premium',
            user_role: 'premium_user',
            ai_credits: 999999,
            subscription_expires_at: subscriptionEndDate.toISOString(),
            stripe_subscription_id: subscription.id,
            stripe_customer_id: session.customer
        };
        
        let updatedProfile;
        if (profiles.length > 0) {
            updatedProfile = await base44.asServiceRole.entities.UserProfile.update(profiles[0].id, updateData);
            console.log('[verifySubscription] ✅ Existing profile updated to premium');
        } else {
            updatedProfile = await base44.asServiceRole.entities.UserProfile.create({
                ...updateData,
                created_by: user.email
            });
            console.log('[verifySubscription] ✅ New premium profile created');
        }
        
        // Ensure update is complete before returning
        console.log('[verifySubscription] Step 8: Verifying database update completed...');
        console.log('[verifySubscription] Updated profile tier:', updatedProfile.subscription_tier);
        
        console.log('[verifySubscription] ========== SUCCESS ==========');
        return Response.json({ 
            success: true,
            tier: 'premium',
            expires_at: subscriptionEndDate.toISOString()
        });
        
    } catch (error) {
        console.log('[verifySubscription] ❌ ERROR:', error.message);
        console.log('[verifySubscription] Error stack:', error.stack);
        console.log('[verifySubscription] ========== FAILED ==========');
        
        return Response.json({ 
            success: false, 
            error: error.message
        }, { status: 500 });
    }
});