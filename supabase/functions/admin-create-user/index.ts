// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

type RolUsuario = 'super_admin' | 'admin_empresa' | 'usuario_empresa';

interface CreateUserPayload {
  empresaId: string;
  username: string;
  email: string;
  password: string;
  rol: RolUsuario;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Configuración incompleta de variables de entorno en Edge Function.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization') || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';

    if (!bearerToken) {
      return new Response(JSON.stringify({ error: 'No autorizado. Falta token Bearer.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const {
      data: { user: callerUser },
      error: callerError
    } = await adminClient.auth.getUser(bearerToken);

    if (callerError || !callerUser) {
      return new Response(JSON.stringify({ error: 'No autorizado: ' + (callerError?.message || 'Usuario no verificado') }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: callerPerfil, error: perfilError } = await adminClient
      .from('perfiles')
      .select('rol')
      .eq('user_id', callerUser.id)
      .single();

    if (perfilError || callerPerfil?.rol !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Permisos insuficientes. Solo Super Admin.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const payload = (await req.json()) as CreateUserPayload;
    const username = payload.username?.trim().toLowerCase();
    const email = payload.email?.trim().toLowerCase();

    if (!payload.empresaId || !username || !email || !payload.password || !payload.rol) {
      return new Response(JSON.stringify({ error: 'Datos incompletos para crear usuario.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!['admin_empresa', 'usuario_empresa', 'super_admin'].includes(payload.rol)) {
      return new Response(JSON.stringify({ error: 'Rol no válido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: empresaExiste } = await adminClient
      .from('empresas')
      .select('id, activo')
      .eq('id', payload.empresaId)
      .single();

    if (!empresaExiste) {
      return new Response(JSON.stringify({ error: 'La empresa seleccionada no existe.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (empresaExiste.activo === false) {
      return new Response(JSON.stringify({ error: 'La empresa seleccionada está inactiva.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: usernameExistente } = await adminClient
      .from('perfiles')
      .select('user_id')
      .eq('username', username)
      .maybeSingle();

    if (usernameExistente) {
      return new Response(JSON.stringify({ error: 'El usuario ya existe.' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: createdAuthUser, error: createAuthError } = await adminClient.auth.admin.createUser({
      email,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        username,
        rol: payload.rol
      }
    });

    if (createAuthError || !createdAuthUser.user) {
      return new Response(
        JSON.stringify({ error: createAuthError?.message || 'No se pudo crear el usuario en Auth.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { error: insertPerfilError } = await adminClient.from('perfiles').insert({
      user_id: createdAuthUser.user.id,
      empresa_id: payload.empresaId,
      username,
      email_login: email,
      rol: payload.rol,
      activo: true
    });

    if (insertPerfilError) {
      await adminClient.auth.admin.deleteUser(createdAuthUser.user.id);
      return new Response(JSON.stringify({ error: insertPerfilError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId: createdAuthUser.user.id,
        username,
        empresaId: payload.empresaId,
        rol: payload.rol
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Error no controlado en admin-create-user.'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
