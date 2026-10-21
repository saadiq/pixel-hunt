// Runs the rewind search off the main thread; the page terminates the worker to cancel it.
import { type RewindInput, searchRewind } from './rewind';

self.onmessage = (e: MessageEvent<RewindInput>) => self.postMessage(searchRewind(e.data));
