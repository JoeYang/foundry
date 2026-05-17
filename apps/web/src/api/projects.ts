import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type DerivedProject } from './client.js';
import type { PatchFlagsInput } from '@foundry/shared';

export const projectKeys = {
  all: ['projects'] as const,
  list: (filter: Record<string, unknown>) => ['projects', 'list', filter] as const,
  detail: (slug: string) => ['projects', 'detail', slug] as const,
  timeline: (slug: string) => ['projects', slug, 'timeline'] as const,
  decisions: (slug: string) => ['projects', slug, 'decisions'] as const,
  todos: (slug: string) => ['projects', slug, 'todos'] as const,
  notes: (slug: string) => ['projects', slug, 'notes'] as const,
};

export function useProjects(filter: Parameters<typeof api.listProjects>[0] = {}) {
  return useQuery({
    queryKey: projectKeys.list(filter),
    queryFn: () => api.listProjects(filter),
    refetchInterval: 10_000,
  });
}

export function useProject(slug: string | undefined) {
  return useQuery({
    queryKey: projectKeys.detail(slug ?? ''),
    queryFn: () => api.getProject(slug!),
    enabled: !!slug,
  });
}

export function useTimeline(slug: string | undefined) {
  return useQuery({
    queryKey: projectKeys.timeline(slug ?? ''),
    queryFn: () => api.getTimeline(slug!),
    enabled: !!slug,
  });
}

export function useDecisions(slug: string | undefined) {
  return useQuery({ queryKey: projectKeys.decisions(slug ?? ''), queryFn: () => api.getDecisions(slug!), enabled: !!slug });
}
export function useTodos(slug: string | undefined) {
  return useQuery({ queryKey: projectKeys.todos(slug ?? ''), queryFn: () => api.getTodos(slug!), enabled: !!slug });
}
export function useNotes(slug: string | undefined) {
  return useQuery({ queryKey: projectKeys.notes(slug ?? ''), queryFn: () => api.getNotes(slug!), enabled: !!slug });
}

export function usePatchFlags(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PatchFlagsInput) => api.patchFlags(slug, input),
    onSuccess: (updated) => {
      qc.setQueryData(projectKeys.detail(slug), updated);
      qc.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => api.deleteProject(slug),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
  });
}
