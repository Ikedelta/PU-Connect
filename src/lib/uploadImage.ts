import { supabase } from './supabase';

export interface UploadResult {
  url: string;
  path: string;
}

/**
 * Upload an image to Supabase Storage
 * @param file - The image file to upload
 * @param folder - The folder to upload to (e.g., 'profiles', 'products')
 * @returns The public URL and storage path of the uploaded image
 */
export async function uploadImage(
  file: File,
  folder: 'profiles' | 'products' | 'cms' | 'ads'
): Promise<UploadResult> {
  try {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      throw new Error('Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.');
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error('File size too large. Maximum size is 5MB.');
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('You must be logged in to upload images');
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    // Upload to Supabase Storage with optimized settings
    const BUCKET_NAME = 'media';
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      if (error.message && error.message.includes('Bucket not found')) {
        throw new Error(`Storage bucket '${BUCKET_NAME}' not found. Please create a public bucket named '${BUCKET_NAME}' in your Supabase dashboard.`);
      }
      throw error;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('media') // Same bucket as above
      .getPublicUrl(data.path);

    return {
      url: publicUrl,
      path: data.path,
    };
  } catch (error: any) {
    console.error('Upload error:', error);
    throw new Error(error.message || 'Failed to upload image');
  }
}

/**
 * Delete an image from Supabase Storage
 * @param path - The storage path of the image to delete
 */
export async function deleteImage(path: string): Promise<void> {
  try {
    const { error } = await supabase.storage
      .from('media')
      .remove([path]);

    if (error) {
      throw error;
    }
  } catch (error: any) {
    console.error('Delete error:', error);
    throw new Error(error.message || 'Failed to delete image');
  }
}

/**
 * Compress and resize image before upload - OPTIMIZED FOR SPEED
 * @param file - The image file to compress
 * @param maxWidth - Maximum width in pixels
 * @param maxHeight - Maximum height in pixels
 * @param quality - JPEG quality (0-1)
 * @returns Compressed image file
 */
export async function compressImage(
  file: File,
  maxWidth: number = 800,
  maxHeight: number = 800,
  quality: number = 0.85
): Promise<File> {
  return new Promise((resolve, reject) => {
    // For small files, skip compression
    if (file.size < 200 * 1024) { // Less than 200KB
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d', {
          alpha: false,
          willReadFrequently: false
        });

        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Use faster image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'medium';
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to WebP for better compression and speed
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.webp'), {
              type: 'image/webp',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          'image/webp',
          quality
        );
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
  });
}
