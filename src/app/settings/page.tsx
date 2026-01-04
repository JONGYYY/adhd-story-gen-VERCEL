'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function SettingsPage() {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

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
    } catch (e: any) {
      alert(`Failed to save name: ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto py-10">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
          <p className="text-muted-foreground">
            Manage your account settings and preferences.
          </p>
        </div>
        <Separator />
        <Tabs defaultValue="account" className="space-y-6">
          <TabsList>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
            <TabsTrigger value="connections">Connections</TabsTrigger>
            <TabsTrigger value="subscription">Subscription</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="privacy">Privacy</TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                  Update your personal information and how others see you on the platform.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={loadingProfile || saving}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={save} disabled={loadingProfile || saving}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="preferences" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>
                  Customize how StoryGen AI looks on your device.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <Label>Theme</Label>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm">Light</Button>
                      <Button variant="outline" size="sm">Dark</Button>
                      <Button variant="outline" size="sm">System</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="connections" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Connected Accounts</CardTitle>
                <CardDescription>
                  Manage your connected social media and content platforms.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {['YouTube', 'TikTok'].map((platform) => (
                    <div key={platform} className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="font-medium">{platform}</div>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/settings/social-media">Connect</Link>
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
} 