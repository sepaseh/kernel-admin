import { apiClient } from "../../shared/api/index.ts";
import type { PermissionGroup, Role, RoleRequest } from "./types.ts";

const basePath = "/roles";

export const createRole = async (params: RoleRequest): Promise<Role> => {
  return apiClient.post<Role>(basePath, params);
};

export const deleteRole = async (id: Role["id"]): Promise<void> => {
  return apiClient.del<void>(`${basePath}/${id}`);
};

export const fetchPermissions = async (
  signal?: AbortSignal,
): Promise<PermissionGroup[]> => {
  return apiClient.get<PermissionGroup[]>(`${basePath}/permissions`, {
    signal,
  });
};

export const fetchRole = async (
  id: Role["id"],
  signal?: AbortSignal,
): Promise<Role> => {
  return apiClient.get<Role>(`${basePath}/${id}`, { signal });
};

export const fetchRoles = async (signal?: AbortSignal): Promise<Role[]> => {
  return apiClient.get<Role[]>(basePath, { signal });
};

export const updateRole = async (
  id: Role["id"],
  params: RoleRequest,
): Promise<Role> => {
  return apiClient.patch<Role>(`${basePath}/${id}`, params);
};
