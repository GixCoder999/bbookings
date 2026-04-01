/**
 * Supabase Edge Function: clearExpiredSlots
 * 
 * Cleanup job that marks past slots as 'cancelled'.
 * Can be triggered via cron or manually via HTTP POST.
 * 
 * Deploy to Supabase with:
 * supabase functions deploy clearExpiredSlots --project-id YOUR_PROJECT_ID
 * 
 * To set up cron scheduler in supabase.json:
 * "functions": {
 *   "clearExpiredSlots": {
 *     "schedule": "0 0 * * *"  # Daily at midnight UTC
 *   }
 * }
 * 
 * Request: POST /clearExpiredSlots
 * Response: { cleaned_count: number }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get today's date in UTC
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]

    // Step 1: Mark all slots before today as 'cancelled' if they're still 'available' or 'booked'
    // This prevents double-booking of past slots
    const { data: expiredSlots, error: selectError } = await supabase
      .from('slots')
      .select('id')
      .lt('date', todayStr)
      .in('status', ['available', 'booked'])

    if (selectError) {
      throw new Error(`Failed to find expired slots: ${selectError.message}`)
    }

    let cleanedCount = 0

    if (expiredSlots && expiredSlots.length > 0) {
      const { error: updateError, count } = await supabase
        .from('slots')
        .update({ status: 'cancelled' })
        .lt('date', todayStr)
        .in('status', ['available', 'booked'])

      if (updateError) {
        throw new Error(`Failed to update expired slots: ${updateError.message}`)
      }

      cleanedCount = count || expiredSlots.length
    }

    // Step 2: Clean up orphaned bookings (optional - depends on your business logic)
    // If a slot is cancelled after booking, consider what happens to the booking
    // This is commented out as it depends on your requirements
    /*
    const { error: bookingError } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .in('slot_id', expiredSlots.map(s => s.id))
      .eq('status', 'pending')
    */

    console.log(`Cleanup completed: ${cleanedCount} slots marked as expired`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Expired slots cleanup completed',
        cleaned_count: cleanedCount,
        date: todayStr,
      }),
      { status: 200, headers: corsHeaders },
    )
  } catch (error) {
    console.error('Cleanup error:', error)
    return new Response(
      JSON.stringify({
        error: 'Cleanup failed',
        message: error.message,
      }),
      { status: 500, headers: corsHeaders },
    )
  }
})
