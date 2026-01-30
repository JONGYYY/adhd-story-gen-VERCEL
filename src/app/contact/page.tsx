import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Mail } from 'lucide-react';

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="section-py">
        <div className="container-wide">
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Contact Us</h1>
            <p className="text-muted-foreground text-lg mb-4 max-w-2xl">
              Have questions? We'd love to hear from you.
            </p>
            <p className="text-muted-foreground mb-8">
              Email us at{' '}
              <a 
                href="mailto:support@taleo.media" 
                className="text-primary hover:underline font-medium inline-flex items-center gap-1"
              >
                <Mail className="w-4 h-4" />
                support@taleo.media
              </a>
            </p>
            <Button asChild className="btn-orange">
              <Link href="/" className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Home
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

