/**
 * Preview Image Component
 * Shows clear image for 5 seconds, then blurs until payment
 */

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Loader2, Lock, Download } from 'lucide-react';
import { usePayment } from '@/hooks/usePayment';
import { formatCurrency } from '@/lib/utils/formatters';

interface PreviewImageProps {
  imageUrl: string;
  styleId: string;
  stylePrice: number;
  onPurchaseComplete?: (hdUrl: string) => void;
}

export function PreviewImage({
  imageUrl,
  styleId,
  stylePrice,
  onPurchaseComplete,
}: PreviewImageProps) {
  const [isBlurred, setIsBlurred] = useState(false);
  const [blurredUrl, setBlurredUrl] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState(5);
  const { purchaseStyle, isProcessing } = usePayment();

  useEffect(() => {
    // Show clear image for 5 seconds
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          applyBlur();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [imageUrl]);

  const applyBlur = async () => {
    try {
      // Canvas-based blur — no external service needed
      const img = await createImageBitmap(await (await fetch(imageUrl)).blob());
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.filter = 'blur(40px)';
      ctx.drawImage(img, 0, 0);
      setBlurredUrl(canvas.toDataURL('image/jpeg', 0.9));
      setIsBlurred(true);
    } catch {
      setIsBlurred(true); // blur flag is enough if canvas fails
    }
  };

  const handlePurchase = async () => {
    try {
      await purchaseStyle(styleId, stylePrice);
      // After successful payment, the HD image will be generated
      // and the onPurchaseComplete callback will be triggered
      if (onPurchaseComplete) {
        // HD URL will be provided by the payment hook
        onPurchaseComplete(imageUrl);
      }
    } catch (error) {
      console.error('Purchase failed:', error);
    }
  };

  return (
    <div className="relative w-full">
      {/* Image Container */}
      <div className="relative rounded-lg overflow-hidden bg-gray-900">
        <img
          src={isBlurred ? blurredUrl : imageUrl}
          alt="Generated preview"
          className="w-full h-auto"
        />

        {/* Timer Overlay (first 5 seconds) */}
        {!isBlurred && timeLeft > 0 && (
          <div className="absolute top-4 right-4 bg-black/80 text-white px-4 py-2 rounded-full font-semibold">
            Preview: {timeLeft}s
          </div>
        )}

        {/* Blur Overlay (after 5 seconds) */}
        {isBlurred && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
            <Lock className="w-16 h-16 text-white mb-4" />
            <h3 className="text-2xl font-bold text-white mb-2">
              Unlock HD Image
            </h3>
            <p className="text-gray-300 mb-6 text-center px-4">
              Purchase this style to download the full HD image
            </p>
            <Button
              size="lg"
              onClick={handlePurchase}
              disabled={isProcessing}
              className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-5 w-5" />
                  Buy for {formatCurrency(stylePrice)}
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Info Text */}
      <div className="mt-4 text-center text-sm text-gray-400">
        {!isBlurred ? (
          <p>
            ✨ Enjoying the preview? Image will blur in {timeLeft} seconds
          </p>
        ) : (
          <p>
            🔒 Purchase to unlock the full HD image without blur
          </p>
        )}
      </div>
    </div>
  );
}
