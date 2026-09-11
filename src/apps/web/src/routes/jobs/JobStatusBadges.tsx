import { Status } from "@web/components/badge/Status";
import { STATUS_LABELS, STATUS_STYLES, TYPE_STYLES } from "@web/utils/api/endpoints/jobs/labels";
import type { JobResponse } from "@web/utils/api/endpoints/jobs/types";

type JobStatusBadgesProps = {
  job: JobResponse;
  typeLabel: string;
};

export function JobStatusBadges({ job, typeLabel }: JobStatusBadgesProps) {
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
