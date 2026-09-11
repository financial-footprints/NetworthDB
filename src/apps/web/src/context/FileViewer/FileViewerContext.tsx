import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";

type FileViewerFormat = "text" | "json";

type FileViewerRequest = {
  title: string;
  url: string;
  format?: FileViewerFormat;
  downloadFilename?: string;
};

type FileViewerContextValue = {
  request: FileViewerRequest | null;
  openFileViewer: (request: FileViewerRequest) => void;
  closeFileViewer: () => void;
};

const FileViewerContext = createContext<FileViewerContextValue | null>(null);

export function FileViewerProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<FileViewerRequest | null>(null);

  const openFileViewer = useCallback((next: FileViewerRequest) => {
    setRequest(next);
  }, []);

  const closeFileViewer = useCallback(() => {
    setRequest(null);
  }, []);

  const value = useMemo(
    () => ({ request, openFileViewer, closeFileViewer }),
    [request, openFileViewer, closeFileViewer]
  );

  return <FileViewerContext.Provider value={value}>{children}</FileViewerContext.Provider>;
}

export function useFileViewer(): FileViewerContextValue {
  const context = useContext(FileViewerContext);
  if (!context) {
    throw new Error("useFileViewer must be used within FileViewerProvider");
  }
  return context;
}
