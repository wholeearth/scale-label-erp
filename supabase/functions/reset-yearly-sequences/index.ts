import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const body = await req.json().catch(() => ({}))
    const targetYear = body.year || new Date().getFullYear()
    const manual = body.manual || false

    // Get all operators (profiles with operator role)
    const { data: operators, error: operatorsError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'operator')

    if (operatorsError) {
      throw new Error(`Failed to fetch operators: ${operatorsError.message}`)
    }

    if (!operators || operators.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No operators found',
          operatorsProcessed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let createdCount = 0
    let skippedCount = 0

    // Create new yearly sequence records for each operator
    for (const operator of operators) {
      // Check if sequence already exists for this year
      const { data: existing } = await supabase
        .from('operator_yearly_sequences')
        .select('id')
        .eq('operator_id', operator.user_id)
        .eq('year', targetYear)
        .maybeSingle()

      if (!existing) {
        // Create new sequence starting at 0
        const { error: insertError } = await supabase
          .from('operator_yearly_sequences')
          .insert({
            operator_id: operator.user_id,
            year: targetYear,
            sequence_count: 0
          })

        if (insertError) {
          console.error(`Failed to create sequence for operator ${operator.user_id}:`, insertError)
        } else {
          createdCount++
        }
      } else {
        skippedCount++
      }
    }

    const message = manual 
      ? `Yearly sequences initialized for ${targetYear}`
      : `Automatic yearly sequence reset for ${targetYear}`

    return new Response(
      JSON.stringify({ 
        success: true, 
        message,
        year: targetYear,
        operatorsProcessed: operators.length,
        sequencesCreated: createdCount,
        sequencesSkipped: skippedCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error('Error resetting yearly sequences:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})