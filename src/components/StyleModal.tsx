import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Upload,
  Star,
  Lock,
  Download,
  ShieldCheck,
  Sparkles,
  Trash2,
  AlertCircle,
  ShoppingCart,
  Loader2,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import type { Style } from "@/hooks/useStyles";
import { useApp } from "@/context/AppContext";
import { useStyles } from "@/hooks/useStyles";
import { useFollows } from "@/hooks/useFollows";
import { useAuth } from "@/hooks/useAuth";
import {
  useCheckStylePurchased,
  usePurchaseStyle,
  useDownloadImage,
} from "@/hooks/useStylePurchase";
import { useCreditsBalance, useRefreshCredits, useDecrementCreditOptimistically } from "@/hooks/useCredits";
import { AuthModal } from "./AuthModal";
import { CreditStore } from "./CreditStore";
import { DEFAULT_MODEL_ID } from "@/types/models";
import { supabase } from "@/lib/supabase";
import { backendApi } from "@/lib/backendApi";

export function StyleModal({
  style,
  onClose,
}: {
  style: Style;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<"upload" | "processing" | "result">(
    "upload"
  );
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [generatingError, setGeneratingError] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [textModifications, setTextModifications] = useState<string>("");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCreditStore, setShowCreditStore] = useState(false);
  const [previewTimeLeft, setPreviewTimeLeft] = useState(5);
  const [previewExpired, setPreviewExpired] = useState(false);
  const [previewCount, setPreviewCount] = useState(2); // 2 extra previews allowed
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { openStyle } = useApp();
  const { follows, toggleFollow } = useFollows();
  const { data: allStyles = [] } = useStyles();
  const { isAuthenticated, session } = useAuth();

  // Purchase / download hooks
  const { data: alreadyPurchased = false } = useCheckStylePurchased(style.id);
  const { purchaseStyle, isPending: isPurchasing } = usePurchaseStyle();
  const { download, isDownloading } = useDownloadImage();

  // Credits
  const { data: credits } = useCreditsBalance();
  const refreshCredits = useRefreshCredits();
  const decrementCredit = useDecrementCreditOptimistically();
  const totalCredits = (credits?.free_credits_remaining ?? 0) + (credits?.paid_credits ?? 0);
  const hasCredits = totalCredits > 0;

  // Is this style free to download?
  const isFreeStyle = !style.price || style.price === 0;
  // Can user download their generated result?
  const canDownload = isFreeStyle || alreadyPurchased;

  const creatorName = style.seller?.display_name || "Unknown";
  const following = follows.includes(creatorName);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // 5-second clear preview when result arrives
  useEffect(() => {
    if (stage !== "result" || canDownload) return;
    setPreviewTimeLeft(5);
    setPreviewExpired(false);
    const interval = setInterval(() => {
      setPreviewTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setPreviewExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [stage, resultImage]);

  const handlePreviewAgain = () => {
    if (previewCount <= 0) return;
    setPreviewCount((c) => c - 1);
    setPreviewTimeLeft(5);
    setPreviewExpired(false);
    const interval = setInterval(() => {
      setPreviewTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setPreviewExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Real AI generation using async job queue
  // generate-universal returns a jobId immediately; we poll get-job-status until done
  useEffect(() => {
    if (stage !== "processing") return;

    let cancelled = false;

    const runGeneration = async () => {
      setGeneratingError(null);
      setProcessingStatus("Starting generation...");

      try {
        if (!style.id) throw new Error("Style ID is missing. Please try again.");

        // ── Upload user face image if provided ──────────────────────────────
        let userImageUrl: string | undefined;

        if (uploadedImage && uploadedImage !== "no-reference-image") {
          setProcessingStatus("Uploading your photo...");
          const base64Data = uploadedImage.split(',')[1];
          const byteCharacters = atob(base64Data);
          const byteArray = new Uint8Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteArray[i] = byteCharacters.charCodeAt(i);
          }
          const blob = new Blob([byteArray], { type: 'image/jpeg' });
          // Use user-scoped path to prevent guessing other users' uploads (C4 fix)
          const userId = session?.user?.id ?? 'anon';
          const fileName = `${userId}/temp-${Date.now()}.jpg`;

          const { error: uploadError } = await supabase.storage
            .from('user-uploads')
            .upload(fileName, blob, { cacheControl: '3600', upsert: false });

          if (uploadError) throw new Error(`Failed to upload image: ${uploadError.message}`);

          // Use a signed URL (1 hour) — private bucket, not public URL (C4 fix)
          const { data: signedData, error: signedError } = await supabase.storage
            .from('user-uploads')
            .createSignedUrl(fileName, 3600);

          if (signedError || !signedData?.signedUrl) {
            throw new Error('Failed to get signed URL for uploaded photo');
          }
          userImageUrl = signedData.signedUrl;
          // Do NOT log userImageUrl — it is a private signed URL (L1 fix)
        }

        // ── Start job via authenticated backend API ──────────────────────────
        setProcessingStatus("Queuing generation...");

        const startData = await backendApi.post<{ jobId: string }>('generate-universal', {
          modelId: DEFAULT_MODEL_ID,
          styleId: style.id,
          userImageUrl,
          textModifications: textModifications.trim() || undefined,
        });

        const { jobId } = startData;
        if (!jobId) throw new Error('Server did not return a job ID');
        // Do NOT log jobId — avoid leaking job identifiers

        // ── Poll for result ─────────────────────────────────────────────────
        const pollStart = Date.now();
        const MAX_WAIT_MS = 5 * 60 * 1000; // 5 minutes
        const POLL_INTERVAL_MS = 3000;

        while (!cancelled) {
          await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
          if (cancelled) break;

          const elapsed = Math.round((Date.now() - pollStart) / 1000);
          setProcessingStatus(`Generating with AI... (${elapsed}s)`);

          if (Date.now() - pollStart > MAX_WAIT_MS) {
            throw new Error('Generation timed out after 5 minutes. Please try again.');
          }

          // ── Poll for result via authenticated backend API ──────────────────
          const job = await backendApi.post<{ status: string; imageUrl?: string; error?: string }>(
            'get-job-status',
            { jobId }
          ).catch(() => null); // transient error — keep polling

          if (!job) continue;

          if (job.status === 'completed' && job.imageUrl) {
            if (!cancelled) {
              setResultImage(job.imageUrl);
              setStage("result");
              setProcessingStatus("Done! ✨");
              refreshCredits(); // force server refetch so navbar/badge update

              // Clean up uploaded face image (fire-and-forget, user-scoped path)
              if (userImageUrl && session?.user?.id) {
                const fileName = `${session.user.id}/temp-${Date.now()}.jpg`;
                supabase.storage.from('user-uploads').remove([fileName]).catch(() => {});
              }
            }
            return;
          }

          if (job.status === 'failed') {
            throw new Error(job.error || 'AI generation failed');
          }

          // status is 'pending' or 'processing' — keep polling
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'AI generation failed';
          // Check for out-of-credits: server returns code OR message
          const isNoCredits =
            msg.includes('INSUFFICIENT_CREDITS') ||
            msg.toLowerCase().includes('no credits') ||
            msg.toLowerCase().includes('credits remaining');
          if (isNoCredits) {
            setGeneratingError('__NO_CREDITS__');
            refreshCredits(); // restore correct count (optimistic was wrong if edge rejected)
          } else {
            setGeneratingError(msg);
            toast.error('Generation failed', { description: msg });
          }
        }
      }
    };

    runGeneration();

    return () => {
      cancelled = true;
    };
  }, [stage, style.id, uploadedImage, textModifications, session]);

  const handleFile = useCallback((file: File) => {
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      toast.error("Please upload a JPG, PNG, or WEBP image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be under 10MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleGenerate = () => {
    // ── AUTH GATE ────────────────────────────────────────────────
    if (!isAuthenticated) {
      setShowAuthModal(true);
      toast.info('Please sign in to generate images');
      return;
    }
    // ── CREDIT GATE ───────────────────────────────────────────────
    if (!hasCredits) {
      setShowCreditStore(true);
      toast.info('No credits remaining — buy a pack to continue');
      return;
    }
    // ── OPTIMISTIC DECREMENT: drop counter in UI immediately ─────
    decrementCredit();
    if (!uploadedImage) {
      setUploadedImage('no-reference-image');
    }
    setStage('processing');
  };


  const handleRemoveImage = () => {
    setUploadedImage(null);
    setResultImage(null);
    setGeneratingError(null);
    setProcessingStatus('');
    setStage('upload');
    setPreviewExpired(false);
    setPreviewTimeLeft(5);
    setPreviewCount(2);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const related = allStyles
    .filter((s) => s.id !== style.id && s.category === style.category)
    .slice(0, 3);
  const relatedFill =
    related.length < 3
      ? [
          ...related,
          ...allStyles
            .filter((s) => s.id !== style.id && !related.includes(s))
            .slice(0, 3 - related.length),
        ]
      : related;

  const formatSales = (count: number) => {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9998] bg-black/85 backdrop-blur-md animate-fade-in flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      {/* Modal card — no scrolling, fixed height */}
      <div
        className="glass-card w-full max-w-5xl h-[90vh] overflow-hidden shadow-[0_40px_100px_-20px_rgba(0,0,0,0.3)] animate-fade-in-scale border-gray-200 relative flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 md:top-4 md:right-4 w-9 h-9 rounded-xl bg-black/50 md:bg-gray-100 hover:bg-gray-200 border border-gray-200 flex items-center justify-center transition-all duration-200 z-20 text-gray-700"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* Two-column layout - no internal scrolling */}
        <div className="flex flex-col md:flex-row flex-1 min-h-0">
          {/* ═══════════════ LEFT PANEL — Original Style ═══════════════ */}
          <div className="md:w-[45%] lg:w-[48%] shrink-0 p-4 sm:p-5 md:p-6 border-b md:border-b-0 md:border-r border-gray-200 flex flex-col overflow-y-auto">
            {/* Style image */}
            <div className="rounded-2xl overflow-hidden aspect-[3/4] bg-[#08080C] relative group shrink-0">
              <img
                src={style.sample_image_url}
                alt={style.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            </div>

            {/* Title */}
            <h2 className="mt-3 text-base sm:text-lg font-display font-bold text-gray-900">
              {style.title}
            </h2>

            {/* Creator info */}
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-600 flex-wrap">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-violet-DEFAULT to-magenta flex items-center justify-center text-[9px] font-bold text-white">
                  {creatorName[0].toUpperCase()}
                </div>
                <span className="text-[11px]">@{creatorName}</span>
                <button
                  onClick={() => toggleFollow(creatorName)}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition-all duration-300 ${
                    following
                      ? "bg-violet-DEFAULT/20 text-violet-light border border-violet-DEFAULT/30"
                      : "bg-gray-100 border border-gray-200 hover:bg-gray-200 text-gray-700"
                  }`}
                >
                  {following ? "✓ Following" : "+ Follow"}
                </button>
              </div>
              <div className="flex items-center gap-1 text-[11px]">
                <Star
                  size={11}
                  className="fill-amber-DEFAULT text-amber-DEFAULT"
                />
                <span className="text-gray-700">
                  {style.avg_rating.toFixed(1)}
                </span>
                <span className="text-gray-400">·</span>
                {formatSales(style.sales_count)} sold
              </div>
            </div>

            {/* Description */}
            <p className="mt-2 text-gray-600 text-xs leading-relaxed line-clamp-2">
              {style.description ||
                "A premium AI style crafted by top creators."}
            </p>

            {/* Tags */}
            <div className="mt-2 flex flex-wrap gap-1">
              {style.tags?.slice(0, 3).map((t) => (
                <span
                  key={t}
                  className="text-[9px] px-1.5 py-0.5 rounded-md bg-violet-DEFAULT/10 border border-violet-DEFAULT/20 text-violet-light"
                >
                  {t}
                </span>
              ))}
              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-0.5">
                <Lock size={8} /> Protected
              </span>
            </div>

            {/* Related styles — desktop only */}
            {relatedFill.length > 0 && (
              <div className="mt-3 hidden md:block">
                <h4 className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                  More like this
                </h4>
                <div className="grid grid-cols-3 gap-1.5">
                  {relatedFill.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setStage("upload");
                        setUploadedImage(null);
                        openStyle(r.id);
                      }}
                      className="group/related rounded-lg overflow-hidden glass-card transition-all duration-300 hover:-translate-y-0.5"
                    >
                        <div className="aspect-square overflow-hidden">
                          <img
                            src={r.sample_image_url}
                            alt={r.title}
                            className="w-full h-full object-cover group-hover/related:scale-110 transition-transform duration-500"
                          />
                        </div>
                        <div className="px-1.5 py-1 text-[9px] truncate text-left text-gray-700">
                          {r.title}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
            )}
          </div>

          {/* ═══════════════ RIGHT PANEL ═══════════════ */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

            {/* ───── UPLOAD / PROCESSING STAGES ───────────────────────── */}
            {stage !== "result" && (
              <div className="flex flex-col flex-1 min-h-0 p-4 sm:p-5 overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-3 shrink-0">
                  <div>
                    <h3 className="text-sm font-display font-bold text-gray-900">See Yourself In This Style</h3>
                    <p className="text-[10px] text-gray-500 mt-0.5">Free AI generation • High quality output</p>
                  </div>
                  {/* Credit badge */}
                  {isAuthenticated && (
                    <button
                      onClick={() => setShowCreditStore(true)}
                      className={`flex items-center gap-1 text-[9px] font-semibold rounded-lg px-2 py-1 transition-all ${
                        totalCredits === 0
                          ? 'text-red-600 bg-red-50 border border-red-200 animate-pulse'
                          : totalCredits <= 1
                          ? 'text-amber-600 bg-amber-50 border border-amber-200'
                          : 'text-emerald-600 bg-emerald-500/10 border border-emerald-500/20'
                      }`}
                    >
                      <Sparkles size={8} />
                      {totalCredits === 0 ? '0 left — Buy Credits' : `${totalCredits} credit${totalCredits !== 1 ? 's' : ''} left`}
                    </button>
                  )}
                  {!isAuthenticated && (
                    <div className="flex items-center gap-1 text-[9px] text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2 py-1">
                      <ShieldCheck size={8} /> Sign in to generate
                    </div>
                  )}
                </div>

                {/* Text Modifications */}
                <div className="mb-4 shrink-0">
                  <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-widest block mb-1.5">
                    Text Modifications <span className="normal-case font-normal text-gray-400">(optional)</span>
                  </label>
                  <textarea
                    value={textModifications}
                    onChange={(e) => setTextModifications(e.target.value)}
                    placeholder='e.g., "Replace John to Sarah"'
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-DEFAULT/20 focus:border-violet-DEFAULT transition-all resize-none bg-gray-50 placeholder:text-gray-400"
                    rows={2}
                  />
                </div>

                {/* Upload / Processing area */}
                <div className="flex-1 flex flex-col min-h-0 justify-center">
                  {/* Upload — no image */}
                  {stage === "upload" && !uploadedImage && (
                    <>
                      <div
                        className={`flex-1 max-h-[320px] border-2 border-dashed rounded-2xl py-8 px-4 text-center cursor-pointer transition-all duration-300 group flex flex-col items-center justify-center ${
                          isDragOver
                            ? "border-violet-DEFAULT/70 bg-violet-DEFAULT/[0.08]"
                            : "border-gray-200 hover:border-violet-DEFAULT/50 bg-gray-50 hover:bg-violet-DEFAULT/[0.03]"
                        }`}
                        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                        onDragLeave={() => setIsDragOver(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileInput} />
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-DEFAULT/15 to-magenta/10 border border-violet-DEFAULT/15 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:shadow-lg">
                          <Upload className="text-violet-DEFAULT" size={22} />
                        </div>
                        <p className="mt-3 font-semibold text-gray-800 text-sm">Drop your photo here</p>
                        <p className="text-xs text-violet-DEFAULT/70 mt-1 underline underline-offset-2">or click to browse</p>
                        <p className="text-[10px] text-gray-400 mt-2">JPG, PNG, WEBP • Max 10MB • Optional</p>
                      </div>
                      <button
                        onClick={handleGenerate}
                        disabled={!hasCredits}
                        className={`mt-4 w-full py-3.5 rounded-2xl text-white font-bold text-sm shadow-lg transition-all duration-300 hover:-translate-y-0.5 flex items-center justify-center gap-2 ${
                          !hasCredits
                            ? 'bg-gray-300 cursor-not-allowed hover:translate-y-0'
                            : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:shadow-[0_12px_40px_rgba(124,58,237,0.4)]'
                        }`}
                      >
                        <Sparkles size={16} />
                        {!hasCredits ? 'No Credits — Buy to Generate' : 'Generate Image'}
                      </button>
                      {!hasCredits && (
                        <button
                          onClick={() => setShowCreditStore(true)}
                          className="mt-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm flex items-center justify-center gap-2 hover:shadow-lg transition-all"
                        >
                          🛒 Buy Credits — Starting ₹149
                        </button>
                      )}
                      <p className="text-[10px] text-gray-400 text-center mt-2">
                        {!hasCredits ? '3 free/month · Reset every calendar month' : textModifications.trim() ? "Will apply text modifications" : "Generates with original style prompt"}
                      </p>
                    </>
                  )}

                  {/* Upload — image selected */}
                  {stage === "upload" && uploadedImage && uploadedImage !== "no-reference-image" && (
                    <div className="flex flex-col items-center gap-4 animate-fade-in">
                      <div className="relative rounded-2xl overflow-hidden w-36 h-36 border-2 border-violet-DEFAULT/20 shadow-lg">
                        <img src={uploadedImage} alt="Your photo" className="w-full h-full object-cover" />
                        <button
                          onClick={handleRemoveImage}
                          className="absolute top-1.5 right-1.5 w-7 h-7 rounded-lg bg-white/95 hover:bg-red-50 border border-gray-200 flex items-center justify-center transition-all shadow-sm"
                        >
                          <Trash2 size={13} className="text-gray-700" />
                        </button>
                      </div>
                      <p className="text-xs text-gray-500">Photo ready — click generate</p>
                      <button
                        onClick={handleGenerate}
                        disabled={!hasCredits}
                        className={`w-full max-w-xs py-3.5 rounded-2xl text-white font-bold text-sm shadow-lg transition-all duration-300 hover:-translate-y-0.5 flex items-center justify-center gap-2 ${
                          !hasCredits
                            ? 'bg-gray-300 cursor-not-allowed hover:translate-y-0'
                            : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:shadow-[0_12px_40px_rgba(124,58,237,0.4)]'
                        }`}
                      >
                        <Sparkles size={16} />
                        {!hasCredits ? 'No Credits' : 'Generate With Photo'}
                      </button>
                    </div>
                  )}

                  {/* Processing */}
                  {stage === "processing" && (
                    <div className="flex-1 flex flex-col items-center justify-center py-8 gap-5 animate-fade-in">
                      {generatingError === '__NO_CREDITS__' ? (
                        /* Out-of-credits state */
                        <div className="text-center px-4">
                          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                            <span className="text-2xl">✨</span>
                          </div>
                          <p className="font-bold text-gray-900 mb-1">No Credits Remaining</p>
                          <p className="text-xs text-gray-500 max-w-xs mx-auto mb-4">
                            You've used all 3 free generations this month. Buy a credit pack to continue.
                          </p>
                          <button
                            onClick={() => { handleRemoveImage(); setShowCreditStore(true); }}
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:shadow-lg transition-all"
                          >
                            🛒 Buy Credits — Starting ₹149
                          </button>
                          <p className="text-[10px] text-gray-400 mt-3">Credits reset every calendar month · 3 free on reset</p>
                        </div>
                      ) : generatingError ? (
                        <div className="text-center">
                          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center">
                            <AlertCircle size={28} className="text-red-400" />
                          </div>
                          <p className="font-bold text-gray-900 mb-1">Generation Failed</p>
                          <p className="text-xs text-gray-500 max-w-xs mx-auto mb-4">{generatingError}</p>
                          <button onClick={handleRemoveImage} className="px-5 py-2 rounded-xl bg-gray-100 border border-gray-200 text-sm text-gray-700 hover:bg-gray-200 transition-all">
                            ← Try again
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="relative w-20 h-20">
                            <div className="absolute inset-0 rounded-full border-[3px] border-violet-DEFAULT/10" />
                            <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-violet-DEFAULT animate-spin" />
                            <div className="absolute inset-3 rounded-full border-[2px] border-transparent border-b-magenta animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Sparkles size={20} className="text-violet-light animate-pulse" />
                            </div>
                          </div>
                          <div className="text-center">
                            <p className="font-display font-bold text-gray-900">{processingStatus || "Applying style magic..."}</p>
                            <p className="text-xs text-gray-500 mt-1">Secure processing · 10–60s</p>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ───── RESULT STAGE — redesigned premium layout ────────────────── */}
            {stage === "result" && resultImage && (
              <div className="flex flex-col h-full">

                {/* Header strip */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-DEFAULT to-magenta flex items-center justify-center">
                      <Sparkles size={12} className="text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-display font-bold text-gray-900 leading-none">AI Result Ready</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{style.title}</p>
                    </div>
                  </div>
                  {!canDownload && !previewExpired && (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-DEFAULT bg-violet-DEFAULT/10 border border-violet-DEFAULT/20 rounded-full px-3 py-1">
                      <Eye size={11} /> Preview: {previewTimeLeft}s
                    </div>
                  )}
                  {!canDownload && previewExpired && (
                    <div className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
                      <Lock size={9} /> Locked
                    </div>
                  )}
                  {canDownload && (
                    <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
                      <ShieldCheck size={9} /> Free download
                    </div>
                  )}
                </div>

                {/* Image area — takes all remaining space above the buy button */}
                <div
                  className="relative flex-1 min-h-0 bg-[#080810] overflow-hidden"
                >
                  <img
                    src={resultImage}
                    alt="Styled result"
                    className="w-full h-full object-contain"
                  />

                  {/* Blur overlay — only after preview expires */}
                  {!canDownload && previewExpired && (
                    <div className="absolute inset-0 backdrop-blur-2xl bg-black/55 flex flex-col items-center justify-center gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-white/8 border border-white/15 backdrop-blur-sm flex items-center justify-center">
                        <Lock size={28} className="text-white" />
                      </div>
                      <div className="text-center">
                        <p className="text-white font-display font-bold text-lg">Purchase to Download</p>
                        <p className="text-white/50 text-sm mt-1">₹{style.price} · one-time payment</p>
                      </div>
                      {previewCount > 0 ? (
                        <button
                          onClick={handlePreviewAgain}
                          className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 px-5 py-2.5 rounded-xl transition-all duration-200 hover:scale-105"
                        >
                          <Eye size={14} /> Preview again (+5s)
                          <span className="text-white/50 text-xs">· {previewCount} left</span>
                        </button>
                      ) : (
                        <p className="text-white/30 text-xs">No more previews available</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Status bar */}
                <div className="px-5 py-2 bg-gray-50 border-t border-gray-100 shrink-0">
                  <p className="text-center text-[11px] text-gray-500">
                    {!canDownload && !previewExpired
                      ? `👁️ Previewing your styled image — blurs in ${previewTimeLeft}s`
                      : canDownload
                      ? "✨ Your AI-generated image is ready to download!"
                      : "🔒 Preview expired — purchase to unlock full download"}
                  </p>
                </div>

                {/* CTA section — always visible at bottom */}
                <div className="px-5 py-4 bg-white border-t border-gray-100 shrink-0 space-y-2.5">
                  {canDownload ? (
                    <button
                      onClick={() => download(resultImage, `${style.title.replace(/\s+/g, '-')}-${Date.now()}.png`)}
                      disabled={isDownloading}
                      className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-500 text-white font-bold text-base shadow-lg hover:shadow-[0_12px_40px_rgba(16,185,129,0.4)] transition-all duration-300 hover:-translate-y-0.5 flex items-center justify-center gap-2.5 disabled:opacity-60"
                    >
                      {isDownloading ? <><Loader2 size={18} className="animate-spin" /> Downloading...</> : <><Download size={18} /> Download Image — Free</>}
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        if (!isAuthenticated) { setShowAuthModal(true); return; }
                        try {
                          await purchaseStyle(style.id, style.title, style.price, style.seller_id ?? null);
                          await download(resultImage, `${style.title.replace(/\s+/g, '-')}-${Date.now()}.png`);
                        } catch { /* errors handled in hook */ }
                      }}
                      disabled={isPurchasing || isDownloading}
                      className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold text-base shadow-lg hover:shadow-[0_12px_40px_rgba(124,58,237,0.5)] transition-all duration-300 hover:-translate-y-0.5 flex items-center justify-center gap-2.5 disabled:opacity-60"
                    >
                      {isPurchasing
                        ? <><Loader2 size={18} className="animate-spin" /> Processing Payment...</>
                        : <><ShoppingCart size={18} /> Buy &amp; Download — ₹{style.price}</>}
                    </button>
                  )}
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <ShieldCheck size={12} className="text-emerald-500" />
                      {canDownload ? "No watermark · Full HD" : "One-time · Unlimited downloads"}
                    </span>
                    <button onClick={handleRemoveImage} className="hover:text-gray-700 transition-colors underline underline-offset-2">
                      Try another
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {createPortal(modalContent, document.body)}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
        />
      )}
      {showCreditStore && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowCreditStore(false)}
        >
          <div
            className="glass-card w-full max-w-4xl max-h-[90vh] overflow-y-auto relative shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowCreditStore(false)}
              className="absolute top-4 right-4 z-10 w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-200 flex items-center justify-center transition-all"
              aria-label="Close"
            >
              <X size={16} />
            </button>
            <CreditStore />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
