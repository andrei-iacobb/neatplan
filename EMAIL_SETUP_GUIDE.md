# 📧 CleanTrack Email Setup Guide

This guide will help you configure email notifications for your CleanTrack application. You have several options, and you **do not need to buy the cleantrack.com domain**.

## 🎯 Quick Summary

**What you need to do:**
1. Choose an email option (see below)
2. Configure SMTP in the admin dashboard
3. Test the configuration
4. Enable notifications

**Do you need to buy a domain?** 
- **NO** - You can use existing email providers
- **OPTIONAL** - You can buy your own domain for a more professional look

---

## 📋 Email Options (Choose One)

### Option 1: 🆓 Use Gmail/Outlook (Easiest, Free)
**Best for:** Small teams, personal use, getting started quickly

**Pros:**
- ✅ Completely free
- ✅ Works immediately
- ✅ Reliable delivery
- ✅ No domain purchase needed

**Cons:**
- ❌ Emails come from your personal/company Gmail
- ❌ Limited to Gmail's sending limits

### Option 2: 💼 Use Your Company Email (Professional)
**Best for:** Businesses with existing email setup

**Pros:**
- ✅ Professional appearance
- ✅ Uses your existing domain
- ✅ No additional costs

**Cons:**
- ❌ Requires IT/admin access to SMTP settings

### Option 3: 🚀 Professional Email Service (Recommended for Production)
**Best for:** Production deployments, high volume

**Providers:**
- **SendGrid** - 100 emails/day free, then $19.95/month
- **Mailgun** - 5,000 emails/month free, then pay-as-you-go
- **Amazon SES** - Very cheap, pay-per-email
- **Postmark** - $10/month for 10,000 emails

### Option 4: 🌐 Buy Your Own Domain (Most Professional)
**Best for:** Companies wanting branded emails

**Cost:** $10-15/year for domain + email hosting
**Result:** Emails from `noreply@yourcompany.com`

---

## 🔧 Setup Instructions

### For Gmail (Most Common)

1. **Enable 2-Factor Authentication** on your Google account
2. **Create an App Password:**
   - Go to [Google Account Settings](https://myaccount.google.com)
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
   - Copy the 16-character password

3. **Configure in CleanTrack:**
   - Go to Settings → System tab (admin only)
   - Enable "Email Notifications"
   - Select "Gmail" provider
   - Enter your details:
     ```
     SMTP Host: smtp.gmail.com
     Port: 587
     Username: your-email@gmail.com
     Password: [16-character app password]
     From: CleanTrack <your-email@gmail.com>
     SSL/TLS: Disabled (uses STARTTLS)
     ```

### For Outlook/Hotmail

1. **Configure in CleanTrack:**
   - Select "Outlook/Hotmail" provider
   - Enter your details:
     ```
     SMTP Host: smtp-mail.outlook.com
     Port: 587
     Username: your-email@outlook.com
     Password: [your password or app password]
     From: CleanTrack <your-email@outlook.com>
     SSL/TLS: Disabled
     ```

### For SendGrid (Professional)

1. **Sign up for SendGrid** (100 emails/day free)
2. **Create API Key:**
   - Go to Settings → API Keys
   - Create API Key with "Mail Send" permissions
   - Copy the API key

3. **Configure in CleanTrack:**
   - Select "SendGrid" provider
   - Enter your details:
     ```
     SMTP Host: smtp.sendgrid.net
     Port: 587
     Username: apikey
     Password: [your API key]
     From: CleanTrack <noreply@yourdomain.com>
     SSL/TLS: Disabled
     ```

### For Your Own Domain

If you want professional emails like `noreply@yourcompany.com`:

1. **Buy a domain** ($10-15/year):
   - Namecheap, GoDaddy, CloudFlare, etc.
   - Choose something like: `yourcompany.com`

2. **Choose email hosting:**
   - **Google Workspace** ($6/user/month) - Professional
   - **Microsoft 365** ($4/user/month) - Professional  
   - **Zoho Mail** ($1/user/month) - Budget-friendly
   - **Your domain registrar** (often included free)

3. **Set up email hosting** with your chosen provider
4. **Configure SMTP** using your new email credentials

---

## ⚙️ Configuration Steps

### 1. Access Admin Settings
- Log in as an admin user
- Go to **Settings** → **System** tab
- Find the "Email Configuration (SMTP)" section

### 2. Configure SMTP
- **Enable Email Notifications** toggle
- **Select your provider** from the grid
- **Fill in the settings** (see provider-specific instructions above)
- **Test the connection** with the "Test Connection" button
- **Save Configuration**

### 3. Test Email Delivery
- Go to **Settings** → **Notifications** tab
- Click any "Test Email" button
- Check your inbox for the test email
- If using development setup, check console for preview URLs

---

## 🛠️ Troubleshooting

### Common Issues

**❌ Authentication Failed**
- For Gmail: Make sure you're using App Password, not regular password
- For Outlook: Try using your full email address as username
- Check if 2FA is enabled and App Password is required

**❌ Connection Timeout**
- Check firewall settings
- Try different ports (587, 465, 25)
- Verify SMTP hostname is correct

**❌ SSL/TLS Errors**
- For port 587: Disable SSL/TLS (uses STARTTLS)
- For port 465: Enable SSL/TLS
- Try switching between ports 587 and 465

**❌ Emails Going to Spam**
- Use a "From" address that matches your SMTP domain
- For Gmail SMTP, use your Gmail address in "From" field
- Consider using professional email service (SendGrid, etc.)

### Getting Help

1. **Check the browser console** for error messages
2. **Use the test button** - it provides specific error details
3. **Try the suggested fixes** in the error messages
4. **Contact your email provider** for SMTP settings

---

## 🎨 Customization

### Email Templates
The system includes beautiful HTML email templates for:
- 📋 Task reminders
- 📅 Schedule updates  
- ⚠️ System alerts
- ✅ Completion notices

### From Address Examples
```
CleanTrack <noreply@gmail.com>              # Using Gmail
CleanTrack <notifications@yourcompany.com>   # Using your domain  
Facilities Team <facilities@yourcompany.com> # Department-specific
```

---

## 💰 Cost Comparison

| Option | Setup Time | Monthly Cost | Emails/Month | Professional Level |
|--------|------------|--------------|--------------|-------------------|
| Gmail | 5 minutes | Free | 500-2000 | ⭐⭐ |
| Company Email | 10 minutes | Free | Varies | ⭐⭐⭐ |
| SendGrid | 15 minutes | Free-$20 | 100-100,000 | ⭐⭐⭐⭐ |
| Own Domain + Email | 1-2 hours | $15-50/year | Unlimited | ⭐⭐⭐⭐⭐ |

---

## 🚀 Recommended Setup

### For Getting Started (5 minutes)
1. Use your existing Gmail account
2. Set up App Password
3. Configure in CleanTrack
4. Test and start using

### For Production (1 hour)
1. Sign up for SendGrid (free tier)
2. Configure with your domain or SendGrid
3. Set up proper "From" addresses
4. Test thoroughly before going live

### For Enterprise (2 hours)
1. Buy professional domain
2. Set up Google Workspace or Microsoft 365
3. Configure professional email addresses
4. Set up monitoring and logging

---

## 📞 Support

If you need help:
1. Check the troubleshooting section above
2. Use the built-in test feature for specific error messages
3. Consult your email provider's documentation
4. Contact your IT administrator for company email setups

The email system will work with most SMTP providers - these are just the most common options! 