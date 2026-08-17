import React from "react";
import LegalLayout, { LegalSection } from "@/components/legal/LegalLayout";

export default function Privacy() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="30 June 2026">
      <p>
        This Privacy Policy explains how AcedIt ("AcedIt", "we", "us" or "our")
        collects, uses, stores and discloses your personal information when you
        use our website at acedit.au and our study application (together, the
        "Service"). We handle personal information in accordance with the
        Australian Privacy Act 1988 (Cth) and the Australian Privacy Principles
        (APPs).
      </p>
      <p>
        By using the Service you agree to the collection and use of information
        in line with this policy. If you do not agree, please do not use the
        Service.
      </p>

      <LegalSection heading="Who we are">
        <p>
          AcedIt is a study application built for Victorian Certificate of
          Education (VCE) students. You can contact us about privacy at{" "}
          <a href="mailto:support@acedit.au" className="text-primary underline">support@acedit.au</a>.
        </p>
      </LegalSection>

      <LegalSection heading="Information we collect">
        <p>We collect the following kinds of personal information:</p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li><strong>Account information</strong> — your name and email address, provided when you sign up (including via Google sign-in).</li>
          <li><strong>Study profile</strong> — your year level, the VCE subjects you select, study goals, and similar preferences you give us.</li>
          <li><strong>Study activity</strong> — quizzes, flashcards, notes, study sessions, streaks, XP, leaderboard standings and other content you create or generate while using the Service.</li>
          <li><strong>Payment information</strong> — if you subscribe, payments are processed by Stripe. We do not collect or store your full card details; we receive only limited confirmation and subscription status from Stripe.</li>
          <li><strong>Usage and device data</strong> — pages visited, features used, approximate location, browser and device type, collected through cookies and analytics tools (see "Cookies and tracking" below).</li>
        </ul>
      </LegalSection>

      <LegalSection heading="How we use your information">
        <p>We use personal information to:</p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>create and manage your account and provide the Service;</li>
          <li>generate personalised study tools, feedback and AI responses;</li>
          <li>process subscriptions, payments and renewals;</li>
          <li>operate leaderboards, competitions and social features;</li>
          <li>respond to support requests and send service-related emails;</li>
          <li>understand how the Service is used and improve it;</li>
          <li>measure the effectiveness of our marketing; and</li>
          <li>meet our legal obligations and protect against misuse or fraud.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="Cookies and tracking">
        <p>
          We use cookies and similar technologies, including analytics and
          advertising pixels from Meta (Facebook/Instagram), TikTok and Google
          Analytics, to understand site traffic and measure our advertising.
          These tools may set cookies and collect usage data through your
          browser. You can control cookies through your browser settings and opt
          out of personalised advertising through each platform's ad settings.
        </p>
      </LegalSection>

      <LegalSection heading="When we share your information">
        <p>
          We do not sell your personal information. We share it only with service
          providers who help us run the Service, under obligations of
          confidentiality, including:
        </p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li><strong>Supabase</strong> — database, authentication and hosting;</li>
          <li><strong>Stripe</strong> — payment processing;</li>
          <li><strong>Anthropic</strong> — AI processing of study prompts to generate responses;</li>
          <li><strong>Resend</strong> — sending service and support emails;</li>
          <li><strong>Meta, TikTok and Google</strong> — analytics and advertising measurement.</li>
        </ul>
        <p>
          We may also disclose information where required by law, or to protect
          the rights, safety and property of AcedIt, our users or others.
        </p>
      </LegalSection>

      <LegalSection heading="Students and young people">
        <p>
          The Service is designed for high-school students, many of whom are
          under 18. We only knowingly collect information from a student where
          they are capable of giving consent, or where a parent or guardian has
          consented. If you are under 18, please make sure your parent or
          guardian is aware of and agrees to your use of the Service.
        </p>
        <p>
          If you believe we have collected information from a child without
          appropriate consent, contact us at{" "}
          <a href="mailto:support@acedit.au" className="text-primary underline">support@acedit.au</a>{" "}
          and we will take reasonable steps to delete it.
        </p>
      </LegalSection>

      <LegalSection heading="Storage, security and overseas transfer">
        <p>
          We take reasonable steps to protect your information from misuse, loss
          and unauthorised access, including access controls and encryption in
          transit. Some of our service providers store or process data on servers
          located outside Australia. By using the Service, you consent to your
          information being transferred to and stored in those locations, which
          may not have the same data-protection laws as Australia.
        </p>
      </LegalSection>

      <LegalSection heading="Data retention">
        <p>
          We keep personal information for as long as your account is active and
          as needed to provide the Service, comply with our legal obligations,
          resolve disputes and enforce our agreements. When information is no
          longer needed, we take reasonable steps to delete or de-identify it.
        </p>
      </LegalSection>

      <LegalSection heading="Your rights">
        <p>
          Under the Australian Privacy Principles you may request access to the
          personal information we hold about you, and ask us to correct it if it
          is inaccurate. You can also ask us to delete your account and
          associated data. To make a request, email{" "}
          <a href="mailto:support@acedit.au" className="text-primary underline">support@acedit.au</a>.
          We will respond within a reasonable time.
        </p>
      </LegalSection>

      <LegalSection heading="Complaints">
        <p>
          If you have a concern about how we have handled your personal
          information, please contact us first at{" "}
          <a href="mailto:support@acedit.au" className="text-primary underline">support@acedit.au</a>{" "}
          so we can try to resolve it. If you are not satisfied, you may lodge a
          complaint with the Office of the Australian Information Commissioner
          (OAIC) at oaic.gov.au.
        </p>
      </LegalSection>

      <LegalSection heading="Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. We will post the
          updated version here with a new "Last updated" date. Significant
          changes may also be notified within the Service.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
