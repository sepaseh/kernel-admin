const unexpected: string[] = [];

export const resetRequestGuard = () => {
  unexpected.length = 0;
};

export const rejectUnexpectedRequest = (method: string, url: string): never => {
  const message = `Unexpected synthetic API request: ${method} ${url}`;
  unexpected.push(message);
  throw new Error(message);
};

export const assertNoUnexpectedRequests = () => {
  if (unexpected.length) throw new Error(unexpected.join("\n"));
};
