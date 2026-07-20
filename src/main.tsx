import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { RootLayout } from "@/components/layout/RootLayout";
import { getTrendInsight, listTrends } from "@/api/trends";
import { ReviewScreen } from "@/screens/ReviewScreen";
import { TrendsScreen } from "@/screens/TrendsScreen";
import { GenreDetailScreen } from "@/screens/GenreDetailScreen";
import { CreateReelScreen } from "@/screens/CreateReelScreen";
import { StudioScreen } from "@/screens/StudioScreen";
import { ThumbnailStudioScreen } from "@/screens/ThumbnailStudioScreen";
import { YtSearchScreen } from "@/screens/YtSearchScreen";
import { YtImportDetailScreen } from "@/screens/YtImportDetailScreen";
import { GameplayLibraryScreen } from "@/screens/GameplayLibraryScreen";
import { AccountsScreen } from "@/screens/AccountsScreen";
import { OperationsScreen } from "@/screens/OperationsScreen";
import { AnalyticsScreen } from "@/screens/AnalyticsScreen";
import { getYtImport } from "@/api/yt-imports";
import "@/styles.css";

const rootRoute = createRootRoute({
  component: RootLayout,
});

export const reviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: (search: Record<string, unknown>) => ({
    status: typeof search.status === "string" ? search.status : undefined,
  }),
  component: ReviewScreen,
});

export const trendsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/trends",
  component: TrendsScreen,
});

export const analyticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/analytics",
  component: AnalyticsScreen,
});

// Loader fetches before the screen mounts (no fetch-on-render waterfall / loading flash).
export const trendsGenreRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/trends/$genre",
  loader: ({ params }) => Promise.all([listTrends(params.genre), getTrendInsight(params.genre)]),
  component: GenreDetailScreen,
});

export const createReelRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reels/new",
  component: CreateReelScreen,
});

export const studioRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/studio/$id",
  component: StudioScreen,
});

export const thumbnailStudioRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/studio/$id/thumbnail",
  validateSearch: (search: Record<string, unknown>) => ({
    mode: search.mode === "shorts" ? ("shorts" as const) : undefined,
  }),
  component: ThumbnailStudioScreen,
});

export const ytSearchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/youtube",
  component: YtSearchScreen,
});

export const ytImportDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/youtube/$importId",
  loader: ({ params }) => getYtImport(params.importId),
  component: YtImportDetailScreen,
});

export const gameplayLibraryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/gameplay",
  component: GameplayLibraryScreen,
});

export const accountsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/accounts", component: AccountsScreen });

export const operationsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/operations", component: OperationsScreen });

const routeTree = rootRoute.addChildren([
  reviewRoute,
  trendsRoute,
  analyticsRoute,
  trendsGenreRoute,
  createReelRoute,
  studioRoute,
  thumbnailStudioRoute,
  ytSearchRoute,
  ytImportDetailRoute,
  gameplayLibraryRoute,
  accountsRoute,
  operationsRoute,
]);

const router = createRouter({
  routeTree,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
