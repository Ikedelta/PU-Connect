import { useState, useRef, useEffect } from 'react';
import { uploadImage, compressImage } from '../../lib/uploadImage';

interface ImageUploaderProps {
  currentImage?: string;
  onImageUploaded?: (url: string) => void;
  folder: 'profiles' | 'products' | 'cms' | 'ads';
  className?: string;
  shape?: 'circle' | 'square';
  size?: 'small' | 'medium' | 'large';
  noBorder?: boolean;
  onPreview?: (url: string) => void;
  onFileSelected?: (file: File) => void;
  hideInternalUI?: boolean;
  autoUpload?: boolean;
}

export default function ImageUploader({
  currentImage,
  onImageUploaded,
  folder,
  className = '',
  shape = 'square',
  size = 'medium',
  noBorder = false,
  onPreview,
  onFileSelected,
  hideInternalUI = false,
  autoUpload = true,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | undefined>(currentImage);
  const [error, setError] = useState<string>('');
  const [progress, setProgress] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync preview if currentImage changes externally
  useEffect(() => {
    setPreview(currentImage);
  }, [currentImage]);

  const sizeClasses = {
    small: 'w-20 h-20',
    medium: 'w-32 h-32',
    large: 'w-48 h-48',
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');

    // Show preview immediately
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setPreview(result);
      if (onPreview) onPreview(result);
    };
    reader.readAsDataURL(file);

    // Call onFileSelected immediately
    if (onFileSelected) onFileSelected(file);

    // Stop here if autoUpload is disabled
    if (!autoUpload) return;

    setUploading(true);
    setProgress('Preparing...');

    try {
      // Compress image with progress
      setProgress('Optimizing image...');
      const compressedFile = await compressImage(file);

      // Upload to Supabase with progress
      setProgress('Uploading...');
      const { url } = await uploadImage(compressedFile, folder);

      // Update parent component
      setProgress('Complete!');
      if (onImageUploaded) onImageUploaded(url);
      setPreview(url);

      // Clear progress after a short delay
      setTimeout(() => setProgress(''), 500);
    } catch (err: any) {
      setError(err.message || 'Failed to upload image');
      setPreview(currentImage);
      setProgress('');
    } finally {
      setUploading(false);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`relative ${className}`}>
      <div
        className={`
          ${sizeClasses[size]}
          ${shape === 'circle' ? 'rounded-full' : 'rounded-xl'}
          ${noBorder ? '' : 'border-2 border-dashed border-gray-300'}
          hover:border-blue-500
          transition-all duration-200
          overflow-hidden
          cursor-pointer
          group
          relative
        `}
        onClick={handleClick}
      >
        {!hideInternalUI && (
          preview ? (
            <>
              <img
                src={preview}
                alt="Upload preview"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="text-white text-center">
                  <i className="ri-upload-cloud-line text-2xl mb-1"></i>
                  <p className="text-xs font-medium">Change Image</p>
                </div>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 dark:text-gray-600 group-hover:text-blue-500 transition-colors relative overflow-hidden bg-gray-50 dark:bg-gray-800">
              {folder === 'profiles' ? (
                <>
                  <i className="ri-user-3-fill absolute text-[10rem] opacity-10 translate-y-6"></i>
                  <i className="ri-image-add-line text-3xl mb-2 relative z-10"></i>
                  <p className="text-xs font-bold uppercase tracking-widest relative z-10">Add Photo</p>
                </>
              ) : (
                <>
                  <i className="ri-image-add-line text-3xl mb-2"></i>
                  <p className="text-xs font-medium px-2 text-center">Upload Image</p>
                </>
              )}
            </div>
          )
        )}

        {uploading && (
          hideInternalUI ? (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gray-200 overflow-hidden">
              <div className="h-full bg-blue-600 animate-progress origin-left"></div>
              <div className="absolute top-[-20px] right-2 bg-blue-600 text-white rounded-full p-1 shadow-lg">
                <i className="ri-loader-4-line text-[10px] animate-spin"></i>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 bg-white/95 flex items-center justify-center">
              <div className="text-center">
                <i className="ri-loader-4-line text-2xl text-teal-600 animate-spin"></i>
                <p className="text-xs text-gray-600 mt-2 font-medium">{progress}</p>
              </div>
            </div>
          )
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {error && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
          <i className="ri-error-warning-fill text-red-500 text-lg shrink-0"></i>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-1">Upload Error</p>
            <p className="text-xs font-bold text-red-700 dark:text-red-400">
              {error}
            </p>
          </div>
        </div>
      )}

      <p className="mt-2 text-xs text-gray-500">
        Max 5MB • JPEG, PNG, GIF, WebP
      </p>
    </div>
  );
}
