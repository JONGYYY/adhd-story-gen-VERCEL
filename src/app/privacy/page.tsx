import Link from 'next/link';
import { PageContainer } from '@/components/layout/page-container';

export default function Privacy() {
  return (
    <PageContainer>
      <div className="bg-gray-800 border-b border-gray-700 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-bold text-white">Privacy Policy</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="prose prose-invert max-w-none">
          <p className="text-lg text-gray-300">
            Last updated: January 26, 2026
          </p>

          <h2>1. Introduction</h2>
          <p>
            This Privacy Policy explains how StoryGen AI (“we”, “us”, or “our”) collects, uses, and shares information when you use our Service at{' '}
            <a href="https://taleo.media" className="text-primary hover:text-primary-dark">taleo.media</a>.
          </p>

          <h2>2. Information We Collect</h2>
          <h3>2.1 Information You Provide</h3>
          <ul>
            <li><strong>Account information</strong> (e.g., email and authentication identifiers via Firebase)</li>
            <li><strong>Profile information</strong> you choose to set (e.g., display name)</li>
            <li><strong>Content</strong> you submit (story text, titles) and outputs you generate (videos, captions)</li>
            <li><strong>Connected accounts</strong> information when you connect third-party platforms (e.g., TikTok username/profile identifiers)</li>
          </ul>

          <h3>2.2 Automatically Collected Information</h3>
          <ul>
            <li>Device information</li>
            <li>Usage data</li>
            <li>IP address</li>
            <li>Browser type</li>
            <li>Cookies and similar technologies</li>
          </ul>

          <h2>3. How We Use Your Information</h2>
          <p>We use your information to:</p>
          <ul>
            <li>Provide and improve our services</li>
            <li>Send you updates and communications</li>
            <li>Personalize your experience</li>
            <li>Analyze and optimize our service</li>
            <li>Prevent fraud and abuse</li>
          </ul>

          <h2>4. Information Sharing</h2>
          <p>We may share your information with:</p>
          <ul>
            <li><strong>Service providers</strong> we use to operate the Service (e.g., hosting, storage, analytics)</li>
            <li><strong>AI/voice providers</strong> to generate requested outputs (e.g., voiceover, transcription/alignment)</li>
            <li><strong>Platform APIs</strong> you connect (e.g., TikTok) when you authorize us to upload/post on your behalf</li>
            <li>Legal authorities when required</li>
            <li>Other users (only information you choose to make public)</li>
          </ul>

          <h2>5. Data Security</h2>
          <p>
            We implement appropriate technical and organizational measures to protect your personal information. However, no method of transmission over the Internet is 100% secure.
          </p>

          <h2>6. Your Rights</h2>
          <p>You have the right to:</p>
          <ul>
            <li>Access your personal information</li>
            <li>Correct inaccurate information</li>
            <li>Request deletion of your information</li>
            <li>Object to processing of your information</li>
            <li>Export your data</li>
          </ul>

          <h2>7. Cookies</h2>
          <p>
            We use cookies and similar technologies to improve your experience, understand user behavior, and provide personalized content.
          </p>

          <h2>8. Children's Privacy</h2>
          <p>
            Our service is not intended for children under 13. We do not knowingly collect information from children under 13.
          </p>

          <h2>9. Changes to Privacy Policy</h2>
          <p>
            We may update this policy from time to time. We will notify you of any material changes via email or through the Service.
          </p>

          <h2>10. Contact Us</h2>
          <p>
            For questions about this Privacy Policy, please contact us at:
            <br />
            <a href="mailto:privacy@storygen.ai" className="text-primary hover:text-primary-dark">
              privacy@storygen.ai
            </a>
            {' '}or review our{' '}
            <Link href="/terms" className="text-primary hover:text-primary-dark">Terms of Service</Link>.
          </p>

          <div className="mt-8 border-t border-gray-700 pt-8">
            <p className="text-gray-400">
              By using StoryGen AI, you agree to the collection and use of information in accordance with this Privacy Policy.
            </p>
          </div>
        </div>
      </div>
    </PageContainer>
  );
} 