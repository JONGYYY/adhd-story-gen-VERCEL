import Link from 'next/link';
import { PageContainer } from '@/components/layout/page-container';

export default function Terms() {
  return (
    <PageContainer>
      <div className="bg-gray-800 border-b border-gray-700 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-bold text-white">Terms of Service</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="prose prose-invert max-w-none">
          <p className="text-lg text-gray-300">
            Last updated: January 26, 2026
          </p>

          <p>
            These Terms of Service (“Terms”) govern your access to and use of StoryGen AI (the “Service”), available at{' '}
            <a href="https://taleo.media" className="text-primary hover:text-primary-dark">taleo.media</a>. By using the Service, you agree to these Terms.
          </p>

          <h2>1. Eligibility</h2>
          <p>
            You must be at least 13 years old (or the minimum age required in your country) to use the Service. If you are using the Service on behalf of
            an organization, you represent that you have authority to bind that organization.
          </p>

          <h2>2. The Service</h2>
          <p>
            StoryGen AI helps you generate short-form videos from story text, including voiceover generation, background video composition, and optional
            posting to connected social media accounts (e.g., TikTok) at your direction.
          </p>

          <h2>3. Accounts and Security</h2>
          <ul>
            <li>You are responsible for all activity under your account.</li>
            <li>You must provide accurate information and keep it up to date.</li>
            <li>You must keep your login credentials secure and notify us promptly of any unauthorized access.</li>
          </ul>

          <h2>4. Your Content and Permissions</h2>
          <p>
            “Your Content” includes text you submit, videos you generate, captions, and other materials you upload or create using the Service.
          </p>
          <ul>
            <li><strong>You own Your Content</strong> as between you and us, subject to any third-party rights.</li>
            <li>
              <strong>You are responsible</strong> for ensuring you have all rights needed to submit Your Content and to publish it (including on TikTok or other platforms).
            </li>
            <li>
              You grant us a limited, non-exclusive, worldwide license to host, process, store, and display Your Content solely to operate, maintain,
              and improve the Service and to generate the outputs you request.
            </li>
          </ul>

          <h2>5. AI Output; No Guarantees</h2>
          <ul>
            <li>
              The Service may generate content that is inaccurate, incomplete, or similar to existing material. You are responsible for reviewing outputs before publishing.
            </li>
            <li>
              We do not guarantee virality, engagement, revenue, or platform acceptance for any content generated using the Service.
            </li>
          </ul>

          <h2>6. Acceptable Use</h2>
          <p>You agree not to use the Service to generate, upload, or distribute content that:</p>
          <ul>
            <li>Violates any law or regulation</li>
            <li>Infringes intellectual property or privacy rights</li>
            <li>Is deceptive, fraudulent, or impersonates others</li>
            <li>Includes hate speech, harassment, or threats</li>
            <li>Contains sexual content involving minors or any illegal sexual content</li>
            <li>Distributes malware, attempts to exploit systems, or interferes with the Service</li>
          </ul>

          <h2>7. Third-Party Services (TikTok, OpenAI, ElevenLabs, Stripe, etc.)</h2>
          <p>
            The Service may integrate with third-party services. Your use of those third-party services is governed by their terms and policies. For example:
          </p>
          <ul>
            <li>
              <strong>TikTok</strong>: if you connect TikTok and upload content, you are authorizing us to act on your behalf for the permissions you grant.
            </li>
            <li>
              <strong>Payments</strong>: if you purchase a subscription, payments are processed by a third-party payment processor.
            </li>
            <li>
              <strong>AI/Voice providers</strong>: story and voice generation may be processed by third-party AI providers.
            </li>
          </ul>
          <p>
            We are not responsible for third-party services and may suspend or remove integrations at any time.
          </p>

          <h2>8. Subscriptions and Billing</h2>
          <ul>
            <li>Some features may require a paid subscription.</li>
            <li>Fees (if any) are described in the Service at the time of purchase.</li>
            <li>Unless otherwise stated, subscriptions renew automatically until canceled.</li>
          </ul>

          <h2>9. Suspension and Termination</h2>
          <p>
            We may suspend or terminate your access to the Service if we reasonably believe you violated these Terms, applicable law, or third-party platform policies.
            You may stop using the Service at any time.
          </p>

          <h2>10. Disclaimers</h2>
          <p>
            THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE.” TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED,
            INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
          </p>

          <h2>11. Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, STORYGEN AI WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES,
            OR ANY LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL, ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE.
          </p>

          <h2>12. Indemnity</h2>
          <p>
            You agree to indemnify and hold harmless StoryGen AI from claims arising out of Your Content, your use of the Service, or your violation of these Terms
            or third-party rights.
          </p>

          <h2>13. Changes</h2>
          <p>
            We may update these Terms from time to time. If we make material changes, we will provide notice through the Service or by other reasonable means.
          </p>

          <h2>14. Contact</h2>
          <p>
            Questions about these Terms? Contact us at{' '}
            <a href="mailto:support@storygen.ai" className="text-primary hover:text-primary-dark">support@storygen.ai</a>.
            {' '}Also see our{' '}
            <Link href="/privacy" className="text-primary hover:text-primary-dark">Privacy Policy</Link>.
          </p>

          <div className="mt-8 border-t border-gray-700 pt-8">
            <p className="text-gray-400">
              By using the Service, you acknowledge that you have read and understand these Terms and agree to be bound by them.
            </p>
          </div>
        </div>
      </div>
    </PageContainer>
  );
} 