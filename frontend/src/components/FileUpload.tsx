import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { cn } from '../utils/cn';
import { FILE_CONSTRAINTS } from '../types';
import Button from './ui/Button';
import Card from './ui/Card';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  selectedFiles: File[];
  onRemoveFile: (index: number) => void;
  disabled?: boolean;
  className?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFilesSelected,
  selectedFiles,
  onRemoveFile,
  disabled = false,
  className
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const validateFiles = useCallback((files: File[]): { valid: File[], errors: string[] } => {
    const validFiles: File[] = [];
    const fileErrors: string[] = [];

    files.forEach((file) => {
      // Check file type
      if (!FILE_CONSTRAINTS.SUPPORTED_FORMATS.includes(file.type as any)) {
        fileErrors.push(`${file.name}: Unsupported file type. Please use JPEG, PNG, WEBP, or TIFF.`);
        return;
      }

      // Check file size
      if (file.size > FILE_CONSTRAINTS.MAX_FILE_SIZE) {
        const sizeMB = Math.round(file.size / (1024 * 1024));
        const maxSizeMB = Math.round(FILE_CONSTRAINTS.MAX_FILE_SIZE / (1024 * 1024));
        fileErrors.push(`${file.name}: File too large (${sizeMB}MB). Maximum size is ${maxSizeMB}MB.`);
        return;
      }

      validFiles.push(file);
    });

    // Check total file count
    const totalFiles = selectedFiles.length + validFiles.length;
    if (totalFiles > FILE_CONSTRAINTS.MAX_FILES_PER_UPLOAD) {
      const excess = totalFiles - FILE_CONSTRAINTS.MAX_FILES_PER_UPLOAD;
      fileErrors.push(`Too many files. Maximum ${FILE_CONSTRAINTS.MAX_FILES_PER_UPLOAD} files allowed. Please remove ${excess} file(s).`);
      return { valid: [], errors: fileErrors };
    }

    return { valid: validFiles, errors: fileErrors };
  }, [selectedFiles.length]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const { valid, errors: validationErrors } = validateFiles(acceptedFiles);
    setErrors(validationErrors);
    
    if (valid.length > 0) {
      onFilesSelected([...selectedFiles, ...valid]);
    }
    setDragActive(false);
  }, [selectedFiles, onFilesSelected, validateFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'image/tiff': ['.tiff', '.tif']
    },
    disabled,
    multiple: true
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Drop Zone */}
      <Card 
        padding="lg" 
        className={cn(
          'border-2 border-dashed transition-colors cursor-pointer',
          isDragActive || dragActive 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <div {...getRootProps()} className="text-center">
          <input {...getInputProps()} />
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
              <svg 
                className={cn(
                  'w-8 h-8 transition-colors',
                  isDragActive || dragActive ? 'text-blue-500' : 'text-gray-400'
                )} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
                />
              </svg>
            </div>
            
            <div>
              <p className="text-lg font-medium text-gray-900">
                {isDragActive || dragActive ? 'Drop files here' : 'Drag & drop images here'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                or <span className="text-blue-600 font-medium">click to browse</span>
              </p>
            </div>
            
            <div className="text-xs text-gray-400 space-y-1">
              <p>Supports: JPEG, PNG, WEBP, TIFF</p>
              <p>Max file size: {Math.round(FILE_CONSTRAINTS.MAX_FILE_SIZE / (1024 * 1024))}MB</p>
              <p>Max files: {FILE_CONSTRAINTS.MAX_FILES_PER_UPLOAD}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Error Messages */}
      {errors.length > 0 && (
        <Card padding="md" className="border-red-200 bg-red-50">
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-red-800">Upload Errors:</h4>
            <ul className="text-sm text-red-700 space-y-1">
              {errors.map((error, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-red-500 mr-2">•</span>
                  {error}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <Card padding="md">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-900">
                Selected Files ({selectedFiles.length})
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onFilesSelected([])}
                disabled={disabled}
              >
                Clear All
              </Button>
            </div>
            
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {selectedFiles.map((file, index) => (
                <div 
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
                >
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveFile(index)}
                    disabled={disabled}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    aria-label={`Remove ${file.name}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default FileUpload;