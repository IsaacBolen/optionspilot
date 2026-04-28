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

// PATCH — close a position or update it
export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { id, exit_price, quantity_sold, closed_at, current_price, current_signal_score, last_refreshed_at } = body as {
    id: string;
    exit_price?: number;
    quantity_sold?: number;
    closed_at?: string;
    current_price?: number;
    current_signal_score?: number;
    last_refreshed_at?: string;
  };

  const hasRefreshUpdate =
    current_price !== undefined ||
    current_signal_score !== undefined ||
    last_refreshed_at !== undefined;

  // Daily refresh update (price and/or current signal metadata)
  if (hasRefreshUpdate && exit_price === undefined) {
    const updatePayload: {
      current_price?: number;
      current_signal_score?: number;
      last_refreshed_at?: string;
    } = {};

    if (current_price !== undefined) updatePayload.current_price = current_price;
    if (current_signal_score !== undefined) updatePayload.current_signal_score = current_signal_score;
    if (last_refreshed_at !== undefined) updatePayload.last_refreshed_at = last_refreshed_at;

    const { data, error } = await supabase
      .from('positions')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ position: data });
  }

  // Full close
  const { data, error } = await supabase
    .from('positions')
    .update({
      exit_price,
      current_price: exit_price,
      status: 'Closed',
      closed_at,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ position: data });
}

// DELETE — remove a position entirely
export async function DELETE(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { id } = body as { id: string };

  const { error } = await supabase
    .from('positions')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
