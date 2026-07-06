import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Upload, Download, Sparkles, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/tools/product-upgrader")({
  component: ProductUpgrader,
  head: () => ({
    meta: [
      { title: "Product Photo Upgrader — PromptStyle" },
      { name: "description", content: "Turn plain product photos into studio-quality images instantly." },
    ],
  }),
});

const SAMPLE_BEFORE = "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600";
const SAMPLE_AFTER = "https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=600";

const bgOptions = ["White", "Black", "Gradient", "Blur"];
const styleOptions = ["Studio", "Lifestyle", "Minimal", "Luxury"];

function ProductUpgrader() {
  const [uploaded, setUploaded] = useState(false);
  const [bg, setBg] = useState("White");
  const [styleType, setStyleType] = useState("Studio");
  const [stage, setStage] = useState<"idle" | "loading" | "done">("idle");

  const enhance = () => {
    setStage("loading");
    setTimeout(() => setStage("done"), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 text-xs text-purple bg-purple/10 border border-purple/30 rounded-full px-3 py-1 mb-4">
          <Sparkles size={14} /> Business Tools
        </div>
        <h1 className="text-3xl md:text-5xl font-display font-bold">Product Photo Upgrader</h1>
        <p className="text-white/60 mt-3 max-w-2xl mx-auto">
          Turn your plain product photo into studio-quality images instantly.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* LEFT: upload */}
        <div className="bg-card-surface border border-white/5 rounded-2xl p-6">
          <h3 className="font-display font-bold text-lg">Upload Product</h3>
          {!uploaded ? (
            <button
              onClick={() => setUploaded(true)}
              className="mt-4 w-full border-2 border-dashed border-orange/60 rounded-2xl py-12 text-center hover:border-orange transition bg-orange/5"
            >
              <Upload className="mx-auto text-orange" size={36} />
              <div className="mt-3 font-semibold">Upload your product photo</div>
              <div className="text-xs text-orange/80 mt-1 underline">Simulate Upload</div>
            </button>
          ) : (
            <div className="mt-4 rounded-2xl overflow-hidden aspect-square bg-black">
              <img src={SAMPLE_BEFORE} alt="Uploaded product" className="w-full h-full object-cover" />
            </div>
          )}

          <div className="mt-6">
            <div className="text-xs uppercase tracking-wider text-white/60 font-semibold mb-2">Background</div>
            <div className="flex flex-wrap gap-2">
              {bgOptions.map(o => (
                <button
                  key={o}
                  onClick={() => setBg(o)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                    bg === o ? "bg-orange text-black border-orange" : "border-white/15 text-white/70 hover:border-white/40"
                  }`}
                >{o}</button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <div className="text-xs uppercase tracking-wider text-white/60 font-semibold mb-2">Style</div>
            <div className="flex flex-wrap gap-2">
              {styleOptions.map(o => (
                <button
                  key={o}
                  onClick={() => setStyleType(o)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                    styleType === o ? "bg-purple text-white border-purple" : "border-white/15 text-white/70 hover:border-white/40"
                  }`}
                >{o}</button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: result */}
        <div className="bg-card-surface border border-white/5 rounded-2xl p-6">
          <h3 className="font-display font-bold text-lg">Enhanced Result</h3>
          <div className="mt-4 rounded-2xl overflow-hidden aspect-square bg-black relative">
            {stage === "done" ? (
              <div className="watermark-overlay w-full h-full">
                <img src={SAMPLE_AFTER} alt="Enhanced" className="w-full h-full object-cover" />
              </div>
            ) : (
              <img src={SAMPLE_BEFORE} alt="Before" className="w-full h-full object-cover opacity-70" />
            )}
            {stage === "loading" && (
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full border-4 border-orange/20 border-t-orange animate-spin" />
                <div className="mt-4 font-semibold">Enhancing your product...</div>
              </div>
            )}
          </div>

          {stage !== "done" ? (
            <button
              onClick={enhance}
              disabled={!uploaded || stage === "loading"}
              className="mt-4 w-full py-3 rounded-xl bg-purple text-white font-bold hover:scale-[1.02] transition disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_8px_30px_rgba(168,85,247,0.4)]"
            >
              <Sparkles className="inline mr-2" size={16} /> Enhance Photo
            </button>
          ) : (
            <>
              <button
                onClick={() => toast.info("Redirecting to payment... (Demo Mode 🚧)")}
                className="mt-4 w-full py-4 rounded-xl bg-orange text-black font-bold text-lg flex items-center justify-center gap-2 hover:scale-[1.02] transition shadow-[0_10px_40px_rgba(255,107,53,0.45)]"
              >
                <Download size={20} /> Download HD — ₹99
              </button>
              <p className="text-xs text-center text-white/60 mt-2 flex items-center justify-center gap-1">
                <ShieldCheck size={12} /> Perfect for Amazon, Flipkart, Instagram shops
              </p>
            </>
          )}
        </div>
      </div>

      {/* Pricing callout */}
      <div className="mt-10 rounded-2xl border border-orange/40 p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-4"
        style={{ background: "linear-gradient(135deg, rgba(255,107,53,0.15), rgba(168,85,247,0.15))" }}>
        <div>
          <h3 className="font-display text-xl md:text-2xl font-bold">₹99 per photo OR ₹999/month for unlimited</h3>
          <p className="text-white/70 text-sm mt-1">Best for small businesses and D2C brands.</p>
        </div>
        <button
          onClick={() => toast.info("Plans coming soon!", { description: "We'll notify you when launched." })}
          className="px-6 py-3 rounded-xl bg-orange text-black font-bold hover:scale-105 transition shadow-[0_8px_30px_rgba(255,107,53,0.4)] whitespace-nowrap"
        >
          Get Unlimited Access
        </button>
      </div>
    </div>
  );
}
