import { PostHog } from 'posthog-node';

let posthogClient: PostHog | null = null;

export function getPostHog(): PostHog | null {
  if (!process.env.POSTHOG_API_KEY) return null;

  if (!posthogClient) {
    posthogClient = new PostHog(process.env.POSTHOG_API_KEY, {
      host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
      flushAt: 20,
      flushInterval: 10000,
    });
  }
  return posthogClient;
}

export function trackServerEvent(
  userId: string,
  event: string,
  properties?: Record<string, any>
) {
  const ph = getPostHog();
  if (ph) {
    ph.capture({ distinctId: userId, event, properties });
  }
}

export async function shutdownPostHog(): Promise<void> {
  const ph = getPostHog();
  if (ph) {
    await ph.shutdown();
  }
}
