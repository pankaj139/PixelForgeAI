/**
 * Generate App Icon for Instagram API Setup
 * 
 * This script generates a 1024x1024 app icon for PixelForge AI
 * Run with: node scripts/generate-app-icon.js
 */

const fs = require('fs');
const path = require('path');

// Create a simple SVG-based app icon
const createAppIconSVG = () => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <!-- Background gradient -->
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="iconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#f8f9fa;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background circle -->
  <circle cx="512" cy="512" r="512" fill="url(#bgGradient)"/>
  
  <!-- Main icon - Camera/Photo symbol -->
  <g transform="translate(512, 512)">
    <!-- Camera body -->
    <rect x="-120" y="-80" width="240" height="160" rx="20" fill="url(#iconGradient)" stroke="#e9ecef" stroke-width="4"/>
    
    <!-- Camera lens -->
    <circle cx="0" cy="-20" r="60" fill="url(#bgGradient)" stroke="#ffffff" stroke-width="6"/>
    <circle cx="0" cy="-20" r="40" fill="none" stroke="#ffffff" stroke-width="3"/>
    <circle cx="0" cy="-20" r="20" fill="#ffffff" opacity="0.3"/>
    
    <!-- Camera flash -->
    <rect x="80" y="-100" width="20" height="30" rx="10" fill="url(#iconGradient)"/>
    
    <!-- AI sparkles -->
    <g opacity="0.8">
      <circle cx="-150" cy="-150" r="8" fill="#ffffff">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite"/>
      </circle>
      <circle cx="150" cy="-120" r="6" fill="#ffffff">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="2.5s" repeatCount="indefinite"/>
      </circle>
      <circle cx="-120" cy="120" r="7" fill="#ffffff">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="1.8s" repeatCount="indefinite"/>
      </circle>
      <circle cx="120" cy="150" r="5" fill="#ffffff">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="2.2s" repeatCount="indefinite"/>
      </circle>
    </g>
    
    <!-- Pixel grid pattern -->
    <g opacity="0.4">
      <rect x="-200" y="-200" width="8" height="8" fill="#ffffff"/>
      <rect x="-180" y="-180" width="8" height="8" fill="#ffffff"/>
      <rect x="-160" y="-160" width="8" height="8" fill="#ffffff"/>
      <rect x="160" y="-200" width="8" height="8" fill="#ffffff"/>
      <rect x="180" y="-180" width="8" height="8" fill="#ffffff"/>
      <rect x="200" y="-160" width="8" height="8" fill="#ffffff"/>
      <rect x="-200" y="160" width="8" height="8" fill="#ffffff"/>
      <rect x="-180" y="180" width="8" height="8" fill="#ffffff"/>
      <rect x="-160" y="200" width="8" height="8" fill="#ffffff"/>
      <rect x="160" y="160" width="8" height="8" fill="#ffffff"/>
      <rect x="180" y="180" width="8" height="8" fill="#ffffff"/>
      <rect x="200" y="200" width="8" height="8" fill="#ffffff"/>
    </g>
  </g>
  
  <!-- App name -->
  <text x="512" y="700" text-anchor="middle" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="#ffffff">
    PixelForge AI
  </text>
  
  <!-- Tagline -->
  <text x="512" y="750" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#ffffff" opacity="0.9">
    AI-Powered Image Processing
  </text>
</svg>`;
};

// Create a simple HTML file to display the icon
const createIconPreviewHTML = () => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PixelForge AI - App Icon Preview</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f8f9fa;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
        }
        .icon-preview {
            margin: 20px 0;
        }
        .icon-large {
            width: 200px;
            height: 200px;
            border-radius: 20px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            margin: 20px auto;
            display: block;
        }
        .icon-medium {
            width: 100px;
            height: 100px;
            border-radius: 10px;
            margin: 10px;
            display: inline-block;
        }
        .icon-small {
            width: 50px;
            height: 50px;
            border-radius: 5px;
            margin: 5px;
            display: inline-block;
        }
        .download-links {
            margin: 30px 0;
        }
        .download-btn {
            display: inline-block;
            padding: 12px 24px;
            margin: 10px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
        }
        .download-btn:hover {
            background: #5a6fd8;
        }
        .specs {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 5px;
            margin: 20px 0;
            text-align: left;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>PixelForge AI - App Icon</h1>
        <p>Professional app icon for Instagram API setup</p>
        
        <div class="icon-preview">
            <h3>Icon Preview (1024x1024)</h3>
            <img src="app-icon.svg" alt="PixelForge AI App Icon" class="icon-large">
            
            <h3>Different Sizes</h3>
            <img src="app-icon.svg" alt="Large" class="icon-medium">
            <img src="app-icon.svg" alt="Medium" class="icon-medium">
            <img src="app-icon.svg" alt="Small" class="icon-small">
            <img src="app-icon.svg" alt="Small" class="icon-small">
            <img src="app-icon.svg" alt="Small" class="icon-small">
        </div>
        
        <div class="specs">
            <h3>Icon Specifications</h3>
            <ul>
                <li><strong>Size:</strong> 1024 x 1024 pixels</li>
                <li><strong>Format:</strong> SVG (scalable vector graphics)</li>
                <li><strong>Background:</strong> Gradient (purple to blue)</li>
                <li><strong>Main Element:</strong> Camera with AI sparkles</li>
                <li><strong>Text:</strong> "PixelForge AI" with tagline</li>
                <li><strong>Style:</strong> Modern, professional, Instagram-ready</li>
            </ul>
        </div>
        
        <div class="download-links">
            <h3>Download Options</h3>
            <a href="app-icon.svg" class="download-btn" download>Download SVG</a>
            <a href="app-icon.png" class="download-btn" download>Download PNG (1024x1024)</a>
        </div>
        
        <div class="specs">
            <h3>For Instagram API Setup</h3>
            <p>Use this icon when configuring your Instagram app:</p>
            <ol>
                <li>Go to your Instagram app settings</li>
                <li>Upload the app icon (1024x1024)</li>
                <li>Ensure it meets Instagram's guidelines</li>
                <li>Save the configuration</li>
            </ol>
        </div>
    </div>
</body>
</html>`;
};

// Main function
const generateAppIcon = () => {
  console.log('🎨 Generating PixelForge AI App Icon');
  console.log('====================================');
  console.log('');

  try {
    // Create assets directory if it doesn't exist
    const assetsDir = path.join(__dirname, '..', 'assets');
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    // Generate SVG icon
    const svgContent = createAppIconSVG();
    const svgPath = path.join(assetsDir, 'app-icon.svg');
    fs.writeFileSync(svgPath, svgContent);
    console.log('✅ SVG icon created: assets/app-icon.svg');

    // Generate preview HTML
    const htmlContent = createIconPreviewHTML();
    const htmlPath = path.join(assetsDir, 'app-icon-preview.html');
    fs.writeFileSync(htmlPath, htmlContent);
    console.log('✅ Preview HTML created: assets/app-icon-preview.html');

    console.log('');
    console.log('📋 App Icon Details:');
    console.log('   Size: 1024 x 1024 pixels');
    console.log('   Format: SVG (scalable)');
    console.log('   Style: Modern, professional');
    console.log('   Theme: AI-powered image processing');
    console.log('');
    console.log('🌐 Preview the icon:');
    console.log('   Open: assets/app-icon-preview.html');
    console.log('');
    console.log('📱 For Instagram API setup:');
    console.log('   Upload: assets/app-icon.svg');
    console.log('   Or convert to PNG: 1024x1024');

  } catch (error) {
    console.error('❌ Error generating app icon:', error.message);
    process.exit(1);
  }
};

// Run the generator
generateAppIcon();
