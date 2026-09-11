import type { RouteConfig } from "@web/router/types";
import { lazy, type ReactNode } from "react";
import { FaCreditCard, FaFileAlt, FaHome, FaTasks, FaUniversity } from "react-icons/fa";

const HomePage = lazy(() => import("@web/routes/home/page"));
const BankAccountPage = lazy(() => import("@web/routes/statements/bank-account/page"));
const CreditCardPage = lazy(() => import("@web/routes/statements/credit-card/page"));
const CreditCardDetailsPage = lazy(() => import("@web/routes/statements/credit-card/details/page"));
const JobsPage = lazy(() => import("@web/routes/jobs/page"));
const JobDetailsPage = lazy(() => import("@web/routes/jobs/details/page"));
const LoginPage = lazy(() => import("@web/routes/login/page"));

export const path = {
  home: "/",
  login: "/login",
  jobs: {
    list: "/jobs",
    get: (jobId: string) => `/jobs/${encodeURIComponent(jobId)}`,
    details: "/jobs/:jobId",
  },
  statements: {
    bank_account: {
      list: "/statements/bank-account",
    },
    credit_card: {
      list: "/statements/credit-card",
      details: "/statements/credit-card/:accountId",
      get: (accountId: string) => `/statements/credit-card/${encodeURIComponent(accountId)}`,
    },
  },
} as const;

const statementsGroup = { label: "Statements", icon: <FaFileAlt /> };

function sidebarEntry(
  icon: ReactNode,
  group?: { label: string; icon: ReactNode }
): RouteConfig["sidebar"] {
  return group
    ? {
        show: true,
        icon,
        group: group.label,
        groupIcon: group.icon,
      }
    : { show: true, icon };
}

export const routes: RouteConfig[] = [
  {
    path: path.login,
    element: <LoginPage />,
    label: "Login",
    app: { public: true },
  },
  {
    path: path.home,
    element: <HomePage />,
    label: "Home",
    sidebar: { show: true, icon: <FaHome /> },
  },
  {
    path: path.statements.bank_account.list,
    element: <BankAccountPage />,
    label: "Bank Account",
    sidebar: sidebarEntry(<FaUniversity />, statementsGroup),
  },
  {
    path: path.statements.credit_card.list,
    element: <CreditCardPage />,
    label: "Credit Card",
    sidebar: sidebarEntry(<FaCreditCard />, statementsGroup),
  },
  {
    path: path.jobs.list,
    element: <JobsPage />,
    label: "Jobs",
    sidebar: sidebarEntry(<FaTasks />),
  },
  {
    path: path.statements.credit_card.details,
    element: <CreditCardDetailsPage />,
    label: "Credit Card Details",
  },
  {
    path: path.jobs.details,
    element: <JobDetailsPage />,
    label: "Job Details",
  },
];
