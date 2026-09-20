import { NotFound } from "@web/components/Error/NotFound";
import { PageTitle } from "@web/components/Layout/PageTitle";

export default function NotFoundPage() {
  return (
    <>
      <PageTitle page="Page Not Found" />
      <NotFound />
    </>
  );
}
