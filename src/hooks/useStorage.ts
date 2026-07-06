/**
 * Storage Hook
 * React hook for file uploads
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { storageService } from '../lib/services/storage.service';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import type { StorageBucket, UploadResult } from '../lib/types/database';

export function useStorage() {
  const { user } = useAuth();
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadMutation = useMutation({
    mutationFn: async ({
      file,
      bucket,
      path,
    }: {
      file: File;
      bucket: StorageBucket;
      path?: string;
    }) => {
      // Validate file
      if (!storageService.validateImageFile(file)) {
        throw new Error('Invalid image file');
      }

      if (!storageService.validateFileSize(file)) {
        throw new Error('File size exceeds 10MB');
      }

      // Compress image
      const compressed = await storageService.compressImage(file);

      // Upload
      return storageService.uploadFile(bucket, compressed, path);
    },
    onSuccess: () => {
      toast.success('File uploaded successfully');
      setUploadProgress(0);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Upload failed');
      setUploadProgress(0);
    },
  });

  const uploadStyleSample = async (file: File) => {
    if (!user) throw new Error('User not authenticated');
    return storageService.uploadStyleSample(file, user.id);
  };

  const uploadUserPhoto = async (file: File) => {
    if (!user) throw new Error('User not authenticated');
    return storageService.uploadUserPhoto(file, user.id);
  };

  const uploadFile = (file: File, bucket: StorageBucket, path?: string) => {
    return uploadMutation.mutateAsync({ file, bucket, path });
  };

  return {
    uploadFile,
    uploadStyleSample,
    uploadUserPhoto,
    uploadProgress,
    isUploading: uploadMutation.isPending,
  };
}
