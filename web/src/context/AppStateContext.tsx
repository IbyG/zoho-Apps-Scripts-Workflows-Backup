import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  design,
  jobKey,
  type SessionValidationStatus,
} from "../design";

const STORAGE_ZIP = "exporter.zipPatterns.v1";

export interface Credentials {
  xCrmOrg: string;
  xZcsrfToken: string;
  cookie: string;
}

interface SessionValidation {
  status: SessionValidationStatus;
  message: string | null;
  validatedAt: string | null;
}

interface ZipPatterns {
  crm: string;
  books: string;
}

function loadZipPatterns(): ZipPatterns {
  try {
    const raw = localStorage.getItem(STORAGE_ZIP);
    if (!raw) {
      return { crm: "", books: "" };
    }
    const parsed = JSON.parse(raw) as Partial<ZipPatterns>;
    return {
      crm: typeof parsed.crm === "string" ? parsed.crm : "",
      books: typeof parsed.books === "string" ? parsed.books : "",
    };
  } catch {
    return { crm: "", books: "" };
  }
}

interface AppStateContextValue {
  credentials: Credentials;
  setCredentials: (patch: Partial<Credentials>) => void;
  sessionValidation: SessionValidation;
  validateSession: () => Promise<void>;
  selectedJobs: Set<string>;
  toggleJob: (key: string, enabled: boolean) => void;
  selectAllAvailable: () => void;
  clearSelection: () => void;
  zipPatterns: ZipPatterns;
  setZipPatterns: (patch: Partial<ZipPatterns>) => void;
  canDownload: boolean;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

function collectAvailableJobKeys(): Set<string> {
  const keys = new Set<string>();
  for (const sys of design.rightPanel.systems) {
    for (const job of sys.jobs) {
      if (job.implementation === "available") {
        keys.add(jobKey(sys.id, job.id));
      }
    }
  }
  return keys;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [credentials, setCredentialsState] = useState<Credentials>({
    xCrmOrg: "",
    xZcsrfToken: "",
    cookie: "",
  });

  const [sessionValidation, setSessionValidation] = useState<SessionValidation>({
    status: "idle",
    message: null,
    validatedAt: null,
  });

  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(() => new Set());

  const [zipPatterns, setZipPatternsState] = useState<ZipPatterns>(loadZipPatterns);

  const setCredentials = useCallback((patch: Partial<Credentials>) => {
    setCredentialsState((prev) => ({ ...prev, ...patch }));
    setSessionValidation({
      status: "idle",
      message: null,
      validatedAt: null,
    });
  }, []);

  const setZipPatterns = useCallback((patch: Partial<ZipPatterns>) => {
    setZipPatternsState((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_ZIP, JSON.stringify(next));
      } catch {
        /* ignore quota */
      }
      return next;
    });
  }, []);

  const validateSession = useCallback(async () => {
    const action = design.leftPanel.validation.actions[0];
    const filled =
      credentials.xCrmOrg.trim() &&
      credentials.xZcsrfToken.trim() &&
      credentials.cookie.trim();

    setSessionValidation({
      status: "loading",
      message: null,
      validatedAt: null,
    });

    await new Promise((r) => setTimeout(r, 900));

    if (filled) {
      setSessionValidation({
        status: "success",
        message: action.onSuccess.userMessage,
        validatedAt: new Date().toISOString(),
      });
    } else {
      setSessionValidation({
        status: "error",
        message: action.onFailure.userMessage,
        validatedAt: null,
      });
    }
  }, [credentials]);

  const toggleJob = useCallback((key: string, enabled: boolean) => {
    setSelectedJobs((prev) => {
      const next = new Set(prev);
      if (enabled) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const selectAllAvailable = useCallback(() => {
    setSelectedJobs(collectAvailableJobKeys());
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedJobs(new Set());
  }, []);

  const canDownload = useMemo(() => {
    if (sessionValidation.status !== "success") return false;
    for (const key of selectedJobs) {
      const [systemId, jobId] = key.split(":");
      const sys = design.rightPanel.systems.find((s) => s.id === systemId);
      const job = sys?.jobs.find((j) => j.id === jobId);
      if (job?.implementation === "available") return true;
    }
    return false;
  }, [sessionValidation.status, selectedJobs]);

  const value = useMemo<AppStateContextValue>(
    () => ({
      credentials,
      setCredentials,
      sessionValidation,
      validateSession,
      selectedJobs,
      toggleJob,
      selectAllAvailable,
      clearSelection,
      zipPatterns,
      setZipPatterns,
      canDownload,
    }),
    [
      credentials,
      setCredentials,
      sessionValidation,
      validateSession,
      selectedJobs,
      toggleJob,
      selectAllAvailable,
      clearSelection,
      zipPatterns,
      setZipPatterns,
      canDownload,
    ],
  );

  return (
    <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
  );
}

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return ctx;
}
