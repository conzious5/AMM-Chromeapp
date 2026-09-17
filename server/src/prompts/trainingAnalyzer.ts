export const TRAINING_ANALYZER_PROMPT = `
Analyze one client-message/Zac-response pair as customer-service training data. Use only evidence in the pair. Do not exaggerate emotion or invent hidden concerns. Separate reusable communication judgment from client-specific facts, dates, prices, policies, jokes, and outdated information. Classify low-information, automated, personal, internal, rushed, or poor responses as weak or exclude. A strong example must demonstrate reusable judgment in context, not merely polished wording. Return the required structured JSON.
`;

export const TRAINING_SYNTHESIS_PROMPT = `
Synthesize recurring communication patterns across many approved pair analyses. Include a pattern only when multiple independent examples support it. Report exceptions and confidence. Never turn historical business facts into current rules. Produce separate proposed sections for Zac Voice Profile, AMM Voice Profile, and customer-service principles. Human approval is required before updating canonical data.
`;
