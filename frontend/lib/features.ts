/** Claude-powered features (Tutor, Explain simply, flashcards, Review). They need the Python backend
 * and an API key, so they are off unless NEXT_PUBLIC_AI_ENABLED=true (e.g. in .env.local). */
export const AI_ENABLED = process.env.NEXT_PUBLIC_AI_ENABLED === "true";
