-- Global examples calibrate structure and quality only. Keep them deliberately
-- diverse so a new brand never inherits the founder's skincare vocabulary.
update public.golden_briefs
set active = false
where scope = 'global'
  and source = 'founder_catalog';

delete from public.golden_briefs
where scope = 'global'
  and source = 'neutral_catalog_v1';

insert into public.golden_briefs(archetype_id, scope, ficha, source, active)
values
  (
    'beneficios_apilados',
    'global',
    '{
      "concepto":"Una oferta de acompañamiento representada como una ruta clara con tres beneficios verificables",
      "texto_principal":"AVANZA CON CLARIDAD",
      "texto_secundario":"Método, práctica y acompañamiento",
      "cta":"Conoce el programa",
      "text_render_mode":"layered",
      "art_direction":{
        "decision_visual_fuerte":"persona trabajando frente a una ruta visual simple con tres apoyos editoriales",
        "iluminacion":"luz natural lateral, contraste suave",
        "camara_y_encuadre":"plano medio con espacio negativo para los beneficios",
        "superficie_y_entorno":"espacio de trabajo real y ordenado",
        "props":"cuaderno y un dispositivo, máximo dos",
        "tratamiento_color":"paleta de marca más un neutro"
      }
    }'::jsonb,
    'neutral_catalog_v1',
    true
  ),
  (
    'producto_heroe_editorial',
    'global',
    '{
      "concepto":"Objeto funcional presentado con escala heroica y tres razones concretas para elegirlo",
      "texto_principal":"HECHO PARA DURAR",
      "texto_secundario":"Diseño, función y materiales",
      "cta":"Conoce más",
      "text_render_mode":"layered",
      "art_direction":{
        "decision_visual_fuerte":"objeto real de gran escala sobre una superficie arquitectónica",
        "iluminacion":"luz comercial direccional con sombra de contacto",
        "camara_y_encuadre":"frontal bajo, objeto ocupando la mitad del lienzo",
        "superficie_y_entorno":"set de estudio sobrio de una sola decisión cromática",
        "props":"un elemento funcional relacionado con el uso",
        "tratamiento_color":"color de marca con materiales naturales"
      }
    }'::jsonb,
    'neutral_catalog_v1',
    true
  ),
  (
    'checklist_toggles',
    'global',
    '{
      "concepto":"Una solución digital explicada con una interfaz central y criterios de decisión simples",
      "texto_principal":"TODO EN UN LUGAR",
      "texto_secundario":"Organiza, decide y avanza",
      "cta":"Ver cómo funciona",
      "text_render_mode":"layered",
      "art_direction":{
        "decision_visual_fuerte":"interfaz real sobre dispositivo con toggles editoriales de apoyo",
        "iluminacion":"luz de estudio suave con reflejos controlados",
        "camara_y_encuadre":"dispositivo frontal al centro y aire amplio alrededor",
        "superficie_y_entorno":"escritorio neutro coherente con la marca",
        "props":"ninguno fuera del dispositivo",
        "tratamiento_color":"paleta de marca más fondo neutro"
      }
    }'::jsonb,
    'neutral_catalog_v1',
    true
  );
