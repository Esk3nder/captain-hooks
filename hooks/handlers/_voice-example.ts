/**
 * _voice-example.ts — Example Stop handler (DELETABLE)
 *
 * Stop handlers are imported by stop-orchestrator.hook.ts.
 * Each exports a default async function that receives the hook input.
 *
 * This example shows how to send a voice notification on task completion.
 * Requires a running voice server (e.g., ElevenLabs TTS).
 */

interface StopInput {
  session_id: string;
  transcript_path?: string;
}

export default async function voiceNotification(input: StopInput): Promise<void> {
  // Example: POST to a local voice server
  // Uncomment and configure for your setup:
  //
  // try {
  //   await fetch('http://localhost:8888/notify', {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({ message: 'Task complete.' }),
  //   });
  // } catch {
  //   // Voice server not running — silent fail
  // }

  void input; // unused in example
}
