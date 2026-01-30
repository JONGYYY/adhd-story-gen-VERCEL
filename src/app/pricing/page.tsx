import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="section-py">
        <div className="container-wide">
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Pricing</h1>
            <p className="text-muted-foreground text-lg mb-8 max-w-2xl">
              Our pricing plans are coming soon. Stay tuned for flexible options that fit your needs.
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

