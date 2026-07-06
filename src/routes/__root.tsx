import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
} from "@tanstack/react-router";

import { Toaster } from "sonner";
import { AppProvider } from "@/context/AppContext";
import { Navbar } from "@/components/Navbar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { useStylesSync } from "@/hooks/useStyles";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 relative">
      <div className="absolute inset-0 aurora-bg opacity-20" />
      <div className="relative max-w-md text-center animate-fade-in-scale">
        <div className="text-8xl font-display font-bold gradient-text">404</div>
        <h2 className="mt-4 text-xl font-semibold text-gray-900">Page not found</h2>
        <p className="mt-2 text-sm text-gray-600">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-8">
          <Link
            to="/"
            className="btn-primary inline-flex items-center gap-2"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center px-4 relative">
      <div className="absolute inset-0 aurora-bg opacity-15" />
      <div className="relative max-w-md text-center animate-fade-in-scale">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center">
          <span className="text-2xl">⚠️</span>
        </div>
        <h1 className="text-xl font-display font-bold text-gray-900">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          We hit a snag. Try refreshing or head back home.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="btn-primary"
          >
            Try again
          </button>
          <a href="/" className="btn-ghost">
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    component: RootComponent,
    notFoundComponent: NotFoundComponent,
    errorComponent: ErrorComponent,
  }
);

// Inner component — must be inside QueryClientProvider to use useQueryClient
function AppShell() {
  useStylesSync();
  return (
    <AppProvider>
      <div className="min-h-screen bg-deep text-gray-900 pb-20 md:pb-0 relative">
        {/* Floating background orbs */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div className="orb orb-violet w-[600px] h-[600px] -top-40 -left-40 animate-float opacity-20" />
          <div className="orb orb-magenta w-[400px] h-[400px] top-1/3 -right-32 animate-float-delayed opacity-15" />
          <div className="orb orb-amber w-[500px] h-[500px] -bottom-32 left-1/4 animate-float-slow opacity-10" />
        </div>

        {/* Content */}
        <div className="relative z-10">
          <Navbar />
          <Outlet />
          <MobileBottomNav />
        </div>
      </div>
      <Toaster
        theme="light"
        position="bottom-right"
        richColors
        closeButton
        visibleToasts={3}
        toastOptions={{
          style: {
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(0,0,0,0.08)",
            color: "#1a1a1a",
            borderRadius: "14px",
          },
        }}
      />
    </AppProvider>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
    </QueryClientProvider>
  );
}
