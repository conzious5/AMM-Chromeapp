import type { StyleContext } from "../types.js";

export interface StyleRepository {
  getContext(query: {
    subject: string;
    draft: string;
    thread: string;
    limit?: number;
  }): Promise<StyleContext>;
}
