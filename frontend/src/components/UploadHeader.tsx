/**
 * UploadHeader Component
 * 
 * Purpose: Displays the main header and description for the upload page.
 * This component provides a clear title and instructions for users about
 * what they can do on the upload page.
 * 
 * Usage:
 * ```tsx
 * <UploadHeader />
 * ```
 * 
 * Returns: JSX element containing the page header with title and description
 */

import React from 'react';

export const UploadHeader: React.FC = () => {
  return (
    <div className="text-center">
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
        Upload & Configure Processing
      </h2>
      <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
        Select your images and configure how you want them processed. 
        Choose aspect ratios, enable AI face detection, and set up sheet composition options.
      </p>
    </div>
  );
};

export default UploadHeader;
