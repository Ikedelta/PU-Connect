// Image optimization utilities for faster loading

export const getOptimizedImageUrl = (url: string | undefined, width?: number, quality: number = 80): string => {
  if (!url) return '';

  // Supabase transformation requires a specific Pro-tier endpoint (/render/image)
  // Appending query params to standard public URLs can break them on the free tier.
  if (url.includes('supabase')) {
    // Standard Supabase public URLs don't support width/quality params on the free tier.
    // We return the raw URL to ensure the image displays correctly.
    return url;
  }
  if (url.includes('cloudinary') || url.includes('imgix')) {
    const separator = url.includes('?') ? '&' : '?';
    const params = [];

    if (width) params.push(`width=${width}`);
    params.push(`quality=${quality}`);

    return `${url}${separator}${params.join('&')}`;
  }

  return url;
};

export const preloadImage = (url: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = url;
  });
};

export const preloadImages = async (urls: string[]): Promise<void> => {
  await Promise.all(urls.map(url => preloadImage(url)));
};

// Lazy load images with Intersection Observer
export const setupLazyLoading = () => {
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          const src = img.dataset.src;
          if (src) {
            img.src = src;
            img.removeAttribute('data-src');
            imageObserver.unobserve(img);
          }
        }
      });
    });

    document.querySelectorAll('img[data-src]').forEach((img) => {
      imageObserver.observe(img);
    });
  }
};
