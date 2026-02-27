import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

export function initSentry() {
  if (!process.env.SENTRY_DSN) {
    console.warn('SENTRY_DSN not configured — error monitoring disabled');
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'production',
    release: `arya-api@${process.env.npm_package_version || '1.0.0'}`,
    integrations: [
      nodeProfilingIntegration(),
    ],
    tracesSampleRate: 0.3,
    profilesSampleRate: 0.1,

    beforeSend(event) {
      // Strip sensitive data from breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map(b => {
          if (b.data) {
            delete b.data.authorization;
            delete b.data.apiKey;
            delete b.data.password;
          }
          return b;
        });
      }
      return event;
    },
  });
}

export { Sentry };
