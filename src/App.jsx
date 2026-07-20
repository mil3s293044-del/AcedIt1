import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, useLocation, Navigate } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import PageNotFound from './lib/PageNotFound';
import StudyRoadmap from './pages/StudyRoadmap';
import Paywall from './pages/Paywall';
import Suspended from './pages/Suspended';
import AdminIPPanel from './pages/AdminIPPanel';
import Landing from './pages/Landing';
import Onboarding from './pages/Onboarding';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isAuthenticated, isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
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

  // Once authenticated, the public auth/onboarding pages must not render —
  // after OAuth/email sign-in the browser can land back on /login or
  // /onboarding, which would otherwise 404 (no authed /login route) or
  // re-show the wizard to someone who's already signed up. Send them into
  // the app instead. (Onboarding answers are already applied by the
  // SIGNED_IN handler in AuthContext before this redirect.)
  if (isAuthenticated && ['/login', '/forgot-password', '/onboarding'].includes(location.pathname)) {
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
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/StudyRoadmap" element={<LayoutWrapper currentPageName="StudyRoadmap"><StudyRoadmap /></LayoutWrapper>} />
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
      <QueryClientProvider client={queryClientInstance}>
        {/* Respect OS-level reduced-motion for every framer-motion animation */}
        <MotionConfig reducedMotion="user">
          <Router>
            <NavigationTracker />
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </MotionConfig>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App