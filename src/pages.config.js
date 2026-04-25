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
import AITools from './pages/AITools';
import AIToolsHistory from './pages/AIToolsHistory';
import Analytics from './pages/Analytics';
import Checkout from './pages/Checkout';
import Competitions from './pages/Competitions';
import Dashboard from './pages/Dashboard';
import Friends from './pages/Friends';
import Goals from './pages/Goals';
import Guides from './pages/Guides';
import PaymentCancel from './pages/PaymentCancel';
import PaymentSuccess from './pages/PaymentSuccess';
import Premium from './pages/Premium';
import Pricing from './pages/Pricing';
import Quizzes from './pages/Quizzes';
import Ranked from './pages/Ranked';
import Settings from './pages/Settings';
import Study from './pages/Study';
import StudyGroups from './pages/StudyGroups';
import Subjects from './pages/Subjects';
import Subscription from './pages/Subscription';
import Support from './pages/Support';
import Timer from './pages/Timer';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AITools": AITools,
    "AIToolsHistory": AIToolsHistory,
    "Analytics": Analytics,
    "Checkout": Checkout,
    "Competitions": Competitions,
    "Dashboard": Dashboard,
    "Friends": Friends,
    "Goals": Goals,
    "Guides": Guides,
    "PaymentCancel": PaymentCancel,
    "PaymentSuccess": PaymentSuccess,
    "Premium": Premium,
    "Pricing": Pricing,
    "Quizzes": Quizzes,
    "Ranked": Ranked,
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