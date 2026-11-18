import { apiClient, encodeIdPathSegment } from "@/shared/api";

import type { PermissionGroup, Role, RoleRequest } from "./types";

export const fetchRoles = async (signal?: AbortSignal): Promise<Role[]> =>
  apiClient.get<Role[]>("/roles", { signal });

export const fetchRole = (
  id: Role["id"],
  signal?: AbortSignal,
): Promise<Role> =>
  apiClient.get<Role>(`/roles/${encodeIdPathSegment(id)}`, { signal });

export const fetchPermissions = (
  signal?: AbortSignal,
): Promise<PermissionGroup[]> =>
  apiClient.get<PermissionGroup[]>("/roles/permissions", { signal });

export const createRole = (
  params: RoleRequest,
  signal?: AbortSignal,
): Promise<Role> => apiClient.post<Role>("/roles", params, { signal });

export const updateRole = (
  id: Role["id"],
  params: RoleRequest,
  signal?: AbortSignal,
): Promise<Role> =>
  apiClient.patch<Role>(`/roles/${encodeIdPathSegment(id)}`, params, {
    signal,
  });

export const deleteRole = (
  id: Role["id"],
  signal?: AbortSignal,
): Promise<void> =>
  apiClient.del<void>(`/roles/${encodeIdPathSegment(id)}`, { signal });
