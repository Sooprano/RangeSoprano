// Web Worker entry: runs the per-combo equity enumeration off the main thread.

import { handleEqRequest, type EqRequest, type EqResponse } from './protocol';

type WorkerScope = {
  onmessage: ((event: MessageEvent<EqRequest>) => void) | null;
  postMessage: (message: EqResponse) => void;
};

const scope = self as unknown as WorkerScope;

scope.onmessage = (event) => {
  handleEqRequest(event.data, (msg) => scope.postMessage(msg));
};
