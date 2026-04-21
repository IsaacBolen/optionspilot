import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

// GET — fetch all positions
export async function GET() {
  const { data, error } = await supabase
    .from('positions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ positions: data });
}

// POST — log a new position
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const p = body as Record<string, unknown>;

  const { data, error } = await supabase
    .from('positions')
    .insert([{
      ticker: p.ticker,
      type: p.type,
      strike: p.strike,
      expiration: p.expiration,
      quantity: p.quantity,
      entry_price: p.entry_price,
      current_price: p.entry_price,
      platform: p.platform,
      ai_thesis: p.ai_thesis,
      signal_score: p.signal_score,
      status: 'Open',
    }])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ position: data });
}
