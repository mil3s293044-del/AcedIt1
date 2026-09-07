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
import { lazyPage } from '@/lib/lazyPage';

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
const AITools = lazyPage('AITools', () => import('./pages/AITools'));
const AIToolsHistory = lazyPage('AIToolsHistory', () => import('./pages/AIToolsHistory'));
const Analytics = lazyPage('Analytics', () => import('./pages/Analytics'));
const Checkout = lazyPage('Checkout', () => import('./pages/Checkout'));
const Competitions = lazyPage('Competitions', () => import('./pages/Competitions'));
const Dashboard = lazyPage('Dashboard', () => import('./pages/Dashboard'));
const Friends = lazyPage('Friends', () => import('./pages/Friends'));
const Goals = lazyPage('Goals', () => import('./pages/Goals'));
const Strategise = lazyPage('Strategise', () => import('./pages/Strategise'));
const Guides = lazyPage('Guides', () => import('./pages/Guides'));
const PaymentCancel = lazyPage('PaymentCancel', () => import('./pages/PaymentCancel'));
const PaymentSuccess = lazyPage('PaymentSuccess', () => import('./pages/PaymentSuccess'));
const Premium = lazyPage('Premium', () => import('./pages/Premium'));
const Quizzes = lazyPage('Quizzes', () => import('./pages/Quizzes'));
const Ranked = lazyPage('Ranked', () => import('./pages/Ranked'));
const Review = lazyPage('Review', () => import('./pages/Review'));
const Settings = lazyPage('Settings', () => import('./pages/Settings'));
const Study = lazyPage('Study', () => import('./pages/Study'));
const StudyGroups = lazyPage('StudyGroups', () => import('./pages/StudyGroups'));
const Subjects = lazyPage('Subjects', () => import('./pages/Subjects'));
const Subscription = lazyPage('Subscription', () => import('./pages/Subscription'));
const Support = lazyPage('Support', () => import('./pages/Support'));
const Timer = lazyPage('Timer', () => import('./pages/Timer'));
const Help = lazyPage('Help', () => import('./pages/Help'));
const MistakeBank = lazyPage('MistakeBank', () => import('./pages/MistakeBank'));
const SubjectHub = lazyPage('SubjectHub', () => import('./pages/SubjectHub'));
import __Layout from './Layout.jsx';


export const PAGES = {
    "AITools": AITools,
    "Help": Help,
    "MistakeBank": MistakeBank,
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
    "SubjectHub": SubjectHub,
    "Subscription": Subscription,
    "Support": Support,
    "Timer": Timer,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};