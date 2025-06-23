
import { genkitNextHandler } from '@genkit-ai/next';
import '@/ai/dev'; // Import flows to ensure they are registered

export const GET = genkitNextHandler;
export const POST = genkitNextHandler;
