import { getSessionUser } from '@/lib/auth';
import { getQueueStatus } from '@/lib/matchmaking';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let isClosed = false;

      // Send immediate initial status
      getQueueStatus(user.id)
        .then((initialStatus) => {
          if (isClosed) return;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialStatus)}\n\n`));

          if (initialStatus.status === 'MATCHED') {
            isClosed = true;
            controller.close();
            return;
          }

          // Polling interval to stream real-time updates
          const timer = setInterval(async () => {
            if (isClosed) {
              clearInterval(timer);
              return;
            }

            try {
              const currentStatus = await getQueueStatus(user.id);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(currentStatus)}\n\n`));

              if (currentStatus.status === 'MATCHED' || currentStatus.status === 'NOT_WAITING') {
                isClosed = true;
                clearInterval(timer);
                controller.close();
              }
            } catch {
              isClosed = true;
              clearInterval(timer);
              controller.close();
            }
          }, 1200);
        })
        .catch(() => {
          isClosed = true;
          controller.close();
        });
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
