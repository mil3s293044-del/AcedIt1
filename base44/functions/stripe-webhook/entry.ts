import { createClient } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@14.21.0';

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
const base44AppId = Deno.env.get("BASE44_APP_ID");

if (!stripeSecretKey || !webhookSecret || !base44AppId) {
  throw new Error("Missing Stripe or Base44 environment variables");
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2023-10-16",
});

Deno.serve(async (req) => {
  // Only accept POST requests
  if (req.method !== "POST") {
    console.log("Received non-POST request, method:", req.method);
    return new Response("Method Not Allowed", { status: 405 });
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    console.error("Missing Stripe signature");
    return new Response("Missing Stripe signature", { status: 400 });
  }

  let event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret
    );
  } catch (err) {
    console.error("Webhook verification failed:", err);
    return new Response("Invalid webhook signature", { status: 400 });
  }

  console.log("✅ Webhook received:", event.type);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userEmail = session?.metadata?.user_email;

    console.log("Processing checkout completion for user:", userEmail);

    if (!userEmail) {
      console.error("❌ No user email in session metadata");
      return new Response("Missing user email", { status: 400 });
    }

    try {
      // Initialize Base44 SDK with service role
      const base44 = createClient(base44AppId);

      // Get the subscription details from Stripe
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      const subscriptionEndDate = new Date(subscription.current_period_end * 1000);

      console.log("Subscription details:", { 
        subscriptionId: subscription.id,
        customerId: subscription.customer,
        status: subscription.status,
        endDate: subscriptionEndDate.toISOString() 
      });

      // Find user's profile
      const profiles = await base44.asServiceRole.entities.UserProfile.filter({ 
        created_by: userEmail 
      });

      console.log(`Found ${profiles.length} profile(s) for user:`, userEmail);

      // Check if already processed (idempotency)
      const existingProfile = profiles[0];
      if (existingProfile?.stripe_subscription_id === subscription.id && existingProfile?.subscription_tier === 'premium') {
        console.log('Subscription already processed, skipping');
        return new Response(JSON.stringify({ success: true, message: 'Already processed' }), { 
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (profiles.length > 0) {
        // Update existing profile
        const updatedProfile = await base44.asServiceRole.entities.UserProfile.update(profiles[0].id, {
          subscription_tier: "premium",
          user_role: "premium_user",
          ai_credits: 999999,
          subscription_expires_at: subscriptionEndDate.toISOString(),
          stripe_subscription_id: subscription.id,
          stripe_customer_id: subscription.customer
        });
        console.log("✅ UPGRADED existing profile to premium:", userEmail, "Profile ID:", profiles[0].id);
        console.log("Updated profile data:", JSON.stringify(updatedProfile));
      } else {
        // Create new profile if it doesn't exist
        const newProfile = await base44.asServiceRole.entities.UserProfile.create({
          created_by: userEmail,
          subscription_tier: "premium",
          user_role: "premium_user",
          ai_credits: 999999,
          subscription_expires_at: subscriptionEndDate.toISOString(),
          stripe_subscription_id: subscription.id,
          stripe_customer_id: subscription.customer
        });
        console.log("✅ CREATED new premium profile:", userEmail, "Profile ID:", newProfile.id);
        console.log("New profile data:", JSON.stringify(newProfile));
      }

      return new Response(JSON.stringify({ success: true, upgraded: userEmail }), { 
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      console.error("❌ Error upgrading user to premium:", error);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      return new Response(JSON.stringify({ 
        error: "Upgrade failed", 
        details: error.message,
        userEmail: userEmail 
      }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object;
    const customer = await stripe.customers.retrieve(subscription.customer);
    const userEmail = customer.email;

    console.log("Subscription updated for user:", userEmail, "Status:", subscription.status);

    if (!userEmail) {
      console.error("No email found for customer");
      return new Response("Missing customer email", { status: 400 });
    }

    try {
      const base44 = createClient(base44AppId);
      const subscriptionEndDate = new Date(subscription.current_period_end * 1000);
      
      const profiles = await base44.asServiceRole.entities.UserProfile.filter({ 
        created_by: userEmail 
      });

      if (profiles.length > 0) {
        await base44.asServiceRole.entities.UserProfile.update(profiles[0].id, {
          subscription_tier: subscription.status === "active" ? "premium" : "free",
          user_role: subscription.status === "active" ? "premium_user" : "free_user",
          ai_credits: subscription.status === "active" ? 999999 : 500,
          subscription_expires_at: subscriptionEndDate.toISOString()
        });
        console.log("✅ Updated subscription status:", { userEmail, status: subscription.status });
      }
    } catch (error) {
      console.error("❌ Error updating subscription:", error);
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object;
    const customer = await stripe.customers.retrieve(subscription.customer);
    const userEmail = customer.email;

    console.log("Subscription cancelled for user:", userEmail);

    if (!userEmail) {
      return new Response("OK", { status: 200 });
    }

    try {
      const base44 = createClient(base44AppId);
      
      const profiles = await base44.asServiceRole.entities.UserProfile.filter({ 
        created_by: userEmail 
      });

      if (profiles.length > 0) {
        await base44.asServiceRole.entities.UserProfile.update(profiles[0].id, {
          subscription_tier: "free",
          user_role: "free_user",
          ai_credits: 500,
          subscription_expires_at: null
        });
        console.log("✅ Downgraded user to free:", userEmail);
      }
    } catch (error) {
      console.error("❌ Error downgrading user:", error);
    }
  }

  return new Response("OK", { status: 200 });
});