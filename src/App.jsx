import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, useLocation, Navigate } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { lazy, Suspense } from 'react';
import PageNotFound from './lib/PageNotFound';
// Landing and Login are what an unauthenticated visitor lands on, so they stay
// in the first chunk — splitting them would put a spinner in front of the
// page that has to be instant. Everything below is reached by a deliberate
// navigation and can afford to be fetched then.
import Landing from './pages/Landing';
import Login from './pages/Login';
const Paywall = lazy(() => import('./pages/Paywall'));
const Suspended = lazy(() => import('./pages/Suspended'));
const AdminIPPanel = lazy(() => import('./pages/AdminIPPanel'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ThemeProvider } from '@/lib/useTheme';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import CardStorm from '@/components/marketing/CardStorm';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

/**
 * The page is loaded on demand, so something has to hold the frame while its
 * chunk arrives. The boundary sits INSIDE the layout on purpose: the nav, the
 * rail and the theme are already on screen and should stay there, so a
 * navigation reads as the page filling in rather than the app blinking out.
 *
 * The spinner matches the auth one below it — same size, same tokens — so the
 * two never look like different states of the same wait.
 */
const PageFallback = () => (
  <div className="flex items-center justify-center py-24" role="status" aria-label="Loading">
    <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
  </div>
);

const LayoutWrapper = ({ children, currentPageName }) => {
  const page = <Suspense fallback={<PageFallback />}>{children}</Suspense>;
  return Layout ? <Layout currentPageName={currentPageName}>{page}</Layout> : page;
};

const AuthenticatedApp = () => {
  const { isAuthenticated, isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  // Legal pages are fully public — they must render for logged-out visitors
  // AND ad-network crawlers, regardless of auth state, so they sit ahead of
  // every auth check below.
  if (location.pathname === '/privacy') {
    return <Privacy />;
  }
  if (location.pathname === '/terms') {
    return <Terms />;
  }

  // Unauthenticated visitors at `/` get the public landing page
  // (instead of being bounced straight to login)
  const isUnauthed = !isAuthenticated || authError?.type === 'auth_required';
  if (isUnauthed && location.pathname === '/') {
    return <Landing />;
  }
  // Pre-signup onboarding wizard — public, no auth needed.
  if (isUnauthed && location.pathname === '/onboarding') {
    return <Onboarding />;
  }
  // Email+password sign-in / recovery routes — public.
  if (isUnauthed && location.pathname === '/login') {
    return <Login />;
  }
  if (isUnauthed && location.pathname === '/forgot-password') {
    return <ForgotPassword />;
  }
  // /reset-password runs the user through Supabase's recovery flow. The user
  // IS technically authenticated by the recovery token at this point, so this
  // check has to allow the route through regardless of isAuthenticated.
  if (location.pathname === '/reset-password') {
    return <ResetPassword />;
  }

  // Once authenticated, the sign-up/sign-in pages must not render — after
  // OAuth/email sign-in the browser can land back on /login, which would
  // otherwise 404 (no authed /login route). Send them into the app instead.
  // /onboarding is deliberately NOT in this list: an authenticated visitor
  // there is retaking the wizard on purpose (see the Settings "Study setup"
  // link), and the route below renders it in existing-user mode rather than
  // the pre-signup one.
  if (isAuthenticated && ['/login', '/forgot-password'].includes(location.pathname)) {
    return <Navigate to="/" replace />;
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="/onboarding" element={<Onboarding existingUser />} />
      {/* Roadmap retired — old links land on the Planner */}
      <Route path="/StudyRoadmap" element={<Navigate to="/Goals" replace />} />
      {/* Explore became Help and moved under Account */}
      <Route path="/Explore" element={<Navigate to="/Help" replace />} />
      <Route path="/Paywall" element={<Paywall />} />
      <Route path="/Suspended" element={<Suspended />} />
      <Route path="/AdminIPPanel" element={<LayoutWrapper currentPageName="AdminIPPanel"><AdminIPPanel /></LayoutWrapper>} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      {/* Outside the auth gate, because the landing page, the login screen
          and the onboarding wizard all render on the far side of it and all
          three should honour the theme. The inline script in index.html has
          already applied it before this mounts; this keeps it true afterwards
          — when the setting changes, when the device flips, and when the
          clock crosses seven on the by-time-of-day setting. */}
      <ThemeProvider>
      <QueryClientProvider client={queryClientInstance}>
        {/* Respect OS-level reduced-motion for every framer-motion animation */}
        <MotionConfig reducedMotion="user">
          <Router>
            <NavigationTracker />
            {/* ABOVE THE AUTH GATE ON PURPOSE.
                Opening the site showed a white flash and then a bare spinner
                for roughly two seconds while auth and public settings
                resolved. The storm used to live inside Landing, which is on
                the far side of that gate, so it could not start until the
                exact moment the thing it should have been covering had
                already finished.

                Mounted here it starts as soon as React does, and the static
                boot layer in index.html covers everything before that. The
                spinner still runs underneath for anyone who skips. */}
            <CardStorm />
            {/* Outer boundary for the routes AuthenticatedApp returns
                directly — /privacy, /terms, /onboarding and the recovery
                flow all render outside LayoutWrapper, so they need one of
                their own. Page navigations inside the app hit the inner
                boundary first and keep their chrome. */}
            <Suspense fallback={
              <div className="fixed inset-0 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
              </div>
            }>
              <AuthenticatedApp />
            </Suspense>
          </Router>
          <Toaster />
        </MotionConfig>
      </QueryClientProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}

export default App