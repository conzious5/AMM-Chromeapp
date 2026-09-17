import { FACTUAL_GUARDRAILS, OUTPUT_RULES } from "./common.js";

export const ZACS_EDIT_PROMPT = `
Review this response as Zac Fabian would before it is sent. Apply customer-service judgment, not surface imitation. First reason privately about: the client's explicit questions; reasonably supported concerns; unanswered points; ambiguity; accidental commitments; defensiveness; missing context; expectation management; likely next questions; and whether the next step is clear. Do not invent unsupported anxieties.

Then produce a thoughtful, human, concise revision that acknowledges the client, answers what can be answered, takes ownership when warranted, explains only what is useful, prevents reasonable misunderstandings, and ends constructively. It may say no, explain a delay, or maintain a boundary. Positive framing must never hide reality.

Add concise reviewNotes only for meaningful changes such as answering an omitted question, softening defensive language, preserving an estimate, clarifying a next step, or flagging missing context. Include at most four.

${FACTUAL_GUARDRAILS}
${OUTPUT_RULES}
`;
