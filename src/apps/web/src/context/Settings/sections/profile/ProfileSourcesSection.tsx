import { CalloutSummary } from "@web/components/badge/CalloutSummary";
import { SecondaryButton } from "@web/components/button";
import { useNotifications } from "@web/context/Notifications/NotificationContext";
import { ProfileSectionCard } from "@web/context/Settings/components/ProfileSectionCard";
import { SourceRow } from "@web/context/Settings/components/SourceRow";
import { SourceModal } from "@web/context/Settings/modals/sources/SourceModal";
import {
  emptyThunderbirdSource,
  getSources,
  updateSources,
} from "@web/utils/api/endpoints/sources";
import type { EmailWrite, SourceConfig, SourceWrite } from "@web/utils/api/endpoints/sources/types";
import { validateSources } from "@web/utils/api/endpoints/sources/validation";
import { errorMessage } from "@web/utils/errors";
import { useEffect, useState } from "react";

type ModalState =
  | { mode: "add"; source: SourceConfig }
  | { mode: "edit"; source: SourceConfig }
  | null;

function toPutSource(source: SourceConfig): SourceWrite {
  if (source.type === "thunderbird") {
    return {
      id: source.id,
      label: source.label.trim(),
      type: "thunderbird",
      profile: source.profile.trim(),
    };
  }
  const put: EmailWrite = {
    id: source.id,
    label: source.label.trim(),
    type: "email",
    host: source.host,
    port: source.port,
    username: source.username,
    folder: source.folder,
    use_ssl: source.use_ssl,
  };
  const password = "password" in source ? (source.password?.trim() ?? "") : "";
  if (password) {
    put.password = password;
  }
  return put;
}

function toWriteSources(sources: SourceConfig[]): SourceWrite[] {
  return sources.map(toPutSource);
}

export function ProfileSourcesSection() {
  const { pushNotification } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sources, setSources] = useState<SourceConfig[]>([]);
  const [modal, setModal] = useState<ModalState>(null);

  useEffect(() => {
    let cancelled = false;
    void getSources()
      .then((status) => {
        if (!cancelled) {
          setSources(status.sources);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          pushNotification(errorMessage(error, "Could not load statement sources"), "error");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pushNotification]);

  async function persistSources(nextSources: SourceConfig[]): Promise<boolean> {
    const validationError = validateSources(nextSources);
    if (validationError) {
      pushNotification(validationError, "error");
      return false;
    }

    setSaving(true);
    try {
      const response = await updateSources({ sources: toWriteSources(nextSources) });
      setSources(response.sources);
      pushNotification("Statement sources saved.", "success");
      return true;
    } catch (error) {
      pushNotification(errorMessage(error, "Could not save statement sources"), "error");
      return false;
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProfileSectionCard
      title="Statement Sources"
      description={
        <p>
          Configure Thunderbird profiles and email (IMAP) accounts. The server searches every source
          for statement attachments that match each account&apos;s rules.
        </p>
      }
    >
      {loading ? (
        <p className="text-sm text-slate-500">Loading sources…</p>
      ) : sources.length === 0 ? (
        <CalloutSummary variant="info">
          No Statement Sources configured yet. Please create a new source to enable automatic
          statement discovery.
        </CalloutSummary>
      ) : (
        <ul className="space-y-3">
          {sources.map((source) => (
            <SourceRow
              key={source.id}
              source={source}
              onEdit={() => setModal({ mode: "edit", source })}
              onRemove={async () => {
                await persistSources(sources.filter((item) => item.id !== source.id));
              }}
              disabled={saving}
            />
          ))}
        </ul>
      )}

      <SecondaryButton
        className="mt-4"
        onClick={() =>
          setModal({ mode: "add", source: emptyThunderbirdSource(crypto.randomUUID()) })
        }
        disabled={saving}
      >
        Add source
      </SecondaryButton>

      <SourceModal
        isOpen={modal !== null}
        mode={modal?.mode ?? "add"}
        source={modal?.source ?? emptyThunderbirdSource("")}
        submitting={saving}
        onClose={() => setModal(null)}
        onConfirm={async (source) => {
          if (!modal) {
            return;
          }
          const nextSources =
            modal.mode === "add"
              ? [...sources, source]
              : sources.map((item) => (item.id === source.id ? source : item));
          const saved = await persistSources(nextSources);
          if (saved) {
            setModal(null);
          }
        }}
      />
    </ProfileSectionCard>
  );
}
