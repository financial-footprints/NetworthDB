import { SecondaryButton } from "@web/components/Button";
import { useNotifications } from "@web/contexts/Notifications/Context";
import { submitStatementUpload } from "@web/routes/accounts/_parts/upload";
import { useRef, useState } from "react";
import { FaFileArchive } from "react-icons/fa";

const ZIP_ACCEPT = ".zip,application/zip";

type UploadZipButtonProps = {
  accountId: string;
  onUploadSuccess?: () => void;
};

export function UploadZipButton({ accountId, onUploadSuccess }: UploadZipButtonProps) {
  const { pushNotification } = useNotifications();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleFileSelected(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) {
      return;
    }

    await submitStatementUpload({
      accountId,
      request: {
        format: "zip",
        file,
      },
      onUploadSuccess,
      pushNotification,
      onBusyChange: setIsUploading,
    });
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={ZIP_ACCEPT}
        className="hidden"
        onChange={(event) => {
          void handleFileSelected(event.target.files);
          event.target.value = "";
        }}
      />
      <SecondaryButton
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        aria-busy={isUploading}
        title="Upload a ZIP archive of CSV statements. Password-protected archives are supported; statement periods are inferred automatically."
      >
        <FaFileArchive aria-hidden />
        Upload ZIP
      </SecondaryButton>
    </>
  );
}
