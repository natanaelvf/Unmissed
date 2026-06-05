import { Router, Request, Response } from 'express';
import { supabase } from '../../config/supabase';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/stats — Monthly stats with month-over-month comparison
// ---------------------------------------------------------------------------
router.get('/stats', async (req: Request, res: Response) => {
  const contractorId = req.contractorId;
  if (!contractorId) { res.status(401).json({ error: 'Not authenticated' }); return; }

  try {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

    // Current month leads
    const { data: currentLeads } = await supabase
      .from('leads')
      .select('*')
      .eq('contractor_id', contractorId)
      .gte('created_at', currentMonthStart);

    // Previous month leads
    const { data: previousLeads } = await supabase
      .from('leads')
      .select('*')
      .eq('contractor_id', contractorId)
      .gte('created_at', previousMonthStart)
      .lte('created_at', previousMonthEnd);

    // Compute stats for a set of leads
    function computeStats(leads: any[]) {
      const total = leads.length;
      const recovered = leads.filter(l =>
        ['booked', 'completed', 'followed_up'].includes(l.status)
      );
      const completed = leads.filter(l =>
        ['completed', 'followed_up'].includes(l.status)
      );
      const consentable = leads.filter(l => l.status !== 'no_consent');
      const recoveryRate = consentable.length > 0
        ? Math.round((recovered.length / consentable.length) * 100)
        : 0;
      const totalValue = completed.reduce(
        (sum: number, l: any) => sum + (l.estimated_value || 0), 0
      );

      // Average response time: time from lead creation to consent_given_at
      const responseTimes = leads
        .filter(l => l.consent_given_at)
        .map(l => {
          const created = new Date(l.created_at).getTime();
          const consented = new Date(l.consent_given_at).getTime();
          return (consented - created) / 60000; // minutes
        });
      const avgResponseMin = responseTimes.length > 0
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : 0;

      return {
        totalLeads: total,
        recoveredCount: recovered.length,
        completedCount: completed.length,
        totalValue,
        recoveryRate,
        avgResponseMinutes: avgResponseMin,
      };
    }

    const current = computeStats(currentLeads || []);
    const previous = computeStats(previousLeads || []);

    // Month-over-month deltas
    function delta(curr: number, prev: number): { value: number; direction: 'up' | 'down' | 'flat'; percent: number } {
      if (prev === 0 && curr === 0) return { value: 0, direction: 'flat', percent: 0 };
      if (prev === 0) return { value: curr, direction: 'up', percent: 100 };
      const pct = Math.round(((curr - prev) / prev) * 100);
      return {
        value: curr - prev,
        direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat',
        percent: Math.abs(pct),
      };
    }

    res.json({
      current: {
        month: now.toISOString().slice(0, 7),
        ...current,
        avgResponseTime: current.avgResponseMinutes > 0
          ? `${current.avgResponseMinutes} min`
          : '—',
      },
      previous: {
        month: `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`,
        ...previous,
      },
      trends: {
        revenue: delta(current.totalValue, previous.totalValue),
        recovered: delta(current.recoveredCount, previous.recoveredCount),
        recoveryRate: delta(current.recoveryRate, previous.recoveryRate),
        totalLeads: delta(current.totalLeads, previous.totalLeads),
      },
    });
  } catch (err) {
    console.error('[api] Stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/stats/calendar — Booking and lead data per day for calendar widget
// Query params: from (ISO date), to (ISO date)
// ---------------------------------------------------------------------------
router.get('/stats/calendar', async (req: Request, res: Response) => {
  const contractorId = req.contractorId;
  if (!contractorId) { res.status(401).json({ error: 'Not authenticated' }); return; }

  const { from, to } = req.query as Record<string, string | undefined>;

  if (!from || !to) {
    res.status(400).json({ error: 'Missing required query params: from, to (ISO date strings)' });
    return;
  }

  try {
    // Leads created in the date range (for "leads collected" dots)
    const { data: leads } = await supabase
      .from('leads')
      .select('id, status, created_at, booking_time, estimated_value, caller_name, urgency, issue_description')
      .eq('contractor_id', contractorId)
      .or(`created_at.gte.${from},booking_time.gte.${from}`)
      .or(`created_at.lte.${to},booking_time.lte.${to}`);

    // Build per-day data
    const dayMap: Record<string, {
      collectedLeads: number;
      bookingRevenue: number;
      bookings: Array<{
        id: string;
        time: string;
        name: string | null;
        issue: string | null;
        urgency: string;
        estimatedValue: number | null;
      }>;
    }> = {};

    for (const lead of (leads || [])) {
      // Count leads collected (created) per day
      const createdDay = lead.created_at?.slice(0, 10);
      if (createdDay && createdDay >= from && createdDay <= to) {
        const recoveredStatuses = ['opted_in', 'qualifying', 'qualifying_issue', 'qualifying_urgency',
          'qualifying_name', 'booking_sent', 'booked', 'completed', 'followed_up'];
        if (recoveredStatuses.includes(lead.status)) {
          if (!dayMap[createdDay]) dayMap[createdDay] = { collectedLeads: 0, bookingRevenue: 0, bookings: [] };
          dayMap[createdDay].collectedLeads++;
        }
      }

      // Count booking revenue per booking day
      if (lead.booking_time) {
        const bookingDay = lead.booking_time.slice(0, 10);
        if (bookingDay >= from && bookingDay <= to) {
          if (!dayMap[bookingDay]) dayMap[bookingDay] = { collectedLeads: 0, bookingRevenue: 0, bookings: [] };
          dayMap[bookingDay].bookingRevenue += lead.estimated_value || 0;
          dayMap[bookingDay].bookings.push({
            id: lead.id,
            time: lead.booking_time,
            name: lead.caller_name,
            issue: lead.issue_description,
            urgency: lead.urgency,
            estimatedValue: lead.estimated_value,
          });
        }
      }
    }

    // Sort bookings within each day by time
    for (const day of Object.values(dayMap)) {
      day.bookings.sort((a, b) => a.time.localeCompare(b.time));
    }

    res.json({ calendar: dayMap });
  } catch (err) {
    console.error('[api] Calendar stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
