'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Footer } from '@/components/layout/Footer';
import { Zap, Video, TrendingUp, Clock, Check, X } from 'lucide-react';

export default function LandingPage() {
  const { user } = useAuth();
  const [showDemo, setShowDemo] = useState(false);

  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="section-py relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-radial from-primary/5 via-transparent to-transparent opacity-50" />
        
        <div className="container-narrow relative z-10">
          {/* Badge */}
          <div className="flex justify-center mb-8">
            <div className="section-badge animate-fade-in-up">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                <span>Proudly Serving 1,200+ Creators</span>
              </div>
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-center mb-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            Turn Stories Into Viral Short-Form Content
          </h1>

          {/* Subheadline */}
          <p className="text-center text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            AI-powered video generation that transforms Reddit stories or creates original content into engaging TikTok-ready videos in minutes.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            <Link href={user ? "/create" : "/auth/signup"} className="btn-orange">
              Start Your Free Trial
            </Link>
            <button onClick={() => setShowDemo(true)} className="btn-secondary">
              Watch Demo
            </button>
          </div>

          <p className="text-center text-sm text-muted-foreground animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            ⚡ Trusted by 1500+ creators worldwide
          </p>
        </div>
      </section>

      {/* Stats Section */}
      <section className="section-py bg-gradient-to-b from-muted/20 to-transparent">
        <div className="container-wide">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl md:text-5xl font-bold mb-2">150+</div>
              <div className="text-muted-foreground">Videos Generated Daily</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold mb-2">0+</div>
              <div className="text-muted-foreground">Years of Experience</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold mb-2">85+</div>
              <div className="text-muted-foreground">Satisfied Creators</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold mb-2">5+</div>
              <div className="text-muted-foreground">Platform Integrations</div>
            </div>
          </div>
        </div>
      </section>

      {/* About / Value Prop */}
      <section className="section-py">
        <div className="container-wide">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="section-badge mb-6">
                <Zap className="w-4 h-4 text-primary" />
                <span>About Us</span>
              </div>
              <h2 className="mb-6">
                Automate Your Content Creation Workflow
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                We help content creators scale their production by automating the entire video creation process—from story generation to final export. Focus on growing your audience while we handle the heavy lifting.
              </p>

              <div className="grid grid-cols-2 gap-8">
                <div>
                  <div className="text-3xl font-bold mb-2">150+</div>
                  <div className="text-sm text-muted-foreground">Projects Completed</div>
                </div>
                <div>
                  <div className="text-3xl font-bold mb-2">15+</div>
                  <div className="text-sm text-muted-foreground">AI Models Used</div>
                </div>
                <div>
                  <div className="text-3xl font-bold mb-2">100+</div>
                  <div className="text-sm text-muted-foreground">Satisfied Clients</div>
                </div>
                <div>
                  <div className="text-3xl font-bold mb-2">20+</div>
                  <div className="text-sm text-muted-foreground">Features</div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="aspect-square rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 p-8 flex items-center justify-center border border-border">
                <div className="text-center">
                  <Video className="w-24 h-24 text-primary mx-auto mb-4" />
                  <p className="text-lg font-semibold">AI-Powered Video Generation</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="section-py bg-gradient-to-b from-muted/20 to-transparent">
        <div className="container-wide">
          <div className="text-center mb-16">
            <div className="section-badge mb-6 inline-flex">
              <Zap className="w-4 h-4 text-primary" />
              <span>How it works</span>
            </div>
            <h2 className="mb-4">How Our Process Works</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="card-elevo text-center">
              <div className="number-badge mx-auto mb-6">1</div>
              <h3 className="text-xl font-bold mb-4">Choose Your Story</h3>
              <p className="text-muted-foreground">
                Select from trending Reddit stories or generate original AI content tailored to your niche.
              </p>
            </div>

            {/* Step 2 */}
            <div className="card-elevo text-center">
              <div className="number-badge mx-auto mb-6">2</div>
              <h3 className="text-xl font-bold mb-4">Customize & Generate</h3>
              <p className="text-muted-foreground">
                Pick your voice, background, and style. Our AI handles the rest—voice-over, captions, everything.
              </p>
            </div>

            {/* Step 3 */}
            <div className="card-elevo text-center">
              <div className="number-badge mx-auto mb-6">3</div>
              <h3 className="text-xl font-bold mb-4">Export & Post</h3>
              <p className="text-muted-foreground">
                Download your video or schedule it to post directly to TikTok, Instagram, and YouTube Shorts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features / Workflow */}
      <section className="section-py">
        <div className="container-wide">
          <h2 className="text-center mb-4">Efficient Progress, Exceptional Results</h2>
          <p className="text-center text-lg text-muted-foreground mb-16 max-w-3xl mx-auto">
            Our streamlined process ensures every stage of your project is delivered with precision, speed, and quality.
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Feature 1 */}
            <div className="card-elevo">
              <div className="flex items-start gap-4">
                <div className="check-icon flex-shrink-0">
                  <Check className="w-3 h-3" />
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Story Generation & Research</h4>
                  <p className="text-sm text-muted-foreground">
                    In-depth analysis of trending content to understand what resonates with your audience.
                  </p>
                </div>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="card-elevo">
              <div className="flex items-start gap-4">
                <div className="check-icon flex-shrink-0">
                  <Check className="w-3 h-3" />
                </div>
                <div>
                  <h4 className="font-semibold mb-2">AI Voice-Over Creation</h4>
                  <p className="text-sm text-muted-foreground">
                    Natural-sounding voice generation with 30+ voice options for perfect narration.
                  </p>
                </div>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="card-elevo">
              <div className="flex items-start gap-4">
                <div className="check-icon flex-shrink-0">
                  <Check className="w-3 h-3" />
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Auto Caption Sync</h4>
                  <p className="text-sm text-muted-foreground">
                    Perfectly timed captions that keep viewers engaged throughout the entire video.
                  </p>
                </div>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="card-elevo">
              <div className="flex items-start gap-4">
                <div className="check-icon flex-shrink-0">
                  <Check className="w-3 h-3" />
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Platform Optimization</h4>
                  <p className="text-sm text-muted-foreground">
                    Videos optimized for TikTok, Instagram Reels, and YouTube Shorts with proper formatting.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Expertise / Services */}
      <section className="section-py bg-gradient-to-b from-muted/20 to-transparent">
        <div className="container-wide">
          <div className="text-center mb-16">
            <div className="section-badge mb-6 inline-flex">
              <Zap className="w-4 h-4 text-primary" />
              <span>Services</span>
            </div>
            <h2 className="mb-4">Expertise That Drives Success</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="card-elevo">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Video className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">AI Story Generation</h3>
              <p className="text-muted-foreground mb-4">
                Generate unique, engaging stories using advanced AI that understands what makes content go viral.
              </p>
            </div>

            <div className="card-elevo">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Reddit Story Sourcing</h3>
              <p className="text-muted-foreground mb-4">
                Tap into trending Reddit stories from r/AITA, r/TrueOffMyChest, and more—properly attributed and formatted.
              </p>
            </div>

            <div className="card-elevo">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Batch Video Creation</h3>
              <p className="text-muted-foreground mb-4">
                Generate multiple videos at once to keep your content calendar full without the manual work.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="section-py">
        <div className="container-wide">
          <div className="text-center mb-16">
            <div className="section-badge mb-6 inline-flex">
              <Zap className="w-4 h-4 text-primary" />
              <span>Comparison</span>
            </div>
            <h2 className="mb-4">Why Choose StoryGen Over Manual Creation</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Manual Creation */}
            <div className="card-elevo">
              <h3 className="text-2xl font-bold mb-6">Manual Creation</h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <X className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Hours of scripting and editing per video</span>
                </li>
                <li className="flex items-start gap-3">
                  <X className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Expensive voice-over talent required</span>
                </li>
                <li className="flex items-start gap-3">
                  <X className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Manual caption timing and syncing</span>
                </li>
                <li className="flex items-start gap-3">
                  <X className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Inconsistent output quality</span>
                </li>
                <li className="flex items-start gap-3">
                  <X className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Limited scalability</span>
                </li>
              </ul>
            </div>

            {/* StoryGen */}
            <div className="card-elevo border-primary/30">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                  <span className="text-white font-bold text-sm">S</span>
                </div>
                <h3 className="text-2xl font-bold">StoryGen AI</h3>
              </div>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="check-icon flex-shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span className="text-muted-foreground">Generate videos in minutes, not hours</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="check-icon flex-shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span className="text-muted-foreground">Professional AI voices included</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="check-icon flex-shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span className="text-muted-foreground">Auto-synced captions with perfect timing</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="check-icon flex-shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span className="text-muted-foreground">Consistent, professional quality every time</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="check-icon flex-shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span className="text-muted-foreground">Scale to dozens of videos per day</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="section-py bg-gradient-to-b from-muted/20 to-transparent">
        <div className="container-wide">
          <div className="text-center mb-16">
            <div className="section-badge mb-6 inline-flex">
              <Zap className="w-4 h-4 text-primary" />
              <span>Pricing</span>
            </div>
            <h2 className="mb-4">Flexible Plans for Every Creator</h2>
            <p className="text-lg text-muted-foreground">
              Whether you're just starting out or scaling your content empire, we have a plan that fits.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Starter */}
            <div className="pricing-card">
              <div className="mb-6">
                <div className="text-sm font-semibold text-muted-foreground mb-2">Starter</div>
                <div className="text-4xl font-bold mb-2">$29<span className="text-lg text-muted-foreground">/mo</span></div>
                <div className="text-sm text-muted-foreground">Great for beginners</div>
              </div>
              
              <Link href="/auth/signup" className="btn-secondary w-full mb-6 block text-center">
                Get Started
              </Link>

              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-sm">10 videos per month</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-sm">AI story generation</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-sm">5 AI voices</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-sm">720p resolution</span>
                </li>
              </ul>
            </div>

            {/* Pro (Popular) */}
            <div className="pricing-card border-primary/50 relative overflow-hidden">
              <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-primary text-xs font-semibold">
                Popular
              </div>
              
              <div className="mb-6">
                <div className="text-sm font-semibold text-muted-foreground mb-2">Pro</div>
                <div className="text-4xl font-bold mb-2">$79<span className="text-lg text-muted-foreground">/mo</span></div>
                <div className="text-sm text-muted-foreground">Best for growing channels</div>
              </div>
              
              <Link href="/auth/signup" className="btn-orange w-full mb-6 block text-center">
                Get Started
              </Link>

              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-sm">50 videos per month</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-sm">AI + Reddit stories</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-sm">30+ AI voices</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-sm">1080p resolution</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-sm">Batch generation</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-sm">Priority support</span>
                </li>
              </ul>
            </div>

            {/* Enterprise */}
            <div className="pricing-card">
              <div className="mb-6">
                <div className="text-sm font-semibold text-muted-foreground mb-2">Enterprise</div>
                <div className="text-4xl font-bold mb-2">Custom</div>
                <div className="text-sm text-muted-foreground">For agencies & teams</div>
              </div>
              
              <Link href="/contact" className="btn-secondary w-full mb-6 block text-center">
                Contact Sales
              </Link>

              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-sm">Unlimited videos</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-sm">All features included</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-sm">Custom voice cloning</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-sm">White-label options</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-sm">Dedicated account manager</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-sm">Custom integrations</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="section-py">
        <div className="container-narrow text-center">
          <h2 className="mb-6">
            Ready to Scale Your Content Creation?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join thousands of creators who are growing their channels with StoryGen AI.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/signup" className="btn-orange">
              Start Creating Now
            </Link>
            <Link href="/contact" className="btn-secondary">
              Schedule a Demo
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />

      {/* Demo Modal */}
      {showDemo && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setShowDemo(false)}>
          <div className="bg-card rounded-3xl max-w-4xl w-full relative border border-border" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowDemo(false)}
              className="absolute -top-4 -right-4 w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center hover:opacity-80 transition-opacity"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="aspect-video rounded-3xl overflow-hidden bg-muted">
              <video controls className="w-full h-full">
                <source src="/demo.mp4" type="video/mp4" />
              </video>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
