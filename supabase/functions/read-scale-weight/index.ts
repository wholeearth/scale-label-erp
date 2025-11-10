import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Get scale configuration from database
    const { data: scaleConfig, error: configError } = await supabase
      .from('scale_config')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (configError || !scaleConfig) {
      console.error('Scale config error:', configError);
      return new Response(
        JSON.stringify({ error: 'Scale not configured' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    console.log('Connecting to scale:', scaleConfig.ip_address, scaleConfig.port);

    // Connect to the CAS CN1 scale via TCP
    try {
      const conn = await Deno.connect({
        hostname: scaleConfig.ip_address,
        port: scaleConfig.port,
      });

      // Read weight data from scale
      const buffer = new Uint8Array(1024);
      const bytesRead = await conn.read(buffer);
      
      if (bytesRead === null) {
        conn.close();
        return new Response(
          JSON.stringify({ error: 'No data from scale' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          }
        );
      }

      const data = new TextDecoder().decode(buffer.subarray(0, bytesRead));
      console.log('Raw scale data:', data);
      
      // Parse weight from scale data (format may vary by scale model)
      // CAS CN1 typically sends data in format like: "ST,GS,   12.34 kg"
      const weightMatch = data.match(/(\d+\.\d+)/);
      const weight = weightMatch ? parseFloat(weightMatch[1]) : 0;

      conn.close();

      return new Response(
        JSON.stringify({ 
          weight,
          unit: 'kg',
          raw: data.trim()
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } catch (scaleError) {
      console.error('Scale connection error:', scaleError);
      
      // Return mock weight for development/testing
      const mockWeight = (Math.random() * 50 + 10).toFixed(2);
      console.log('Returning mock weight:', mockWeight);
      
      return new Response(
        JSON.stringify({ 
          weight: parseFloat(mockWeight),
          unit: 'kg',
          mock: true,
          error: 'Scale not accessible, using mock data'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An error occurred' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
