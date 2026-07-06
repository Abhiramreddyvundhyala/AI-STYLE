/**
 * Storage Service
 * Handles file uploads to Supabase Storage
 */

import { supabase } from '../supabase';
import type { StorageBucket, UploadResult } from '../types/database';

class StorageService {
  /**
   * Upload a file to Supabase Storage
   */
  async uploadFile(
    bucket: StorageBucket,
    file: File,
    path?: string
  ): Promise<UploadResult> {
    const fileName = path || `${Date.now()}-${file.name}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw error;

    const url = this.getPublicUrl(bucket, data.path);

    return {
      url,
      path: data.path,
      bucket,
    };
  }

  /**
   * Upload multiple files
   */
  async uploadFiles(
    bucket: StorageBucket,
    files: File[]
  ): Promise<UploadResult[]> {
    const uploads = files.map((file) => this.uploadFile(bucket, file));
    return Promise.all(uploads);
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(bucket: StorageBucket, path: string): Promise<void> {
    const { error } = await supabase.storage.from(bucket).remove([path]);

    if (error) throw error;
  }

  /**
   * Delete multiple files
   */
  async deleteFiles(bucket: StorageBucket, paths: string[]): Promise<void> {
    const { error } = await supabase.storage.from(bucket).remove(paths);

    if (error) throw error;
  }

  /**
   * Get public URL for a file
   */
  getPublicUrl(bucket: StorageBucket, path: string): string {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  /**
   * Get signed URL for private files
   */
  async getSignedUrl(
    bucket: StorageBucket,
    path: string,
    expiresIn = 3600
  ): Promise<string> {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) throw error;
    return data.signedUrl;
  }

  /**
   * Upload style sample image
   */
  async uploadStyleSample(file: File, sellerId: string): Promise<UploadResult> {
    const path = `sellers/${sellerId}/${Date.now()}-${file.name}`;
    return this.uploadFile('style-samples', file, path);
  }

  /**
   * Upload user photo for AI transformation
   */
  async uploadUserPhoto(file: File, userId: string): Promise<UploadResult> {
    const path = `users/${userId}/${Date.now()}-${file.name}`;
    return this.uploadFile('user-uploads', file, path);
  }

  /**
   * Upload HD output after payment
   */
  async uploadHDOutput(
    file: File,
    userId: string,
    purchaseId: string
  ): Promise<UploadResult> {
    const path = `purchases/${purchaseId}/${Date.now()}-hd.png`;
    return this.uploadFile('hd-outputs', file, path);
  }

  /**
   * Get HD output URL (requires authentication)
   */
  async getHDOutputUrl(purchaseId: string): Promise<string> {
    const path = `purchases/${purchaseId}`;
    
    // List files in the purchase folder
    const { data, error } = await supabase.storage
      .from('hd-outputs')
      .list(path);

    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error('HD output not found');
    }

    // Get the first HD file
    const hdFile = data[0];
    return this.getSignedUrl('hd-outputs', `${path}/${hdFile.name}`);
  }

  /**
   * Validate file type
   */
  validateImageFile(file: File): boolean {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    return validTypes.includes(file.type);
  }

  /**
   * Validate file size (max 10MB)
   */
  validateFileSize(file: File, maxSizeMB = 10): boolean {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return file.size <= maxSizeBytes;
  }

  /**
   * Compress image before upload
   */
  async compressImage(file: File, maxWidth = 1920): Promise<File> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                reject(new Error('Failed to compress image'));
              }
            },
            'image/jpeg',
            0.9
          );
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  }
}

export const storageService = new StorageService();
export default storageService;
