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
          <li><strong>Assessment results</strong> — where you choose to enter them, the marks you record against SACs and assessments on your planner. These are used to show your own progress and, only if you open a line about one yourself, to settle it.</li>
          <li><strong>Uploads</strong> — files and photos of notes you upload to generate study material. These are deleted automatically, usually within a day; see "How long we keep it" below.</li>
          <li><strong>Usage and device data</strong> — pages visited, features used, IP address, browser and device type. Some of this is collected through analytics tools, which only run if you have agreed and are never used on an account belonging to someone under 18.</li>
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
          We use analytics and advertising pixels from Meta
          (Facebook/Instagram), TikTok and Google Analytics to understand site
          traffic and measure our advertising. <strong>None of them load until
          you agree.</strong> When you first visit we ask, and nothing is sent
          anywhere unless you choose to allow it &mdash; declining costs you no
          part of the Service.
        </p>
        <p>
          <strong>We never use advertising or analytics tools on the account of
          anyone under 18</strong>, whatever has been agreed to, so a student
          account is not tracked by them at all.
        </p>
        <p>
          You can change your mind at any time from Settings. Because a script
          already loaded in your browser cannot be recalled, withdrawing consent
          stops anything further being sent; to clear cookies those tools have
          already set, use your browser&rsquo;s settings.
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
          The Service is designed for high-school students, most of whom are
          under 18. We ask every account holder for their date of birth, and
          what we do with your information depends on the answer:
        </p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li><strong>Under 13</strong> &mdash; you cannot hold an account. If you tell us you are under 13 we will not let the account continue, and you can contact us to have it removed.</li>
          <li><strong>Under 16</strong> &mdash; the social parts of the Service (Compete, leaderboards, markets) are switched off for your account.</li>
          <li><strong>Under 18</strong> &mdash; we ask you to confirm that a parent or guardian knows about and agrees to your use of the Service, and we do not use advertising or analytics tools on your account. Other students cannot open a question about your study on the Compete board unless you switch that on yourself.</li>
        </ul>
        <p>
          We do not independently verify a date of birth or a parent&rsquo;s
          agreement. If you are a parent or guardian and want to see, correct or
          delete your child&rsquo;s information, contact us and we will help.
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
