
import { createRoot } from 'react-dom/client';
import './styles/index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('No se encontró el contenedor principal (#root).');
}

async function bootstrap() {
  try {
    const { default: App } = await import('./app/App.tsx');
    createRoot(rootElement).render(<App />);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido al iniciar la app.';

    rootElement.innerHTML = `
      <div style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#f8fafc;color:#0f172a;font-family:Segoe UI,Arial,sans-serif;">
        <div style="max-width:720px;width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;box-shadow:0 10px 20px rgba(15,23,42,0.06)">
          <h1 style="margin:0 0 10px;font-size:20px;">La aplicación no pudo iniciar</h1>
          <p style="margin:0 0 8px;line-height:1.5;">Revisa las variables de entorno en Vercel y vuelve a desplegar.</p>
          <pre style="margin:12px 0 0;padding:12px;border-radius:8px;background:#0f172a;color:#f8fafc;overflow:auto;white-space:pre-wrap;word-break:break-word;">${message}</pre>
        </div>
      </div>
    `;
  }
}

void bootstrap();
  