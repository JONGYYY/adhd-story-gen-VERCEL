'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/layout/Footer';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { User, Bell, Shield, CreditCard, Link as LinkIcon, Loader2, Check } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';

export default function SettingsPage() {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch('/api/profile', { credentials: 'include' });
        if (!resp.ok) return;
        const data = await resp.json();
        if (cancelled) return;
        if (typeof data?.displayName === 'string') setName(data.displayName);
      } catch (e) {
        console.warn('Failed to load profile:', e);
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const resp = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ displayName: name }),
      });
      if (!resp.ok) {
        const msg = await resp.text();
        alert(`Failed to save name: ${msg}`);
        return;
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      alert(`Failed to save name: ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
      <div className="section-py">
        <div className="container-wide max-w-6xl">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-2">Settings</h1>
            <p className="text-muted-foreground">
              Manage your account settings and preferences
            </p>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="account" className="space-y-8">
            <TabsList className="bg-muted p-1 rounded-2xl flex-wrap h-auto gap-2">
              <TabsTrigger value="account" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white">
                <User className="w-4 h-4 mr-2" />
                Account
              </TabsTrigger>
              <TabsTrigger value="preferences" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white">
                Preferences
              </TabsTrigger>
              <TabsTrigger value="connections" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white">
                <LinkIcon className="w-4 h-4 mr-2" />
                Connections
              </TabsTrigger>
              <TabsTrigger value="subscription" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white">
                <CreditCard className="w-4 h-4 mr-2" />
                Subscription
              </TabsTrigger>
              <TabsTrigger value="notifications" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white">
                <Bell className="w-4 h-4 mr-2" />
                Notifications
              </TabsTrigger>
              <TabsTrigger value="privacy" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white">
                <Shield className="w-4 h-4 mr-2" />
                Privacy
              </TabsTrigger>
            </TabsList>

            {/* Account Tab */}
            <TabsContent value="account">
              <div className="card-elevo">
                <h2 className="text-2xl font-bold mb-2">Profile Information</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Update your personal information and how others see you on the platform.
                </p>
                
                <div className="space-y-6">
                  <div>
                    <Label htmlFor="name" className="text-sm font-medium mb-2 block">
                      Display Name
                    </Label>
                    <Input
                      id="name"
                      placeholder="Your display name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={loadingProfile || saving}
                      className="input-elevo"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      This name will appear on your generated videos
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button 
                      onClick={save} 
                      disabled={loadingProfile || saving}
                      className="btn-orange"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save Changes'
                      )}
                    </Button>
                    {saveSuccess && (
                      <div className="flex items-center gap-2 text-green-400 text-sm">
                        <Check className="w-4 h-4" />
                        <span>Saved successfully!</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Preferences Tab */}
            <TabsContent value="preferences">
              <div className="card-elevo">
                <h2 className="text-2xl font-bold mb-2">Appearance</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Customize how Taleo Shorts AI looks on your device
                </p>
                
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium mb-3 block">Theme</Label>
                    <p className="text-sm text-muted-foreground mb-4">
                      Taleo Shorts AI uses a dark theme for optimal viewing experience
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-muted/50 border border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium">Dark Mode</p>
                        <p className="text-sm text-muted-foreground">Currently active</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Connections Tab */}
            <TabsContent value="connections">
              <div className="card-elevo">
                <h2 className="text-2xl font-bold mb-2">Connected Accounts</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Manage your connected social media and content platforms
                </p>
                
                <div className="space-y-4">
                  {['YouTube', 'TikTok'].map((platform) => (
                    <div 
                      key={platform} 
                      className="flex items-center justify-between p-4 rounded-2xl bg-muted/50 border border-border"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                          <LinkIcon className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold">{platform}</p>
                          <p className="text-sm text-muted-foreground">Not connected</p>
                        </div>
                      </div>
                      <Link href="/settings/social-media" className="btn-secondary text-sm px-6 py-2">
                        Connect
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Subscription Tab */}
            <TabsContent value="subscription">
              <div className="card-elevo">
                <h2 className="text-2xl font-bold mb-2">Subscription & Billing</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Manage your subscription plan and billing information
                </p>
                
                <div className="space-y-6">
                  <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold mb-1">Free Plan</h3>
                        <p className="text-sm text-muted-foreground">Currently active</p>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-sm font-semibold">
                        Active
                      </span>
                    </div>
                    <Link href="/pricing" className="btn-orange inline-flex">
                      Upgrade Plan
                    </Link>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Billing History</h3>
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No billing history yet</p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Notifications Tab */}
            <TabsContent value="notifications">
              <div className="card-elevo">
                <h2 className="text-2xl font-bold mb-2">Notification Preferences</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Choose what updates you'd like to receive
                </p>
                
                <div className="space-y-4">
                  {[
                    { title: 'Video Generation Complete', description: 'Get notified when your videos finish processing' },
                    { title: 'Performance Updates', description: 'Weekly reports on your content performance' },
                    { title: 'Product Updates', description: 'News about new features and improvements' },
                    { title: 'Marketing Emails', description: 'Tips, tricks, and promotional content' },
                  ].map((item) => (
                    <div 
                      key={item.title}
                      className="flex items-center justify-between p-4 rounded-2xl bg-muted/50 border border-border"
                    >
                      <div>
                        <p className="font-medium mb-1">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Privacy Tab */}
            <TabsContent value="privacy">
              <div className="card-elevo">
                <h2 className="text-2xl font-bold mb-2">Privacy & Security</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Control your privacy settings and data
                </p>
                
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-3">Data & Privacy</h3>
                    <div className="space-y-3">
                      <Link 
                        href="/privacy" 
                        className="flex items-center justify-between p-4 rounded-2xl bg-muted/50 border border-border hover:border-primary/30 transition-all"
                      >
                        <span className="font-medium">Privacy Policy</span>
                        <span className="text-primary">→</span>
                      </Link>
                      <Link 
                        href="/terms" 
                        className="flex items-center justify-between p-4 rounded-2xl bg-muted/50 border border-border hover:border-primary/30 transition-all"
                      >
                        <span className="font-medium">Terms of Service</span>
                        <span className="text-primary">→</span>
                      </Link>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Account Actions</h3>
                    <button className="w-full p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all">
                      Delete Account
                    </button>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Footer />
      </div>
    </AppLayout>
  );
}
