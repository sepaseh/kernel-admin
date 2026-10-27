import { apiClient } from "../../shared/api/index.ts";

const basePath = "/calendar";

export const createCalendarDate = (date: string): Promise<void> =>
  apiClient.post<void>(basePath, { date });

export const deleteCalendarDate = (date: string): Promise<void> =>
  apiClient.del<void>(`${basePath}/${date}`);

export const fetchCalendarDates = (signal?: AbortSignal): Promise<string[]> =>
  apiClient.get<string[]>(basePath, { signal });
