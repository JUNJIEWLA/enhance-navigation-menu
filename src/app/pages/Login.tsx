import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const navigate = useNavigate();
  const { signIn, rememberedUsername } = useAuth();

  const [username, setUsername] = useState(rememberedUsername);
  const [password, setPassword] = useState('');
  const [rememberUsername, setRememberUsername] = useState(Boolean(rememberedUsername));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await signIn({ username, password, rememberUsername });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible iniciar sesión.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center relative overflow-hidden"
      style={{
        backgroundImage: `url('https://images.unsplash.com/photo-1551582045-6ec9c11d8697?w=1600&q=80')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-5xl mx-auto px-8 flex flex-col md:flex-row items-center justify-between gap-12">

        {/* Left: Welcome text, pl es para la derecha y ss mt es hacia arriba */}
        <div className="flex-1 text-white pl-10 self-start mt-16"> 
          <h1 className="text-5xl font-bold leading-tight mb-4">
            Bienvenido<br />de Nuevo
          </h1>
          <p className="text-white/70 text-sm max-w-xs leading-relaxed">
            Acceda al sistema con sus credenciales corporativas para continuar gestionando sus operaciones.
          </p>
        </div>

        {/* Right: Sign-in form */}
        <div className="w-full max-w-sm">
          <h2 className="text-white text-2xl font-semibold mb-6">Iniciar sesión</h2>

          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-1">
              <Label htmlFor="usuario" className="text-white/80 text-xs font-medium">
                Usuario
              </Label>
              <Input
                id="usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="Ingrese su usuario"
                required
                className="bg-white/90 border-0 text-gray-900 placeholder:text-gray-400 h-10 focus:bg-white"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="contrasena" className="text-white/80 text-xs font-medium">
                Contraseña
              </Label>
              <Input
                id="contrasena"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Ingrese su contraseña"
                required
                className="bg-white/90 border-0 text-gray-900 placeholder:text-gray-400 h-10 focus:bg-white"
              />
            </div>

            <label
              htmlFor="remember-usuario"
              className="flex items-center gap-2 cursor-pointer select-none"
            >
              <Checkbox
                id="remember-usuario"
                checked={rememberUsername}
                onCheckedChange={(value) => setRememberUsername(Boolean(value))}
                className="border-white/60 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
              />
              <span className="text-sm text-white/80">Recordar usuario</span>
            </label>

            {error ? (
              <Alert variant="destructive" className="bg-red-900/70 border-red-700 text-white">
                <AlertTitle className="text-white">Error de autenticación</AlertTitle>
                <AlertDescription className="text-white/80">{error}</AlertDescription>
              </Alert>
            ) : null}

            <Button
              type="submit"
              disabled={submitting}
              className="w-auto px-6 h-9 bg-orange-500 hover:bg-orange-600 text-white font-medium border-0 rounded-sm cursor-pointer"
            >
              {submitting ? 'Validando...' : 'Iniciar sesión'}
            </Button>

            <p className="text-white/60 text-xs mt-2 cursor-pointer hover:text-white/90 transition-colors w-fit">
              ¿Olvidó su contraseña?
            </p>
          </form>

          <p className="text-white/40 text-xs mt-8 leading-relaxed">
            Al hacer clic en "Iniciar sesión" usted acepta los{' '}
            <span className="underline cursor-pointer hover:text-white/60">Términos de Servicio</span>{' '}
            |{' '}
            <span className="underline cursor-pointer hover:text-white/60">Política de Privacidad</span>
          </p>
        </div>
      </div>
    </div>
  );
}