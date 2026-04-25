import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { issueType, location, description, screenshotUrl } = await req.json();

        if (!issueType || !location || !description) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Get user profile for additional info
        let userProfile = null;
        try {
            const profiles = await base44.entities.UserProfile.filter({ created_by: user.email });
            userProfile = profiles[0] || null;
        } catch (error) {
            console.log("Could not fetch user profile:", error);
        }

        // Build HTML email body
        const emailBody = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: left;">
                            <h2 style="margin: 0 0 10px 0; color: #ffffff; font-size: 16px; font-weight: 500; letter-spacing: 1px; text-transform: uppercase;">AcedIt Support</h2>
                            <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold;">Bug Report Received</h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="margin: 0 0 20px 0; color: #1a202c; font-size: 20px; font-weight: 600;">Hello Support Team,</h2>
                            
                            <p style="margin: 0 0 20px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
                                We have received a new bug report from <strong>${user.full_name || 'a user'}</strong> with the following details:
                            </p>
                            
                            <!-- User Information Box -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7fafc; border-radius: 6px; margin: 20px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <h3 style="margin: 0 0 15px 0; color: #2d3748; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">User Information</h3>
                                        <table width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td style="padding: 8px 0; color: #718096; font-size: 14px; width: 120px;">Email:</td>
                                                <td style="padding: 8px 0; color: #2d3748; font-size: 14px; font-weight: 500;">${user.email}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #718096; font-size: 14px;">Name:</td>
                                                <td style="padding: 8px 0; color: #2d3748; font-size: 14px; font-weight: 500;">${user.full_name || 'Not provided'}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #718096; font-size: 14px;">Username:</td>
                                                <td style="padding: 8px 0; color: #2d3748; font-size: 14px; font-weight: 500;">${userProfile?.username || 'Not set'}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #718096; font-size: 14px;">Subscription:</td>
                                                <td style="padding: 8px 0; color: #2d3748; font-size: 14px; font-weight: 500; text-transform: capitalize;">${userProfile?.subscription_tier || 'free'}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Bug Details Box -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fff5f5; border-left: 4px solid #f56565; border-radius: 6px; margin: 20px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <h3 style="margin: 0 0 15px 0; color: #c53030; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">🐛 Bug Details</h3>
                                        <table width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td style="padding: 8px 0; color: #718096; font-size: 14px; width: 120px;">Issue Type:</td>
                                                <td style="padding: 8px 0; color: #2d3748; font-size: 14px; font-weight: 500;">${issueType}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #718096; font-size: 14px;">Location:</td>
                                                <td style="padding: 8px 0; color: #2d3748; font-size: 14px; font-weight: 500;">${location}</td>
                                            </tr>
                                        </table>
                                        
                                        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #feb2b2;">
                                            <p style="margin: 0 0 10px 0; color: #718096; font-size: 14px; font-weight: 600;">Description:</p>
                                            <p style="margin: 0; color: #2d3748; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${description}</p>
                                        </div>
                                        
                                        ${screenshotUrl ? `
                                        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #feb2b2;">
                                            <p style="margin: 0 0 10px 0; color: #718096; font-size: 14px; font-weight: 600;">Screenshot:</p>
                                            <a href="${screenshotUrl}" style="color: #667eea; text-decoration: none; font-size: 14px;">View Screenshot →</a>
                                        </div>
                                        ` : ''}
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 20px 0 0 0; color: #718096; font-size: 14px;">
                                Submitted at: ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Melbourne' })}
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f7fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0; color: #718096; font-size: 13px;">
                                AcedIt Support System • Automated Bug Report
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `.trim();

        // Save support ticket to database
        await base44.entities.SupportTicket.create({
            subject: `${issueType} - ${location}`,
            description: description,
            category: 'bug',
            screenshot_url: screenshotUrl || null,
            status: 'pending',
            user_email: user.email,
            user_name: user.full_name || 'Unknown'
        });

        console.log("✅ Support ticket saved to database");

        // Send emails
        const emailResults = [];
        
        // 1. Send bug report to admin
        const adminEmail = "admin@acedit.com.au";
        console.log(`📧 Sending bug report email to admin: ${adminEmail}...`);
        try {
            await base44.asServiceRole.integrations.Core.SendEmail({
                from_name: "AcedIt Bug Reports",
                to: adminEmail,
                subject: `🐛 Bug Report: ${issueType} - ${location}`,
                body: emailBody
            });
            console.log(`✅ Bug report email sent to admin: ${adminEmail}`);
            emailResults.push({ email: adminEmail, success: true });
        } catch (emailError) {
            console.error(`❌ Error sending bug report to admin:`, emailError);
            emailResults.push({ email: adminEmail, success: false, error: emailError.message });
        }

        // 2. Send confirmation to user
        console.log(`📧 Sending confirmation email to user: ${user.email}...`);
        try {
            const confirmationBody = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">Thank You!</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="margin: 0 0 20px 0; color: #1a202c; font-size: 20px; font-weight: 600;">Hi ${user.full_name || 'there'},</h2>
                            <p style="margin: 0 0 20px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
                                We've received your bug report and our team will investigate it shortly. We appreciate you taking the time to help us improve AcedIt!
                            </p>
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7fafc; border-radius: 6px; margin: 20px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0 0 10px 0; color: #718096; font-size: 14px;"><strong>Issue Type:</strong> ${issueType}</p>
                                        <p style="margin: 0; color: #718096; font-size: 14px;"><strong>Location:</strong> ${location}</p>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 20px 0 0 0; color: #718096; font-size: 14px;">
                                If you have any additional information to add, feel free to reply to this email.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f7fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0; color: #718096; font-size: 13px;">AcedIt Support Team</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
            `.trim();

            await base44.asServiceRole.integrations.Core.SendEmail({
                from_name: "AcedIt Support",
                to: user.email,
                subject: `Bug Report Received - ${issueType}`,
                body: confirmationBody
            });
            console.log(`✅ Confirmation email sent to user`);
            emailResults.push({ email: user.email, success: true });
        } catch (emailError) {
            console.error(`❌ Error sending confirmation to user:`, emailError);
            emailResults.push({ email: user.email, success: false, error: emailError.message });
        }

        const allEmailsFailed = emailResults.every(r => !r.success);
        const someEmailsFailed = emailResults.some(r => !r.success);

        return Response.json({ 
            success: true,
            message: 'Support ticket submitted successfully',
            emailStatus: {
                results: emailResults,
                allSent: !someEmailsFailed,
                warning: someEmailsFailed ? 'Some emails failed to send but ticket was saved' : null
            }
        });

    } catch (error) {
        console.error("Error sending support ticket:", error);
        return Response.json({ 
            error: error.message || 'Failed to submit support ticket'
        }, { status: 500 });
    }
});