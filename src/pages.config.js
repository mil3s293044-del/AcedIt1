/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import { lazy } from 'react';

// Every page is loaded on demand.
//
// Statically imported, the 24 pages here plus what they pull in — recharts,
// KaTeX, html2canvas, the whole AI tool set — built ONE 4MB bundle that every
// student downloaded and parsed before the dashboard could paint, on a school
// wifi connection, most of it for pages they were not going to open. Each of
// these is now its own chunk, fetched when the route is.
//
// Layout is NOT lazy: it is on every route, so splitting it would only add a
// round trip before the chrome appears.
const AITools = lazy(() => import('./pages/AITools'));
const AIToolsHistory = lazy(() => import('./pages/AIToolsHistory'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Competitions = lazy(() => import('./pages/Competitions'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Friends = lazy(() => import('./pages/Friends'));
const Goals = lazy(() => import('./pages/Goals'));
const Strategise = lazy(() => import('./pages/Strategise'));
const Guides = lazy(() => import('./pages/Guides'));
const PaymentCancel = lazy(() => import('./pages/PaymentCancel'));
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess'));
const Premium = lazy(() => import('./pages/Premium'));
const Quizzes = lazy(() => import('./pages/Quizzes'));
const Ranked = lazy(() => import('./pages/Ranked'));
const Review = lazy(() => import('./pages/Review'));
const Settings = lazy(() => import('./pages/Settings'));
const Study = lazy(() => import('./pages/Study'));
const StudyGroups = lazy(() => import('./pages/StudyGroups'));
const Subjects = lazy(() => import('./pages/Subjects'));
const Subscription = lazy(() => import('./pages/Subscription'));
const Support = lazy(() => import('./pages/Support'));
const Timer = lazy(() => import('./pages/Timer'));
const Help = lazy(() => import('./pages/Help'));
import __Layout from './Layout.jsx';


export const PAGES = {
    "AITools": AITools,
    "Help": Help,
    "AIToolsHistory": AIToolsHistory,
    "Analytics": Analytics,
    "Checkout": Checkout,
    "Competitions": Competitions,
    "Dashboard": Dashboard,
    "Friends": Friends,
    "Goals": Goals,
    "Strategise": Strategise,
    "Guides": Guides,
    "PaymentCancel": PaymentCancel,
    "PaymentSuccess": PaymentSuccess,
    "Premium": Premium,
    "Quizzes": Quizzes,
    "Ranked": Ranked,
    "Review": Review,
    "Settings": Settings,
    "Study": Study,
    "StudyGroups": StudyGroups,
    "Subjects": Subjects,
    "Subscription": Subscription,
    "Support": Support,
    "Timer": Timer,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};