import { path } from "@web/router/path";
import type { RouteConfig } from "@web/router/types";
import { lazy, type ReactNode } from "react";
import {
  FaClipboardList,
  FaCreditCard,
  FaFolder,
  FaHome,
  FaLayerGroup,
  FaTags,
  FaTasks,
  FaUniversity,
} from "react-icons/fa";

export { path } from "@web/router/path";

const HomePage = lazy(() => import("@web/routes/home/page"));
const AccountsListPage = lazy(() => import("@web/routes/accounts/list/page"));
const AccountDetailsPage = lazy(() => import("@web/routes/accounts/details/page"));
const AccountStatementsPage = lazy(() => import("@web/routes/accounts/statements/page"));
const JobsPage = lazy(() => import("@web/routes/jobs/page"));
const JobDetailsPage = lazy(() => import("@web/routes/jobs/details/page"));
const CategoriesPage = lazy(() => import("@web/routes/categories/page"));
const TagsPage = lazy(() => import("@web/routes/tags/page"));
const RulesPage = lazy(() => import("@web/routes/rules/page"));
const RuleEditorPage = lazy(() => import("@web/routes/rules/editor/page"));
const CreditCardsPage = lazy(() => import("@web/routes/credit-cards/page"));
const LoginPage = lazy(() => import("@web/routes/login/page"));
const NotFoundPage = lazy(() => import("@web/routes/not-found/page"));
const RecoveryRequestPage = lazy(() => import("@web/routes/recovery/request/page"));
const RecoveryPasswordPage = lazy(() => import("@web/routes/recovery/password/page"));
const RecoveryAdvancedPage = lazy(() => import("@web/routes/recovery/advanced/page"));

function sidebarEntry(icon: ReactNode): RouteConfig["sidebar"] {
  return { show: true, icon };
}

const organizeSidebarGroup = {
  id: "organize",
  label: "Organize",
  icon: <FaLayerGroup />,
};

export const routes: RouteConfig[] = [
  {
    path: path.login,
    element: <LoginPage />,
    label: "Login",
    app: { public: true },
  },
  {
    path: path.recovery.request,
    element: <RecoveryRequestPage />,
    label: "Recovery Request",
    app: { public: true },
  },
  {
    path: path.recovery.password,
    element: <RecoveryPasswordPage />,
    label: "Password Recovery",
    app: { public: true },
  },
  {
    path: path.recovery.advanced,
    element: <RecoveryAdvancedPage />,
    label: "Advanced Recovery",
    app: { public: true },
  },
  {
    path: path.notFound,
    element: <NotFoundPage />,
    label: "Not Found",
    app: { public: true },
  },
  {
    path: path.home,
    element: <HomePage />,
    label: "Home",
    sidebar: { show: true, icon: <FaHome /> },
  },
  {
    path: path.accounts.list,
    element: <AccountsListPage />,
    label: "Accounts",
    sidebar: sidebarEntry(<FaUniversity />),
  },
  {
    path: path.categories.list,
    element: <CategoriesPage />,
    label: "Categories",
    sidebar: { show: true, icon: <FaFolder />, group: organizeSidebarGroup },
  },
  {
    path: path.tags.list,
    element: <TagsPage />,
    label: "Tags",
    sidebar: { show: true, icon: <FaTags />, group: organizeSidebarGroup },
  },
  {
    path: path.rules.list,
    element: <RulesPage />,
    label: "Rules",
    sidebar: sidebarEntry(<FaClipboardList />),
  },
  {
    path: path.rules.create,
    element: <RuleEditorPage />,
    label: "New Rule",
  },
  {
    path: path.rules.details(),
    element: <RuleEditorPage />,
    label: "Edit Rule",
  },
  {
    path: path.creditCards.hub,
    element: <CreditCardsPage />,
    label: "Card Benefits",
    sidebar: sidebarEntry(<FaCreditCard />),
  },
  {
    path: path.accounts.statements(),
    element: <AccountStatementsPage />,
    label: "Account Statements",
  },
  {
    path: path.accounts.details(),
    element: <AccountDetailsPage />,
    label: "Account Details",
  },
  {
    path: path.jobs.list,
    element: <JobsPage />,
    label: "Jobs",
    sidebar: sidebarEntry(<FaTasks />),
  },
  {
    path: path.jobs.details(),
    element: <JobDetailsPage />,
    label: "Job Details",
  },
];
