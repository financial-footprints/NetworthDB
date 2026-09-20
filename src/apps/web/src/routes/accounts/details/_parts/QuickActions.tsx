import { path } from "@web/router/routes";
import { fetchCreditCardForAccount } from "@web/utils/api/routes/credit-cards";
import { creditCardsHubPath } from "@web/utils/credit-cards/query";
import { useEffect, useState } from "react";
import { LuChevronRight } from "react-icons/lu";
import { Link } from "react-router-dom";

type AccountDetailsQuickActionsProps = {
  accountId: string;
  statementCapable: boolean;
  creditCardAccount: boolean;
  bank: string;
  variant: string | null | undefined;
};

export function QuickActions({
  accountId,
  statementCapable,
  creditCardAccount,
  bank,
  variant,
}: AccountDetailsQuickActionsProps) {
  const [benefitsHref, setBenefitsHref] = useState<string | null>(null);

  useEffect(() => {
    if (!creditCardAccount) {
      setBenefitsHref(null);
      return;
    }

    let cancelled = false;
    void fetchCreditCardForAccount(bank, variant)
      .then((catalog) => {
        if (cancelled || !catalog?.registry_key) {
          return;
        }
        setBenefitsHref(creditCardsHubPath({ card: catalog.registry_key }));
      })
      .catch(() => {
        if (!cancelled) {
          setBenefitsHref(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [bank, creditCardAccount, variant]);

  if (!statementCapable && !benefitsHref) {
    return null;
  }

  const linkCount = (statementCapable ? 1 : 0) + (benefitsHref ? 1 : 0);

  return (
    <div className="mt-6 border-t border-slate-200 pt-5">
      <nav
        className={linkCount > 1 ? "grid gap-3 sm:grid-cols-2" : "grid grid-cols-1 gap-3"}
        aria-label="Related pages"
      >
        {statementCapable ? (
          <Link to={path.accounts.statements(accountId)} className="account-summary-nav-link">
            <span>View Statements</span>
            <LuChevronRight className="account-summary-nav-link-icon" strokeWidth={2} aria-hidden />
          </Link>
        ) : null}
        {benefitsHref ? (
          <Link to={benefitsHref} className="account-summary-nav-link">
            <span>View Benefits</span>
            <LuChevronRight className="account-summary-nav-link-icon" strokeWidth={2} aria-hidden />
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
