import { z } from "zod";

export const rewriteRequestSchema = z.object({
  mode: z.enum(["amm_style", "zacs_edit"]),
  draft: z.string().trim().min(1).max(12_000),
  subject: z.string().trim().max(500).default(""),
  thread: z.string().trim().max(30_000).default(""),
  recipientName: z.string().trim().max(200).optional(),
  senderAddress: z.string().trim().email().max(320).optional(),
  recipientAddress: z.string().trim().email().max(320).optional(),
  conversationId: z.string().trim().max(500).optional()
}).strict();

export type RewriteRequest = z.infer<typeof rewriteRequestSchema>;

export const rewriteModelResultSchema = z.object({
  rewrittenText: z.string().min(1),
  reviewNotes: z.array(z.string()).max(6),
  warnings: z.array(z.string()).max(6)
}).strict();

export const rewriteResponseSchema = rewriteModelResultSchema.extend({
  success: z.literal(true),
  requestId: z.string()
});
