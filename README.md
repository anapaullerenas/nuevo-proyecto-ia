# Proyecto IA

Plataforma unificada para:

- Chat IA como asistente de dirección creativa.
- Análisis de datos exportados desde Meta.
- Análisis profundo de creativos con psicología, receta, variantes y prompts.
- Creación de estáticos con memoria de marca, referencias y edición por instrucciones.
- Gestión de marcas, créditos, membresía Skool y panel de administración.

## Ver en local

```bash
npm run dev -- -p 3004
```

Abrir:

```text
http://localhost:3004
```

Vista admin:

```text
http://localhost:3004/unified-flow?view=admin
```

## Variables pendientes

Copiar `.env.example` a `.env.local` cuando estén listos los accesos de Ana:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=
SKOOL_WEBHOOK_SECRET=
```

## Estado

Esta primera versión es una maqueta funcional en Next.js lista para subir a un proyecto nuevo de Vercel cuando la CLI tenga acceso al scope de Ana.
