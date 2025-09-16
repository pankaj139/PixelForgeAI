# Instagram API with Instagram Login Setup Guide

## 🎯 **Instagram Login Approach (Simpler Option)**

Based on the [official Instagram Platform Content Publishing documentation](https://developers.facebook.com/docs/instagram-platform/content-publishing/), you can use **Instagram API with Instagram Login** instead of Facebook Login.

## 📋 **Key Differences:**

| Feature | Instagram Login | Facebook Login |
|---------|----------------|----------------|
| **Access Tokens** | Instagram User access token | Facebook Page access token |
| **Host URL** | `graph.instagram.com` | `graph.facebook.com` |
| **Login Type** | Business Login for Instagram | Facebook Login for Business |
| **Permissions** | `instagram_business_basic`, `instagram_business_content_publish` | `instagram_basic`, `instagram_content_publish`, `pages_read_engagement` |
| **Setup Complexity** | ⭐⭐ Simpler | ⭐⭐⭐ More complex |
| **Requirements** | Instagram Business App + Business/Creator account | Facebook App + Facebook Page + Business/Creator account |

## 🚀 **Setup Steps for Instagram Login**

### **Step 1: Create Instagram Business App**

1. **Go to Instagram Developers Console**
   - Visit: https://developers.facebook.com/
   - Click "My Apps" → "Create App"

2. **Select App Type**
   - Choose **"Business"** (not Consumer)
   - This is required for Instagram Graph API access

3. **App Details**
   - App Name: `PixelForge AI` (or your preferred name)
   - App Contact Email: Your email address
   - App Purpose: Business

### **Step 2: Add Instagram Graph API Product**

1. **In your new Instagram App dashboard**
   - Look for "Add Product" section
   - Find "Instagram Graph API"
   - Click "Set Up"

2. **Configure Instagram Graph API**
   - This enables Instagram posting capabilities
   - You'll see Instagram Graph API in your products list

### **Step 3: Set Up OAuth Configuration**

1. **Go to Instagram Graph API → Basic Display**
   - **Valid OAuth Redirect URIs**: 
     ```
     http://localhost:3001/api/instagram/auth/callback
     ```
   - **Privacy Policy URL**: `https://yourdomain.com/privacy-policy.html`
   - **Terms of Service URL**: `https://yourdomain.com/terms-of-service.html`
   - **App Website URL**: `https://yourdomain.com`
   - Click "Save Changes"

2. **Go to Facebook Login → Settings** (if available)
   - Add the same redirect URI
   - Add App Domains: `localhost`

### **Step 4: Upload App Icon**

1. **App Icon Requirements**
   - Size: 1024 x 1024 pixels
   - Format: PNG or JPG
   - Professional design representing your app

2. **Upload App Icon**
   - Go to "Settings" → "Basic"
   - Upload your app icon (1024x1024)
   - Use the generated icon: `assets/app-icon.svg` or convert to PNG

### **Step 5: Get Your Credentials**

1. **Instagram App ID**
   - Go to "Settings" → "Basic"
   - Copy your **App ID** (this is your INSTAGRAM_CLIENT_ID)

2. **Instagram App Secret**
   - Go to "Settings" → "Basic"
   - Click "Show" next to App Secret
   - Copy your **App Secret** (this is your INSTAGRAM_CLIENT_SECRET)

### **Step 6: Set Up Instagram Business Account**

1. **Convert Instagram Account**
   - Open Instagram app
   - Go to Settings → Account
   - Switch to **"Business"** or **"Creator"** account
   - Follow the prompts to complete setup

2. **No Facebook Page Required!**
   - Unlike Facebook Login, Instagram Login doesn't require a Facebook Page
   - This makes setup much simpler

### **Step 7: Update Your Environment Variables**

Update your `.env` file with these values:

```bash
# Instagram Login credentials
INSTAGRAM_CLIENT_ID=your_instagram_app_id
INSTAGRAM_CLIENT_SECRET=your_instagram_app_secret
INSTAGRAM_REDIRECT_URI=http://localhost:3001/api/instagram/auth/callback
```

## 🧪 **Testing Your Setup**

### **Quick Test Commands:**
```bash
# Test environment variables
node scripts/test-instagram-setup.js

# Test auth URL generation
curl "http://localhost:3001/api/instagram/auth/url"

# Test complete OAuth flow
# (Use your frontend to complete the flow)
```

### **Expected Results:**
- ✅ Auth URL should point to Instagram (not Facebook)
- ✅ OAuth flow should redirect to Instagram login
- ✅ After login, should redirect back to your app
- ✅ Should detect Instagram Business account

## 🔧 **Implementation Details**

### **Authentication Flow:**
```typescript
// Generate Instagram OAuth URL
const authUrl = instagramLoginService.generateAuthUrl([
  'instagram_business_basic',
  'instagram_business_content_publish'
]);

// Exchange code for token
const tokenResponse = await instagramLoginService.exchangeCodeForToken(code);

// Get user info
const userInfo = await instagramLoginService.getUserInfo(tokenResponse.access_token);
```

### **Posting Images:**
```typescript
// Post image using Instagram Login
const result = await instagramLoginService.postImage({
  imagePath: '/path/to/processed/image.jpg',
  caption: 'AI-generated caption with emojis ✨',
  hashtags: ['#photography', '#ai', '#pixelforge'],
  instagramAccessToken: 'instagram_user_access_token',
  instagramBusinessAccountId: 'instagram_business_account_id',
  altText: 'Description for accessibility'
});
```

## ✅ **Advantages of Instagram Login**

1. **Simpler Setup** - No Facebook Page required
2. **Direct Instagram Integration** - Uses Instagram's own OAuth
3. **Fewer Dependencies** - Only needs Instagram Business App
4. **Cleaner Authentication** - Direct Instagram user tokens
5. **Easier Testing** - Simpler OAuth flow

## 🚨 **Requirements**

### **Must Have:**
- ✅ **Business Instagram App** (not Consumer)
- ✅ **Instagram Business/Creator Account** (not Personal)
- ✅ **Correct OAuth redirect URIs**

### **Not Required:**
- ❌ Facebook Page (unlike Facebook Login approach)
- ❌ Facebook App (unlike Facebook Login approach)
- ❌ Facebook Page access tokens

## 📚 **Official Documentation**

- [Instagram Platform Content Publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing/)
- [Instagram API with Instagram Login](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/instagram-login)
- [Instagram Graph API Reference](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/)

## 🎉 **Ready to Start!**

1. **Create your Instagram Business App** (5-10 minutes)
2. **Convert Instagram to Business account** (5 minutes)
3. **Update your .env file** with new credentials
4. **Test the integration** (3-5 minutes)

**Total time: ~15-20 minutes** (much faster than Facebook Login approach!)

The Instagram Login approach is perfect for your use case and much simpler to set up! 🚀
