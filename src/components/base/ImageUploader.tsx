import { useState, useRef } from 'react';
import { uploadImage, compressImage } from '../../lib/uploadImage';

interface ImageUploaderProps {
  currentImage?: string;
  onImageUploaded: (url: string) => void;
  folder: 'profiles' | 'products' | 'cms' | 'ads';
  className?: string;
  shape?: 'circle' | 'square';
  size?: 'small' | 'medium' | 'large';
}

export default function ImageUploader({
  currentImage,
  onImageUploaded,
  folder,
  className = '',
  shape = 'square',
  size = 'medium',
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | undefined>(currentImage);
  const [error, setError] = useState<string>('');
  const [progress, setProgress] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = {
    small: 'w-20 h-20',
    medium: 'w-32 h-32',
    large: 'w-48 h-48',
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setUploading(true);
    setProgress('Preparing...');

    try {
      // Show preview immediately
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Compress image with progress
      setProgress('Optimizing image...');
      const compressedFile = await compressImage(file);

      // Upload to Supabase with progress
      setProgress('Uploading...');
      const { url } = await uploadImage(compressedFile, folder);

      // Update parent component
      setProgress('Complete!');
      onImageUploaded(url);
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
          border-2 border-dashed border-gray-300
          hover:border-teal-500
          transition-all duration-200
          overflow-hidden
          bg-gray-50
          cursor-pointer
          group
          relative
        `}
        onClick={handleClick}
      >
        {preview ? (
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
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 group-hover:text-teal-500 transition-colors">
            <i className="ri-image-add-line text-3xl mb-2"></i>
            <p className="text-xs font-medium px-2 text-center">Upload Image</p>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 bg-white/95 flex items-center justify-center">
            <div className="text-center">
              <i className="ri-loader-4-line text-2xl text-teal-600 animate-spin"></i>
              <p className="text-xs text-gray-600 mt-2 font-medium">{progress}</p>
            </div>
          </div>
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
        <p className="mt-2 text-xs text-red-600 flex items-center">
          <i className="ri-error-warning-line mr-1"></i>
          {error}
        </p>
      )}

      <p className="mt-2 text-xs text-gray-500">
        Max 5MB • JPEG, PNG, GIF, WebP
      </p>
    </div>
  );
}
