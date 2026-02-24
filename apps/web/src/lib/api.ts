const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("accessToken");
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Try refresh
      const refreshed = await this.refreshToken();
      if (refreshed) {
        headers["Authorization"] = `Bearer ${this.getToken()}`;
        const retryResponse = await fetch(`${this.baseUrl}${path}`, {
          ...options,
          headers,
        });
        if (!retryResponse.ok) {
          throw new ApiError(retryResponse.status, await retryResponse.text());
        }
        return retryResponse.json();
      }
      // Redirect to login
      if (typeof window !== "undefined") {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        window.location.href = "/login";
      }
      throw new ApiError(401, "Unauthorized");
    }

    if (!response.ok) {
      const body = await response.text();
      throw new ApiError(response.status, body);
    }

    return response.json();
  }

  private async refreshToken(): Promise<boolean> {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      return true;
    } catch {
      return false;
    }
  }

  // Auth
  async register(email: string, password: string, name?: string) {
    const data = await this.request<{
      user: any;
      accessToken: string;
      refreshToken: string;
    }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    });
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    return data;
  }

  async login(email: string, password: string) {
    const data = await this.request<{
      user: any;
      accessToken: string;
      refreshToken: string;
    }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    return data;
  }

  async getMe() {
    return this.request<any>("/api/auth/me");
  }

  // Projects
  async listProjects() {
    const data = await this.request<any>("/api/projects");
    return ensureArray(data);
  }

  async createProject(name: string, framework?: string, description?: string, template?: string) {
    return this.request<any>("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name, framework, description, template }),
    });
  }

  async getProject(id: string) {
    return this.request<any>(`/api/projects/${id}`);
  }

  async deleteProject(id: string) {
    return this.request<any>(`/api/projects/${id}`, { method: "DELETE" });
  }

  async deployProject(id: string) {
    return this.request<any>(`/api/projects/${id}/deploy`, { method: "POST" });
  }

  async updateProjectSettings(id: string, data: { customInstructions?: string; settings?: any }) {
    return this.request<any>(`/api/projects/${id}/settings`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  // Messages
  async getMessages(projectId: string) {
    const data = await this.request<any>(`/api/projects/${projectId}/messages`);
    return ensureArray<any>(data);
  }

  async sendMessage(projectId: string, content: string) {
    return this.request<any>(`/api/projects/${projectId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  }

  async stopAgent(projectId: string) {
    return this.request<any>(`/api/projects/${projectId}/stop`, {
      method: "POST",
    });
  }

  async undoChange(projectId: string) {
    return this.request<any>(`/api/projects/${projectId}/undo`, {
      method: "POST",
    });
  }

  // Snapshots
  async getSnapshots(projectId: string) {
    const data = await this.request<any>(`/api/projects/${projectId}/snapshots`);
    return ensureArray<{ id: string; label: string; createdAt: string }>(data);
  }

  async restoreSnapshot(projectId: string, snapshotId: string) {
    return this.request<any>(`/api/projects/${projectId}/snapshots/${snapshotId}/restore`, {
      method: "POST",
    });
  }

  // Files
  async getFileTree(projectId: string) {
    const data = await this.request<any>(`/api/projects/${projectId}/files`);
    return ensureArray(data);
  }

  async readFile(projectId: string, path: string) {
    return this.request<{ path: string; content: string }>(
      `/api/projects/${projectId}/files/${path}`
    );
  }

  async writeFile(projectId: string, path: string, content: string) {
    return this.request<any>(`/api/projects/${projectId}/files/${path}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    });
  }

  async getPreviewUrl(projectId: string) {
    return this.request<{ url: string }>(`/api/projects/${projectId}/preview`);
  }

  // GitHub
  async getGitHubStatus() {
    return this.request<{ connected: boolean; username: string | null }>("/api/github/status");
  }

  async connectGitHub(token: string) {
    return this.request<{ connected: boolean; username: string }>("/api/github/connect", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  }

  async disconnectGitHub() {
    return this.request<{ connected: boolean }>("/api/github/disconnect", {
      method: "POST",
    });
  }

  async exportToGitHub(projectId: string) {
    return this.request<{ success: boolean; repoUrl: string; repoFullName: string }>(
      `/api/github/${projectId}/export`,
      { method: "POST" }
    );
  }

  async pushToGitHub(projectId: string, message?: string) {
    return this.request<{ success: boolean; commitSha: string }>(
      `/api/github/${projectId}/push`,
      { method: "POST", body: JSON.stringify({ message }) }
    );
  }

  async pullFromGitHub(projectId: string) {
    return this.request<{ success: boolean; filesUpdated: number }>(
      `/api/github/${projectId}/pull`,
      { method: "POST" }
    );
  }

  // Supabase
  async getSupabaseStatus() {
    return this.request<{ connected: boolean; url: string | null }>("/api/supabase/status");
  }

  async connectSupabase(url: string, anonKey: string) {
    return this.request<{ connected: boolean; url: string }>("/api/supabase/connect", {
      method: "POST",
      body: JSON.stringify({ url, anonKey }),
    });
  }

  async disconnectSupabase() {
    return this.request<{ connected: boolean }>("/api/supabase/disconnect", {
      method: "POST",
    });
  }

  async generateSupabaseClient(projectId: string) {
    return this.request<{ success: boolean; filesCreated: string[] }>(
      `/api/supabase/${projectId}/generate-client`,
      { method: "POST" }
    );
  }

  async generateSupabaseTypes(projectId: string) {
    return this.request<{ success: boolean; file: string; tablesFound: number }>(
      `/api/supabase/${projectId}/generate-types`,
      { method: "POST" }
    );
  }

  // Billing
  async getUsage() {
    return this.request<any>("/api/billing/usage");
  }

  async getPlans() {
    const data = await this.request<any>("/api/billing/plans");
    return ensureArray(data);
  }

  async upgradePlan(plan: string) {
    return this.request<any>("/api/billing/upgrade", {
      method: "POST",
      body: JSON.stringify({ plan }),
    });
  }

  // Templates
  async getTemplates() {
    const data = await this.request<any>("/api/templates");
    return ensureArray(data);
  }

  async getTemplate(id: string) {
    return this.request<any>(`/api/templates/${id}`);
  }

  // Sharing
  async shareProject(projectId: string, email: string, role: "viewer" | "editor") {
    return this.request<any>(`/api/projects/${projectId}/share`, {
      method: "POST",
      body: JSON.stringify({ email, role }),
    });
  }

  async getProjectMembers(projectId: string) {
    return this.request<any>(`/api/projects/${projectId}/members`);
  }

  async removeProjectMember(projectId: string, memberId: string) {
    return this.request<any>(`/api/projects/${projectId}/members/${memberId}`, {
      method: "DELETE",
    });
  }

  async forkProject(projectId: string) {
    return this.request<any>(`/api/projects/${projectId}/fork`, {
      method: "POST",
    });
  }

  // Export / Import
  async exportZip(projectId: string): Promise<Blob> {
    const token = this.getToken();
    const response = await fetch(`${this.baseUrl}/api/projects/${projectId}/export/zip`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new ApiError(response.status, "Export failed");
    return response.blob();
  }

  async importProject(name: string, zipBase64: string, framework?: string) {
    return this.request<any>("/api/projects/import", {
      method: "POST",
      body: JSON.stringify({ name, zipBase64, framework }),
    });
  }

  async importFromGitHub(repoUrl: string, name?: string) {
    return this.request<any>("/api/projects/import/github", {
      method: "POST",
      body: JSON.stringify({ repoUrl, name }),
    });
  }

  async getScreenshot(projectId: string) {
    return this.request<{ thumbnail: string }>(`/api/projects/${projectId}/screenshot`);
  }

  // Notifications
  async getNotifications() {
    return this.request<{ notifications: any[]; unreadCount: number }>("/api/notifications");
  }

  async markNotificationRead(id: string) {
    return this.request<any>(`/api/notifications/${id}/read`, { method: "PATCH" });
  }

  async markAllNotificationsRead() {
    return this.request<any>("/api/notifications/read-all", { method: "POST" });
  }

  // User Settings
  async updateUserSettings(settings: any) {
    return this.request<any>("/api/auth/me/settings", {
      method: "PATCH",
      body: JSON.stringify({ settings }),
    });
  }

  logout() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }
}

/** Safely extract an array from an API response that might be a wrapper object */
function ensureArray<T = any>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    // Try common wrapper keys
    const obj = data as Record<string, unknown>;
    for (const key of ["data", "messages", "items", "results", "projects", "snapshots", "files", "templates", "nodes"]) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
  }
  return [] as T[];
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const api = new ApiClient(API_URL);
export { ApiError };
