import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function BlogPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="section-py">
        <div className="container-wide">
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Blog</h1>
            <p className="text-muted-foreground text-lg mb-8 max-w-2xl">
              Our blog is coming soon. We'll be sharing tips, tutorials, and updates here.
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

