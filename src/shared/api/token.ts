let accessToken: string | null = null;
let version = 0;

export const clearAccessToken = () => {
  version += 1;
  accessToken = null;
};

export const getAccessToken = () => accessToken;
export const getAccessTokenVersion = () => version;
// A refresh rotates credentials within the same login/logout generation.
export const setRefreshedAccessToken = (token: string) => {
  accessToken = token;
};

export const setAccessToken = (token: string) => {
  version += 1;
  accessToken = token;
};
