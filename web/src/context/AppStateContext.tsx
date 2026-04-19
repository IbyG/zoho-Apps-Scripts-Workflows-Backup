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
import { cleanseCredentials, cleanseCredentialsPatch } from "../utils/cleanseCredentials";

const STORAGE_ZIP = "exporter.zipPatterns.v1";

export interface Credentials {
  xCrmOrg: string;
  xZcsrfToken: string;
  cookie: string;
}

interface SessionValidation {
  status: SessionValidationStatus;
  message: string | null;
  /** Extra detail from the CRM check (host used, API message); never includes your cookie. */
  errorHint: string | null;
  validatedAt: string | null;
}

function formatValidationErrorPayload(text: string): string | null {
  try {
    const j = JSON.parse(text) as {
      crmBaseUrl?: string;
      attemptUrl?: string;
      error?: string;
      detail?: unknown;
    };
    const parts: string[] = [];
    if (j.crmBaseUrl) parts.push(`CRM host: ${j.crmBaseUrl}`);
    if (j.attemptUrl) parts.push(`Last request: ${j.attemptUrl}`);
    if (j.detail != null) {
      parts.push(
        typeof j.detail === "string"
          ? j.detail
          : JSON.stringify(j.detail).slice(0, 400),
      );
    } else if (j.error) {
      parts.push(j.error);
    }
    return parts.length > 0 ? parts.join(" — ") : null;
  } catch {
    return text.trim() ? text.slice(0, 400) : null;
  }
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
    errorHint: null,
    validatedAt: null,
  });

  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(() => new Set());

  const [zipPatterns, setZipPatternsState] = useState<ZipPatterns>(loadZipPatterns);

  const setCredentials = useCallback((patch: Partial<Credentials>) => {
    const cleaned = cleanseCredentialsPatch(patch);
    setCredentialsState((prev) => ({ ...prev, ...cleaned }));
    setSessionValidation({
      status: "idle",
      message: null,
      errorHint: null,
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
    const creds = cleanseCredentials(credentials);
    setCredentials(creds);
    const filled = creds.xCrmOrg && creds.xZcsrfToken && creds.cookie;

    if (!filled) {
      setSessionValidation({
        status: "error",
        message: action.onFailure.userMessage,
        errorHint: null,
        validatedAt: null,
      });
      return;
    }

    setSessionValidation({
      status: "loading",
      message: null,
      errorHint: null,
      validatedAt: null,
    });

    try {
      // Cookie cannot be sent via fetch() from the browser; Vite calls Zoho from Node instead.
      const res = await fetch("/api/crm-validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creds),
      });
      const bodyText = await res.text();
      if (!res.ok) {
        setSessionValidation({
          status: "error",
          message: action.onFailure.userMessage,
          errorHint: formatValidationErrorPayload(bodyText),
          validatedAt: null,
        });
        return;
      }
      setSessionValidation({
        status: "success",
        message: action.onSuccess.userMessage,
        errorHint: null,
        validatedAt: new Date().toISOString(),
      });
    } catch {
      setSessionValidation({
        status: "error",
        message: action.onFailure.userMessage,
        errorHint: "Could not reach the local validation endpoint. Is the dev server running?",
        validatedAt: null,
      });
    }
  }, [credentials, setCredentials]);

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
