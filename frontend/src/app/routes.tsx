// oxlint-disable react/only-export-components -- this is a route manifest,
// not a component module: it exports the router and declares lazy page
// chunks. Fast-refresh boundaries live in the page files themselves.
import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./AppShell";
import { Loading } from "../components/ui";

/**
 * Route-level code splitting. Each page is a separate lazy chunk so the
 * initial bundle only carries the shell, the adapter, and the home page.
 */
const HomePage = lazy(() => import("../pages/HomePage"));
const IdentityListPage = lazy(() => import("../pages/IdentityListPage"));
const IdentityNewPage = lazy(() => import("../pages/IdentityNewPage"));
const IdentityDetailPage = lazy(() => import("../pages/IdentityDetailPage"));
const IdentityClaimsPage = lazy(() => import("../pages/IdentityClaimsPage"));
const IdentityCredentialsPage = lazy(() => import("../pages/IdentityCredentialsPage"));
const IdentityContinuityPage = lazy(() => import("../pages/IdentityContinuityPage"));
const ChallengesPage = lazy(() => import("../pages/ChallengesPage"));
const ChallengeDetailPage = lazy(() => import("../pages/ChallengeDetailPage"));
const PoliciesPage = lazy(() => import("../pages/PoliciesPage"));
const PolicyDetailPage = lazy(() => import("../pages/PolicyDetailPage"));
const AccountPage = lazy(() => import("../pages/AccountPage"));
const ProtocolPage = lazy(() => import("../pages/ProtocolPage"));
const IntegrationPage = lazy(() => import("../pages/IntegrationPage"));
const DemoPage = lazy(() => import("../pages/DemoPage"));
const NotFoundPage = lazy(() => import("../pages/NotFoundPage"));

function page(Component: React.ComponentType) {
  return (
    <Suspense fallback={<Loading label="Loading page…" />}>
      <Component />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: page(HomePage) },
      { path: "identity", element: page(IdentityListPage) },
      { path: "identity/new", element: page(IdentityNewPage) },
      { path: "identity/:profileId", element: page(IdentityDetailPage) },
      { path: "identity/:profileId/claims", element: page(IdentityClaimsPage) },
      { path: "identity/:profileId/credentials", element: page(IdentityCredentialsPage) },
      { path: "identity/:profileId/continuity", element: page(IdentityContinuityPage) },
      { path: "challenges", element: page(ChallengesPage) },
      { path: "challenges/:challengeId", element: page(ChallengeDetailPage) },
      { path: "policies", element: page(PoliciesPage) },
      { path: "policies/:policyId", element: page(PolicyDetailPage) },
      { path: "account", element: page(AccountPage) },
      { path: "protocol", element: page(ProtocolPage) },
      { path: "integration", element: page(IntegrationPage) },
      { path: "demo", element: page(DemoPage) },
      { path: "*", element: page(NotFoundPage) },
    ],
  },
]);
