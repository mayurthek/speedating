import { getSessionUser } from '@/lib/auth';
import { getQueueStatus } from '@/lib/matchmaking';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const encoder = new TextEncoder();

  let timer: NodeJS.Timeout | null = null;
  let isClosed = false;

  const stream = new ReadableStream({
    start(controller) {
      const safeClose = () => {
        if (!isClosed) {
          isClosed = true;
          if (timer) clearInterval(timer);
          try {
            controller.close();
          } catch {
            // Ignore if already closed
          }
        }
      };

      const safeEnqueue = (payload: unknown) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          safeClose();
        }
      };

      // Send immediate initial status
      getQueueStatus(user.id)
        .then((initialStatus) => {
          if (isClosed) return;
          safeEnqueue(initialStatus);

          if (initialStatus.status === 'MATCHED') {
            safeClose();
            return;
          }

          // Polling interval to stream real-time updates
          timer = setInterval(async () => {
            if (isClosed) {
              if (timer) clearInterval(timer);
              return;
            }

            try {
              const currentStatus = await getQueueStatus(user.id);
              if (isClosed) return;
              safeEnqueue(currentStatus);

              if (currentStatus.status === 'MATCHED' || currentStatus.status === 'NOT_WAITING') {
                safeClose();
              }
            } catch {
              safeClose();
            }
          }, 1200);
        })
        .catch(() => {
          safeClose();
        });
    },
    cancel() {
      isClosed = true;
      if (timer) clearInterval(timer);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
