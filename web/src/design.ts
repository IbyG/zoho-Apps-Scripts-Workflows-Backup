import raw from "../../RnD/Full-Design.json";

export type SessionValidationStatus = "idle" | "loading" | "success" | "error";

export type JobImplementation = "available" | "waitlist";

export interface DesignJob {
  id: string;
  userLabel: string;
  implementation: JobImplementation;
  backendJobId: string;
  waitlistBehavior?: {
    ui: string;
    primaryControl: string;
    secondaryCopy: string;
    blocksDownload: boolean;
  };
}

export interface DesignSystem {
  id: string;
  displayName: string;
  jobs: DesignJob[];
}

export interface FullDesign {
  designVersion: string;
  app: {
    name: string;
    shortDescription: string;
  };
  leftPanel: {
    sharedCredentials: {
      introCopy: string;
      fields: Array<{
        id: string;
        label: string;
        /** HTTP header name as shown in DevTools (Request Headers). */
        requestHeaderName: string;
        envKey: string;
        control: string;
        required: boolean;
        rows?: number;
        userVisibleDescription: string;
      }>;
    };
    validation: {
      actions: Array<{
        id: string;
        label: string;
        onSuccess: { userMessage: string };
        onFailure: { userMessage: string };
      }>;
    };
  };
  rightPanel: {
    selectionModel: { jobKeyPattern: string };
    globalControls: Array<{ id: string; label: string; behavior: string }>;
    systems: DesignSystem[];
    primaryAction: {
      id: string;
      label: string;
      dependsOn: string[];
    };
  };
  settingsPage: {
    title: string;
    sections: Array<{
      id: string;
      title: string;
      description: string;
      fields: Array<{
        id: string;
        label: string;
        control: string;
        systemId: string;
        placeholder: string;
      }>;
    }>;
  };
  navigation: {
    routes: Array<{ id: string; path: string; label: string }>;
  };
}

export const design = raw as FullDesign;

export function jobKey(systemId: string, jobId: string): string {
  return `${systemId}:${jobId}`;
}
