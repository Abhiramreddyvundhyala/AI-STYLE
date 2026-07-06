/**
 * Process Purchase Edge Function
 * Creates purchase record and updates seller earnings
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      buyerId,
      styleId,
      paymentId,
      orderId,
      amount,
      platformCut,
      sellerCut,
    } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get style to find seller
    const { data: style, error: styleError } = await supabaseClient
      .from('styles')
      .select('seller_id')
      .eq('id', styleId)
      .single();

    if (styleError) throw styleError;

    // Create purchase record
    const { data: purchase, error: purchaseError } = await supabaseClient
      .from('purchases')
      .insert({
        buyer_id: buyerId,
        style_id: styleId,
        amount,
        platform_cut: platformCut,
        seller_cut: sellerCut,
        razorpay_payment_id: paymentId,
        razorpay_order_id: orderId,
      })
      .select()
      .single();

    if (purchaseError) throw purchaseError;

    // Update seller earnings
    const { error: sellerError } = await supabaseClient.rpc('update_seller_earnings', {
      seller_id: style.seller_id,
      amount: sellerCut,
    });

    if (sellerError) throw sellerError;

    return new Response(
      JSON.stringify({ purchase }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
