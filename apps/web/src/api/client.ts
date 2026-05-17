import type { Project, PatchFlagsInput } from '@foundry/shared';

export interface DerivedProject extends Project {
  live: boolean;
  decay: 'fresh' | 'stale' | 'fossil';
}

export interface ApiError {
  error: string;
  message: string;
  request_id?: string;
}

export class ApiFetchError extends Error {
  constructor(public status: number, public body: ApiError) {
    super(`API ${status} ${body.error}: ${body.message}`);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    let body: ApiError;
    try {
      body = (await res.json()) as ApiError;
    } catch {
      body = { error: 'UNKNOWN', message: res.statusText };
    }
    throw new ApiFetchError(res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  listProjects: (params: { status?: string; search?: string; sort?: string; include_archived?: boolean } = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined) qs.set(k, String(v));
    const q = qs.toString();
    return request<DerivedProject[]>(`/v1/projects${q ? `?${q}` : ''}`);
  },
  getProject: (slug: string) => request<DerivedProject>(`/v1/projects/${encodeURIComponent(slug)}`),
  getTimeline: (slug: string) => request<unknown[]>(`/v1/projects/${encodeURIComponent(slug)}/timeline`),
  getDecisions: (slug: string) => request<unknown[]>(`/v1/projects/${encodeURIComponent(slug)}/decisions`),
  getTodos: (slug: string) => request<unknown[]>(`/v1/projects/${encodeURIComponent(slug)}/todos`),
  getNotes: (slug: string) => request<unknown[]>(`/v1/projects/${encodeURIComponent(slug)}/notes`),
  patchFlags: (slug: string, input: PatchFlagsInput) =>
    request<DerivedProject>(`/v1/projects/${encodeURIComponent(slug)}/flags`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  deleteProject: (slug: string) =>
    request<void>(`/v1/projects/${encodeURIComponent(slug)}`, { method: 'DELETE' }),
};
