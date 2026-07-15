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

## Prueba de composición de texto

La capa de texto usa fuentes TTF empaquetadas en `assets/fonts/` y convierte cada glifo a trazados SVG antes de rasterizar. No depende de fuentes del sistema ni de `fontconfig` en Vercel.

Para ejecutar la prueba de humo reproducible:

```bash
npm run test:compose
```

La prueba crea un anuncio de 1080×1350 con acentos, texto secundario, CTA y disclaimer; verifica contraste real en cada región y escribe el resultado en `/tmp/compose-test.png`. También falla si reaparecen nodos tipográficos SVG o si se dibuja CTA/disclaimer sin contenido.

La generación normal conserva la imagen terminada del modelo sin añadir tarjetas, barras, logos ni botones automáticos. El compositor por trazados se mantiene para usos explícitos y para su prueba de humo, pero no se activa automáticamente.

Fuentes empaquetadas: DM Sans, Space Grotesk y Caveat. Sus licencias SIL Open Font License están junto a los TTF en `assets/fonts/`.

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

## Candados de propiedad y despliegue

- Repositorio autorizado: `anapaullerenas/nuevo-proyecto-ia`.
- Proyecto autorizado: `anapaulopezlle-2168s-projects/nuevo-proyecto-ia`.
- `npm run verify:ownership` bloquea remotos o enlaces de Vercel distintos.
- Producción debe publicarse con `npm run deploy:production`; exige rama `main`, árbol limpio y commits ya guardados en GitHub.
- `CODEOWNERS` asigna a `@anapaullerenas` como responsable de todo el repositorio.
- GitHub usa el host SSH aislado `github-ana` y una llave exclusiva; no hereda las credenciales HTTPS globales.
- Vercel usa el perfil local aislado `~/.local/share/platform-profiles/vercel-ana`.
- Supabase usa siempre `--profile ana` y el proyecto `rjjrwthkyeuxzecomkga`.
