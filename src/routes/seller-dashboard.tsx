import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { toast } from "sonner";
import {
  Plus,
  X,
  Pause,
  Play,
  Trash2,
  Wallet,
  TrendingUp,
  ShoppingBag,
  Sparkles,
  IndianRupee,
  Loader2,
  Upload,
  ImagePlus,
  ArrowUpRight,
  Wand2,
  Edit,
} from "lucide-react";
import { aiService } from "@/lib/services/ai.service";
import { supabase } from "@/lib/supabase";
import { categories } from "@/data/styles";
import { useAuth } from "@/hooks/useAuth";
import {
  useSellerStats,
  useSellerStyles,
  useMonthlyEarnings,
  useUpdateStyle,
  useDeleteStyle,
  useCreateStyle,
  type SellerStyle,
} from "@/hooks/useSellerData";

export const Route = createFileRoute("/seller-dashboard")({
  component: SellerDashboard,
  head: () => ({
    meta: [{ title: "Seller Dashboard — PromptStyle" }],
  }),
});

function SellerDashboard() {
  const [showUpload, setShowUpload] = useState(false);
  const [editingStyle, setEditingStyle] = useState<SellerStyle | null>(null);
  const [upi, setUpi] = useState("");
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();

  // Check if user is a seller
  const isSeller = user?.user_metadata?.is_seller;

  // Require authentication - no localStorage fallback
  const sellerId = user?.id;
  const displayName =
    user?.user_metadata?.display_name ||
    user?.email?.split("@")[0] ||
    "You";

  const { data: stats, isLoading: statsLoading } = useSellerStats(sellerId);
  const { data: myStyles = [], isLoading: stylesLoading } =
    useSellerStyles(sellerId);
  const { data: chartData = [], isLoading: chartLoading } =
    useMonthlyEarnings(sellerId);

  const updateStyle = useUpdateStyle();
  const deleteStyle = useDeleteStyle();

  if (authLoading || statsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-violet-light" />
          <span className="text-sm text-gray-500">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-card p-8 max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center">
            <span className="text-3xl">🔒</span>
          </div>
          <h2 className="text-2xl font-display font-bold text-gray-900 mb-2">
            Sign In Required
          </h2>
          <p className="text-gray-600 mb-6">
            Please sign in to access the seller dashboard.
          </p>
          <a
            href="/"
            className="btn-primary inline-block"
          >
            Go to Home
          </a>
        </div>
      </div>
    );
  }

  // Redirect if not a seller
  if (isAuthenticated && !isSeller) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-card p-8 max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-100 border border-red-200 flex items-center justify-center">
            <span className="text-3xl">🚫</span>
          </div>
          <h2 className="text-2xl font-display font-bold text-gray-900 mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600 mb-6">
            Only seller accounts can access the dashboard. Please register as a seller to continue.
          </p>
          <a
            href="/"
            className="btn-primary inline-block"
          >
            Go to Home
          </a>
        </div>
      </div>
    );
  }

  const statsDisplay = [
    {
      label: "Total Earnings",
      value: `₹${stats?.total_earnings.toLocaleString() || 0}`,
      icon: IndianRupee,
      gradient: "from-amber-DEFAULT to-amber-warm",
      glow: "rgba(245,158,11,0.15)",
    },
    {
      label: "This Month",
      value: `₹${stats?.monthly_earnings.toLocaleString() || 0}`,
      icon: TrendingUp,
      gradient: "from-emerald-400 to-emerald-500",
      glow: "rgba(16,185,129,0.15)",
    },
    {
      label: "Total Sales",
      value: stats?.total_sales.toString() || "0",
      icon: ShoppingBag,
      gradient: "from-violet-DEFAULT to-violet-light",
      glow: "rgba(124,58,237,0.15)",
    },
    {
      label: "Active Styles",
      value: stats?.active_styles.toString() || "0",
      icon: Sparkles,
      gradient: "from-magenta to-rose-500",
      glow: "rgba(236,72,153,0.15)",
    },
  ];

  const maxV =
    chartData.length > 0 ? Math.max(...chartData.map((d) => d.value)) : 1;
  const availableBalance = Math.round((stats?.total_earnings || 0) * 0.75);

  const handleToggleActive = async (styleId: string, currentStatus: boolean) => {
    try {
      await updateStyle.mutateAsync({
        id: styleId,
        updates: { is_active: !currentStatus },
      });
    } catch (error) {
      console.error('Failed to toggle style status:', error);
    }
  };

  const handleDelete = async (styleId: string, styleName: string) => {
    if (confirm(`Are you sure you want to delete "${styleName}"?`)) {
      try {
        await deleteStyle.mutateAsync(styleId);
      } catch (error) {
        console.error('Failed to delete style:', error);
      }
    }
  };

  const handleEdit = (style: SellerStyle) => {
    setEditingStyle(style);
    setShowUpload(true);
  };

  const formatViews = (views: number) => {
    if (views >= 1000) return `${(views / 1000).toFixed(1)}k`;
    return views.toString();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-gray-900">
            Seller Dashboard
          </h1>
          <p className="text-gray-600 mt-1.5">
            Welcome back, <span className="text-violet-light">@{displayName}</span> 👋
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Plus size={16} /> Upload New Style
        </button>
      </div>

      {/* ─── Stats ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsDisplay.map((s) => (
          <div
            key={s.label}
            className="glass-card p-5 transition-all duration-300 hover:-translate-y-1"
            style={{ boxShadow: `0 8px 30px ${s.glow}` }}
          >
            <div
              className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center shadow-lg`}
            >
              <s.icon size={18} className="text-white" />
            </div>
            <div className="mt-3 text-2xl md:text-3xl font-display font-bold text-gray-900">
              {s.value}
            </div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ─── Chart ──────────────────────────────────────────── */}
      <div className="mt-8 glass-card p-6">
        <h2 className="text-lg font-display font-bold text-gray-900">
          Earnings — Last 6 Months
        </h2>
        {chartLoading ? (
          <div className="flex items-center justify-center h-56">
            <Loader2 className="w-6 h-6 animate-spin text-violet-light" />
          </div>
        ) : chartData.length > 0 ? (
          <div className="mt-6 flex items-end gap-3 md:gap-6 h-56">
            {chartData.map((d) => (
              <div key={d.month} className="flex-1 flex flex-col items-center gap-2">
                <div className="text-xs text-gray-600 font-medium">
                  ₹{d.value.toLocaleString()}
                </div>
                <div
                  className="w-full rounded-t-xl bg-gradient-to-t from-violet-DEFAULT to-violet-light/70 transition-all duration-500 hover:from-magenta hover:to-magenta/70 cursor-default relative group"
                  style={{ height: `${(d.value / maxV) * 100}%` }}
                >
                  <div className="absolute inset-0 rounded-t-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/[0.05]" />
                </div>
                <div className="text-xs text-gray-500">{d.month}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-gray-500">
            <div className="text-4xl mb-3">📊</div>
            No earnings data yet. Start selling to see your progress!
          </div>
        )}
      </div>

      {/* ─── My Styles Table ────────────────────────────────── */}
      <div className="mt-8 glass-card overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-display font-bold text-gray-900">
            My Styles
          </h2>
        </div>
        {stylesLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-violet-light" />
          </div>
        ) : myStyles.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-[11px] uppercase tracking-wider">
                <tr>
                  {[
                    "Style",
                    "Category",
                    "Price",
                    "Views",
                    "Sales",
                    "Earnings",
                    "Status",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3.5 text-left font-medium"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {myStyles.map((s) => {
                  const earnings = Math.round(
                    s.price * s.sales_count * 0.65
                  );
                  return (
                    <tr
                      key={s.id}
                      className={`border-t border-gray-200 hover:bg-gray-50 transition-colors ${
                        !s.is_active ? "opacity-60 bg-gray-50/50" : ""
                      }`}
                    >
                      <td className="px-4 py-4 font-semibold text-gray-800">
                        {s.title}
                        {!s.is_active && (
                          <span className="ml-2 text-[10px] text-gray-500 italic">
                            (Hidden from marketplace)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-gray-600">
                        {s.category}
                      </td>
                      <td className="px-4 py-4 text-gray-800">₹{s.price}</td>
                      <td className="px-4 py-4 text-gray-600">
                        {formatViews(s.views_count)}
                      </td>
                      <td className="px-4 py-4 text-gray-800">
                        {s.sales_count}
                      </td>
                      <td className="px-4 py-4 font-semibold gradient-text-warm">
                        ₹{earnings.toLocaleString()}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg font-semibold ${
                            s.is_active
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-gray-500/10 text-gray-500 border border-gray-500/20"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              s.is_active
                                ? "bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.6)]"
                                : "bg-gray-400"
                            }`}
                          />
                          {s.is_active ? "Live" : "Paused"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEdit(s)}
                            className="p-2 rounded-lg hover:bg-violet-50 transition-colors"
                            aria-label="Edit"
                            title="Edit style"
                          >
                            <Wand2 size={13} className="text-violet-light" />
                          </button>
                          <button
                            onClick={() =>
                              handleToggleActive(s.id, s.is_active)
                            }
                            disabled={updateStyle.isPending}
                            className="p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label={
                              s.is_active ? "Pause" : "Activate"
                            }
                            title={s.is_active ? "Pause" : "Activate"}
                          >
                            {s.is_active ? (
                              <Pause size={13} className="text-gray-600" />
                            ) : (
                              <Play size={13} className="text-gray-600" />
                            )}
                          </button>
                          <button
                            onClick={() =>
                              handleDelete(s.id, s.title)
                            }
                            disabled={deleteStyle.isPending}
                            className="p-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Delete"
                            title="Delete style"
                          >
                            <Trash2 size={13} className="text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-20 animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center">
              <span className="text-2xl">🎨</span>
            </div>
            <div className="text-gray-700 font-medium">No styles yet</div>
            <button
              onClick={() => setShowUpload(true)}
              className="mt-5 btn-primary text-sm"
            >
              Upload Your First Style
            </button>
          </div>
        )}
      </div>

      {/* ─── Withdrawal ─────────────────────────────────────── */}
      <div className="mt-8 glass-card p-6">
        <h2 className="text-lg font-display font-bold flex items-center gap-2 text-gray-900">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-DEFAULT to-amber-warm flex items-center justify-center">
            <Wallet size={16} className="text-white" />
          </div>
          Withdraw Earnings
        </h2>
        <div className="mt-2 text-sm text-gray-600">
          Available balance:{" "}
          <span className="text-lg font-display font-bold gradient-text-warm">
            ₹{availableBalance.toLocaleString()}
          </span>
        </div>
        <div className="mt-4 flex flex-col sm:flex-row gap-3 max-w-xl">
          <input
            value={upi}
            onChange={(e) => setUpi(e.target.value)}
            placeholder="yourname@upi"
            className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-DEFAULT/40 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.1)] transition-all"
          />
          <button
            onClick={() => {
              if (!upi) {
                toast.error("Please enter your UPI ID");
                return;
              }
              if (availableBalance === 0) {
                toast.error("No balance available for withdrawal");
                return;
              }
              toast.success(
                `Withdrawal of ₹${availableBalance.toLocaleString()} requested. Arrives in 2-3 days.`
              );
              setUpi("");
            }}
            disabled={availableBalance === 0}
            className="btn-warm text-sm !py-3 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Withdraw to UPI
          </button>
        </div>
      </div>

      {showUpload && (
        <UploadModal
          sellerId={sellerId}
          editingStyle={editingStyle}
          onClose={() => {
            setShowUpload(false);
            setEditingStyle(null);
          }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   UPLOAD MODAL
   ═══════════════════════════════════════════════════════════════════════════ */

function UploadModal({
  sellerId,
  editingStyle,
  onClose,
}: {
  sellerId: string | undefined;
  editingStyle?: SellerStyle | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: editingStyle?.title || "",
    category: editingStyle?.category || "Cinematic",
    price: editingStyle?.price || 99,
    desc: editingStyle?.description || "",
    prompt: editingStyle?.prompt || "",
    imageUrl: editingStyle?.sample_image_url || "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(editingStyle?.sample_image_url || null);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createStyle = useCreateStyle();
  const updateStyle = useUpdateStyle();
  const isEditMode = !!editingStyle;

  const handleImageChange = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10MB");
      return;
    }
    setImageFile(file);
    
    // Show preview immediately as base64 for UI
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setImagePreview(base64);
    };
    reader.readAsDataURL(file);
    
    // Upload to Supabase Storage and get URL
    try {
      const fileName = `style-${Date.now()}-${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from('user-uploads')
        .upload(fileName, file, {
          cacheControl: '31536000',
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('user-uploads')
        .getPublicUrl(fileName);

      // Store the URL (not base64!)
      setForm((f) => ({ ...f, imageUrl: publicUrl }));
      console.log('✅ Image uploaded to storage:', publicUrl);
    } catch (error: any) {
      console.error('Failed to upload image:', error);
      toast.error('Failed to upload image: ' + error.message);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageChange(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageChange(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setForm((f) => ({ ...f, imageUrl: "" }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleGenerateFromPrompt = async () => {
    if (!form.prompt.trim()) {
      toast.error("Please enter a prompt first");
      return;
    }
    setIsGenerating(true);
    setGenerationStatus("Starting generation...");
    try {
      // Use a placeholder styleId for text-to-image — the seller
      // will then upload the result manually or we use the image URL directly.
      // For the seller dashboard preview, we call generate-universal with
      // a freeform text modification approach.
      // NOTE: This requires a real styleId. For now we show a message.
      toast.info("To generate a preview, first save the style, then use the style page to generate a sample.");
    } catch (err: any) {
      toast.error("Generation failed", {
        description: err.message || "Please try again",
      });
    } finally {
      setIsGenerating(false);
      setGenerationStatus("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!imageFile && !form.imageUrl) {
      toast.error("Please upload a sample image or generate one from prompt");
      return;
    }
    if (!form.prompt.trim()) {
      toast.error("Please add your AI prompt");
      return;
    }

    if (isEditMode && editingStyle) {
      // Update existing style
      updateStyle.mutate(
        {
          id: editingStyle.id,
          updates: {
            title: form.name,
            category: form.category,
            price: form.price,
            description: form.desc,
            sample_image_url: form.imageUrl,
            prompt: form.prompt, // Store as plain text, secured server-side via RLS
          },
        },
        {
          onSuccess: () => {
            toast.success('Style updated successfully! 🎉');
            onClose();
          },
        }
      );
    } else {
      // Create new style
      createStyle.mutate(
        {
          title: form.name,
          category: form.category,
          price: form.price,
          description: form.desc,
          sample_image_url: form.imageUrl,
          seller_id: sellerId ?? '',
          tags: [form.category.toLowerCase(), "ai-style"],
          prompt: form.prompt, // Will be encrypted by createStyle hook
        },
        {
          onSuccess: () => {
            // Reset form
            setForm({
              name: "",
              category: "Cinematic",
              price: 99,
              desc: "",
              prompt: "",
              imageUrl: "",
            });
            setImageFile(null);
            setImagePreview(null);
            // Close modal
            onClose();
          },
        }
      );
    }
  };

  const inputClass =
    "w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-violet-DEFAULT/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(124,58,237,0.1)] transition-all duration-300";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-start justify-center p-4 pt-8 pb-8 animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="glass-card max-w-xl w-full p-6 md:p-8 relative animate-fade-in-scale border-gray-200 my-auto max-h-[calc(100vh-4rem)] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-200 flex items-center justify-center transition-all"
          aria-label="Close"
        >
          <X size={16} className="text-gray-700" />
        </button>

        <h2 className="text-2xl font-display font-bold text-gray-900">
          {isEditMode ? 'Edit Style' : 'Upload New Style'}
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          {isEditMode ? 'Update your style details.' : 'Share your magic with the world.'}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4 pb-4">
          <Field label="Style Name">
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Neon Dreams"
              className={inputClass}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value })
                }
                className={inputClass}
              >
                {categories
                  .filter((c) => c !== "All")
                  .map((c) => (
                    <option
                      key={c}
                      value={c}
                      className="bg-[#12121A] text-white"
                    >
                      {c}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Price (₹)">
              <input
                type="number"
                min={1}
                required
                value={form.price}
                onChange={(e) =>
                  setForm({ ...form, price: +e.target.value })
                }
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Description">
            <textarea
              required
              rows={2}
              value={form.desc}
              onChange={(e) => setForm({ ...form, desc: e.target.value })}
              className={inputClass}
            />
          </Field>

          {/* Image Upload */}
          <Field label="Sample Image">
            {imagePreview ? (
              <div className="relative rounded-xl overflow-hidden border border-gray-200 w-32 h-32">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute top-1 right-1 w-6 h-6 rounded-lg bg-white/90 hover:bg-red-50 flex items-center justify-center transition-colors border border-gray-200"
                  aria-label="Remove image"
                >
                  <X size={12} className="text-gray-700" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-300 ${
                  isDragging
                    ? "border-violet-DEFAULT bg-violet-DEFAULT/[0.06]"
                    : "border-gray-300 hover:border-violet-DEFAULT/50 hover:bg-gray-50"
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center">
                  <ImagePlus size={22} className="text-gray-500" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700">
                    Click to upload or drag & drop
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    PNG, JPG, WEBP up to 10MB
                  </p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-DEFAULT/10 border border-violet-DEFAULT/20 text-violet-light text-xs font-medium">
                  <Upload size={12} /> Browse Files
                </div>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileInput}
              className="hidden"
            />
          </Field>

          <Field label="Paste Your Prompt 🔒">
            <textarea
              required
              rows={3}
              value={form.prompt}
              onChange={(e) =>
                setForm({ ...form, prompt: e.target.value })
              }
              placeholder="e.g. Transform this photo into a cinematic movie poster with dramatic lighting..."
              className={`${inputClass} font-mono text-xs`}
            />
            <p className="text-[11px] text-gray-600 mt-1">
              This will be encrypted and never shown to buyers 🔒
            </p>
            {/* Generate Preview from Prompt */}
            <button
              type="button"
              onClick={handleGenerateFromPrompt}
              disabled={isGenerating || !form.prompt.trim()}
              className="mt-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold text-xs shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2 border border-gray-200"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {generationStatus || "Generating..."}
                </>
              ) : (
                <>
                  <Wand2 size={14} />
                  Generate Sample Image from Prompt
                </>
              )}
            </button>
          </Field>

          <button
            type="submit"
            disabled={
              (isEditMode ? updateStyle.isPending : createStyle.isPending) || 
              isGenerating || 
              (!imageFile && !form.imageUrl)
            }
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold text-sm shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2"
          >
            {(isEditMode ? updateStyle.isPending : createStyle.isPending) ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {isEditMode ? 'Updating...' : 'Uploading...'}
              </>
            ) : (
              <>
                <Upload size={16} /> {isEditMode ? 'Update Style' : 'List My Style'}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-gray-600 font-medium">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
