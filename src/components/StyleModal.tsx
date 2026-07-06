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
import { AuthModal } from "./AuthModal";
import { DEFAULT_MODEL_ID } from "@/types/models";
import { supabase } from "@/lib/supabase";

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { openStyle } = useApp();
  const { follows, toggleFollow } = useFollows();
  const { data: allStyles = [] } = useStyles();
  const { isAuthenticated, session } = useAuth();

  // Purchase / download hooks
  const { data: alreadyPurchased = false } = useCheckStylePurchased(style.id);
  const { purchaseStyle, isPending: isPurchasing } = usePurchaseStyle();
  const { download, isDownloading } = useDownloadImage();

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
          const fileName = `temp-${Date.now()}.jpg`;

          const { error: uploadError } = await supabase.storage
            .from('user-uploads')
            .upload(fileName, blob, { cacheControl: '3600', upsert: false });

          if (uploadError) throw new Error(`Failed to upload image: ${uploadError.message}`);

          const { data: { publicUrl } } = supabase.storage
            .from('user-uploads')
            .getPublicUrl(fileName);

          userImageUrl = publicUrl;
          console.log('Face image uploaded:', publicUrl);
        }

        // ── Start job (returns jobId immediately, ~2s) ──────────────────────
        setProcessingStatus("Queuing generation...");

        const startResp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-universal`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // Use the user's JWT — NOT the anon key.
              // The edge function will verify this token server-side.
              'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              modelId: DEFAULT_MODEL_ID,
              styleId: style.id,
              userImageUrl,
              textModifications: textModifications.trim() || undefined,
            }),
          }
        );

        if (!startResp.ok) {
          const errText = await startResp.text();
          let msg = 'Generation failed to start';
          try { msg = JSON.parse(errText).error || msg; } catch { msg = errText || msg; }
          throw new Error(msg);
        }

        const { jobId } = await startResp.json();
        if (!jobId) throw new Error('Server did not return a job ID');
        console.log('Job started:', jobId);

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

          const pollResp = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-job-status`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              },
              body: JSON.stringify({ jobId }),
            }
          );

          if (!pollResp.ok) continue; // transient error — keep polling

          const job = await pollResp.json();
          console.log('Job status:', job.status, 'elapsed:', elapsed, 's');

          if (job.status === 'completed' && job.imageUrl) {
            if (!cancelled) {
              setResultImage(job.imageUrl);
              setStage("result");
              setProcessingStatus("Done! ✨");

              // Clean up uploaded face image
              if (userImageUrl) {
                const fileName = userImageUrl.split('/').pop();
                if (fileName) {
                  supabase.storage.from('user-uploads').remove([fileName]).catch(() => {});
                }
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
          setGeneratingError(msg);
          toast.error("Generation failed", { description: msg });
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
    // ── AUTH GATE: never allow unauthenticated generation ────────────────────
    if (!isAuthenticated) {
      setShowAuthModal(true);
      toast.info('Please sign in to generate images');
      return;
    }
    // If no image uploaded, set a placeholder to trigger processing
    if (!uploadedImage) {
      setUploadedImage("no-reference-image");
    }
    setStage("processing");
  };

  const handleRemoveImage = () => {
    setUploadedImage(null);
    setResultImage(null);
    setGeneratingError(null);
    setProcessingStatus("");
    setStage("upload");
    if (fileInputRef.current) fileInputRef.current.value = "";
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

          {/* ═══════════════ RIGHT PANEL — Upload / Result ═══════════════ */}
          <div className="flex-1 p-3 sm:p-4 flex flex-col min-h-0 overflow-hidden">
                  {/* Compact Header */}
                  <div className="flex items-center justify-between mb-2 shrink-0">
                    <div className="flex-1">
                      <h3 className="text-sm font-display font-bold text-gray-900 leading-tight">
                        See Yourself In This Style
                      </h3>
                      <p className="text-[10px] text-gray-600">
                        Free AI • High quality download
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-[9px] text-violet-light bg-violet-DEFAULT/10 border border-violet-DEFAULT/20 rounded px-1.5 py-0.5 h-fit">
                      <Lock size={8} /> Protected
                    </div>
                  </div>


                  {/* Text Modifications Input */}
                  <div className="mb-3 shrink-0">
                    <label className="text-[9px] font-semibold text-gray-600 uppercase tracking-wider block mb-1.5">
                      Text Modifications (Optional)
                    </label>
                    <textarea
                      value={textModifications}
                      onChange={(e) => setTextModifications(e.target.value)}
                      placeholder='e.g., "Replace John to Sarah" or "Change welcome to hello"'
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-DEFAULT/20 focus:border-violet-DEFAULT transition-all resize-none"
                      rows={2}
                    />
                    <p className="text-[9px] text-gray-500 mt-1">
                      Tell the AI what text to modify in the style (e.g., "replace this to that")
                    </p>
                  </div>

                  {/* ─── Upload / Processing / Result Area ─── */}
                  <div className="flex-1 flex flex-col min-h-0 justify-center">
                    {/* Upload state */}
                    {stage === "upload" && !uploadedImage && (
                      <>
                        <div
                          className={`flex-1 max-h-[380px] border-2 border-dashed rounded-lg py-6 px-4 text-center cursor-pointer transition-all duration-300 group flex flex-col items-center justify-center ${
                            isDragOver
                              ? "border-violet-DEFAULT/60 bg-violet-DEFAULT/[0.08]"
                              : "border-violet-DEFAULT/30 hover:border-violet-DEFAULT/60 bg-violet-DEFAULT/[0.03] hover:bg-violet-DEFAULT/[0.06]"
                          }`}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setIsDragOver(true);
                          }}
                          onDragLeave={() => setIsDragOver(false)}
                          onDrop={handleDrop}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={handleFileInput}
                          />
                          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-violet-DEFAULT/20 to-magenta/10 border border-violet-DEFAULT/20 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                            <Upload className="text-violet-light" size={20} />
                          </div>
                          <div className="mt-3 font-semibold text-gray-800 text-base">
                            Drop your photo here (optional)
                          </div>
                          <div className="text-xs text-violet-light/70 mt-1 underline underline-offset-2">
                            or click to browse
                          </div>
                          <div className="text-[10px] text-gray-500 mt-2">
                            JPG, PNG, WEBP up to 10MB
                          </div>
                        </div>
                        
                        {/* Generate button */}
                        <div className="mt-3 text-center">
                          <button
                            onClick={handleGenerate}
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold text-base shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 flex items-center justify-center gap-2"
                          >
                            <Sparkles size={16} /> Generate Image
                          </button>
                          <p className="text-[9px] text-gray-500 mt-2">
                            {textModifications.trim() && !uploadedImage
                              ? "Will generate with text modifications"
                              : !textModifications.trim() && !uploadedImage
                              ? "Will generate with original prompt"
                              : "Upload photo to see yourself in this style"}
                          </p>
                        </div>
                      </>
                    )}

                    {/* Uploaded preview — ready to generate */}
                    {stage === "upload" && uploadedImage && uploadedImage !== "no-reference-image" && (
                      <div className="flex flex-col animate-fade-in items-center justify-center flex-1">
                        <div className="relative rounded-lg overflow-hidden w-40 h-40 border border-gray-200">
                          <img
                            src={uploadedImage}
                            alt="Your photo"
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={handleRemoveImage}
                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-lg bg-white/90 hover:bg-red-50 border border-gray-200 flex items-center justify-center transition-all duration-200"
                          >
                            <Trash2 size={12} className="text-gray-700" />
                          </button>
                        </div>
                        <button
                          onClick={handleGenerate}
                          className="mt-4 w-full max-w-xs py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold text-base shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 flex items-center justify-center gap-2"
                        >
                          <Sparkles size={16} /> Generate With Photo
                        </button>
                        {textModifications.trim() && (
                          <p className="text-[9px] text-gray-600 text-center mt-2">
                            Will apply your text modifications
                          </p>
                        )}
                      </div>
                    )}

                    {/* Processing state */}
                    {stage === "processing" && (
                      <div className="flex-1 flex flex-col items-center justify-center py-10 animate-fade-in">
                        {generatingError ? (
                          /* Error state */
                          <div className="text-center px-4">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                              <AlertCircle size={28} className="text-red-400" />
                            </div>
                            <div className="font-display text-base sm:text-lg font-bold text-gray-900 mb-2">
                              Generation Failed
                            </div>
                            <p className="text-xs sm:text-sm text-gray-600 max-w-sm mx-auto mb-4">
                              {generatingError}
                            </p>
                            <button
                              onClick={handleRemoveImage}
                              className="px-4 py-2 rounded-xl bg-gray-100 border border-gray-200 text-sm text-gray-700 hover:bg-gray-200 transition-all"
                            >
                              ← Try another photo
                            </button>
                          </div>
                        ) : (
                          /* Spinner + status */
                          <>
                            <div className="relative w-16 h-16 sm:w-20 sm:h-20">
                              <div className="absolute inset-0 rounded-full border-[3px] border-violet-DEFAULT/15" />
                              <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-violet-DEFAULT animate-spin" />
                              <div
                                className="absolute inset-3 rounded-full border-[2px] border-transparent border-b-magenta animate-spin"
                                style={{
                                  animationDirection: "reverse",
                                  animationDuration: "1.5s",
                                }}
                              />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <Sparkles
                                  size={18}
                                  className="text-violet-light animate-pulse"
                                />
                              </div>
                            </div>
                            <div className="mt-5 font-display text-base sm:text-lg font-bold text-gray-900">
                              {processingStatus || "Applying style magic..."}
                            </div>
                            <div className="mt-1.5 text-xs sm:text-sm text-gray-600">
                              Processing securely 🔒 · This may take 10–30s
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Result state — output replaces the upload zone */}
                    {stage === "result" && resultImage && (
                      <div className="flex flex-col gap-2.5 flex-1">
                        {/* Result image */}
                        <div className="relative rounded-lg overflow-hidden bg-gray-100 border border-violet-DEFAULT/20 flex-1 flex items-center justify-center min-h-0">
                          <img
                            src={resultImage}
                            alt="Styled result"
                            className="w-full h-full object-contain"
                          />
                          {/* Blur overlay for unpurchased paid styles */}
                          {!canDownload && (
                            <div className="absolute inset-0 backdrop-blur-xl bg-black/40 flex flex-col items-center justify-center gap-3 rounded-lg">
                              <Lock size={28} className="text-white" />
                              <p className="text-white font-semibold text-sm text-center px-4">
                                Purchase to unlock full download
                              </p>
                              <p className="text-white/70 text-xs">
                                ₹{style.price} one-time
                              </p>
                            </div>
                          )}
                        </div>

                        <p className="text-center text-xs text-gray-700 font-medium -mt-1">
                          Your AI-generated image is ready! ✨
                        </p>

                        {/* Download / Buy button — conditional on purchase */}
                        {canDownload ? (
                          /* ─── FREE or PURCHASED: allow direct download ─── */
                          <button
                            onClick={() => download(
                              resultImage,
                              `${style.title.replace(/\s+/g, '-')}-${Date.now()}.png`
                            )}
                            disabled={isDownloading}
                            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-base hover:shadow-[0_12px_40px_rgba(16,185,129,0.5)] transition-all duration-300 hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {isDownloading ? (
                              <><Loader2 size={18} className="animate-spin" /> Downloading...</>
                            ) : (
                              <><Download size={18} className="font-bold" /> Download Image</>
                            )}
                          </button>
                        ) : (
                          /* ─── PAID & NOT PURCHASED: show buy button ─── */
                          <button
                            onClick={async () => {
                              if (!isAuthenticated) {
                                setShowAuthModal(true);
                                return;
                              }
                              try {
                                await purchaseStyle(
                                  style.id,
                                  style.title,
                                  style.price,
                                  style.seller_id ?? null
                                );
                                // After successful purchase, download immediately
                                await download(
                                  resultImage,
                                  `${style.title.replace(/\s+/g, '-')}-${Date.now()}.png`
                                );
                              } catch {
                                // errors handled in hook
                              }
                            }}
                            disabled={isPurchasing || isDownloading}
                            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold text-base hover:shadow-[0_12px_40px_rgba(124,58,237,0.5)] transition-all duration-300 hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {isPurchasing ? (
                              <><Loader2 size={18} className="animate-spin" /> Processing Payment...</>
                            ) : (
                              <><ShoppingCart size={18} /> Buy & Download — ₹{style.price}</>
                            )}
                          </button>
                        )}

                        <div className="flex items-center justify-between text-xs">
                          <p className="text-gray-600 flex items-center gap-1">
                            <ShieldCheck size={13} className="inline text-green-500" />
                            {canDownload ? 'No watermark · Full HD' : `One-time purchase · Unlimited downloads`}
                          </p>
                          <button
                            onClick={handleRemoveImage}
                            className="text-xs text-gray-600 hover:text-gray-900 transition-colors underline"
                          >
                            Try another photo
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Mobile-only: Related styles */}
                  {relatedFill.length > 0 && (
                    <div className="mt-4 md:hidden">
                      <h4 className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-2">
                        More like this
                      </h4>
                      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1">
                        {relatedFill.map((r) => (
                          <button
                            key={r.id}
                            onClick={() => {
                              setStage("upload");
                              setUploadedImage(null);
                              openStyle(r.id);
                            }}
                            className="shrink-0 w-24 rounded-xl overflow-hidden glass-card"
                          >
                            <div className="aspect-square overflow-hidden">
                              <img
                                src={r.sample_image_url}
                                alt={r.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="px-2 py-1 text-[10px] truncate text-left text-gray-700">
                              {r.title}
                            </div>
                          </button>
                        ))}
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
    </>
  );
}
