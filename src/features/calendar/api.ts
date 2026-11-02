import { apiClient } from "../../shared/api/index.ts";

const basePath = "/calendar";

export const createCalendarDate = (
  date: string,
  signal?: AbortSignal,
): Promise<void> => apiClient.post<void>(basePath, { date }, { signal });

export const deleteCalendarDate = (
  date: string,
  signal?: AbortSignal,
): Promise<void> => apiClient.del<void>(`${basePath}/${date}`, { signal });

export const fetchCalendarDates = (signal?: AbortSignal): Promise<string[]> =>
  apiClient.get<string[]>(basePath, { signal });
