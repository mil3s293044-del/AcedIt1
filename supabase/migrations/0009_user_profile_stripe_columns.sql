-- ─── 0009: add Stripe linkage columns to user_profiles ─────────────────────
-- Needed by stripeCheckout / verifySubscription / stripe-webhook to track
-- which Stripe customer + subscription belongs to each user.

alter table public.user_profiles
    add column if not exists stripe_customer_id      text,
    add column if not exists stripe_subscription_id  text;

create index if not exists user_profiles_stripe_customer_idx
    on public.user_profiles (stripe_customer_id);
create index if not exists user_profiles_stripe_subscription_idx
    on public.user_profiles (stripe_subscription_id);
