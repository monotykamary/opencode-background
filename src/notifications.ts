export async function sendIgnoredMessage(
  client: any,
  sessionId: string,
  text: string
): Promise<void> {
  try {
    await client.session.prompt({
      path: {
        id: sessionId,
      },
      body: {
        noReply: true,
        parts: [
          {
            type: 'text',
            text: text,
            ignored: true,
          },
        ],
      },
    });
  } catch {
    // Silently fail if notification can't be sent
  }
}
