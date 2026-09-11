const APP_TITLE = "NetworthDB";

type PageTitleProps = {
  page?: string;
};

export function PageTitle({ page }: PageTitleProps) {
  return <title>{page ? `${APP_TITLE} | ${page}` : APP_TITLE}</title>;
}
