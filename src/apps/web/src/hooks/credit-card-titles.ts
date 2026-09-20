import { fetchCreditCardCatalogBulk } from "@web/utils/api/routes/credit-cards";
import { useEffect, useState } from "react";

export function useCreditCardCatalogTitles(): Map<string, string> {
  const [titles, setTitles] = useState<Map<string, string>>(() => new Map());

  useEffect(() => {
    let cancelled = false;
    void fetchCreditCardCatalogBulk()
      .then((items) => {
        if (cancelled) {
          return;
        }
        setTitles(new Map(items.map((item) => [item.registry_key, item.display_name])));
      })
      .catch(() => {
        if (!cancelled) {
          setTitles(new Map());
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return titles;
}
