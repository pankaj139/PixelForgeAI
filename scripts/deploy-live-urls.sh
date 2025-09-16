#!/bin/bash

# Deploy Live URLs for Instagram API Setup
# This script helps you deploy the legal documents and app icon to get live URLs

echo "🌐 Deploy Live URLs for Instagram API"
echo "====================================="
echo ""

# Check if public directory exists
if [ ! -d "public" ]; then
    echo "❌ Public directory not found. Creating it..."
    mkdir -p public
    cp privacy-policy.html public/
    cp terms-of-service.html public/
    cp assets/app-icon.svg public/
    cp assets/app-icon.png public/
    echo "✅ Public directory created with all files"
else
    echo "✅ Public directory exists with files"
fi

echo ""
echo "📁 Files ready for deployment:"
echo "=============================="
ls -la public/

echo ""
echo "🚀 Choose your deployment method:"
echo "================================"
echo ""
echo "1. 🌟 Netlify (Recommended - Free & Easy)"
echo "   - Go to: https://netlify.com"
echo "   - Sign up with GitHub"
echo "   - New site from Git → Connect repository"
echo "   - Build command: echo 'Static site ready'"
echo "   - Publish directory: public"
echo "   - Deploy site"
echo ""
echo "2. ⚡ Vercel (Free & Fast)"
echo "   - Install: npm install -g vercel"
echo "   - Run: cd public && vercel --prod"
echo ""
echo "3. 📄 GitHub Pages (Free)"
echo "   - Push to GitHub: git add public/ && git commit -m 'Add legal docs' && git push"
echo "   - Enable Pages in repository settings"
echo "   - Source: Deploy from branch → main → /public"
echo ""
echo "4. 🌐 Your Own Domain"
echo "   - Upload public/ contents to your web server"
echo "   - Ensure HTTPS is enabled"
echo ""

echo "📋 After deployment, you'll get URLs like:"
echo "=========================================="
echo "   Privacy Policy: https://your-site.netlify.app/privacy-policy.html"
echo "   Terms of Service: https://your-site.netlify.app/terms-of-service.html"
echo "   App Website: https://your-site.netlify.app"
echo "   App Icon: https://your-site.netlify.app/app-icon.png"
echo ""

echo "🧪 Test your URLs:"
echo "=================="
echo "1. Open your live site in browser"
echo "2. Verify all links work"
echo "3. Check app icon loads (1024x1024)"
echo "4. Use URLs in Instagram app configuration"
echo ""

echo "📚 For detailed instructions, see:"
echo "   - DEPLOY_LIVE_URLS.md"
echo "   - INSTAGRAM_LOGIN_SETUP_GUIDE.md"
echo ""

echo "⚠️  Important: Instagram API requires live URLs - localhost won't work!"
echo ""

echo "🎯 Quick Start (Netlify):"
echo "1. Go to https://netlify.com"
echo "2. Sign up with GitHub"
echo "3. New site from Git → Connect this repository"
echo "4. Build command: echo 'Static site ready'"
echo "5. Publish directory: public"
echo "6. Deploy site"
echo "7. Copy your live URLs for Instagram setup"
echo ""

echo "✅ Ready to deploy! Choose your method above."
