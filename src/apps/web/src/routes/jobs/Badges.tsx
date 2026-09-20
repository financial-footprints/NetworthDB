import { Status } from "@web/components/Badge/Status";
import { STATUS_LABELS, STATUS_STYLES, TYPE_STYLES } from "@web/utils/api/routes/jobs/labels";
import type { JobApi } from "@web/utils/api/routes/jobs/types";

type JobStatusBadgesProps = {
  job: JobApi;
  typeLabel: string;
};

export function Badges({ job, typeLabel }: JobStatusBadgesProps) {
  return (
    <>
      <Status
        label={STATUS_LABELS[job.status]}
        className={STATUS_STYLES[job.status].badge}
        pulse={job.status === "running"}
      />
      <Status label={typeLabel} className={TYPE_STYLES.badge} />
    </>
  );
}
