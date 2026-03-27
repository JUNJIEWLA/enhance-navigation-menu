import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { supabase, supabaseKey, supabaseUrl } from '../supabase';
import type { RolUsuario } from '../context/AuthContext';

interface Empresa {
  id: string;
  nombre: string;
  activo: boolean;
  created_at: string;
}

interface PerfilListado {
  user_id: string;
  username: string;
  email_login: string;
  rol: RolUsuario;
  activo: boolean;
  empresa_id: string;
  empresas?: { nombre?: string };
}

const ROLES_DISPONIBLES: RolUsuario[] = ['admin_empresa', 'usuario_empresa'];

export function AdminUsuarios() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [usuarios, setUsuarios] = useState<PerfilListado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardandoUsuario, setGuardandoUsuario] = useState(false);
  const [guardandoEmpresa, setGuardandoEmpresa] = useState(false);
  const [empresaAccionId, setEmpresaAccionId] = useState('');
  const [usuarioAccionId, setUsuarioAccionId] = useState('');

  const [empresaId, setEmpresaId] = useState('');
  const [empresaNombre, setEmpresaNombre] = useState('');
  const [edicionEmpresas, setEdicionEmpresas] = useState<Record<string, string>>({});
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [passwordTemporal, setPasswordTemporal] = useState('');
  const [rol, setRol] = useState<RolUsuario>('admin_empresa');
  const [error, setError] = useState('');
  const [okMessage, setOkMessage] = useState('');

  const totalActivos = useMemo(() => usuarios.filter((u) => u.activo).length, [usuarios]);
  const empresasActivas = useMemo(() => empresas.filter((e) => e.activo), [empresas]);

  const loadData = async () => {
    setCargando(true);
    setError('');

    const [empresasRes, usuariosRes] = await Promise.all([
      supabase.rpc('admin_listar_empresas'),
      supabase.rpc('admin_listar_perfiles')
    ]);

    if (empresasRes.error) {
      setError('No fue posible cargar las empresas. Verifique permisos de Super Admin.');
    } else {
      const empresasData = (empresasRes.data || []) as Empresa[];
      setEmpresas(empresasData);
      setEdicionEmpresas(
        empresasData.reduce<Record<string, string>>((acc, empresa) => {
          acc[empresa.id] = empresa.nombre;
          return acc;
        }, {})
      );

      const empresasActivasData = empresasData.filter((e) => e.activo);
      const seleccionValida = empresasActivasData.some((e) => e.id === empresaId);

      if (!seleccionValida) {
        setEmpresaId(empresasActivasData[0]?.id || '');
      }
    }

    if (usuariosRes.error) {
      setError('No fue posible cargar los usuarios. Verifique permisos de Super Admin.');
    } else {
      const perfilesData = ((usuariosRes.data || []) as any[]).map((row) => ({
        ...row,
        empresas: { nombre: row.nombre_empresa }
      }));
      setUsuarios(perfilesData as PerfilListado[]);
    }

    setCargando(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const clearForm = () => {
    setUsername('');
    setEmail('');
    setPasswordTemporal('');
    setRol('admin_empresa');
  };

  const handleCrearUsuario = async () => {
    setGuardandoUsuario(true);
    setError('');
    setOkMessage('');

    try {
      const normalizedUsername = username.trim().toLowerCase();
      const normalizedEmail = email.trim().toLowerCase();

      if (!empresaId || !normalizedUsername || !normalizedEmail || !passwordTemporal || !rol) {
        throw new Error('Complete todos los campos para crear el usuario.');
      }

      const usernameDuplicado = usuarios.some((u) => u.username?.trim().toLowerCase() === normalizedUsername);
      if (usernameDuplicado) {
        throw new Error('El usuario ya existe. Use otro nombre de usuario.');
      }

      const emailDuplicado = usuarios.some((u) => u.email_login?.trim().toLowerCase() === normalizedEmail);
      if (emailDuplicado) {
        throw new Error('El correo ya existe. Use otro correo para el nuevo usuario.');
      }

      if (passwordTemporal.length < 8) {
        throw new Error('La contraseña temporal debe tener al menos 8 caracteres.');
      }

      const payload = {
        empresaId,
        username: normalizedUsername,
        email: normalizedEmail,
        password: passwordTemporal,
        rol
      };

      const getValidAccessToken = async (): Promise<string> => {
        const {
          data: { session: initialSession }
        } = await supabase.auth.getSession();

        if (initialSession?.access_token) {
          return initialSession.access_token;
        }

        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();

        if (refreshError || !refreshed.session?.access_token) {
          throw new Error('Sesion no valida o expirada. Inicie sesion nuevamente.');
        }

        return refreshed.session.access_token;
      };

      const callAdminCreateUser = async (accessToken: string) =>
        fetch(`${supabaseUrl}/functions/v1/admin-create-user`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseKey || '',
            Authorization: `Bearer ${accessToken}`
          } as HeadersInit,
          body: JSON.stringify(payload)
        });

      let token = await getValidAccessToken();
      let invokeResult = await callAdminCreateUser(token);

      if (invokeResult.status === 401) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();

        if (!refreshError && refreshed.session?.access_token) {
          token = refreshed.session.access_token;
          invokeResult = await callAdminCreateUser(token);
        }
      }

      const rawBody = await invokeResult.text();
      let parsedBody: unknown = null;

      try {
        parsedBody = rawBody ? JSON.parse(rawBody) : null;
      } catch {
        parsedBody = rawBody;
      }

      if (!invokeResult.ok) {
        if (typeof parsedBody === 'object' && parsedBody !== null && 'error' in parsedBody) {
          const apiError = (parsedBody as { error?: unknown }).error;
          if (typeof apiError === 'string' && apiError.trim()) {
            throw new Error(`${apiError} (HTTP ${invokeResult.status})`);
          }
        }

        if (typeof parsedBody === 'string' && parsedBody.trim()) {
          throw new Error(`${parsedBody} (HTTP ${invokeResult.status})`);
        }

        if (invokeResult.status === 401) {
          throw new Error('No autorizado (HTTP 401). Cierre sesion e inicie nuevamente como Super Admin.');
        }

        throw new Error(`No fue posible crear el usuario. (HTTP ${invokeResult.status})`);
      }

      setOkMessage('Usuario creado correctamente.');
      clearForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible crear el usuario.');
    } finally {
      setGuardandoUsuario(false);
    }
  };

  const handleCrearEmpresa = async () => {
    setGuardandoEmpresa(true);
    setError('');
    setOkMessage('');

    try {
      const nombreNormalizado = empresaNombre.trim();

      if (!nombreNormalizado) {
        throw new Error('Ingrese el nombre de la empresa.');
      }

      const { data, error: createError } = await supabase.rpc('admin_crear_empresa', {
        p_nombre: nombreNormalizado
      });

      if (createError) {
        throw new Error(createError.message || 'No fue posible crear la empresa.');
      }

      const empresaCreada = Array.isArray(data) ? data[0] : null;

      setEmpresaNombre('');
      setOkMessage('Empresa creada correctamente.');
      await loadData();

      if (empresaCreada?.id) {
        setEmpresaId(empresaCreada.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible crear la empresa.');
    } finally {
      setGuardandoEmpresa(false);
    }
  };

  const handleActualizarEmpresa = async (id: string) => {
    setEmpresaAccionId(id);
    setError('');
    setOkMessage('');

    try {
      const nombre = (edicionEmpresas[id] || '').trim();

      if (!nombre) {
        throw new Error('Ingrese un nombre válido para la empresa.');
      }

      const { error: updateError } = await supabase.rpc('admin_actualizar_empresa', {
        p_empresa_id: id,
        p_nombre: nombre
      });

      if (updateError) {
        throw new Error(updateError.message || 'No fue posible actualizar la empresa.');
      }

      setOkMessage('Empresa actualizada correctamente.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible actualizar la empresa.');
    } finally {
      setEmpresaAccionId('');
    }
  };

  const handleDesactivarEmpresa = async (id: string) => {
    setEmpresaAccionId(id);
    setError('');
    setOkMessage('');

    try {
      const { error: disableError } = await supabase.rpc('admin_desactivar_empresa', {
        p_empresa_id: id
      });

      if (disableError) {
        throw new Error(disableError.message || 'No fue posible desactivar la empresa.');
      }

      setOkMessage('Empresa desactivada correctamente.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible desactivar la empresa.');
    } finally {
      setEmpresaAccionId('');
    }
  };

  const handleActivarEmpresa = async (id: string) => {
    setEmpresaAccionId(id);
    setError('');
    setOkMessage('');

    try {
      const { error: enableError } = await supabase.rpc('admin_activar_empresa', {
        p_empresa_id: id
      });

      if (enableError) {
        throw new Error(enableError.message || 'No fue posible activar la empresa.');
      }

      setOkMessage('Empresa activada correctamente.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible activar la empresa.');
    } finally {
      setEmpresaAccionId('');
    }
  };

  const handleDesactivarUsuario = async (id: string) => {
    setUsuarioAccionId(id);
    setError('');
    setOkMessage('');

    try {
      const { error: disableError } = await supabase.rpc('admin_desactivar_usuario', {
        p_user_id: id
      });

      if (disableError) {
        throw new Error(disableError.message || 'No fue posible desactivar el usuario.');
      }

      setOkMessage('Usuario desactivado correctamente.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible desactivar el usuario.');
    } finally {
      setUsuarioAccionId('');
    }
  };

  const handleActivarUsuario = async (id: string) => {
    setUsuarioAccionId(id);
    setError('');
    setOkMessage('');

    try {
      const { error: enableError } = await supabase.rpc('admin_activar_usuario', {
        p_user_id: id
      });

      if (enableError) {
        throw new Error(enableError.message || 'No fue posible activar el usuario.');
      }

      setOkMessage('Usuario activado correctamente.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible activar el usuario.');
    } finally {
      setUsuarioAccionId('');
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Administración Privada</h1>
        <p className="text-gray-500 mt-1">Creación de usuarios por empresa (solo Super Admin)</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600 mb-1">Empresas registradas</p>
            <p className="text-2xl font-bold text-gray-900">{empresas.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600 mb-1">Usuarios totales</p>
            <p className="text-2xl font-bold text-gray-900">{usuarios.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600 mb-1">Usuarios activos</p>
            <p className="text-2xl font-bold text-green-700">{totalActivos}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Crear empresa</CardTitle>
          <CardDescription>Registre primero la empresa para luego crear sus usuarios.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
            <div>
              <Label htmlFor="empresaNombre">Nombre de empresa</Label>
              <Input
                id="empresaNombre"
                value={empresaNombre}
                onChange={(e) => setEmpresaNombre(e.target.value)}
                placeholder="ej: Plaza Max"
              />
            </div>
            <Button onClick={handleCrearEmpresa} disabled={guardandoEmpresa || cargando}>
              {guardandoEmpresa ? 'Creando empresa...' : 'Crear empresa'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Crear usuario privado</CardTitle>
          <CardDescription>
            No existe registro público. Todos los usuarios se crean únicamente desde este panel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="empresa">Empresa</Label>
              <Select value={empresaId} onValueChange={setEmpresaId}>
                <SelectTrigger id="empresa">
                  <SelectValue placeholder="Seleccione empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresasActivas.map((empresa) => (
                    <SelectItem key={empresa.id} value={empresa.id}>
                      {empresa.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="rol">Rol</Label>
              <Select value={rol} onValueChange={(value) => setRol(value as RolUsuario)}>
                <SelectTrigger id="rol">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES_DISPONIBLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r === 'admin_empresa' ? 'Administrador de empresa' : 'Usuario de empresa'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="username">Usuario</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ej: finanzas_cibao"
              />
            </div>

            <div>
              <Label htmlFor="email">Correo login interno</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@empresa.com"
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="password">Contraseña temporal</Label>
              <Input
                id="password"
                type="password"
                value={passwordTemporal}
                onChange={(e) => setPasswordTemporal(e.target.value)}
                placeholder="Minimo 8 caracteres"
              />
            </div>
          </div>

          {error ? (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {okMessage ? (
            <Alert className="mt-4">
              <AlertTitle>Operación completada</AlertTitle>
              <AlertDescription>{okMessage}</AlertDescription>
            </Alert>
          ) : null}

          <div className="mt-6 flex justify-end">
            <Button onClick={handleCrearUsuario} disabled={guardandoUsuario || cargando}>
              {guardandoUsuario ? 'Creando usuario...' : 'Crear usuario'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Empresas existentes</CardTitle>
          <CardDescription>
            Renombre, active o desactive empresas desde este panel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="border-b">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Nombre</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Estado</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {empresas.map((empresa) => {
                  const isBusy = empresaAccionId === empresa.id;

                  return (
                    <tr key={empresa.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <Input
                          value={edicionEmpresas[empresa.id] || ''}
                          onChange={(e) =>
                            setEdicionEmpresas((prev) => ({
                              ...prev,
                              [empresa.id]: e.target.value
                            }))
                          }
                          disabled={!empresa.activo || isBusy}
                        />
                      </td>
                      <td className="py-3 px-4 text-center text-sm">
                        <span className={empresa.activo ? 'text-green-700 font-medium' : 'text-gray-500'}>
                          {empresa.activo ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            onClick={() => handleActualizarEmpresa(empresa.id)}
                            disabled={!empresa.activo || isBusy}
                          >
                            {isBusy ? 'Guardando...' : 'Guardar nombre'}
                          </Button>
                          {empresa.activo ? (
                            <Button
                              variant="destructive"
                              onClick={() => handleDesactivarEmpresa(empresa.id)}
                              disabled={isBusy}
                            >
                              Desactivar
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              onClick={() => handleActivarEmpresa(empresa.id)}
                              disabled={isBusy}
                            >
                              Activar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {!cargando && empresas.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-500">No hay empresas registradas.</div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usuarios existentes</CardTitle>
          <CardDescription>Listado de cuentas creadas por empresa. Puede desactivar usuarios activos.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="border-b">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Usuario</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Correo</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Empresa</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Rol</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Estado</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => {
                  const isBusy = usuarioAccionId === u.user_id;
                  const isSuperAdmin = u.rol === 'super_admin';

                  return (
                    <tr key={u.user_id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm font-medium">{u.username}</td>
                      <td className="py-3 px-4 text-sm">{u.email_login}</td>
                      <td className="py-3 px-4 text-sm">{u.empresas?.nombre || '-'}</td>
                      <td className="py-3 px-4 text-sm">{u.rol}</td>
                      <td className="py-3 px-4 text-center text-sm">
                        <span className={u.activo ? 'text-green-700 font-medium' : 'text-gray-500'}>
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant={u.activo ? 'destructive' : 'outline'}
                          size="sm"
                          onClick={() => (u.activo ? handleDesactivarUsuario(u.user_id) : handleActivarUsuario(u.user_id))}
                          disabled={isBusy || isSuperAdmin}
                        >
                          {isBusy ? (u.activo ? 'Desactivando...' : 'Activando...') : u.activo ? 'Desactivar' : 'Activar'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {!cargando && usuarios.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-500">No hay usuarios registrados.</div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
