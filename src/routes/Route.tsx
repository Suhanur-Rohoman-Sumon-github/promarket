import { createBrowserRouter } from "react-router-dom";
import MainLayOut from "../layouts/MainLayout";
import Home from "../pages/Home/Home";
import {
  CategoryRoute,
  SearchRoute,
  EventDetailRoute,
} from "../pages/Home/RoutePages";
import {
  LeaderboardPage,
  ApisPage,
  ReferPage,
  BuildersPage,
  AccuracyPage,
  SupportPage,
  StatusPage,
  DocumentationPage,
  HelpCenterPage,
  TrustSafetyPage,
  TermsPage,
} from "../pages/Home/MenuPages";
import AuthPage from "../pages/Home/AuthPage";
import RewardsPage from "../pages/Home/RewardsPage";
import DepositPage from "../pages/Home/DepositPage";
import WithdrawPage from "../pages/Home/WithdrawPage";
import AdminPage from "../pages/Home/AdminPage";
import AdminRoute from "./AdminRoute";
import PaymentSuccess from "../pages/Home/PaymentSuccess";

const route = createBrowserRouter([
  {
    path: "/",
    element: <MainLayOut />,
    children: [
      { index: true, element: <Home /> },
      { path: "category/:category", element: <CategoryRoute /> },
      { path: "search", element: <SearchRoute /> },
      { path: "event/:slug", element: <EventDetailRoute /> },
      { path: "deposit", element: <DepositPage /> },
      { path: "withdraw", element: <WithdrawPage /> },
      // Menu Pages
      { path: "leaderboard", element: <LeaderboardPage /> },
      { path: "rewards", element: <RewardsPage /> },
      { path: "apis", element: <ApisPage /> },
      { path: "refer", element: <ReferPage /> },
      { path: "builders", element: <BuildersPage /> },
      { path: "accuracy", element: <AccuracyPage /> },
      { path: "support", element: <SupportPage /> },
      { path: "status", element: <StatusPage /> },
      { path: "docs", element: <DocumentationPage /> },
      { path: "help", element: <HelpCenterPage /> },
      { path: "trust", element: <TrustSafetyPage /> },
      { path: "terms", element: <TermsPage /> },
      { path: "login", element: <AuthPage mode="login" /> },
      { path: "signup", element: <AuthPage mode="signup" /> },
      {path: "payment-success", element: <PaymentSuccess />},
      {
        path: "admin",
        element: (
          <AdminRoute>
            <AdminPage />
          </AdminRoute>
        ),
      },
    ],
  },
]);

export default route;
