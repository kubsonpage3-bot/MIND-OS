import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const connectorId = "6a3c683c1511b0c03aa71701";
    
    let accessToken;
    try {
      const connection = await base44.asServiceRole.connectors.getCurrentAppUserConnection(connectorId);
      accessToken = connection.accessToken;
    } catch (error) {
      return Response.json({ error: 'Google Calendar not connected', status: 'not_connected' }, { status: 400 });
    }

    const body = await req.json();
    const { action, task } = body;

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    if (action === 'create') {
      // Create calendar event from task
      const startDate = task.dueDate ? new Date(task.dueDate) : new Date();
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // +1 hour

      const event = {
        summary: task.name,
        description: `Task from MIND OS\nCategory: ${task.category}\nDifficulty: ${task.difficulty}\nNotes: ${task.notes || ''}`,
        start: {
          dateTime: startDate.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: endDate.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 15 },
          ],
        },
      };

      const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers,
        body: JSON.stringify(event),
      });

      if (!res.ok) {
        const error = await res.json();
        return Response.json({ error: error.error?.message || 'Failed to create event' }, { status: 500 });
      }

      const eventData = await res.json();
      return Response.json({ success: true, eventId: eventData.id, event: eventData });
    }

    if (action === 'list') {
      // List upcoming events
      const timeMin = new Date().toISOString();
      const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // Next 30 days

      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&maxResults=50`,
        { headers }
      );

      if (!res.ok) {
        const error = await res.json();
        return Response.json({ error: error.error?.message || 'Failed to list events' }, { status: 500 });
      }

      const data = await res.json();
      return Response.json({ events: data.items || [] });
    }

    if (action === 'delete') {
      // Delete calendar event
      if (!task.eventId) {
        return Response.json({ error: 'Event ID required' }, { status: 400 });
      }

      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${task.eventId}`,
        { method: 'DELETE', headers }
      );

      if (!res.ok) {
        const error = await res.json();
        return Response.json({ error: error.error?.message || 'Failed to delete event' }, { status: 500 });
      }

      return Response.json({ success: true });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});