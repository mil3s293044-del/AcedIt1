import React from "react";
import LegalLayout, { LegalSection } from "@/components/legal/LegalLayout";

export default function Terms() {
  return (
    <LegalLayout title="Terms of Service" lastUpdated="30 June 2026">
      <p>
        These Terms of Service ("Terms") govern your use of AcedIt ("AcedIt",
        "we", "us" or "our"), available at acedit.au and as a study application
        (the "Service"). By creating an account or using the Service, you agree
        to these Terms. If you do not agree, please do not use the Service.
      </p>

      <LegalSection heading="Eligibility and student accounts">
        <p>
          The Service is intended for high-school students studying the VCE. If
          you are under 18, you may use the Service only with the knowledge and
          consent of a parent or guardian, who agrees to these Terms on your
          behalf. You are responsible for ensuring the information you give us is
          accurate and kept up to date.
        </p>
      </LegalSection>

      <LegalSection heading="Your account">
        <p>
          You are responsible for keeping your login details secure and for all
          activity that happens under your account. Let us know promptly at{" "}
          <a href="mailto:support@acedit.au" className="text-primary underline">support@acedit.au</a>{" "}
          if you believe your account has been used without your permission.
        </p>
      </LegalSection>

      <LegalSection heading="Subscriptions, billing and cancellation">
        <ul className="list-disc pl-6 space-y-1.5">
          <li>AcedIt offers a free trial period, after which premium features require a paid subscription.</li>
          <li>Paid subscriptions are billed in advance on a recurring basis through our payment provider, Stripe, and renew automatically until cancelled.</li>
          <li>You can cancel at any time from your account settings. Cancellation stops future renewals; you keep premium access until the end of the current billing period.</li>
          <li>Prices are shown at checkout in Australian dollars and may change with notice for future billing periods.</li>
          <li>Nothing in these Terms limits your rights under the Australian Consumer Law, including any rights to a remedy that cannot lawfully be excluded.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>use the Service for anything unlawful or harmful;</li>
          <li>share, resell or give others access to your account;</li>
          <li>attempt to disrupt, reverse-engineer, scrape or overload the Service;</li>
          <li>abuse, harass or impersonate others through leaderboards, competitions or social features; or</li>
          <li>misuse AI features to generate harmful, misleading or inappropriate content.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="AI study tools and academic integrity">
        <p>
          AcedIt uses artificial intelligence to generate study material,
          feedback and practice content. AI output can be incomplete, inaccurate
          or out of date, and is provided as a study aid only. It is not a
          substitute for official VCAA materials, your school, or your teachers,
          and we do not guarantee any particular academic result.
        </p>
        <p>
          You are responsible for using the Service in line with your school's
          and the VCAA's academic-integrity rules. Do not submit AI-generated
          work as your own where that is not permitted.
        </p>
      </LegalSection>

      <LegalSection heading="Intellectual property">
        <p>
          The Service, including its software, design and content we provide, is
          owned by AcedIt and protected by law. We grant you a personal,
          non-transferable, non-exclusive right to use the Service for your own
          study. Content you create remains yours, and you grant us the rights
          needed to host and display it so we can provide the Service to you.
        </p>
      </LegalSection>

      <LegalSection heading="Suspension and termination">
        <p>
          You may stop using the Service and delete your account at any time. We
          may suspend or terminate access if you breach these Terms or use the
          Service in a way that harms other users or us. Where reasonable, we
          will give you notice.
        </p>
      </LegalSection>

      <LegalSection heading="Disclaimers and liability">
        <p>
          The Service is provided on an "as is" and "as available" basis. To the
          maximum extent permitted by law, and subject to the Australian Consumer
          Law, we exclude all warranties not expressly stated and are not liable
          for indirect or consequential loss. Where liability cannot be excluded,
          our liability is limited to re-supplying the Service or paying the cost
          of re-supply.
        </p>
      </LegalSection>

      <LegalSection heading="Governing law">
        <p>
          These Terms are governed by the laws of Victoria, Australia, and you
          submit to the non-exclusive jurisdiction of the courts of that state.
        </p>
      </LegalSection>

      <LegalSection heading="Changes to these Terms">
        <p>
          We may update these Terms from time to time. We will post the updated
          version here with a new "Last updated" date, and significant changes
          may also be notified within the Service. Continuing to use the Service
          after changes take effect means you accept the updated Terms.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Questions about these Terms? Email us at{" "}
          <a href="mailto:support@acedit.au" className="text-primary underline">support@acedit.au</a>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
