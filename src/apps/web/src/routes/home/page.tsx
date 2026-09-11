import { PageTitle } from "@web/components/layout/PageTitle";

export default function HomePage() {
  return (
    <div>
      <PageTitle page="Home" />
      <h2 className="mb-2 text-2xl font-semibold text-slate-900">Home</h2>
      <p className="text-slate-500">Welcome to NetworthDB — track and understand your networth.</p>
    </div>
  );
}
