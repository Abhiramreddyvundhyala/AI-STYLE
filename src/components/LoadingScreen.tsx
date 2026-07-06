import { Sparkles } from "lucide-react";

export function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-deep relative">
      <div className="absolute inset-0 aurora-bg opacity-30" />
      <div className="relative flex flex-col items-center gap-4 animate-fade-in">
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-DEFAULT to-magenta flex items-center justify-center shadow-[0_0_40px_rgba(124,58,237,0.3)] animate-pulse-glow">
            <Sparkles size={24} className="text-white" />
          </div>
        </div>
        <div className="font-display text-lg font-bold gradient-text">
          PromptStyle
        </div>
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-violet-DEFAULT animate-bounce-subtle" />
          <div className="w-1.5 h-1.5 rounded-full bg-magenta animate-bounce-subtle" style={{ animationDelay: "0.15s" }} />
          <div className="w-1.5 h-1.5 rounded-full bg-amber-DEFAULT animate-bounce-subtle" style={{ animationDelay: "0.3s" }} />
        </div>
      </div>
    </div>
  );
}
