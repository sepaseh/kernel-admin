import { apiClient } from "../../shared/api/index.ts";
import { toSnakeCase } from "../../shared/lib/transform.ts";
import type {
  User,
  UserListQuery,
  UserPasswordRequest,
  UserRequest,
  UserRoleRequest,
  UserStatusRequest,
  UserSystemAdminRequest,
} from "./types.ts";

const basePath = "/users";

export const createUser = async (
  params: UserRequest & UserPasswordRequest,
  signal?: AbortSignal,
): Promise<User> => {
  return apiClient.post<User>(basePath, params, { signal });
};

export const deleteUser = async (
  id: User["id"],
  signal?: AbortSignal,
): Promise<void> => {
  return apiClient.del<void>(`${basePath}/${id}`, { signal });
};

export const fetchUser = async (
  id: User["id"],
  signal?: AbortSignal,
): Promise<User> => {
  return apiClient.get<User>(`${basePath}/${id}`, { signal });
};

export const fetchUsers = async (
  params: UserListQuery,
  signal?: AbortSignal,
): Promise<{ items: User[]; total: number }> => {
  return apiClient.get<{ items: User[]; total: number }>(basePath, {
    params: toSnakeCase(params),
    signal,
  });
};

export const updateUser = async (
  id: User["id"],
  params: UserRequest,
  signal?: AbortSignal,
): Promise<User> => {
  return apiClient.patch<User>(`${basePath}/${id}`, params, { signal });
};

export const updateUserPassword = async (
  id: User["id"],
  params: UserPasswordRequest,
  signal?: AbortSignal,
): Promise<void> => {
  return apiClient.put<void>(`${basePath}/${id}/password`, params, { signal });
};

export const updateUserRoles = async (
  id: User["id"],
  params: UserRoleRequest,
  signal?: AbortSignal,
): Promise<void> => {
  return apiClient.put<void>(`${basePath}/${id}/roles`, params, { signal });
};

export const updateUserStatus = async (
  id: User["id"],
  params: UserStatusRequest,
  signal?: AbortSignal,
): Promise<void> => {
  return apiClient.patch<void>(`${basePath}/${id}/status`, params, { signal });
};

export const updateUserSystemAdmin = async (
  id: User["id"],
  params: UserSystemAdminRequest,
  signal?: AbortSignal,
): Promise<void> => {
  return apiClient.patch<void>(`${basePath}/${id}/system-admin`, params, {
    signal,
  });
};
