import { afterEach } from "vitest";

import { assertNoUnexpectedRequests } from "./mocks";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

afterEach(assertNoUnexpectedRequests);
