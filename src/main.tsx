import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { RootLayout } from "@/components/layout/RootLayout";
import { listTrends } from "@/api/trends";
import { ReviewScreen } from "@/screens/ReviewScreen";
import { TrendsScreen } from "@/screens/TrendsScreen";
import { GenreDetailScreen } from "@/screens/GenreDetailScreen";
import { CreateReelScreen } from "@/screens/CreateReelScreen";
import { StudioScreen } from "@/screens/StudioScreen";
import { YtSearchScreen } from "@/screens/YtSearchScreen";
import { YtImportDetailScreen } from "@/screens/YtImportDetailScreen";
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

// Loader fetches before the screen mounts (no fetch-on-render waterfall / loading flash).
export const trendsGenreRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/trends/$genre",
  loader: ({ params }) => listTrends(params.genre),
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

const routeTree = rootRoute.addChildren([
  reviewRoute,
  trendsRoute,
  trendsGenreRoute,
  createReelRoute,
  studioRoute,
  ytSearchRoute,
  ytImportDetailRoute,
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
