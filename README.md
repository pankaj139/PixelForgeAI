# 🚀 PixelForge AI - Intelligent Image Processing & AI Content Generation Platform

A comprehensive AI-powered image processing platform that combines smart cropping, descriptive naming, Instagram content generation, sheet composition, and real-time progress tracking for professional image workflow automation.

## ✨ Key Features

### 🚀 Real-Time Processing Experience

- **Live Progress Tracking**: Watch your images process with accurate percentage updates and time estimates
- **Dynamic Stage Visibility**: Shows only relevant processing steps based on your selected options
- **Smart Status Updates**: Real-time feedback during image processing, sheet composition, and PDF generation
- **Enhanced Error Handling**: Actionable error messages with recovery suggestions and retry options

### 🎯 Intelligent Image Cropping

- **Smart Content-Aware Cropping**: Uses computer vision to detect faces and people for optimal crop positioning
- **Multiple Aspect Ratios**: Support for 4x6, 5x7, 8x10, 16x9, Square, and 3x2 formats
- **No Image Stretching**: Maintains image quality by using padding instead of distorting images
- **Fallback Processing**: Local Node.js processing when Python service is unavailable

### 🤖 AI-Powered Intelligence Suite

- **Smart Naming**: Generates meaningful 2-word descriptive filenames using Google Gemini Vision API
- **Instagram Content Generation**:
  - Engaging captions (50-100 characters) with relevant emojis
  - 10-15 trending hashtags (mix of popular and niche)
  - Optimized for maximum social media engagement
- **Filename Examples**: `family_portrait_4x6.jpg`, `beach_sunset_8x10.jpg`, `birthday_celebration_square.jpg`
- **Content Analysis**: AI understands image mood, subjects, setting, and context
- **Smart Caching**: 24-hour cache for AI analysis results to improve performance
- **Intelligent Fallback**: Enhanced naming based on filename patterns when AI services are unavailable

### 📋 Professional Sheet Composition & PDF Generation

- **Flexible Grid Layouts**: Support for 1x1, 1x2, 1x3, 1x4, 2x2, 2x3, 3x2, and 3x3 arrangements
- **A4 Sheet Generation**: Professional-quality layouts in both portrait and landscape orientations
- **Smart Space Utilization**: Maximizes image size while maintaining proper spacing and margins
- **Multi-Page PDFs**: Combines multiple sheets into downloadable PDF documents
- **Empty Slot Management**: Handles partial grids intelligently for optimal layouts
- **High-Resolution Output**: 300 DPI quality suitable for professional printing

### 🚀 Comprehensive Download & Export System

- **Individual Images**: Download processed images with AI-generated descriptive filenames
- **A4 Sheet Downloads**: High-quality JPEG sheets ready for printing or sharing
- **Multi-Page PDFs**: Professional PDF documents with metadata and proper formatting
- **Complete ZIP Archives**: All processed content bundled for easy distribution
- **Instagram Content Export**: Access generated captions and hashtags for social media
- **Flexible Naming**: Smart filenames that include aspect ratios and processing details

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Python 3.8+
- Google Gemini API key (for AI naming)

### Installation

1. **Clone and install dependencies:**

```bash
git clone <repository-url>
cd PixelForgeAI
npm install
```

1. **Set up Python service:**

```bash
cd python-service
pip install -r requirements.txt
```

1. **Environment Configuration:**

```bash
# Copy and configure environment variables
cp .env.example .env

# Add your Gemini API key
GEMINI_API_KEY=your_gemini_api_key_here
```

1. **Start the services:**

```bash
# Terminal 1: Python service
cd python-service
python main.py

# Terminal 2: Node.js backend
cd backend
npm run dev

# Terminal 3: Frontend (if available)
cd frontend
npm start
```

## 🔧 Configuration

### Environment Variables

```bash
# AI Services
GEMINI_API_KEY=your_gemini_api_key_here

# Service URLs
PYTHON_SERVICE_URL=http://localhost:8001

# Storage
UPLOAD_DIR=./uploads
PROCESSED_DIR=./processed
MAX_FILE_SIZE=50MB

# Database
DATABASE_TYPE=json
DATABASE_PATH=./data/database.json
```

### Aspect Ratios

The system supports these predefined aspect ratios:

- **Portrait**: 4x6, 5x7, 8x10
- **Landscape**: 16x9, 3x2
- **Square**: 1x1

## 📡 API Endpoints

### Image Processing & Job Management

```bash
# Upload and process images with options
POST /api/processing/process
Content-Type: multipart/form-data
Body: files + processingOptions (aspectRatio, faceDetection, aiNaming, instagram, sheets, pdf)

# Get real-time job progress
GET /api/processing/job/:jobId/progress

# Get detailed job status
GET /api/processing/job/:jobId

# Get complete job results
GET /api/processing/job/:jobId/results
```

### Comprehensive Download System

```bash
# Get all download URLs for a job
GET /api/download/urls/:jobId

# Download individual processed image
GET /api/download/image/:imageId

# Download A4 sheet composition
GET /api/download/sheet/:sheetId

# Download multi-page PDF
GET /api/download/pdf/:jobId

# Download complete ZIP archive (all content)
GET /api/download/zip/:jobId

# Legacy individual file download
GET /api/download/file/:filename
```

### Processing Configuration Options

```typescript
interface ProcessingOptions {
  aspectRatio: AspectRatio;           // 4x6, 5x7, 8x10, 16x9, Square, 3x2
  faceDetectionEnabled: boolean;      // AI-powered smart cropping
  aiNamingEnabled: boolean;           // Descriptive filename generation
  generateInstagramContent: boolean;  // Captions and hashtags
  sheetComposition: {                // Optional A4 layouts
    enabled: boolean;
    gridLayout: GridLayout;          // 1x1, 1x2, 2x2, 3x3, etc.
    orientation: 'portrait' | 'landscape';
    generatePDF: boolean;            // Multi-page PDF output
  } | null;
}
```

## 🏗️ Complete System Architecture

```text
┌─────────────────────────────────────────────────────────┐
│                Frontend (React/TypeScript)               │
│  Real-time Progress • Dynamic UI • Enhanced UX          │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│            Backend API (Node.js/TypeScript)             │
│     Job Queue • Progress Tracking • Error Handling      │
└─────────────┬───────────────────────┬───────────────────┘
              ↓                       ↓
┌─────────────────────┐    ┌─────────────────────┐
│   Python CV Service │    │   Google Gemini API │
│                     │    │                     │
│ • Face Detection    │    │ • Smart Naming      │
│ • Person Detection  │    │ • Instagram Content │
│ • Smart Cropping    │    │ • Caption Generation│
│ • Sheet Composition │    │ • Hashtag Creation  │
│ • Batch Processing  │    │ • Content Analysis  │
└─────────────────────┘    └─────────────────────┘
              ↓                       ↓
┌─────────────────────────────────────────────────────────┐
│                File Storage & Database                   │
│  Original Files • Processed Images • A4 Sheets • PDFs   │
│     Metadata • Progress • Instagram Content              │
└─────────────────────────────────────────────────────────┘
```

### Core Services & Components

1. **Computer Vision Service** (Python): Face/person detection, intelligent cropping, and A4 sheet composition
2. **AI Content Generation** (Node.js + Gemini): Descriptive filenames, Instagram captions, and hashtag generation
3. **Real-Time Processing Pipeline**: Job queue management with live progress updates and error recovery
4. **Sheet Composition Engine**: Professional A4 layouts with multiple grid options and PDF generation  
5. **Comprehensive Download System**: Individual files, sheets, PDFs, and ZIP archives with smart naming
6. **Dynamic UI System**: Real-time progress tracking with stage visibility based on selected options

## 💡 How It Works

### Enhanced Processing Flow

1. **Upload & Configure**: User uploads images, selects aspect ratio, and chooses processing options
2. **Real-Time Initialization**: Processing starts with live progress tracking
3. **Detection**: Python service analyzes images for faces/people (with progress updates)
4. **Smart Cropping**: Intelligent crop calculation based on detected content (per-image progress)
5. **AI Enhancement**: Gemini analyzes processed images for descriptive names and Instagram content
6. **Optional Composition**: Sheet layouts and PDF generation (if enabled, with stage visibility)
7. **Completion**: User gets organized, well-named images with full processing transparency

## 🆕 Recent Enhancements (Latest Updates)

### ✅ Real-Time Progress Tracking

- **Live Updates**: Progress bars update in real-time as each image processes
- **Accurate Timing**: Time estimates decrease accurately based on actual processing speed
- **Stage-by-Stage**: Individual progress tracking for image processing, sheet composition, and PDF generation

### ✅ Dynamic User Interface

- **Smart Stage Visibility**: Processing status shows only relevant stages based on selected options
- **No Clutter**: Sheet composition and PDF stages only appear when enabled
- **Enhanced Feedback**: Clear visual indicators for active, completed, and pending stages

### ✅ Improved Error Handling

- **Enhanced Recovery**: Better error messages with actionable recovery suggestions
- **Graceful Fallbacks**: Smooth transitions to fallback processing when services are unavailable
- **Correlation IDs**: Debug information for development and troubleshooting

### ✅ Performance Optimizations

- **Progress Callbacks**: Efficient real-time status updates throughout the pipeline
- **Resource Management**: Better memory and processing resource utilization
- **Batch Processing**: Enhanced batch processing with per-image progress reporting

## 📖 Usage Examples

### Comprehensive Processing Workflow

```javascript
// Upload with full AI processing enabled
const result = await fetch('/api/processing/process', {
  method: 'POST',
  body: formData, // images + processingOptions
});

// Real-time progress monitoring
const { data: status } = useProcessingStatus(jobId);
// Shows: "Processing Images: 3 of 5 (60%)" with live updates

// Complete output examples:
// ✅ AI-named files: family_portrait_4x6.jpg, beach_sunset_5x7.jpg
// ✅ Instagram content: "Beautiful family moment 👨‍👩‍👧‍👦✨" + ["family", "love", "portrait", ...]
// ✅ A4 sheets: composed_sheet_2x3_portrait.jpg
// ✅ PDF: processed_sheets_multi_page.pdf
// ✅ ZIP: complete_job_archive.zip
```

### AI-Generated Content Examples

```javascript
// Smart Filename Generation
"family_portrait_4x6.jpg"     // Group photo → descriptive name
"beach_sunset_8x10.jpg"       // Landscape scene → mood + setting
"birthday_celebration_5x7.jpg" // Event photo → occasion + format
"mountain_landscape_16x9.jpg"  // Nature scene → subject + ratio

// Instagram Content Generation  
{
  caption: "Beautiful sunset vibes 🌅✨ Perfect evening mood!",
  hashtags: [
    "sunset", "nature", "photography", "beautiful", "evening",
    "landscape", "mood", "vibes", "golden", "peaceful",
    "outdoors", "scenery", "instagrammers", "photooftheday"
  ],
  generatedAt: "2024-01-15T18:30:00Z"
}
```

### Sheet Composition Examples

```javascript
// A4 Sheet Layouts Available:
1x1: Single large image per sheet
1x2: Two images side by side  
2x2: Four images in grid
2x3: Six images in grid
3x3: Nine images in grid
// + portrait/landscape orientations for each
```

## 🔍 Quality Features

- **No Upscaling**: Images are never stretched or upscaled beyond original resolution
- **Smart Padding**: White padding added when needed to maintain aspect ratio
- **Quality Preservation**: High-quality JPEG output with configurable compression
- **Error Handling**: Graceful fallbacks when AI services are unavailable

## 🛠️ Development

### Enhanced Project Structure

```bash
├── backend/                 # Node.js API server with real-time updates
│   ├── src/
│   │   ├── services/       # Core business logic with progress callbacks
│   │   │   ├── jobProcessingService.ts      # Queue management with events
│   │   │   ├── processingPipelineService.ts # Pipeline with progress tracking
│   │   │   └── computerVisionService.ts     # AI detection with fallbacks
│   │   ├── routes/         # API endpoints with enhanced error handling
│   │   ├── types/          # TypeScript definitions with progress interfaces
│   │   └── utils/          # Utilities including enhanced logging
├── python-service/         # Computer vision service with batch processing
│   ├── processing/         # Image processing with progress reporting
│   └── models/            # AI model configurations
├── frontend/              # React application with real-time UI
│   ├── src/
│   │   ├── components/     # Enhanced UI components
│   │   │   └── ProcessingStatus.tsx  # Dynamic status with stage visibility
│   │   ├── hooks/         # Custom hooks with polling
│   │   └── pages/         # Updated pages with latest features
└── uploads/              # File storage directories
```

### Key Development Improvements

1. **Progress Architecture**: Event-driven progress updates with callback system
2. **Error Handling**: Enhanced error types with correlation IDs and recovery suggestions  
3. **UI Responsiveness**: Real-time status updates using React Query with optimized polling
4. **Type Safety**: Comprehensive TypeScript interfaces for progress tracking and status management

### Adding New Features

1. **New Aspect Ratios**: Update `backend/src/constants/index.ts` and frontend types
2. **Processing Options**: Extend interfaces in `backend/src/types/index.ts` with progress support
3. **AI Naming**: Modify prompts in `backend/src/services/aiNamingService.ts`
4. **Progress Tracking**: Add callbacks in `processingPipelineService.ts` for new stages
5. **UI Components**: Update `ProcessingStatus.tsx` for new stage visibility

## 📊 Monitoring

The system provides detailed logging for:

- Processing performance metrics
- AI naming success rates  
- Error tracking and fallback usage
- Cache hit/miss statistics

## 🔒 Security Notes

- File type validation prevents malicious uploads
- Size limits prevent resource exhaustion
- API keys should be kept secure and rotated regularly
- All file paths are validated to prevent directory traversal

## 📈 Performance Tips

- **Caching**: AI naming results are cached for 24 hours
- **Batch Processing**: More efficient for multiple images
- **Image Sizing**: Larger images take longer to process
- **API Quotas**: Monitor Gemini API usage to avoid limits

## 🆘 Troubleshooting

### Common Issues

- **"GEMINI_API_KEY not found"**: Add your API key to `.env`
- **Python service errors**: Check if Python service is running on port 8001
- **Naming fallbacks**: Normal behavior when AI service is unavailable
- **Large files**: Check MAX_FILE_SIZE setting

### Debug Mode

```bash
NODE_ENV=development npm run dev
```
