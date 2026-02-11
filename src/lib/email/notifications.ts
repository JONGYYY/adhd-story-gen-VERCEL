/**
 * Email notification system for campaign completions
 * Uses Resend API for sending emails
 */

export interface CampaignCompletionEmail {
  to: string;
  campaignName: string;
  videosGenerated: number;
  videosFailed: number;
  videosPosted: number;
  nextRunAt?: number;
}

/**
 * Send campaign completion notification
 */
export async function sendCampaignCompletionEmail(
  data: CampaignCompletionEmail
): Promise<{ success: boolean; error?: string }> {
  // Check if Resend is configured
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.warn('[Email] Resend API key not configured, skipping email');
    return { success: false, error: 'Email not configured' };
  }

  try {
    const successRate = data.videosGenerated > 0
      ? Math.round(((data.videosGenerated - data.videosFailed) / data.videosGenerated) * 100)
      : 0;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'Taleo Shorts AI <notifications@taleo.media>',
        to: data.to,
        subject: `✅ Campaign Complete: ${data.campaignName}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🎬 Campaign Complete!</h1>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
              <h2 style="color: #333; margin-top: 0;">${data.campaignName}</h2>
              
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #667eea; margin-top: 0;">📊 Results</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e9ecef;">Videos Generated:</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e9ecef; text-align: right; font-weight: bold;">${data.videosGenerated}</td>
                  </tr>
                  ${data.videosFailed > 0 ? `
                  <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e9ecef;">Failed:</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e9ecef; text-align: right; font-weight: bold; color: #dc3545;">${data.videosFailed}</td>
                  </tr>
                  ` : ''}
                  ${data.videosPosted > 0 ? `
                  <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e9ecef;">Posted to TikTok:</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e9ecef; text-align: right; font-weight: bold; color: #28a745;">${data.videosPosted}</td>
                  </tr>
                  ` : ''}
                  <tr>
                    <td style="padding: 10px 0;">Success Rate:</td>
                    <td style="padding: 10px 0; text-align: right; font-weight: bold; color: ${successRate >= 80 ? '#28a745' : successRate >= 50 ? '#ffc107' : '#dc3545'};">${successRate}%</td>
                  </tr>
                </table>
              </div>

              ${data.nextRunAt ? `
              <div style="background: #e7f3ff; padding: 15px; border-radius: 8px; border-left: 4px solid #667eea;">
                <p style="margin: 0; color: #333;">
                  <strong>⏰ Next Run:</strong> ${new Date(data.nextRunAt).toLocaleString()}
                </p>
              </div>
              ` : ''}

              <div style="margin-top: 30px; text-align: center;">
                <a href="https://taleo.media/campaigns" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 500;">
                  View Campaign Details
                </a>
              </div>

              <p style="color: #6c757d; font-size: 12px; margin-top: 30px; text-align: center;">
                You're receiving this email because you have an active auto-pilot campaign.<br/>
                <a href="https://taleo.media/settings" style="color: #667eea;">Manage notification preferences</a>
              </p>
            </div>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Email] Failed to send:', errorData);
      return {
        success: false,
        error: errorData.message || 'Failed to send email',
      };
    }

    return { success: true };
  } catch (error) {
    console.error('[Email] Error sending campaign completion email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get user email from Firebase
 */
export async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const { getAuth } = await import('@/lib/firebase-admin');
    const auth = getAuth();
    const user = await auth.getUser(userId);
    return user.email || null;
  } catch (error) {
    console.error('[Email] Failed to get user email:', error);
    return null;
  }
}

/**
 * Send campaign failure notification
 */
export async function sendCampaignFailureEmail(options: {
  to: string;
  campaignName: string;
  error: string;
  campaignId: string;
}): Promise<{ success: boolean; error?: string }> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.warn('[Email] Resend API key not configured, skipping email');
    return { success: false, error: 'Email not configured' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'Taleo Shorts AI <notifications@taleo.media>',
        to: options.to,
        subject: `⚠️ Campaign Paused: ${options.campaignName}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">⚠️ Campaign Paused</h1>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
              <h2 style="color: #333; margin-top: 0;">${options.campaignName}</h2>
              
              <div style="background: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
                <h3 style="color: #856404; margin-top: 0;">Error Details</h3>
                <p style="color: #856404; margin: 0; font-family: 'Courier New', monospace; font-size: 14px;">
                  ${options.error}
                </p>
              </div>

              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #dc2626; margin-top: 0;">Next Steps</h3>
                <ol style="color: #333; margin: 0; padding-left: 20px;">
                  <li style="margin-bottom: 10px;">Review the error message above</li>
                  <li style="margin-bottom: 10px;">If using Reddit URL list, check that all URLs are valid and accessible</li>
                  <li style="margin-bottom: 10px;">Check your Railway service logs for more details</li>
                  <li>Resume your campaign when ready</li>
                </ol>
              </div>

              <div style="margin-top: 30px; text-align: center;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://taleo.media'}/campaigns" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 500; margin-right: 10px;">
                  View Campaigns
                </a>
              </div>

              <p style="color: #6c757d; font-size: 12px; margin-top: 30px; text-align: center;">
                Your campaign has been automatically paused to prevent further errors.<br/>
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://taleo.media'}/settings" style="color: #667eea;">Manage notification preferences</a>
              </p>
            </div>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Email] Failed to send failure notification:', errorData);
      return {
        success: false,
        error: errorData.message || 'Failed to send email',
      };
    }

    return { success: true };
  } catch (error) {
    console.error('[Email] Error sending campaign failure email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send campaign completed notification (when URL list is exhausted)
 */
export async function sendCampaignCompletedEmail(options: {
  to: string;
  campaignName: string;
  totalVideos: number;
  reason: string;
}): Promise<{ success: boolean; error?: string }> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.warn('[Email] Resend API key not configured, skipping email');
    return { success: false, error: 'Email not configured' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'Taleo Shorts AI <notifications@taleo.media>',
        to: options.to,
        subject: `✅ Campaign Completed: ${options.campaignName}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">✅ Campaign Completed!</h1>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
              <h2 style="color: #333; margin-top: 0;">${options.campaignName}</h2>
              
              <div style="background: #d1fae5; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0;">
                <p style="color: #065f46; margin: 0;">
                  <strong>Status:</strong> ${options.reason}
                </p>
              </div>

              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #10b981; margin-top: 0;">📊 Summary</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e9ecef;">Total Videos Generated:</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #e9ecef; text-align: right; font-weight: bold;">${options.totalVideos}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0;">Campaign Status:</td>
                    <td style="padding: 10px 0; text-align: right; font-weight: bold; color: #10b981;">Completed</td>
                  </tr>
                </table>
              </div>

              <div style="margin-top: 30px; text-align: center;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://taleo.media'}/library" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 500; margin-right: 10px;">
                  View Your Videos
                </a>
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://taleo.media'}/campaigns" style="display: inline-block; background: #10b981; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 500;">
                  View All Campaigns
                </a>
              </div>

              <p style="color: #6c757d; font-size: 12px; margin-top: 30px; text-align: center;">
                Your campaign has successfully completed all scheduled posts.<br/>
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://taleo.media'}/settings" style="color: #667eea;">Manage notification preferences</a>
              </p>
            </div>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Email] Failed to send completion notification:', errorData);
      return {
        success: false,
        error: errorData.message || 'Failed to send email',
      };
    }

    return { success: true };
  } catch (error) {
    console.error('[Email] Error sending campaign completed email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

