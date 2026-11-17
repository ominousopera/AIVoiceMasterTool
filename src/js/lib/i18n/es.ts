/** Spanish translation dictionary — same key convention as `ru.ts` (key is
 *  the exact English source string, see `./index.ts`'s header comment).
 *  Keys are grouped roughly by source file (main.tsx, Waveform.tsx,
 *  analyze.ts's `MODES`, guideText.ts, bridge/main.tsx, hostMessages.ts)
 *  and by topic; the order has no meaning. scripts/check-i18n.mjs lists
 *  keys missing here. A key missing here just falls back to English —
 *  never a crash, never a blank string.
 *
 *  Deliberately NOT translated (left to fall back to English on purpose):
 *  the product name "AI Voice Master Tool", third-party proper nouns
 *  (ElevenLabs, Kokoro, OpenAI, Claude/Anthropic, Kilohearts AB, kHs Pitch
 *  Shifter), and the stylized feature names "J/L Pacing" / "J/L Cut" — see
 *  `ru.ts`'s identical header note for the reasoning.
 */
export const es: Record<string, string> = {
  "This is the key's ID, not the key itself. ElevenLabs shows the key, which starts with sk_, only once, when it is created. Create a new key there and paste that one.":
    "Este es el ID de la clave, no la clave en sí. ElevenLabs muestra la clave, que empieza por sk_, una sola vez, al crearla. Crea allí una clave nueva y pega esa.",
  "Not enough ElevenLabs credits for this request.": "No hay suficientes créditos de ElevenLabs para esta solicitud.",
  "This key works, but it isn't allowed to do this. In ElevenLabs, turn on the permission named below in the key's settings, or create a key with full access.":
    "La clave funciona, pero no tiene permiso para esto. En ElevenLabs, activa en la configuración de la clave el permiso indicado abajo, o crea una clave con acceso completo.",
  "No pause in this clip is long enough for {mode}: the detector found {count}, the longest is {longest} s, and {mode} only cuts pauses longer than about {min} s. Aggressive does cut this clip, or you can set your own minimum pause in Advanced.":
    "Ninguna pausa de este clip es lo bastante larga para «{mode}»: el detector encontró {count}, la más larga dura {longest} s, y «{mode}» solo corta pausas de más de unos {min} s. El modo agresivo sí corta este clip, o puedes definir tu propia pausa mínima en «Avanzado».",
  "No pause in this clip is long enough for {mode}: the detector found {count}, the longest is {longest} s, and {mode} only cuts pauses longer than about {min} s. To cut them anyway, set your own minimum pause in Advanced.":
    "Ninguna pausa de este clip es lo bastante larga para «{mode}»: el detector encontró {count}, la más larga dura {longest} s, y «{mode}» solo corta pausas de más de unos {min} s. Para cortarlas igualmente, define tu propia pausa mínima en «Avanzado».",
  "Invalid API key — double-check it was copied correctly.": "Clave de API no válida — comprueba que se copió correctamente.",
  "This API key doesn't have permission for this request — check your account's plan/scopes.":
    "Esta clave de API no tiene permiso para esta solicitud — revisa el plan o los permisos de tu cuenta.",
  "Rate limit or quota exceeded — wait a moment and try again, or check your usage/billing.":
    "Límite de solicitudes o cuota superado — espera un momento y vuelve a intentarlo, o revisa tu uso o facturación.",
  "Unknown error.": "Error desconocido.",
  "Filter voices…": "Filtrar voces…",
  "No matches.": "Sin coincidencias.",
  "Remove from favorites": "Quitar de favoritos",
  "Add to favorites": "Añadir a favoritos",
  "Working…": "Procesando…",
  "My Voices": "Mis voces",
  "Stock voices": "Voces predeterminadas",
  "English (US)": "Inglés (EE. UU.)",
  "English (UK)": "Inglés (Reino Unido)",
  "Spanish": "Español",
  "French": "Francés",
  "Hindi": "Hindi",
  "Italian": "Italiano",
  "Portuguese (Brazil)": "Portugués (Brasil)",
  "All languages": "Todos los idiomas",
  "No voices returned for this key — check it's correct and active.":
    "No se encontraron voces para esta clave — comprueba que sea correcta y esté activa.",
  "Kokoro model failed to load{detail}.": "No se pudo cargar el modelo Kokoro{detail}.",
  "Scanning audio…": "Analizando audio…",
  "Selected clip has no linked media file on disk.": "El clip seleccionado no tiene un archivo de medios vinculado en el disco.",
  "Cutting silence…": "Cortando silencios…",
  "Undoing Cut…": "Deshaciendo el corte…",
  "Making J/L Cut…": "Aplicando J/L Cut…",
  "Resetting J/L Cut…": "Restableciendo J/L Cut…",
  "Applying Speed…": "Aplicando velocidad…",
  'Improved text was generated, but you edited the script while waiting — your edit was kept and the improvement wasn\'t applied. Run "Improve for voice" again if you still want it.':
    "Se generó el texto mejorado, pero editaste el guion mientras esperabas — se conservó tu edición y la mejora no se aplicó. Vuelve a ejecutar «Mejorar para voz» si aún la quieres.",
  "Generating voice-over…": "Generando locución…",
  "No items generated successfully — nothing to place on the timeline.":
    "Ningún elemento se generó correctamente — no hay nada que colocar en la línea de tiempo.",
  "Converting voice…": "Convirtiendo voz…",
  "Rendering selected clip…": "Renderizando el clip seleccionado…",
  "Waiting for the render to finish writing…": "Esperando a que el renderizado termine de escribirse…",
  "Placing on timeline…": "Colocando en la línea de tiempo…",
  "Sending to After Effects…": "Enviando a After Effects…",
  "Rendering full timeline for After Effects…": "Renderizando toda la línea de tiempo para After Effects…",
  "Waiting for Premiere to finish rendering the full timeline…": "Esperando a que Premiere termine de renderizar toda la línea de tiempo…",
  "Replacing the original pieces with the rendered clip…": "Reemplazando los fragmentos originales por el clip renderizado…",
  "Running diagnostics…": "Ejecutando diagnóstico…",
  "Clearing data…": "Borrando datos…",
  "Aggressive": "Agresivo",
  "Normal": "Normal",
  "Gentle": "Suave",
  "Diagnostics & feedback": "Diagnóstico y comentarios",
  "Guide / FAQ": "Guía / Preguntas frecuentes",
  "Language": "Idioma",
  "Save Renders": "Guardar renderizados",
  "Documents": "Documentos",
  "Next to project": "Junto al proyecto",
  '"Next to project" saves beside your .prproj file instead of Documents, and survives "Clear all data" below (which never touches the project folder).':
    "«Junto al proyecto» guarda los archivos junto a tu archivo .prproj en lugar de en Documentos, y no se elimina con «Borrar todos los datos» de abajo (que nunca toca la carpeta del proyecto).",
  "Clearing…": "Borrando…",
  "Clear all data": "Borrar todos los datos",
  'Deletes everything under "AI Voice Master Tool" in Documents — Renders, voice-overs, Diagnostics reports — and your API keys, presets and settings. Any generated clip already on your timeline goes offline immediately (Premiere links to that file by path).':
    "Elimina todo lo que hay en «AI Voice Master Tool» dentro de Documentos — renderizados, locuciones, informes de diagnóstico — y también tus claves de API, ajustes preestablecidos y ajustes. Cualquier clip generado que ya esté en tu línea de tiempo queda sin conexión de inmediato (Premiere enlaza ese archivo por ruta).",
  "Cleared.": "Datos borrados.",
  "Some files couldn't be removed (in use elsewhere?) — check {path}.":
    "No se pudieron eliminar algunos archivos (¿en uso en otro lugar?) — revisa {path}.",
  "Running…": "Ejecutando…",
  "Run Diagnostics": "Ejecutar diagnóstico",
  "Saves a troubleshooting report to your Documents folder.": "Guarda un informe de solución de problemas en tu carpeta Documentos.",
  "Saved to": "Guardado en",
  "Give Feedback": "Enviar comentarios",
  "License": "Licencia",
  "Licenses / Third-party notices": "Licencias / avisos de terceros",
  "secure build": "compilación segura",
  "dev build": "compilación de desarrollo",
  "Also removes your API keys, presets and settings from this computer. The plugin then restarts as on first install.":
    "También elimina de este equipo tus claves de API, ajustes preestablecidos y ajustes. Después, el plugin se reinicia como en la primera instalación.",
  "To undo this, use Cmd/Ctrl+Z in Premiere.": "Para deshacerlo, usa Cmd/Ctrl+Z en Premiere.",
  "A generated clip is no longer on the timeline — nothing to remove there.":
    "Un clip generado ya no está en la línea de tiempo — no hay nada que quitar.",
  "A generated clip now plays a different file — it was left on the timeline.":
    "Un clip generado ahora reproduce otro archivo — se dejó en la línea de tiempo.",
  "The original take could not be found to turn it back on. Select it and choose Clip > Enable in Premiere.":
    "No se encontró la toma original para volver a activarla. Selecciónala y elige Clip > Habilitar (Clip > Enable) en Premiere.",
  "Removing a generated clip failed ({p0}).": "No se pudo quitar un clip generado ({p0}).",
  "Turning the original take back on failed ({p0}).": "No se pudo volver a activar la toma original ({p0}).",
  "A generated clip could not be removed — it is still on the timeline.":
    "No se pudo quitar un clip generado — sigue en la línea de tiempo.",
  "The original take was left muted because the new take is still on the timeline. Remove the new take by hand, then select the original and choose Clip > Enable in Premiere.":
    "La toma original se dejó silenciada porque la toma nueva sigue en la línea de tiempo. Quita la toma nueva a mano, luego selecciona la original y elige Clip > Habilitar (Clip > Enable) en Premiere.",
  'Cannot place: this batch\'s earlier clips were placed in the sequence "{p0}". Open that sequence, then click Generate All again; the generated lines are kept. Nothing was placed.':
    "No se puede colocar: los clips anteriores de este lote se colocaron en la secuencia «{p0}». Abre esa secuencia y vuelve a pulsar «Generar todo»; las líneas generadas se conservan. No se colocó nada.",
  'This batch\'s earlier clips were placed in the sequence "{p0}". Open that sequence, then click Generate All again. Nothing was generated.':
    "Los clips anteriores de este lote se colocaron en la secuencia «{p0}». Abre esa secuencia y vuelve a pulsar «Generar todo». No se generó nada.",
  "Natural pitch: Premiere did not remove the original audio of piece {p0} ({p1}). Putting the originals back failed too: {p2} of {p3} original piece(s) went back{p4}. Check that stretch of the timeline in Premiere, or use Cmd/Ctrl+Z there to step back. Nothing else was replaced.":
    "Tono natural: Premiere no quitó el audio original del fragmento {p0} ({p1}). Tampoco se pudieron devolver los originales: volvieron {p2} de {p3} fragmentos originales{p4}. Revisa ese tramo de la línea de tiempo en Premiere o retrocede allí con Cmd/Ctrl+Z. No se reemplazó nada más.",
  "Natural pitch: Premiere rejected placing the audio for piece {p0}{p1}. Putting the originals back failed too: {p2} of {p3} original piece(s) went back{p4}. Check that stretch of the timeline in Premiere, or use Cmd/Ctrl+Z there to step back. Nothing else was replaced.":
    "Tono natural: Premiere rechazó colocar el audio del fragmento {p0}{p1}. Tampoco se pudieron devolver los originales: volvieron {p2} de {p3} fragmentos originales{p4}. Revisa ese tramo de la línea de tiempo en Premiere o retrocede allí con Cmd/Ctrl+Z. No se reemplazó nada más.",
  "Natural pitch: Premiere did not remove the original audio of piece {p0} ({p1}). Every original piece went back, but not exactly as before ({p2}). Check that stretch of the timeline in Premiere, or use Cmd/Ctrl+Z there to step back. Nothing else was replaced.":
    "Tono natural: Premiere no quitó el audio original del fragmento {p0} ({p1}). Todos los fragmentos originales volvieron, pero no exactamente como estaban ({p2}). Revisa ese tramo de la línea de tiempo en Premiere o retrocede allí con Cmd/Ctrl+Z. No se reemplazó nada más.",
  "Natural pitch: Premiere rejected placing the audio for piece {p0}{p1}. Every original piece went back, but not exactly as before ({p2}). Check that stretch of the timeline in Premiere, or use Cmd/Ctrl+Z there to step back. Nothing else was replaced.":
    "Tono natural: Premiere rechazó colocar el audio del fragmento {p0}{p1}. Todos los fragmentos originales volvieron, pero no exactamente como estaban ({p2}). Revisa ese tramo de la línea de tiempo en Premiere o retrocede allí con Cmd/Ctrl+Z. No se reemplazó nada más.",
  "Premiere Pro applied less than {p0}% to {p1} piece(s) (lowest {p2}%). They still play all of their audio, at that lower speed.":
    "Premiere Pro no aplicó el {p0}% completo a {p1} fragmento(s) (el más lento: {p2}%). Suenan enteros, solo que más lentos.",
  "Premiere Pro put back less than the earlier Speed on {p0} piece(s) (lowest {p1}% of it). They still play all of their audio, at that lower speed.":
    "Premiere Pro no devolvió toda la velocidad anterior a {p0} fragmento(s) (el más lento: {p1}% de ella). Suenan enteros, solo que más lentos.",
  "Premiere Pro restored the clip at {p0}% instead of {p1}%. It still plays all of its audio, at that lower speed.":
    "Premiere Pro restauró el clip al {p0}% en lugar del {p1}%. Suena entero, solo que más lento.",
  "{p0} piece(s) could not be linked to their video again. Select each one with its video and use Clip > Link.":
    "{p0} fragmento(s) no se pudieron volver a vincular con su vídeo. Selecciona cada uno con su vídeo y usa Clip > Vincular (Clip > Link).",
  "Could not unlock audio track {p0} after placing audio ({p1}). Unlock it by hand.":
    "No se pudo desbloquear la pista de audio {p0} después de colocar el audio ({p1}). Desbloquéala a mano.",
  "Placing the audio also added a copy of another of its channels on audio track {p0} at {p1}s, and it could not be removed ({p2}). Delete that clip by hand.":
    "Al colocar el audio se añadió una copia de otro de sus canales en la pista de audio {p0} en {p1} s y no se pudo quitar ({p2}). Borra ese clip a mano.",
  "Could not unlock video track {p0} after placing video ({p1}). Unlock it by hand.":
    "No se pudo desbloquear la pista de vídeo {p0} después de colocar el vídeo ({p1}). Desbloquéala a mano.",
  "Placing the video also added a copy of another of its channels on video track {p0} at {p1}s, and it could not be removed ({p2}). Delete that clip by hand.":
    "Al colocar el vídeo se añadió una copia de otro de sus canales en la pista de vídeo {p0} en {p1} s y no se pudo quitar ({p2}). Borra ese clip a mano.",
  "Could not unlock audio track {p0} after placing video ({p1}). Unlock it by hand.":
    "No se pudo desbloquear la pista de audio {p0} después de colocar el vídeo ({p1}). Desbloquéala a mano.",
  "Placing the video also added a copy of its audio at {p0}s, and it could not be removed ({p1}). Delete that audio clip by hand.":
    "Al colocar el vídeo se añadió una copia de su audio en {p0} s y no se pudo quitar ({p1}). Borra ese clip de audio a mano.",
  "Could not unlock video track {p0} after placing audio ({p1}). Unlock it by hand.":
    "No se pudo desbloquear la pista de vídeo {p0} después de colocar el audio ({p1}). Desbloquéala a mano.",
  "Placing the audio also added a copy of its video at {p0}s, and it could not be removed ({p1}). Delete that video clip by hand.":
    "Al colocar el audio se añadió una copia de su vídeo en {p0} s y no se pudo quitar ({p1}). Borra ese clip de vídeo a mano.",
  'Could not unlock track "{p0}" after cutting ({p1}). Unlock it by hand.':
    "No se pudo desbloquear la pista «{p0}» después de cortar ({p1}). Desbloquéala a mano.",
  "{p0} restored piece(s) could not be linked to their video again.":
    "Fragmentos restaurados que no se pudieron volver a vincular con su vídeo: {p0}.",
  'Cannot undo: this voice-over was placed in the sequence "{p0}". Open that sequence, then try again. Nothing was changed.':
    "No se puede deshacer: esta locución se colocó en la secuencia «{p0}». Abre esa secuencia e inténtalo de nuevo. No se cambió nada.",
  "Cannot undo: audio track {p0} is locked. Unlock it, then try again. Nothing was changed.":
    "No se puede deshacer: la pista de audio {p0} está bloqueada. Desbloquéala e inténtalo de nuevo. No se cambió nada.",
  "Natural pitch: Premiere did not remove the original audio of piece {p0} ({p1}). Everything was put back; nothing was replaced. Try again, or check that stretch of the timeline in Premiere.":
    "Tono natural: Premiere no quitó el audio original del fragmento {p0} ({p1}). Todo se devolvió; no se reemplazó nada. Inténtalo de nuevo o revisa ese tramo de la línea de tiempo en Premiere.",
  "the clip is still on the timeline": "el clip sigue en la línea de tiempo",
  "The rendered audio is larger than 4 GB, more than a WAV file can hold. Select fewer pieces from this source, or a shorter stretch, and try again.":
    "El audio renderizado ocupa más de 4 GB, más de lo que admite un archivo WAV. Selecciona menos fragmentos de esta fuente, o un tramo más corto, e inténtalo de nuevo.",
  "{p0} original piece(s) would land on other clips that were moved there after the replace step (for example by J/L Pacing) — nothing was changed. Click Reset in J/L Pacing, or move those clips, then try again.":
    "{p0} fragmento(s) originales caerían sobre otros clips movidos allí después del reemplazo (por ejemplo, por J/L Pacing) — no se cambió nada. Pulsa «Restablecer» en J/L Pacing o mueve esos clips e inténtalo de nuevo.",
  'Audio track {p0} already has a clip where the new take would go ("{p1}", {p2}s–{p3}s) — nothing was replaced, to avoid overwriting it. Free that stretch of the track, then try again.':
    "La pista de audio {p0} ya tiene un clip donde iría la nueva toma («{p1}», {p2}–{p3} s) — no se reemplazó nada, para no sobrescribirlo. Libera ese tramo de la pista e inténtalo de nuevo.",
  "The rewrite stopped before the end, most likely because the text is too long for one pass. Your text was left unchanged — split it into shorter parts and improve each one.":
    "La reescritura se cortó antes del final, probablemente porque el texto es demasiado largo para una sola pasada. Tu texto no se modificó: divídelo en partes más cortas y mejora cada una.",
  "OpenAI did not finish the rewrite. Your text was left unchanged.": "OpenAI no terminó la reescritura. Tu texto no se modificó.",
  "Claude did not finish the rewrite. Your text was left unchanged.": "Claude no terminó la reescritura. Tu texto no se modificó.",
  "release build": "compilación de lanzamiento",
  "Silence Cut": "Corte de silencios",
  "Pacing": "Ritmo",
  "AI Voice": "Voz IA",
  "Send to AE": "Enviar a AE",
  "Scanning…": "Analizando…",
  "SCAN CLIP": "ANALIZAR CLIP",
  "Select one clip on the timeline, then click Scan Clip.": "Selecciona un clip en la línea de tiempo y luego pulsa «Analizar clip».",
  '"{name}" has {count} separate audio tracks. The plugin works with files that have one mono or stereo audio track: export the voice as a mono file (File > Export > Media, Audio > Channels: Mono), import it and use that clip.':
    "«{name}» tiene {count} pistas de audio separadas. El plugin trabaja con archivos que tienen una sola pista de audio mono o estéreo: exporta la voz en mono (File > Export > Media, sección Audio, Channels: Mono), impórtala y usa ese clip.",
  '"{name}" has {count} audio channels. The plugin works with mono and stereo files: export the voice as a mono file (File > Export > Media, Audio > Channels: Mono), import it and use that clip.':
    "«{name}» tiene {count} canales de audio. El plugin trabaja con archivos mono y estéreo: exporta la voz en mono (File > Export > Media, sección Audio, Channels: Mono), impórtala y usa ese clip.",
  "Scan a clip first.": "Primero analiza un clip.",
  "The sequence runs at {seqFps} fps and the clip at {srcFps} fps, so audio and video may drift. Consider a {srcFps} fps sequence.":
    "La secuencia va a {seqFps} fps y el clip a {srcFps} fps, así que el audio y el vídeo pueden desincronizarse. Considera una secuencia a {srcFps} fps.",
  'Nothing is currently selected on the timeline (or more than one clip) — this is still showing the last Scan\'s results for "{name}". Re-select it before cutting.':
    "No hay nada seleccionado en la línea de tiempo (o hay más de un clip) — esto sigue mostrando los resultados del último análisis para «{name}». Vuelve a seleccionarlo antes de cortar.",
  'Selected clip has changed since Scan (was "{prev}", now "{current}") — Cut would apply to what\'s selected now, not what was analyzed. Scan again before cutting.':
    "El clip seleccionado cambió desde el análisis (era «{prev}», ahora es «{current}») — el corte se aplicaría a lo seleccionado ahora, no a lo analizado. Vuelve a analizar antes de cortar.",
  "This clip's Speed has changed since Scan (was {prev}%, now {current}%) — Cut should still apply correctly (Scan's own analysis doesn't depend on Speed), but Scan again first if the cut looks wrong.":
    "La velocidad de este clip cambió desde el análisis (era {prev}%, ahora es {current}%) — el corte debería seguir aplicándose correctamente (el análisis no depende de la velocidad), pero vuelve a analizar si el resultado no se ve bien.",
  "Sequence audio was mono — Cut switched it to stereo so audio plugins can be applied; levels or panning may sound different afterwards.":
    "El audio de la secuencia era mono — el corte lo cambió a estéreo para poder aplicar plugins de audio; los niveles o el paneo pueden sonar distintos después.",
  "duration": "duración",
  "noise": "ruido",
  "speech": "voz",
  "segments": "segmentos",
  "Speech detection:": "Detección de voz:",
  "level-based fallback": "modo de respaldo por nivel",
  "AI model": "modelo de IA",
  "Word check:": "Comprobación de palabras:",
  "on (words: {count})": "activado (palabras: {count})",
  "unavailable": "no disponible",
  "Automatic": "Automático",
  "Advanced": "Avanzado",
  "Segments: {count} · cuts {pct}": "Segmentos: {count} · corta {pct}",
  "noise {floor} · speech {speech}": "ruido {floor} · voz {speech}",
  "cut threshold: {value}": "umbral de corte: {value}",
  "min. silence: {value}s": "silencio mín.: {value} s",
  "Local threshold safety check": "Verificación de umbral local",
  "Presets": "Preajustes",
  "name this preset": "nombre del preajuste",
  "Save": "Guardar",
  "Preview": "Vista previa",
  "Cutting…": "Cortando…",
  "CUT": "CORTAR",
  "Undo": "Deshacer",
  "Segments cut: {count}.": "Segmentos cortados: {count}.",
  // ExtendScript-originated warning, translated through main.tsx's
  // translateWarning pattern match (see its doc comment), since ppro.ts has no
  // access to this dictionary. The placeholder must stay {clipName}, matching
  // translateWarning's substitution exactly.
  'Note: a clip from another file ("{clipName}") is close to this Cut on the same track. J/L Pacing on either file may be blocked later as a safety measure. If you plan to use J/L Pacing on either one, do it now, before cutting anything else nearby, or leave more space between the files\' cuts (or use a different track).':
    "Nota: un clip de otro archivo («{clipName}») está cerca de este corte en la misma pista. Más tarde, J/L Pacing en cualquiera de los dos archivos podría bloquearse como medida de seguridad. Si piensas usar J/L Pacing en alguno de ellos, hazlo ahora, antes de cortar algo más cerca, o deja más espacio entre los cortes de los archivos (o usa otra pista).",
  "Note: these pieces now sit at {currentSec}s, far from where Cut placed them ({originalSec}s), so they were rebuilt where they are now, not moved back.":
    "Nota: estos fragmentos ahora están en {currentSec} s, lejos de donde el corte los colocó ({originalSec} s), así que se reconstruyeron donde están ahora, sin moverlos de vuelta.",
  "J/L Pacing has run since this Cut. To use Undo again, select every piece of this Cut and click Reset in the Pacing tab; or use Cmd/Ctrl+Z repeatedly to go back to before Cut.":
    "Se aplicó J/L Pacing después de este corte. Para volver a usar «Deshacer», selecciona todos los fragmentos de este corte y haz clic en «Restablecer» en la pestaña Ritmo; o usa Cmd/Ctrl+Z varias veces para volver a antes del corte.",
  "J/L Pacing": "J/L Pacing",
  "Works on the pieces a Cut created — run Cut in Silence Cut, or just select already-cut pieces directly on the timeline (e.g. after reopening this project).":
    "Funciona con los fragmentos que crea un corte — ejecuta el corte en Corte de silencios, o simplemente selecciona fragmentos ya cortados directamente en la línea de tiempo (por ejemplo, tras reabrir este proyecto).",
  'Working on: pieces cut from "{name}" earlier this session.': "Trabajando con: fragmentos cortados de «{name}» antes en esta sesión.",
  "Select at least 2 of the pieces Cut just made (they're left selected right after Cut).":
    "Selecciona al menos 2 de los fragmentos que acaba de crear el corte (quedan seleccionados justo después de cortar).",
  "Tightest pacing: the longest overlaps (recommended).": "El ritmo más ajustado: los solapamientos más largos (recomendado).",
  "Balanced: clear pacing, with shorter overlaps than Aggressive.":
    "Equilibrado: un ritmo claramente más ágil, con solapamientos más cortos que en «Agresivo».",
  "Lightest: small overlaps only where the audio allows them, plus a short fade at each edit.":
    "El más ligero: solapamientos pequeños solo donde el audio lo permite, más un fundido corto en cada punto de edición.",
  "Make J/L Cut": "Aplicar J/L Cut",
  "Reset": "Restablecer",
  "{pieces} pieces · {overlaps} boundaries overlapped · {fades} fades applied.":
    "{pieces} fragmentos · {overlaps} límites solapados · {fades} fundidos aplicados.",
  "Speed %": "Velocidad, %",
  "Above 105%, AI voice often picks up audible artifacts. Stay at 105% or below, or correct the pitch with Pitch correction below.":
    "Por encima del 105%, la voz IA suele presentar artefactos audibles. Quédate en el 105% o por debajo, o corrige el tono con «Corrección de tono» más abajo.",
  "Applying…": "Aplicando…",
  "Apply Speed": "Aplicar velocidad",
  "Speed applied to {count} clip(s).": "Velocidad aplicada a {count} clip(s).",
  "Pitch correction": "Corrección de tono",
  "{count} clip(s) already at 100% speed — skipped.": "{count} clip(s) ya al 100% de velocidad — omitidos.",
  "Read from selected clip": "Leer del clip seleccionado",
  "values for Speed % above — type into your plugin's own controls":
    "valores para el campo «Velocidad, %» de arriba — escríbelos en los controles propios de tu plugin",
  "{semitones} semitones · {cents} cents · Ratio {ratio}": "{semitones} semitonos · {cents} cents · Ratio {ratio}",
  "Speed % above is at 100 — nothing to compute yet.": "La velocidad de arriba está en 100 — todavía no hay nada que calcular.",
  "Recommended:": "Recomendado:",
  "(Kilohearts AB,": "(Kilohearts AB,",
  ") — open its Pitch slider (shown in semitones) and type the semitones value above. Premiere's scripting can't set a third-party plugin's controls reliably, so type the value into the plugin's own window. This is an independent recommendation, not a partnership, sponsorship, or endorsement by Kilohearts AB — AI Voice Master Tool doesn't bundle, download, or install it; get it directly from them under their own terms.":
    ") — abre su deslizador Pitch (mostrado en semitonos) y escribe el valor de semitonos de arriba. Los scripts de Premiere no pueden ajustar de forma fiable los controles de un plugin de terceros, así que escribe el valor en la propia ventana del plugin. Esta es una recomendación independiente, no una asociación, patrocinio ni respaldo de Kilohearts AB — AI Voice Master Tool no lo incluye, descarga ni instala; consíguelo directamente de ellos bajo sus propios términos.",
  "Render full timeline for AE": "Renderizar toda la línea de tiempo para AE",
  'Pitch, and any other effect besides Speed and J/L Pacing, exists only inside Premiere, so "Send to After Effects" (the Send to AE tab) refuses it. Finish your cut, pacing, speed and pitch edits, then click this: it bakes the selected audio span into one file (audio tracks without selected pieces, such as music, are muted for the render) and puts it on the timeline in place of the pieces. The render includes the track\'s fader and effects and the Master, which then apply to the new clip again: set them to their defaults first, or mix afterward. Then click "Send to After Effects" as usual. Video is not baked and is sent separately.':
    "El tono, como cualquier otro efecto aparte de velocidad y J/L Pacing, solo existe dentro de Premiere, así que «Enviar a After Effects» (la pestaña Enviar a AE) se niega a enviarlo. Termina tus ediciones de corte, ritmo, velocidad y tono y pulsa este botón: combina el tramo de audio seleccionado en un solo archivo (las pistas de audio sin fragmentos seleccionados, como la música, se silencian durante el renderizado) y lo pone en la línea de tiempo en lugar de los fragmentos. El renderizado incluye el fader y los efectos de la pista y el máster, que luego se aplican otra vez al nuevo clip: ponlos antes en sus valores por defecto, o mezcla después. Luego pulsa «Enviar a After Effects» como de costumbre. El vídeo no se combina y se envía por separado.",
  "Rendering…": "Renderizando…",
  'Replaced {count} piece(s) with one rendered clip at {seconds}s. It is selected: click "Send to After Effects" in the Send to AE tab next.':
    "Se reemplazaron {count} fragmento(s) por un solo clip renderizado en {seconds} s. Está seleccionado: ahora pulsa «Enviar a After Effects» en la pestaña Enviar a AE.",
  "Revert to segments": "Restaurar fragmentos",
  "Reverting…": "Restaurando…",
  "Reverting to the original pieces…": "Restaurando los fragmentos originales…",
  "Restoring Pitch…": "Restaurando el tono…",
  "Restoring Pitch failed: {error}": "No se pudo restaurar el tono: {error}",
  "Reverted to {count} original piece(s).": "Se restauraron {count} fragmento(s) original(es).",
  "Generate a voice-over from text. The result is an ordinary clip: Silence Cut and Pacing work on it as on any other.":
    "Genera una locución a partir de texto. El resultado es un clip normal: Corte de silencios y Ritmo funcionan con él igual que con cualquier otro.",
  "Selected clip was generated with": "El clip seleccionado se generó con",
  "({engine}):": "({engine}):",
  '— text loaded below. Pick a different voice and click "Replace Voice" to swap it in place.':
    "— texto cargado abajo. Elige otra voz y pulsa «Reemplazar voz» para sustituirla en su sitio.",
  '— the Text field below holds other text, so this clip\'s text was not loaded. "Replace Voice" speaks what the Text field holds.':
    "— el campo «Texto» de abajo tiene otro texto, así que no se cargó el texto de este clip. «Reemplazar voz» locuta lo que haya en el campo «Texto».",
  "Load its text": "Cargar su texto",
  'The Text field holds different text from the selected clip. Click "Load its text" above to use the clip\'s own text, or click "Replace Voice" again to speak the Text field\'s text over the clip.':
    "El campo «Texto» tiene un texto distinto del clip seleccionado. Pulsa «Cargar su texto» arriba para usar el texto del clip, o pulsa «Reemplazar voz» otra vez para locutar el texto del campo sobre el clip.",
  "Kokoro (offline)": "Kokoro (sin conexión)",
  "Text to Speech": "Texto a voz",
  "Voice Changer": "Conversor de voz",
  "Batch": "Generación por lotes",
  "ElevenLabs API key": "Clave de API de ElevenLabs",
  "Edit": "Editar",
  "Cancel": "Cancelar",
  "Voice": "Voz",
  "Save an API key first": "Guarda primero una clave de API",
  "Loading voices…": "Cargando voces…",
  "No voices found": "No se encontraron voces",
  "Loading…": "Cargando…",
  "Reload voices": "Recargar voces",
  'Don\'t see a voice you want to use? Add it to your ElevenLabs account first — favorite, clone, or design it at elevenlabs.io or in their own app — then click "Reload voices" above to pick it up here.':
    "¿No ves la voz que quieres usar? Añádela primero a tu cuenta de ElevenLabs — márcala como favorita, clónala o diséñala en elevenlabs.io o en su propia app — y luego pulsa «Recargar voces» arriba para que aparezca aquí.",
  "Model": "Modelo",
  "v2 (stable)": "v2 (estable)",
  "v3 (expressive)": "v3 (expresivo)",
  "Speed: {value}x": "Velocidad: {value}x",
  "Speed of the generation itself — separate from Speed in the Pacing tab, which retimes audio already on the timeline.":
    "Velocidad de la propia generación — independiente de la velocidad de la pestaña Ritmo, que retemporiza el audio que ya está en la línea de tiempo.",
  "Output Quality": "Calidad de salida",
  "Choose a quality": "Elige una calidad",
  "MP3 (compressed)": "MP3 (comprimido)",
  "MP3 · 32 kbps (smallest file)": "MP3 · 32 kbps (archivo más pequeño)",
  "MP3 · 64 kbps": "MP3 · 64 kbps",
  "MP3 · 96 kbps": "MP3 · 96 kbps",
  "MP3 · 128 kbps (default)": "MP3 · 128 kbps (predeterminado)",
  "MP3 · 192 kbps (Creator tier+)": "MP3 · 192 kbps (plan Creator o superior)",
  "WAV (uncompressed)": "WAV (sin comprimir)",
  "WAV · 44.1kHz (lossless, Pro tier+)": "WAV · 44,1 kHz (sin pérdida, plan Pro o superior)",
  "WAV · 48kHz (lossless, may need a higher ElevenLabs plan)": "WAV · 48 kHz (sin pérdida, puede requerir un plan de ElevenLabs superior)",
  "Higher bitrate or WAV sounds clearer but makes a bigger file. 128 kbps MP3 is a good default for voice-over and works on every ElevenLabs plan, including Free. 192 kbps MP3 and WAV need a paid ElevenLabs plan; if your plan doesn't include a format, ElevenLabs returns an error.":
    "Un bitrate más alto o WAV suena más nítido pero genera un archivo más grande. MP3 a 128 kbps es una buena opción por defecto para locuciones y funciona en cualquier plan de ElevenLabs, incluido Free. MP3 a 192 kbps y WAV requieren un plan de pago de ElevenLabs; si tu plan no incluye un formato, ElevenLabs devuelve un error.",
  "Language Override": "Forzar idioma",
  "Auto-detect": "Detección automática",
  "Speaker Boost": "Refuerzo de voz",
  "Boosts similarity to the original voice; generation takes slightly longer. Worth leaving on.":
    "Aumenta la similitud con la voz original; la generación tarda un poco más. Merece la pena dejarlo activado.",
  "Afrikaans": "Afrikáans",
  "Arabic": "Árabe",
  "Armenian": "Armenio",
  "Assamese": "Asamés",
  "Azerbaijani": "Azerbaiyano",
  "Belarusian": "Bielorruso",
  "Bengali": "Bengalí",
  "Bosnian": "Bosnio",
  "Bulgarian": "Búlgaro",
  "Catalan": "Catalán",
  "Croatian": "Croata",
  "Czech": "Checo",
  "Danish": "Danés",
  "Dutch": "Neerlandés",
  "English": "Inglés",
  "Estonian": "Estonio",
  "Finnish": "Finés",
  "Galician": "Gallego",
  "Georgian": "Georgiano",
  "German": "Alemán",
  "Greek": "Griego",
  "Gujarati": "Guyaratí",
  "Hausa": "Hausa",
  "Hebrew": "Hebreo",
  "Hungarian": "Húngaro",
  "Icelandic": "Islandés",
  "Indonesian": "Indonesio",
  "Irish": "Irlandés",
  "Japanese": "Japonés",
  "Javanese": "Javanés",
  "Kannada": "Canarés",
  "Kazakh": "Kazajo",
  "Kirghiz": "Kirguís",
  "Korean": "Coreano",
  "Latvian": "Letón",
  "Lingala": "Lingala",
  "Lithuanian": "Lituano",
  "Luxembourgish": "Luxemburgués",
  "Macedonian": "Macedonio",
  "Malay": "Malayo",
  "Malayalam": "Malayalam",
  "Mandarin Chinese": "Chino mandarín",
  "Marathi": "Maratí",
  "Nepali": "Nepalí",
  "Norwegian": "Noruego",
  "Chichewa": "Chichewa",
  "Pashto": "Pastún",
  "Persian": "Persa",
  "Polish": "Polaco",
  "Portuguese": "Portugués",
  "Punjabi": "Panyabí",
  "Romanian": "Rumano",
  "Russian": "Ruso",
  "Serbian": "Serbio",
  "Sindhi": "Sindhi",
  "Slovak": "Eslovaco",
  "Slovenian": "Esloveno",
  "Somali": "Somalí",
  "Swahili": "Suajili",
  "Swedish": "Sueco",
  "Tamil": "Tamil",
  "Telugu": "Telugu",
  "Thai": "Tailandés",
  "Turkish": "Turco",
  "Ukrainian": "Ucraniano",
  "Urdu": "Urdu",
  "Vietnamese": "Vietnamita",
  "Welsh": "Galés",
  "Kokoro comes with the plugin and runs fully offline, without an API key or internet connection. It has English (American and British), Spanish, French, Hindi, Italian and Brazilian Portuguese voices. It has no fine-grained stability or style sliders like ElevenLabs; the result depends mostly on the voice preset and on clean, well-punctuated text in that voice's language.":
    "Kokoro viene incluido en el plugin y funciona completamente sin conexión, sin clave de API ni internet. Tiene voces en inglés (estadounidense y británico), español, francés, hindi, italiano y portugués de Brasil. No tiene controles finos de estabilidad o estilo como ElevenLabs; el resultado depende sobre todo de la voz elegida y de un texto limpio y bien puntuado en el idioma de esa voz.",
  "Loading model…": "Cargando modelo…",
  "Unavailable": "No disponible",
  "Retry": "Reintentar",
  "Text": "Texto",
  "Type or paste the narration to generate…": "Escribe o pega la narración que quieres generar…",
  "Improving…": "Mejorando…",
  "Improve for voice": "Mejorar para voz",
  "Pacing only": "Solo ritmo",
  "Natural": "Natural",
  "Expressive": "Expresivo",
  "Loading models…": "Cargando modelos…",
  "Choose a model": "Elige un modelo",
  "— using a built-in fallback model instead.": "— se está usando un modelo de respaldo integrado.",
  "Sends your text to OpenAI or Anthropic, whichever you pick, with your own API key, and puts the rewrite back in the Text field: one click instead of copy-pasting your script into ChatGPT or Claude and back. On v2 and Kokoro it changes only wording and punctuation; on v3 and v4, which understand audio tags, it can also add them.":
    "Envía tu texto a OpenAI o Anthropic, el que elijas, con tu propia clave de API, y devuelve la versión reescrita al campo «Texto»: un solo clic en vez de copiar y pegar tu guion en ChatGPT o Claude y volver. En v2 y Kokoro solo cambia la redacción y la puntuación; en v3 y v4, que entienden etiquetas de audio, también puede añadirlas.",
  "Realism": "Realismo",
  "Narration": "Narración",
  "Calm & Steady": "Calmado y estable",
  "Stability: {value}%": "Estabilidad: {value}%",
  "Similarity / Clarity: {value}%": "Similitud / claridad: {value}%",
  "Style: {value}%": "Estilo: {value}%",
  "Hide tips": "Ocultar consejos",
  "Tips for realistic voice": "Consejos para una voz realista",
  "Voice choice matters more than any setting here": "La elección de la voz importa más que cualquier ajuste de aquí",
  "— pick (or clone) a voice whose natural register already matches the delivery you want, rather than forcing a mismatched voice via sliders.":
    "— elige (o clona) una voz cuyo registro natural ya se ajuste a la entonación que quieres, en lugar de forzar una voz que no encaja mediante los deslizadores.",
  "Pacing/pauses": "Ritmo y pausas",
  'come from punctuation — commas, ellipses ("…"), and paragraph breaks are the main lever, on every model. This is generating with ElevenLabs\'':
    "vienen de la puntuación — las comas, los puntos suspensivos («…») y los saltos de párrafo son la palanca principal en todos los modelos. Esto se está generando con el modelo",
  "Voice choice still matters most": "La elección de la voz sigue siendo lo más importante",
  "— audio tags shape an already-fitting voice, they don't fix a mismatched one.":
    "— las etiquetas de audio dan forma a una voz que ya encaja, no arreglan una que no encaja.",
  "Bracket audio tags": "Las etiquetas de audio entre corchetes",
  "like": "como",
  'only register reliably when Realism sits toward the lower/"Creative" end of Stability — the "Expressive" preset above is tuned for this; high stability ("Robust") mostly ignores them.':
    "solo se registran de forma fiable cuando la estabilidad está hacia el extremo bajo («Creative») — el preajuste «Expresivo» de arriba está ajustado para esto; una estabilidad alta («Robust») las ignora en su mayor parte.",
  "still comes from punctuation (ellipses for a pause and weight, CAPS for emphasis) — v3 has no":
    "sigue viniendo de la puntuación (puntos suspensivos para pausa y peso, MAYÚSCULAS para énfasis) — v3 no tiene ninguna etiqueta",
  "tag at all.": "de ese tipo.",
  "Hard-to-pronounce words": "Palabras difíciles de pronunciar",
  "(invented names, foreign words) can be respelled inline with IPA in forward slashes, e.g.":
    "(nombres inventados, palabras extranjeras) pueden reescribirse en línea con AFI entre barras, por ejemplo",
  '— "Improve for voice" applies this automatically when v3 is selected.':
    "— «Mejorar para voz» aplica esto automáticamente cuando se selecciona v3.",
  "Generating…": "Generando…",
  "Generate & Insert": "Generar e insertar",
  "Replacing…": "Reemplazando…",
  "Replace Voice": "Reemplazar voz",
  "Placed at {seconds}s on audio track {track}.": "Colocado en {seconds} s en la pista de audio {track}.",
  "Selected clip": "Clip seleccionado",
  "Selected: {name}": "Seleccionado: {name}",
  "Select one audio clip on the timeline to convert.": "Selecciona un clip de audio en la línea de tiempo para convertir.",
  "Converting…": "Convirtiendo…",
  "Convert Selected Clip's Voice": "Convertir la voz del clip seleccionado",
  "Batch script": "Guion por lotes",
  "One line per clip, e.g.:\nWelcome back to the show.\nToday we're covering three topics.":
    "Una línea por clip, por ejemplo:\nBienvenidos de nuevo al programa.\nHoy vamos a ver tres temas.",
  "Add to Queue": "Añadir a la cola",
  "Clear queue": "Vaciar la cola",
  "Queue ({count})": "Cola ({count})",
  "{count} characters still to generate — roughly {count} ElevenLabs credits at the standard 1 credit/character rate (exact cost depends on your plan and the model used).":
    "{count} caracteres pendientes de generar — aproximadamente {count} créditos de ElevenLabs a la tarifa estándar de 1 crédito/carácter (el coste exacto depende de tu plan y del modelo usado).",
  "Generate All": "Generar todo",
  "{count} clip(s) placed sequentially from the playhead.": "{count} clip(s) colocados en secuencia desde el cabezal de reproducción.",
  "Sending…": "Enviando…",
  "Send to After Effects": "Enviar a After Effects",
  "Sent {count} {kind}": "Enviados {count} {kind}",
  "rendered piece(s)": "fragmento(s) renderizado(s)",
  "segment(s)": "segmento(s)",
  " + {count} video piece(s)": " + {count} fragmento(s) de vídeo",
  'Open After Effects and use the "AI Voice Master Tool Bridge" plugin there to place them.':
    "Abre After Effects y usa allí el plugin «AI Voice Master Tool Bridge» para colocarlos.",
  "Send to AE file written to: {path}": "Archivo de «Enviar a AE» escrito en: {path}",
  "Choose your interface language": "Elige el idioma de la interfaz",
  "You can change this anytime from the gear icon.": "Puedes cambiarlo en cualquier momento desde el icono de engranaje.",
  "Where should rendered audio be saved?": "¿Dónde se debe guardar el audio renderizado?",
  "Rendered audio (Render full timeline, Natural pitch, Voice Changer) and AI Voice's generated voice-overs need somewhere to live on disk. Pick a default now — you can change it anytime from the gear icon.":
    "El audio renderizado (Renderizar toda la línea de tiempo, tono natural, conversor de voz) y las locuciones generadas en Voz IA necesitan un lugar en el disco. Elige una opción predeterminada ahora — puedes cambiarla en cualquier momento desde el icono de engranaje.",
  '"Documents" is the recommended default. "Next to project" saves beside your .prproj file instead, and survives "Clear all data" (which never touches the project folder).':
    "«Documentos» es la opción predeterminada recomendada. «Junto al proyecto» guarda los archivos junto a tu archivo .prproj, y no se elimina con «Borrar todos los datos» (que nunca toca la carpeta del proyecto).",
  "Clear all data?": "¿Borrar todos los datos?",
  'Deletes everything under "AI Voice Master Tool" in Documents — Renders, generated voice-overs, Diagnostics reports, and any pending Send to AE data.':
    "Elimina todo lo que hay en «AI Voice Master Tool» dentro de Documentos — renderizados, locuciones generadas, informes de diagnóstico y cualquier dato pendiente de «Enviar a AE».",
  "If you haven't saved the rendered voice pieces (WAV files) somewhere else yet, they will be permanently lost.":
    "Si aún no has guardado los fragmentos de voz renderizados (archivos WAV) en otro lugar, se perderán de forma permanente.",
  "Any generated voice-over already placed on your timeline goes offline immediately — Premiere links to that file by path, and this deletes it.":
    "Cualquier locución generada que ya esté colocada en tu línea de tiempo queda sin conexión de inmediato — Premiere enlaza ese archivo por ruta, y esta acción lo elimina.",
  "This can't be undone.": "Esto no se puede deshacer.",
  "Delete everything": "Eliminar todo",
  "Open link in your browser?": "¿Abrir el enlace en tu navegador?",
  "This opens": "Esto abre",
  "in your default browser, outside of Premiere.": "en tu navegador predeterminado, fuera de Premiere.",
  "in your default browser, outside of After Effects.": "en tu navegador predeterminado, fuera de After Effects.",
  "Remember my choice": "Recordar mi elección",
  "Open": "Abrir",
  "Close": "Cerrar",
  "Kept": "Conservado",
  "Cut": "Cortado",
  "Play": "Reproducir",
  "Pause": "Pausa",
  "Click to seek": "Clic para saltar a ese punto",
  "Undo last preview edit": "Deshacer la última edición de la vista previa",
  "Zoom out": "Alejar",
  "Zoom in": "Acercar",
  "Fit to width": "Ajustar al ancho",
  "Uncertain edge — worth a quick listen": "Borde dudoso — conviene escucharlo rápido",
  // Short legend-label form of the tooltip above (a static, always-visible
  // legend entry).
  "Uncertain edge": "Borde dudoso",
  "Interaction mode": "Modo de interacción",
  "Edit mode — click a region to toggle keep/cut": "Modo edición — clic en un tramo alterna conservar/cortar",
  "Seek mode — click anywhere to move the playhead": "Modo desplazamiento — clic en cualquier lugar mueve el cabezal",

  // analyze.ts MODES: detection-mode picker cards. Translations follow the
  // English descriptions exactly.
  "Mode 1 — Aggressive (recommended)": "Modo 1 — Agresivo (recomendado)",
  "Tightest cut: catches short pauses the other modes leave alone, for maximum pacing. Breaths between phrases are cut like any other pause; best for fast-cut, high-density content.":
    "El corte más ajustado: capta pausas breves que los otros modos dejan pasar, para un ritmo máximo. Las respiraciones entre frases se cortan como cualquier otra pausa. Ideal para contenido de corte rápido y alta densidad.",
  "Mode 2 — Normal": "Modo 2 — Normal",
  "Tight, punchy cut — removes brief pauses for brisk pacing while keeping natural speech rhythm. A good middle ground for most content.":
    "Corte ajustado y enérgico — elimina pausas breves para un ritmo ágil, conservando el ritmo natural del habla. Un buen término medio para la mayoría de los contenidos.",
  "Mode 3 — Gentle": "Modo 3 — Suave",
  "Balanced, moderate touch — removes clear dead air while preserving natural speech rhythm and breathing. Best for interviews/podcasts or careful content.":
    "Toque equilibrado y moderado — elimina silencios evidentes conservando el ritmo natural del habla y la respiración. Ideal para entrevistas/pódcast o contenido cuidadoso.",

  // guideText.ts — "Guide / FAQ" modal
  "AI Voice Master Tool guide": "Guía de AI Voice Master Tool",
  "Silence Cut: Scan": "Corte de silencios: Analizar",
  "Scan reads the source media of the one clip selected on your timeline and finds where speech starts and stops, using a voice-activity model that runs on your computer. It then runs a local speech-to-text pass to check that no cut lands in the middle of a word. That check can only make a kept region longer, to cover a word that would otherwise be split, and it does so only where there is real audio at that spot, not silence.":
    "El análisis lee el medio de origen del único clip seleccionado en tu línea de tiempo y encuentra dónde empieza y termina el habla, con un modelo de detección de voz que se ejecuta en tu equipo. Después hace un paso local de voz a texto para comprobar que ningún corte cae en medio de una palabra. Esa comprobación solo puede alargar una región conservada, para cubrir una palabra que quedaría partida, y solo lo hace donde hay audio real en ese punto, no silencio.",
  "Silence Cut: Automatic and Advanced detection": "Corte de silencios: detección automática y avanzada",
  "Automatic picks from 3 ready-made sensitivity presets. Advanced lets you set the exact silence threshold and minimum pause length by hand, with a live preview of the result, and save them as presets.":
    "«Automático» elige entre 3 preajustes de sensibilidad ya listos. «Avanzado» permite fijar a mano el umbral de silencio exacto y la duración mínima de pausa, con una vista previa del resultado en tiempo real, y guardarlos como preajustes.",
  "Cut threshold: audio quieter than this counts as silence. A more negative value cuts only near-total silence; a value closer to 0 cuts more, including quiet breaths.":
    "Umbral de corte: el audio más bajo que este valor cuenta como silencio. Un valor más negativo solo corta el silencio casi total; un valor más cerca de 0 corta más, incluidas las respiraciones suaves.",
  "Min. silence: how long a quiet patch must last before it gets cut. Lower catches tiny pauses between words; higher only cuts clearly dead air.":
    "Silencio mín.: cuánto debe durar un tramo silencioso antes de cortarse. Un valor menor detecta pausas diminutas entre palabras; uno mayor solo corta pausas claras.",
  "Local threshold safety check (off by default) adds a second threshold, worked out for each region, next to the global one. A moment is cut only if both call it silence, so the check can only save quiet speech that the global threshold might cut by mistake in a clip whose level drifts, for example under a music bed or after a recording-level change partway through. On clean AI-generated voice, where the level stays put, it usually makes no difference; it helps most on mixed or human recordings.":
    "La verificación de umbral local (desactivada por defecto) añade un segundo umbral, calculado para cada región, junto al global. Un momento solo se corta si ambos lo consideran silencio, así que la verificación solo puede salvar voz suave que el umbral global podría cortar por error en un clip con un nivel que fluctúa, por ejemplo bajo una música de fondo o tras un cambio de nivel de grabación a mitad del clip. Con voz IA limpia, donde el nivel no varía, no suele cambiar nada; es más útil en grabaciones mixtas o de personas reales.",
  "Presets: save the current threshold and min. silence under a name to use again later.":
    "Preajustes: guarda el umbral actual y el silencio mín. con un nombre para usarlos más tarde.",
  "Silence Cut: Preview and Cut": "Corte de silencios: vista previa y corte",
  "In the waveform preview, solid amber is kept, hatched is cut, and a small red triangle marks a kept stretch whose edge the plugin is unsure of, worth a quick listen. The toolbar has two modes. In Seek (the arrow, on by default), click anywhere to play from there. In Edit (the razor), click a region to flip it between kept and cut, drag a region's edge to move it, or drag across the waveform to set a whole stretch: a drag that starts in a kept region cuts the stretch, and one that starts in a cut region keeps it. The strip under the waveform always seeks, and the undo arrow reverts the last preview edit. Use +/− to zoom in on a long track for precise edits.":
    "En la vista previa de la forma de onda, el ámbar sólido se conserva, lo rayado se corta, y un pequeño triángulo rojo marca un tramo conservado con un borde del que el plugin no está seguro, que conviene escuchar. La barra de herramientas tiene dos modos. En el modo desplazamiento (la flecha, activo por defecto), haz clic en cualquier punto para reproducir desde ahí. En el modo de edición (la cuchilla), haz clic en una región para alternarla entre conservada y cortada, arrastra el borde de una región para moverlo o arrastra sobre la forma de onda para fijar un tramo entero: si empiezas en una región conservada, el tramo se corta, y si empiezas en una cortada, se conserva. La franja bajo la forma de onda siempre mueve el cabezal, y la flecha de deshacer revierte la última edición de la vista previa. Usa +/− para acercar una pista larga y editar con precisión.",
  "Cut rebuilds the selected clip from the segments shown, removing everything else. The new pieces are left selected, ready for Pacing.":
    "Cortar reconstruye el clip seleccionado a partir de los segmentos mostrados y elimina todo lo demás. Los nuevos fragmentos quedan seleccionados, listos para la pestaña Ritmo.",
  "Undo puts the original, uncut clip back. It rebuilds the clip from the source file instead of stepping back through Premiere's undo history, so effects added to the pieces after the Cut are not kept (the plugin lists them and asks first). It works only in the sequence the Cut was made in, and refuses when another clip now sits where the original goes back. Cmd/Ctrl+Z also works, one step at a time. The button turns off once J/L Pacing has run, because J/L moves pieces onto a second track that this rebuild doesn't clear. To turn it back on, select every piece of the Cut and click Reset in the Pacing tab, or use Cmd/Ctrl+Z.":
    "Deshacer vuelve a poner el clip original sin cortar. Lo reconstruye desde el archivo de origen en lugar de retroceder por el historial de deshacer de Premiere, así que los efectos añadidos a los fragmentos después del corte no se conservan (el plugin los enumera y pregunta antes). Solo funciona en la secuencia donde se hizo el corte, y se niega si ahora hay otro clip donde vuelve el original. Cmd/Ctrl+Z también funciona, un paso a la vez. El botón se desactiva después de ejecutar J/L Pacing, porque J/L mueve fragmentos a una segunda pista que esta reconstrucción no limpia. Para volver a activarlo, selecciona todos los fragmentos del corte y haz clic en «Restablecer» en la pestaña Ritmo, o usa Cmd/Ctrl+Z.",
  "Pacing: J/L Pacing": "Ritmo: J/L Pacing",
  "J/L Pacing is meant for fast-paced short-form content. It pulls each piece slightly earlier, so it starts before the previous one has finished, which tightens the pacing. Pieces alternate onto the audio track directly below, since one track can't hold overlapping clips; it refuses when another clip, such as music, sits where a piece would go. How far a piece moves depends on whether the waveform on both sides of the boundary allows an overlap. Gentle goes by the measurement only and leaves a boundary alone when it doesn't allow one. Aggressive and Normal also apply a minimum overlap where the measurement finds none, which is why they feel tighter. That minimum applies in full on clean synthetic voice and shrinks on noisier recordings, down to nothing on the noisiest, where the waveform can't safely show where a word ends. A boundary with no gap in the source at all, such as a spot you split by hand in the middle of a phrase, is never overlapped, because there is no pause there to overlap into. Every piece also gets a short Premiere fade at its start and end (1 to 5 frames, sized from the audio at that boundary) to avoid a click.":
    "J/L Pacing está pensado para contenido corto de ritmo rápido. Adelanta ligeramente cada fragmento para que empiece antes de que termine el anterior, lo que aprieta el ritmo. Los fragmentos se alternan con la pista de audio justo debajo, ya que una pista no puede tener clips solapados; se niega si otro clip, como la música, ocupa el lugar de un fragmento. Cuánto se mueve un fragmento depende de si la forma de onda a ambos lados del límite permite un solapamiento. El modo suave se guía solo por la medición y deja tal cual un límite que no lo permite. El agresivo y el normal aplican además un solapamiento mínimo donde la medición no encuentra ninguno, y por eso se sienten más ajustados. Ese mínimo se aplica por completo en voz sintética limpia y se reduce en grabaciones más ruidosas, hasta desaparecer en las más ruidosas, donde la forma de onda no permite ver con seguridad dónde termina una palabra. Un límite sin ningún hueco en el origen, como un punto que cortaste a mano en mitad de una frase, nunca se solapa, porque ahí no hay pausa en la que entrar. Además, cada fragmento recibe un fundido corto de Premiere al inicio y al final (de 1 a 5 fotogramas, según el audio en ese límite) para evitar un chasquido.",
  "It works on the pieces that Cut just made in Silence Cut, and on a timeline you edited by hand after the Cut. You can click it again with a different preset without a Reset first. It works in any order with Speed and Pitch. Applying Speed afterward re-syncs the overlaps to the new durations on this run's pieces while the plugin still remembers the run; after the plugin is reopened, or on other clips, run Make J/L Cut again. Premiere's Pitch Shifter is applied again automatically when every piece had it. J/L Pacing and Reset place the pieces fresh from the source file, so other effects, volume and Motion changes and keyframes on them are not kept; the plugin lists them and asks first. Add effects as the last step.":
    "Funciona con los fragmentos que el corte acaba de crear en Corte de silencios, y también en una línea de tiempo que editaste a mano después del corte. Puedes volver a pulsarlo con otro preajuste sin restablecer antes. Funciona en cualquier orden con velocidad y tono. Si aplicas velocidad después, los solapamientos se resincronizan con las nuevas duraciones en los fragmentos de esta ejecución, mientras el plugin aún la recuerde; después de volver a abrir el plugin, o en otros clips, vuelve a pulsar «Aplicar J/L Cut». El Pitch Shifter de Premiere se vuelve a aplicar automáticamente cuando todos los fragmentos lo tenían. J/L Pacing y Restablecer colocan los fragmentos de nuevo desde el archivo de origen, así que otros efectos, cambios de volumen y de Movimiento y fotogramas clave en ellos no se conservan; el plugin los enumera y pregunta antes. Añade los efectos como último paso.",
  "Make J/L Cut applies the preset selected above. Reset puts every piece back in a plain row, with no overlap and no pacing fade. Neither button changes the Cut itself.":
    "Aplicar J/L Cut aplica el preajuste seleccionado arriba. Restablecer vuelve a poner cada fragmento en fila, sin solapamiento ni fundido de ritmo. Ninguno de los dos botones cambia el corte en sí.",
  "Pacing: Speed": "Ritmo: Velocidad",
  "100 is the original speed, as in Premiere's own Speed/Duration dialog. Above 100 speeds the voice up and shortens the clip; below 100 slows it down and lengthens it. AI-generated voice (from ElevenLabs, for example) picks up artifacts easily: stay under about 105 (5% faster), or correct the pitch with Pitch correction. Recordings of real people can be sped up more.":
    "100 es la velocidad original, como en el cuadro Velocidad/Duración de Premiere. Por encima de 100 la voz se acelera y el clip se acorta; por debajo de 100 se ralentiza y el clip se alarga. La voz generada por IA (de ElevenLabs, por ejemplo) se llena de artefactos con facilidad: no pases de unos 105 (un 5 % más rápido), o corrige el tono con Corrección de tono. Las grabaciones de personas reales se pueden acelerar más.",
  "Apply Speed sets the speed of every selected clip and adds no pitch correction of its own. If every piece already has Premiere's Pitch Shifter, the plugin updates it to the new speed. Right after a Cut, Speed rebuilds the pieces from the source file, so repeated changes can't drift, and puts them back where the Cut left them; pieces you moved elsewhere get the new speed in place. Effects on rebuilt pieces are not kept; the plugin lists them and asks first.":
    "Aplicar velocidad fija la velocidad de todos los clips seleccionados y no añade ninguna corrección de tono por su cuenta. Si todos los fragmentos ya tienen el Pitch Shifter de Premiere, el plugin lo actualiza a la nueva velocidad. Justo después del corte, la velocidad reconstruye los fragmentos desde el archivo de origen, para que los cambios repetidos no acumulen desfase, y los devuelve a donde los dejó el corte; los fragmentos que moviste a otro sitio reciben la nueva velocidad en su lugar. Los efectos de los fragmentos reconstruidos no se conservan; el plugin los enumera y pregunta antes.",
  "Pacing: Pitch correction": "Ritmo: Corrección de tono",
  "Read from selected clip (in Calculator) fills the Speed % field with the speed the selected clip plays at right now. Otherwise the field shows 100 or the value you last typed, which may not match the clip.":
    "Leer del clip seleccionado (en Calculadora) rellena el campo «Velocidad, %» con la velocidad a la que se reproduce ahora el clip seleccionado. Si no, el campo muestra 100 o lo último que escribiste, que puede no coincidir con el clip.",
  "Recommended third-party plugin: kHs Pitch Shifter (Kilohearts AB, kilohearts.com/products/pitch_shifter). Open its Pitch slider (shown in semitones) and type the semitones value from Calculator. Premiere's scripting can't set a third-party plugin's parameters reliably, so type the value into the plugin's own window. This is an independent recommendation, not a partnership with, sponsorship by or endorsement from Kilohearts AB. AI Voice Master Tool doesn't bundle, download or install the plugin.":
    "Plugin de terceros recomendado: kHs Pitch Shifter (Kilohearts AB, kilohearts.com/products/pitch_shifter). Abre su deslizador Pitch (en semitonos) y escribe el valor de semitonos de Calculadora. Los scripts de Premiere no pueden ajustar de forma fiable los parámetros de un plugin de terceros, así que escribe el valor en la propia ventana del plugin. Esta es una recomendación independiente, no una asociación, patrocinio ni respaldo de Kilohearts AB. AI Voice Master Tool no incluye, descarga ni instala el plugin.",
  "Pacing: Render full timeline for AE": "Ritmo: Renderizar toda la línea de tiempo para AE",
  'Pitch, and any other effect besides Speed and J/L Pacing, exists only inside Premiere\'s playback engine. "Send to After Effects" can\'t carry it over piece by piece, so it refuses whenever such an effect is applied. This button bakes the selected audio over the whole selected span into one file (audio tracks without selected pieces, such as music, are muted for the render) and puts that file on the timeline in place of the original pieces, so you can see that the bake happened. Then click "Send to After Effects" as usual: the new clip has no Pitch on it and sends normally. Video is left untouched; it is still sent separately and is not baked. The render includes the track\'s own fader and effects and the Master, and the rendered clip goes back on the same track, where they apply again: set them to their defaults before rendering, or mix afterward.':
    "El tono, como cualquier otro efecto aparte de velocidad y J/L Pacing, solo existe dentro del motor de reproducción de Premiere. «Enviar a After Effects» no puede transferirlo fragmento a fragmento, así que se niega cuando hay un efecto así aplicado. Este botón combina el audio seleccionado de todo el tramo en un solo archivo (las pistas de audio sin fragmentos seleccionados, como la música, se silencian durante el renderizado) y pone ese archivo en la línea de tiempo en lugar de los fragmentos originales, para que se vea que la combinación ocurrió. Luego pulsa «Enviar a After Effects» como de costumbre: el nuevo clip ya no tiene tono y se envía con normalidad. El vídeo queda intacto y sigue enviándose por separado, sin combinar. El renderizado incluye el fader y los efectos de la propia pista y el máster, y el clip renderizado vuelve a la misma pista, donde se aplican otra vez: ponlos en sus valores por defecto antes de renderizar, o mezcla después.",
  "\"Revert to segments\" puts the original pieces back in one click, as long as the plugin hasn't been reopened since. Premiere's own Cmd/Ctrl+Z also works, one step at a time.":
    "«Restaurar fragmentos» vuelve a poner los fragmentos originales con un clic, siempre que el plugin no se haya vuelto a abrir desde entonces. El propio Cmd/Ctrl+Z de Premiere también funciona, un paso a la vez.",
  "AI Voice: ElevenLabs API key and voice": "Voz IA: clave de API de ElevenLabs y voz",
  "Calls go straight from this computer to api.elevenlabs.io with your own key. The plugin has no key of its own and doesn't see or resell your usage. The key is stored only on this computer, in a plain settings file with the plugin's other settings, and is sent nowhere but api.elevenlabs.io. The status dot is green when ElevenLabs accepted the key, grey when it is saved but not confirmed yet (still checking, or ElevenLabs couldn't be reached), and red when no key is saved or ElevenLabs rejected it.":
    "Las llamadas van directamente desde este equipo a api.elevenlabs.io con tu propia clave. El plugin no tiene clave propia y no ve ni revende tu uso. La clave se guarda solo en este equipo, en un archivo de configuración normal junto al resto de la configuración del plugin, y no se envía a ningún sitio salvo api.elevenlabs.io. El punto de estado es verde cuando ElevenLabs aceptó la clave, gris cuando está guardada pero aún sin confirmar (se está comprobando o no se pudo contactar con ElevenLabs) y rojo cuando no hay clave guardada o ElevenLabs la rechazó.",
  'The Voice picker loads from your ElevenLabs account each time the plugin opens and after you save a key, in two groups: "My Voices" (anything you cloned, designed or added to your account) and "Stock voices" (ElevenLabs\' own premade voices). Click the star on a voice to pin it to the quick-access row above the picker. To use a voice that isn\'t listed, add it to your ElevenLabs account first (favorite, clone or design it at elevenlabs.io or in the ElevenLabs app), then click "Reload voices".':
    "El selector de voces se carga desde tu cuenta de ElevenLabs cada vez que se abre el plugin y al guardar una clave, en dos grupos: «Mis voces» (todo lo que hayas clonado, diseñado o añadido a tu cuenta) y «Voces predeterminadas» (las voces prediseñadas de ElevenLabs). Haz clic en la estrella de una voz para fijarla en la fila de acceso rápido encima del selector. Para usar una voz que no aparece, añádela primero a tu cuenta de ElevenLabs (márcala como favorita, clónala o diséñala en elevenlabs.io o en la app de ElevenLabs) y luego pulsa «Recargar voces».",
  "AI Voice: Kokoro (offline)": "Voz IA: Kokoro (sin conexión)",
  "The Language field only filters the Voice picker below by language and has no effect on generation. The voice you pick sets the language (bundled Kokoro-82M presets, Apache-2.0), so type your script in that voice's language; the plugin doesn't detect or translate languages.":
    "El campo Idioma solo filtra por idioma el selector de voces de abajo y no afecta a la generación. El idioma lo fija la voz que elijas (preajustes de Kokoro-82M incluidos, Apache-2.0), así que escribe el guion en el idioma de esa voz; el plugin no detecta ni traduce idiomas.",
  "AI Voice: Text and Improve for voice": "Voz IA: texto y «Mejorar para voz»",
  "Text: use full sentences and real punctuation. Commas, ellipses and paragraph breaks do the most for natural pacing on every model. On ElevenLabs, texts shorter than about 250 characters can come out inconsistent.":
    "Texto: usa frases completas y puntuación real. Las comas, los puntos suspensivos y los saltos de párrafo son lo que más ayuda a un ritmo natural en todos los modelos. En ElevenLabs, los textos de menos de unos 250 caracteres pueden sonar irregulares.",
  "The model picker lists the models your OpenAI or Anthropic account offers, fetched when the plugin opens, when you save a key and when you switch provider. It defaults to the smallest, cheapest one, which is enough for rewriting a short script.":
    "El selector de modelo muestra los modelos que ofrece tu cuenta de OpenAI o Anthropic, obtenidos al abrir el plugin, al guardar una clave y al cambiar de proveedor. Por defecto elige el más pequeño y barato, que basta para reescribir un guion corto.",
  "Cost: rewriting one script with the default small model costs little; the provider's pricing page has current rates. Get a key at platform.openai.com (API keys, separate from a ChatGPT Plus subscription) or console.anthropic.com (separate from a Claude Pro subscription). Both need a small prepaid balance instead of a monthly plan.":
    "Coste: reescribir un guion con el modelo pequeño por defecto cuesta poco; la página de precios del proveedor tiene las tarifas actuales. Consigue una clave en platform.openai.com (claves de API, independientes de una suscripción a ChatGPT Plus) o en console.anthropic.com (independiente de una suscripción a Claude Pro). Ambos piden un pequeño saldo prepagado en lugar de un plan mensual.",
  "AI Voice: Realism (ElevenLabs)": "Voz IA: Realismo (ElevenLabs)",
  "Automatic sets Stability, Similarity and Style together to a sensible combination. Advanced shows the sliders themselves, for fine-tuning beyond a preset: Stability on every model, Similarity on all but v3, and Style on v2 and for Voice Changer.":
    "«Automático» ajusta juntos la estabilidad, la similitud y el estilo en una combinación razonable. «Avanzado» muestra los propios deslizadores para afinar más allá de un preajuste: estabilidad en todos los modelos, similitud en todos salvo v3, y estilo en v2 y para el Conversor de voz.",
  "Stability: lower values (about 30 to 50%) sound more emotional and lively but less consistent. Higher values (about 65 to 75%) sound clearer and more consistent but can sound flat.":
    "Estabilidad: con valores bajos (de un 30 a un 50 %) suena más emocional y viva pero menos constante. Con valores altos (de un 65 a un 75 %) suena más clara y constante, pero puede quedar plana.",
  "Similarity / Clarity: keep it in the 75 to 90% range, together with Stability. Pushed to 100%, the voice tends to over-enunciate into an unnatural news-anchor sound. Not on v3.":
    "Similitud / claridad: mantenla junto con la estabilidad entre un 75 y un 90 %, aproximadamente. Cerca del 100 % la voz tiende a sobrearticular, con un efecto poco natural de presentador de noticias. No existe en v3.",
  "AI Voice: Generate, Replace and Voice Changer": "Voz IA: generar, reemplazar y conversor de voz",
  '"Generate & Insert" generates the audio, saves it under "AI Voice Master Tool/Generated" (in Documents, or next to your project if Save Renders is set to "Next to project") and places it at the playhead on the active sequence\'s target audio track (the first audio track targeted in Premiere, or else track 1). It is then ready for Silence Cut and Pacing. If something already sits at that spot, it refuses instead of overwriting: the playhead position is checked before generating, and the full length before placing. Move the playhead to an empty stretch, or target another track, and try again.':
    "«Generar e insertar» genera el audio, lo guarda en «AI Voice Master Tool/Generated» (en Documentos, o junto a tu proyecto si «Guardar renderizados» está en «Junto al proyecto») y lo coloca en la posición del cabezal, en la pista de audio de destino de la secuencia activa (la primera pista de audio marcada como destino en Premiere o, si no hay ninguna, la primera). Queda listo para el corte de silencios y el ritmo. Si ese punto de la pista ya está ocupado, se niega en lugar de sobrescribir: el cabezal se comprueba antes de generar y toda la duración antes de colocar. Mueve el cabezal a un tramo vacío, o marca otra pista como destino, y vuelve a intentarlo.",
  '"Replace Voice" generates the text again with the voice selected now and places it at the selected clip\'s start; the rest of your edit stays as it is. It speaks what the Text field holds. If the field held other text when you selected the clip, the banner says so and offers "Load its text", and Replace Voice asks for a second click before speaking that other text over the clip. The new take goes on the audio track below, and the previous take is disabled and stays on the timeline: bring it back with Enable in the clip\'s right-click menu, or with the plugin\'s Undo. Replace needs a free audio track below the clip; without one, it asks you to add a track before generating anything.':
    "«Reemplazar voz» vuelve a generar el texto con la voz seleccionada en ese momento y lo coloca al inicio del clip seleccionado; el resto de tu montaje no cambia. Locuta lo que haya en el campo «Texto». Si al seleccionar el clip el campo tenía otro texto, el banner lo indica y ofrece «Cargar su texto», y «Reemplazar voz» pide un segundo clic antes de locutar ese otro texto sobre el clip. La nueva toma va en la pista de audio de debajo y la anterior se desactiva y sigue en la línea de tiempo: recupérala con Habilitar (Enable) en el menú contextual del clip o con Deshacer del plugin. Reemplazar necesita una pista de audio libre debajo del clip; si no la hay, te pide añadir una pista antes de generar nada.",
  "Voice Changer's \"Convert Selected Clip's Voice\" renders the selected timeline clip, with any Speed or Pitch already on it, and sends it to ElevenLabs' Voice Changer (speech-to-speech) with the voice picked above. Other audio tracks are muted for the render, so music under the clip isn't sent. The words stay the same and only the voice changes. Like Replace, it needs a spare audio track directly below the clip's own track, so the result can be undone. Premiere renders the clip itself; only if it can't does the render go to Adobe Media Encoder's queue. If that render then times out, check Media Encoder's Queue panel and its \"auto-start queue\" preference. ElevenLabs takes clips up to 5 minutes long: cut a longer one into parts and convert them one at a time.":
    "«Convertir la voz del clip seleccionado», del conversor de voz, renderiza el clip seleccionado en la línea de tiempo, con la velocidad o el tono que ya tenga, y lo envía al conversor de voz de ElevenLabs (speech-to-speech) con la voz elegida arriba. Las demás pistas de audio se silencian durante el renderizado, así que la música de debajo no se envía. Las palabras siguen siendo las mismas y solo cambia la voz. Igual que Reemplazar, necesita una pista de audio libre justo debajo de la pista del clip, para que el resultado se pueda deshacer. Premiere renderiza el clip por sí mismo; solo si no puede, el renderizado va a la cola de Adobe Media Encoder. Si entonces se agota el tiempo de espera, revisa el panel de cola de Media Encoder y su preferencia «auto-start queue». ElevenLabs admite clips de hasta 5 minutos: corta uno más largo en partes y conviértelas una a una.",
  "AI Voice: Batch": "Voz IA: generación por lotes",
  "Each line of the batch script becomes one generated clip, with the voice, model and Realism settings set above. Lines are generated one at a time, to stay within ElevenLabs' rate limits, and placed one after another on the timeline from the playhead.":
    "Cada línea del guion por lotes se convierte en un clip generado, con los ajustes de voz, modelo y realismo definidos arriba. Las líneas se generan una a una, para respetar los límites de solicitudes de ElevenLabs, y se colocan una tras otra en la línea de tiempo a partir del cabezal.",
  '"Generate All" skips lines already generated and doesn\'t place lines already on the timeline, so you can add lines and click again to generate and place only the new ones. Before generating anything, it checks that the target audio track (the first targeted one, or else track 1) is free after the playhead.':
    "«Generar todo» omite las líneas ya generadas y no vuelve a colocar las que ya están en la línea de tiempo, así que puedes añadir líneas y pulsar otra vez para generar y colocar solo las nuevas. Antes de generar nada, comprueba que la pista de audio de destino (la primera marcada como destino o, si no hay ninguna, la primera) esté libre después del cabezal.",
  'Open After Effects (2025 or later), then in the "AI Voice Master Tool Bridge" plugin there (Window > Extensions), click "Place in current composition."':
    "Abre After Effects (2025 o posterior) y, en el plugin «AI Voice Master Tool Bridge» de allí (Window > Extensions), haz clic en «Colocar en la composición actual».",
  "Send to After Effects passes the pieces selected on the timeline to After Effects through a small hand-off file, since the two apps share no clipboard for timeline clips. In After Effects, each piece's speed comes back as a time-stretch, and its J/L position is kept. There is no crossfade: overlapping pieces play at full volume during the overlap. The pieces stay linked to your original media, so you can still nudge their edges in After Effects.":
    "Enviar a After Effects pasa a After Effects los fragmentos seleccionados en la línea de tiempo mediante un pequeño archivo de traspaso, ya que las dos aplicaciones no comparten portapapeles para clips de línea de tiempo. En After Effects, la velocidad de cada fragmento se reconstruye como un estiramiento de tiempo y se conserva su posición de J/L. No hay fundido cruzado: los fragmentos solapados suenan a volumen completo durante el solapamiento. Los fragmentos siguen enlazados a tu medio original, así que todavía puedes ajustar sus bordes en After Effects.",
  "Video is always sent linked to its media and never rendered. A plain linked audio and video clip, such as a camera's own file, arrives as one linked layer with picture and sound, as it sits in Premiere. Only a clip whose audio and video come from two different source files arrives as two separate layers.":
    "El vídeo siempre se envía enlazado a su medio y nunca se renderiza. Un clip normal con audio y vídeo enlazados, como el archivo de una cámara, llega como una sola capa enlazada con imagen y sonido, igual que está en Premiere. Solo un clip cuyo audio y vídeo vienen de dos archivos de origen distintos llega como dos capas separadas.",
  'Send to After Effects never renders anything. If a selected clip has Pitch, or any other effect besides Speed and J/L Pacing, it refuses, because that effect exists only in Premiere\'s playback engine and not in the file. For that case, use "Render full timeline for AE" in the Pacing tab first.':
    "Enviar a After Effects nunca renderiza nada. Si algún clip seleccionado tiene tono, o cualquier otro efecto aparte de velocidad y J/L Pacing, se niega, porque ese efecto solo existe en el motor de reproducción de Premiere y no en el archivo. En ese caso, usa antes «Renderizar toda la línea de tiempo para AE» en la pestaña Ritmo.",
  'An audio file made by "Render full timeline for AE" has no spare material past its edges, so in After Effects you can\'t extend it the way you can extend a trimmed clip; to make it longer, render again in Premiere. Video, if any, is not affected: it is always sent linked to the original media, so you can still adjust it freely.':
    "Un archivo de audio hecho con «Renderizar toda la línea de tiempo para AE» no tiene material de sobra más allá de sus bordes, así que en After Effects no se puede alargar como un clip recortado; para hacerlo más largo, vuelve a renderizar en Premiere. El vídeo, si lo hay, no se ve afectado: siempre se envía enlazado al medio original, así que todavía puedes ajustarlo libremente.",

  // bridge/main.tsx — the "AI Voice Master Tool Bridge" panel (After Effects side)
  "Checking for a cut sent from Premiere…": "Comprobando si se envió un corte desde Premiere…",
  'Nothing sent yet. In Premiere, use "Send to After Effects" (in the AI Voice Master Tool plugin\'s Send to AE tab) after cutting.':
    "Todavía no se ha enviado nada. En Premiere, usa «Enviar a After Effects» (en la pestaña Enviar a AE del plugin AI Voice Master Tool) después de cortar.",
  'from "{name}"{fileName}': "de «{name}»{fileName}",
  "Sent {when}": "Enviado {when}",
  "Placing…": "Colocando…",
  "Place in current composition": "Colocar en la composición actual",
  "Refresh": "Actualizar",
  "Placed {count} {kind}": "Colocado(s) {count} {kind}",
  "Reading: {path}": "Leyendo: {path}",
  " · modified {when}": " · modificado {when}",
  " · {count} bytes": " · {count} bytes",
  " · the Bridge last checked {when}": " · última comprobación del Bridge: {when}",
  "Saves an After Effects-specific troubleshooting report to your Documents folder.":
    "Guarda un informe de diagnóstico específico de After Effects en tu carpeta Documentos.",
  "The Bridge's scripting part didn't load, so it can't place anything. Quit and reopen After Effects; if that doesn't help, reinstall the plugin.":
    "La parte de scripts del Bridge no se cargó, por lo que no puede colocar nada. Cierra y vuelve a abrir After Effects; si no ayuda, reinstala el plugin.",
  "The plugin's scripting part didn't load, so nothing that works on the timeline can run. Quit and reopen Premiere Pro; if that doesn't help, reinstall the plugin.":
    "La parte de scripts del plugin no se cargó, así que nada que trabaje con la línea de tiempo podrá ejecutarse. Cierra y vuelve a abrir Premiere Pro; si no ayuda, reinstala el plugin.",
  "This isn't a key: it contains spaces, so other text was probably pasted or typed into this field. Copy the key again from your account's API keys page.":
    "Esto no es una clave: contiene espacios, así que probablemente se pegó o escribió otro texto en este campo. Vuelve a copiar la clave desde la página de claves de API de tu cuenta.",
  "The key contains non-Latin characters, for example a Cyrillic letter that looks like a Latin one. Copy the key again from your account's API keys page, or retype it with an English keyboard layout.":
    "La clave contiene caracteres no latinos, por ejemplo una letra cirílica que parece latina. Vuelve a copiar la clave desde la página de claves de API de tu cuenta o escríbela con la distribución de teclado en inglés.",
  "Couldn't read the current selection, so Speed is applied to the selected clips in place instead of rebuilding them from the original Cut. Nothing you edited by hand can be lost this way.":
    "No se pudo leer la selección actual, así que la velocidad se aplica a los clips seleccionados en su sitio, sin reconstruirlos a partir del corte original. Así no se puede perder nada de lo que editaste a mano.",
  "The timeline no longer matches the original Cut ({live} pieces selected vs {expected} from that Cut) — applying Speed to the current selection instead of rebuilding, so your manual edits are kept.":
    "La línea de tiempo ya no coincide con el corte original ({live} fragmentos seleccionados frente a {expected} de ese corte): se aplica la velocidad a la selección actual en lugar de reconstruir, para conservar tus ediciones manuales.",
  "Speed was applied, but re-applying J/L Pacing afterwards failed: {error}. Don't run Speed again; re-apply J/L Pacing from the Pacing tab.":
    "La velocidad se aplicó, pero falló volver a aplicar J/L Pacing: {error}. No vuelvas a aplicar la velocidad; vuelve a aplicar J/L Pacing desde la pestaña Ritmo.",

  // ---- Messages from the ExtendScript side (see hostMessages.ts).
  "Please select exactly one clip on the timeline.": "Selecciona exactamente un clip en la línea de tiempo.",
  "Could not locate the selected clip on any track.": "No se encontró el clip seleccionado en ninguna pista.",
  "Premiere couldn't read this clip's effects.": "Premiere no pudo leer los efectos de este clip.",
  "No active sequence. Open a sequence first.": "No hay ninguna secuencia activa. Abre una secuencia primero.",
  "Cannot cut this clip: Premiere's editing interface isn't available in this session. Restart Premiere Pro and try again; the clip was left untouched.":
    "No se puede cortar este clip: la interfaz de edición de Premiere no está disponible en esta sesión. Reinicia Premiere Pro e inténtalo de nuevo; el clip se ha dejado sin cambios.",
  "Cannot cut this clip: no active sequence. Open the sequence in the Timeline and try again; the clip was left untouched.":
    "No se puede cortar este clip: no hay ninguna secuencia activa. Abre la secuencia en la línea de tiempo e inténtalo de nuevo; el clip se ha dejado sin cambios.",
  "No segments to cut — scan the clip first.": "No hay segmentos que cortar — analiza el clip primero.",
  "Selected clip has no source media.": "El clip seleccionado no tiene medio de origen.",
  "Cannot undo: the original audio track no longer exists.": "No se puede deshacer: la pista de audio original ya no existe.",
  "The original video track no longer exists — only the audio was restored.":
    "La pista de vídeo original ya no existe — solo se restauró el audio.",
  "Cannot undo: could not find the original source media in the Project panel. Nothing was changed.":
    "No se puede deshacer: no se encontró el medio de origen en el panel Proyecto. No se cambió nada.",
  "Could not find the original source media of {p0} piece(s) in the Project panel — nothing was changed. Import the source file again, then try again.":
    "No se encontró el medio de origen de {p0} fragmento(s) en el panel Proyecto — no se cambió nada. Vuelve a importar el archivo de origen e inténtalo de nuevo.",
  "Restored the clip's position, but couldn't restore its original Speed (Premiere's editing interface was not available).":
    "Se restauró la posición del clip, pero no su velocidad original (la interfaz de edición de Premiere no estaba disponible).",
  "Restored the clip's position, but couldn't restore its original Speed (no active sequence).":
    "Se restauró la posición del clip, pero no su velocidad original (no hay ninguna secuencia activa).",
  "Restored the clip's position, but couldn't find it in Premiere's editing interface to restore its original Speed.":
    "Se restauró la posición del clip, pero no se encontró en la interfaz de edición de Premiere para restaurar su velocidad original.",
  "Premiere rejected restoring the original clip — the track may not be clear at that position.":
    "Premiere rechazó restaurar el clip original — puede que la pista no esté libre en esa posición.",
  "Could not restore the linked video — Premiere rejected placing it.":
    "No se pudo restaurar el vídeo vinculado — Premiere rechazó colocarlo.",
  "Restored the clip, but couldn't verify its exact placement afterward.":
    "Se restauró el clip, pero no se pudo verificar su posición exacta después.",
  "No original Cut segments to rebuild from — re-run Cut first.":
    "No hay segmentos del corte original a partir de los que reconstruir — vuelve a ejecutar el corte.",
  "The original audio track no longer exists in this sequence.": "La pista de audio original ya no existe en esta secuencia.",
  "Could not find the original source media in the Project panel.": "No se encontró el medio de origen en el panel Proyecto.",
  "Premiere's editing interface was not available, so no edge fades were added.":
    "La interfaz de edición de Premiere no estaba disponible, así que no se añadieron fundidos en los bordes.",
  "Couldn't add the fade-in.": "No se pudo añadir el fundido de entrada.",
  "Couldn't add the fade-out.": "No se pudo añadir el fundido de salida.",
  "neither fade-in nor fade-out could be added": "no se pudo añadir ni el fundido de entrada ni el de salida",
  "Could not locate the selected pieces on any track.": "No se encontraron los fragmentos seleccionados en ninguna pista.",
  "J/L Pacing works on audio only. Select the pieces Cut made on an audio track.":
    "J/L Pacing solo funciona con audio. Selecciona en una pista de audio los fragmentos que hizo el corte.",
  "J/L Pacing needs a spare audio track directly below the selected pieces to alternate onto. Add one more audio track to this sequence and try again.":
    "J/L Pacing necesita una pista de audio libre justo debajo de los fragmentos seleccionados para alternarlos. Añade una pista de audio más a esta secuencia y vuelve a intentarlo.",
  "Some pieces have a linked video, but there's no spare video track to alternate onto — only audio pacing was applied, the video was left where it was. Add one more video track and re-run if you need the video repositioned too.":
    "Algunos fragmentos tienen vídeo vinculado, pero no hay una pista de vídeo libre para alternarlos — el ritmo se aplicó solo al audio y el vídeo se quedó donde estaba. Añade una pista de vídeo más y repite si también necesitas reubicar el vídeo.",
  "The original Cut position wasn't available — the pieces were placed at their current position instead.":
    "La posición original del corte no estaba disponible — los fragmentos se colocaron en su posición actual.",
  "No audio file path given.": "No se indicó la ruta del archivo de audio.",
  "Premiere rejected importing the generated audio file.": "Premiere rechazó importar el archivo de audio generado.",
  "Import appeared to succeed, but the new project item could not be located.":
    "La importación pareció funcionar, pero no se encontró el nuevo elemento del proyecto.",
  "Select the audio clip whose voice you want to replace.": "Selecciona el clip de audio cuya voz quieres reemplazar.",
  "The selected clip changed while the new voice was being made — nothing was replaced, to avoid overwriting the wrong clip. Re-select the original clip and try again.":
    "El clip seleccionado cambió mientras se creaba la nueva voz — no se reemplazó nada para no sobrescribir el clip equivocado. Vuelve a seleccionar el clip original e inténtalo de nuevo.",
  "Active sequence has no audio track to place the generated voice-over on.":
    "La secuencia activa no tiene ninguna pista de audio donde colocar la locución generada.",
  "Placed on the timeline, but could not auto-select the new clip.":
    "Se colocó en la línea de tiempo, pero no se pudo seleccionar el nuevo clip automáticamente.",
  "Placed on the timeline, but could not locate the new clip afterward to select it.":
    "Se colocó en la línea de tiempo, pero después no se encontró el nuevo clip para seleccionarlo.",
  "No files to place.": "No hay archivos que colocar.",
  "Active sequence has no audio track to place generated voice-overs on.":
    "La secuencia activa no tiene ninguna pista de audio donde colocar las locuciones generadas.",
  'Audio track {p0} has "{p1}" at or after the playhead. Batch places its clips one after another from the playhead and would overwrite it. Make an empty audio track the first targeted one (turn on its track-targeting button in the track header, and turn it off on the audio tracks above it), or move the playhead to {p2}s or later, the end of that track\'s last clip, and click Generate All again. Nothing was generated.':
    "La pista de audio {p0} tiene «{p1}» en el cabezal o después. El lote coloca sus clips uno tras otro desde el cabezal y lo sobrescribiría. Haz que una pista de audio vacía sea la primera de destino (activa su botón de destino de pista en la cabecera y desactívalo en las pistas de audio de encima), o pon el cabezal en {p2} s o más adelante, donde termina el último clip de esa pista, y vuelve a pulsar «Generar todo». No se generó nada.",
  'Audio track {p0} has "{p1}" at or after the playhead. Batch places its clips one after another from the playhead and would overwrite it. Make an empty audio track the first targeted one (turn on its track-targeting button in the track header, and turn it off on the audio tracks above it), or move the playhead to {p2}s or later, the end of that track\'s last clip, and click Generate All again. The generated lines are kept. Nothing was placed.':
    "La pista de audio {p0} tiene «{p1}» en el cabezal o después. El lote coloca sus clips uno tras otro desde el cabezal y lo sobrescribiría. Haz que una pista de audio vacía sea la primera de destino (activa su botón de destino de pista en la cabecera y desactívalo en las pistas de audio de encima), o pon el cabezal en {p2} s o más adelante, donde termina el último clip de esa pista, y vuelve a pulsar «Generar todo». Las líneas generadas se conservan. No se colocó nada.",
  "Premiere's editing interface is not available. Restart Premiere Pro and try again.":
    "La interfaz de edición de Premiere no está disponible. Reinicia Premiere Pro e inténtalo de nuevo.",
  "No active sequence. Open the sequence in the Timeline and try again.":
    "No hay ninguna secuencia activa. Abre la secuencia en la línea de tiempo e inténtalo de nuevo.",
  "Select one or more clips on the timeline first (the pieces Cut just made are auto-selected).":
    "Selecciona primero uno o varios clips en la línea de tiempo (los fragmentos que acaba de crear el corte se seleccionan automáticamente).",
  "Select one or more clips on the timeline first.": "Selecciona primero uno o varios clips en la línea de tiempo.",
  "Premiere didn't start the render. Check that Adobe Media Encoder is installed.":
    "Premiere no inició el renderizado. Comprueba que Adobe Media Encoder está instalado.",
  "No export preset path given.": "No se indicó la ruta del ajuste preestablecido de exportación.",
  "Select the audio clip you want to convert.": "Selecciona el clip de audio que quieres convertir.",
  "Rendering isn't available in this version of Premiere Pro.": "El renderizado no está disponible en esta versión de Premiere Pro.",
  "Select the cut segments to send first (they're auto-selected right after Cut).":
    "Selecciona primero los segmentos cortados que quieres enviar (justo después del corte se seleccionan automáticamente).",
  "All selected clips must come from the same source media to send as segments.":
    "Para enviarlos como segmentos, todos los clips seleccionados deben proceder del mismo medio de origen.",
  "Select the audio to render first.": "Selecciona primero el audio que quieres renderizar.",
  "No rendered file path given.": "No se indicó la ruta del archivo renderizado.",
  "No audio pieces recorded from the render step — nothing to replace.":
    "El paso de renderizado no registró ningún fragmento de audio — no hay nada que reemplazar.",
  'The timeline changed since rendering — one or more of the original pieces can no longer be found. Nothing was removed. Run "Render full timeline for AE" again.':
    "La línea de tiempo cambió después del renderizado — uno o varios de los fragmentos originales ya no se encuentran. No se eliminó nada. Vuelve a ejecutar «Renderizar toda la línea de tiempo para AE».",
  '"{p0}" now sits on audio track {p1} where the rendered file goes ({p2}s–{p3}s). Nothing was removed. Move it out of that stretch, then run "Render full timeline for AE" again.':
    "«{p0}» está ahora en la pista de audio {p1}, donde va el archivo renderizado ({p2} s–{p3} s). No se eliminó nada. Sácalo de ese tramo y vuelve a ejecutar «Renderizar toda la línea de tiempo para AE».",
  '"{p0}" on audio track {p1} ({p2}s–{p3}s) sits between the selected pieces but isn\'t selected: the render would include it and then replace it. Select it too, or move it out of that stretch, then try again. Nothing was rendered.':
    "«{p0}» en la pista de audio {p1} ({p2} s–{p3} s) está entre los fragmentos seleccionados, pero no está seleccionado: el renderizado lo incluiría y luego lo reemplazaría. Selecciónalo también o sácalo de ese tramo e inténtalo de nuevo. No se renderizó nada.",
  "Could not locate a track for the original audio pieces.": "No se encontró una pista para los fragmentos de audio originales.",
  "Premiere rejected importing the rendered file.": "Premiere rechazó importar el archivo renderizado.",
  "No original pieces were recorded for this render — nothing to restore.":
    "No se registraron fragmentos originales para este renderizado — no hay nada que restaurar.",
  "Could not find the rendered clip on the timeline to remove — it may already have been moved or deleted. Restoring the original pieces anyway.":
    "No se encontró el clip renderizado en la línea de tiempo para eliminarlo — puede que ya se haya movido o borrado. Aun así se restauran los fragmentos originales.",
  "Restored a piece's position, but couldn't restore its original Speed (Premiere's editing interface was not available).":
    "Se restauró la posición de un fragmento, pero no su velocidad original (la interfaz de edición de Premiere no estaba disponible).",
  "Restored a piece's position, but couldn't restore its original Speed (no active sequence).":
    "Se restauró la posición de un fragmento, pero no su velocidad original (no hay ninguna secuencia activa).",
  "Restored a piece's position, but couldn't find it in Premiere's editing interface to restore its original Speed.":
    "Se restauró la posición de un fragmento, pero no se encontró en la interfaz de edición de Premiere para restaurar su velocidad original.",
  "Nothing to place — send a cut from Premiere first.": "No hay nada que colocar — envía primero un corte desde Premiere.",
  "Open (or select) a composition in After Effects first.": "Abre (o selecciona) primero una composición en After Effects.",
  "The data sent from Premiere is missing its source media path. Send it again from Premiere.":
    "A los datos enviados desde Premiere les falta la ruta del medio de origen. Vuelve a enviarlos desde Premiere.",
  "The data sent from Premiere has no segments. Send it again from Premiere.":
    "Los datos enviados desde Premiere no tienen segmentos. Vuelve a enviarlos desde Premiere.",
  "The data sent from Premiere has no rendered files. Send it again from Premiere.":
    "Los datos enviados desde Premiere no tienen archivos renderizados. Vuelve a enviarlos desde Premiere.",
  "Active item is no longer a composition — skipped repositioning.":
    "El elemento activo ya no es una composición — se omitió la reubicación.",
  "Please select exactly one clip (currently {p0} selected). For a clip with several linked audio channels, Alt/Option-click one audio clip to select it alone.":
    "Selecciona exactamente un clip (ahora hay {p0} seleccionados). Si el clip tiene varios canales de audio vinculados, haz Alt/Opción-clic en un clip de audio para seleccionarlo solo.",
  '"{p0}" added, but its "{p1}" parameter was not found.{p2}': "Se añadió «{p0}», pero no se encontró su parámetro «{p1}».{p2}",
  '"{p0}": its "{p1}" setting could not be changed ({p2}).': "«{p0}»: no se pudo cambiar su ajuste «{p1}» ({p2}).",
  '"{p0}" was added but can\'t be found on the clip. Add it again by hand in Effect Controls.':
    "«{p0}» se añadió, pero no se encuentra en el clip. Vuelve a añadirlo a mano en Controles de efectos.",
  "Razoring at {p0}s failed ({p1}).": "Falló el corte en {p0} s ({p1}).",
  "Removing a silence piece failed ({p0}).": "Falló la eliminación de un fragmento de silencio ({p0}).",
  "Closing a gap failed ({p0}).": "Falló el cierre de un hueco ({p0}).",
  "Removing a piece failed ({p0}).": "Falló la eliminación de un fragmento ({p0}).",
  "Restored the clip's position, but restoring its original Speed failed ({p0}).":
    "Se restauró la posición del clip, pero falló restaurar su velocidad original ({p0}).",
  "Restoring the linked video failed ({p0}).": "Falló la restauración del vídeo vinculado ({p0}).",
  "Premiere did not match it to the selection, so its Speed was left unchanged.":
    "Premiere no lo asoció a la selección, así que su velocidad no se cambió.",
  'Speed was applied to "{p0}", but moving it into place failed ({p1}). Check it on the timeline.':
    "Se aplicó la velocidad a «{p0}», pero no se pudo colocar en su sitio ({p1}). Revísalo en la línea de tiempo.",
  "Restored the clip, but setting its exact bounds failed ({p0}).": "Se restauró el clip, pero falló fijar sus límites exactos ({p0}).",
  "Restored the video, but setting its exact bounds failed ({p0}).": "Se restauró el vídeo, pero falló fijar sus límites exactos ({p0}).",
  "Could not remove an existing piece before rebuilding ({p0}).": "No se pudo eliminar un fragmento existente antes de reconstruir ({p0}).",
  "Piece {p0}: Premiere rejected placing it at {p1}s — left out.": "Fragmento {p0}: Premiere rechazó colocarlo en {p1} s — se omitió.",
  "Piece {p0}: placed, but could not locate it afterward — left as-is.":
    "Fragmento {p0}: se colocó, pero después no se encontró — se dejó tal cual.",
  "Piece {p0}: placed, but setting its source in/out failed ({p1}).":
    "Fragmento {p0}: se colocó, pero falló fijar su entrada y salida de origen ({p1}).",
  "Piece {p0} (video): Premiere rejected placing it at {p1}s — left out.":
    "Fragmento {p0} (vídeo): Premiere rechazó colocarlo en {p1} s — se omitió.",
  "Piece {p0} (video): placed, but could not locate it afterward — left as-is.":
    "Fragmento {p0} (vídeo): se colocó, pero después no se encontró — se dejó tal cual.",
  "Piece {p0} (video): placed, but setting its exact bounds failed ({p1}).":
    "Fragmento {p0} (vídeo): se colocó, pero falló fijar sus límites exactos ({p1}).",
  "Could not remove a leftover stray fragment ({p0}).": "No se pudo eliminar un fragmento residual sobrante ({p0}).",
  "Could not restore a piece's own duration after setting its speed ({p0}).":
    "No se pudo restaurar la duración propia de un fragmento después de fijar su velocidad ({p0}).",
  '"{p0}" audio transition not found — edge fades skipped for all pieces.':
    "No se encontró la transición de audio «{p0}» — se omitieron los fundidos de borde en todos los fragmentos.",
  'Premiere refused the "{p0}" audio transition on every piece — no edge fades were added; the pieces themselves are in place.':
    "Premiere rechazó la transición de audio «{p0}» en todos los fragmentos — no se añadieron fundidos de borde; los fragmentos en sí siguen en su sitio.",
  "Couldn't add the fade-in ({p0}).": "No se pudo añadir el fundido de entrada ({p0}).",
  "Couldn't add the fade-out ({p0}).": "No se pudo añadir el fundido de salida ({p0}).",
  "Could not set the source clip's in/out {p0} ({p1}).":
    "No se pudieron fijar los puntos de entrada y salida del clip de origen {p0} ({p1}).",
  "for piece {p0} before placing it": "para el fragmento {p0} antes de colocarlo",
  "for the video of piece {p0} before placing it": "para el vídeo del fragmento {p0} antes de colocarlo",
  "back to its original range after placing the pieces": "de vuelta a su rango original después de colocar los fragmentos",
  "{p0} video clip{p1} in the selection could not be matched to a linked audio piece — video pacing was skipped for {p2} this run.":
    "Clips de vídeo de la selección que no se pudieron emparejar con un fragmento de audio vinculado: {p0} — esta vez no se les aplicó el ritmo de vídeo.",
  "Piece {p0}: its audio and video were already {p1} frame(s) apart before J/L Pacing ran.":
    "Fragmento {p0}: su audio y su vídeo ya estaban separados {p1} fotograma(s) antes de aplicar J/L Pacing.",
  "{p0} pieces are selected, but this run expected {p1} — the selection may have changed. Re-select the pieces from that Cut and try again.":
    "Hay {p0} fragmentos seleccionados, pero esta ejecución esperaba {p1} — puede que la selección haya cambiado. Vuelve a seleccionar los fragmentos de ese corte e inténtalo de nuevo.",
  "Piece {p0} has no source media.": "El fragmento {p0} no tiene medio de origen.",
  "Placing pieces at the original Cut position ({p0}s) instead of where they currently sit ({p1}s).":
    "Los fragmentos se colocan en la posición del corte original ({p0} s) en lugar de donde están ahora ({p1} s).",
  "Can't apply J/L Pacing safely: another clip on {p0} starts at {p1}s, closer than piece {p2} needs ({p3}s). Move it further away (or onto a different track) before running J/L Pacing.":
    "No se puede aplicar J/L Pacing con seguridad: otro clip en {p0} empieza en {p1} s, más cerca de lo que necesita el fragmento {p2} ({p3} s). Apártalo más (o muévelo a otra pista) antes de aplicar J/L Pacing.",
  "Can't apply J/L Pacing safely: another clip on {p0} starts at {p1}s, closer than piece {p2} needs ({p3}s). Move it further away before running J/L Pacing.":
    "No se puede aplicar J/L Pacing con seguridad: otro clip en {p0} empieza en {p1} s, más cerca de lo que necesita el fragmento {p2} ({p3} s). Apártalo más antes de aplicar J/L Pacing.",
  "Piece {p0} (video): could not remove for repositioning ({p1}) — left in its original spot.":
    "Fragmento {p0} (vídeo): no se pudo quitar para reubicarlo ({p1}) — se dejó en su lugar original.",
  "Piece {p0} may have landed {p1}s away from where it belongs. Check it on the timeline.":
    "Puede que el fragmento {p0} haya quedado a {p1} s de su sitio. Revísalo en la línea de tiempo.",
  "Piece {p0}: placed, but setting its source in/out failed ({p1}) — kept with default source framing.":
    "Fragmento {p0}: se colocó, pero falló fijar su entrada y salida de origen ({p1}) — se mantuvo el encuadre de origen predeterminado.",
  "Piece {p0} (video): placed, but setting its source in/out failed ({p1}) — kept with default source framing.":
    "Fragmento {p0} (vídeo): se colocó, pero falló fijar su entrada y salida de origen ({p1}) — se mantuvo el encuadre de origen predeterminado.",
  "Reset: {p0} piece(s) are not back to back: {p1}.": "Restablecer: {p0} fragmento(s) no quedaron pegados: {p1}.",
  "Video piece {p0} is missing near {p1}s. Check the video track.":
    "No se encuentra el fragmento de vídeo {p0} cerca de {p1} s. Revisa la pista de vídeo.",
  "Video piece {p0} near {p1}s is only {p2}s long. Check the video track.":
    "El fragmento de vídeo {p0} cerca de {p1} s dura solo {p2} s. Revisa la pista de vídeo.",
  "Could not restore a piece's own duration after resetting its speed ({p0}).":
    "No se pudo restaurar la duración propia de un fragmento después de restablecer su velocidad ({p0}).",
  "The number of clips on the {p0} track changed while restoring speed. Check the track.":
    "El número de clips cambió al restaurar la velocidad ({p0}). Revisa la pista.",
  "A {p0}s clip at {p1}s was removed as a leftover fragment. If it was a real piece, undo (Cmd/Ctrl+Z), then run Diagnostics from the gear menu and add the report to a bug report.":
    "Se eliminó un clip de {p0} s en {p1} s como fragmento sobrante. Si era un fragmento real, deshaz (Cmd/Ctrl+Z), luego ejecuta el diagnóstico desde el menú del engranaje y adjunta el informe al comunicar el error.",
  "Piece {p0}: audio and video moved {p1} frame(s) out of sync.":
    "Fragmento {p0}: el audio y el vídeo se desincronizaron {p1} fotograma(s).",
  "Piece {p0}: adding fades moved audio and video {p1} frame(s) out of sync.":
    "Fragmento {p0}: al añadir los fundidos, el audio y el vídeo se desincronizaron {p1} fotograma(s).",
  "Video track: {p0} clip(s) where {p1} were expected (alternate track: {p2} of {p3}). Some leftover fragments may remain, or a piece was removed.":
    "Pista de vídeo: {p0} clip(s) donde se esperaban {p1} (pista alterna: {p2} de {p3}). Puede que queden fragmentos sobrantes o que se haya eliminado un fragmento.",
  "Audio track: {p0} clip(s) where {p1} were expected (alternate track: {p2} of {p3}). Some leftover fragments may remain, or a piece was removed.":
    "Pista de audio: {p0} clip(s) donde se esperaban {p1} (pista alterna: {p2} de {p3}). Puede que queden fragmentos sobrantes o que se haya eliminado un fragmento.",
  "Generated audio file not found on disk: {p0}": "No se encontró en el disco el archivo de audio generado: {p0}",
  "Premiere rejected placing the generated audio at {p0}s.": "Premiere rechazó colocar el audio generado en {p0} s.",
  "Audio track {p0} is locked, so the new take can't be placed. Unlock it, then try again. Nothing was replaced.":
    "La pista de audio {p0} está bloqueada, así que no se puede colocar la nueva toma. Desbloquéala e inténtalo de nuevo. No se reemplazó nada.",
  "The new take goes on the audio track below and the previous take stays as a disabled clip, but audio track {p0} is the last one. Add an audio track (Sequence > Add Tracks), then try again. Nothing was replaced.":
    "La nueva toma va en la pista de audio de debajo y la anterior queda como clip desactivado, pero la pista de audio {p0} es la última. Añade una pista de audio (Sequence > Add Tracks) e inténtalo de nuevo. No se reemplazó nada.",
  "This clip is {p0} long, and ElevenLabs Voice Changer takes at most 5:00. Cut it into shorter clips and convert them one at a time. Nothing was rendered or sent.":
    "Este clip dura {p0} y ElevenLabs Voice Changer admite como máximo 5:00. Córtalo en clips más cortos y conviértelos uno a uno. No se renderizó ni se envió nada.",
  "Premiere rejected placing the generated audio at {p0}s. The previous take was turned back on.":
    "Premiere rechazó colocar el audio generado en {p0} s. La toma anterior se volvió a activar.",
  "Premiere rejected placing the generated audio at {p0}s. The previous take is still disabled: select it and choose Clip > Enable.":
    "Premiere rechazó colocar el audio generado en {p0} s. La toma anterior sigue desactivada: selecciónala y elige Clip > Habilitar (Clip > Enable).",
  "File {p0} of {p1}: not found on disk ({p2}).": "Archivo {p0} de {p1}: no se encontró en el disco ({p2}).",
  "File {p0} of {p1}: Premiere rejected importing it.": "Archivo {p0} de {p1}: Premiere rechazó importarlo.",
  "File {p0} of {p1}: import appeared to succeed, but the new project item could not be located.":
    "Archivo {p0} de {p1}: la importación pareció funcionar, pero no se encontró el nuevo elemento del proyecto.",
  "File {p0} of {p1}: Premiere rejected placing it at {p2}s.": "Archivo {p0} de {p1}: Premiere rechazó colocarlo en {p2} s.",
  "File {p0} of {p1}: placed, but could not be located afterward to place the next file.":
    "Archivo {p0} de {p1}: se colocó, pero después no se encontró para colocar el siguiente archivo.",
  "File {p0} of {p1}: {p2}": "Archivo {p0} de {p1}: {p2}",
  'Clip {p0} ("{p1}"): couldn\'t find its track.': "Clip {p0} («{p1}»): no se encontró su pista.",
  'Clip {p0} ("{p1}"): Premiere couldn\'t find it on its track.': "Clip {p0} («{p1}»): Premiere no lo encontró en su pista.",
  'Clip {p0} ("{p1}"): {p2}': "Clip {p0} («{p1}»): {p2}",
  "After Speed, a video clip and its audio no longer line up (start differs by {p0} frame(s), end by {p1} frame(s)). Check them on the timeline.":
    "Después de cambiar la velocidad, un clip de vídeo y su audio ya no coinciden (el inicio difiere {p0} fotograma(s) y el final {p1}). Revísalos en la línea de tiempo.",
  'Premiere\'s "{p0}" audio effect could not be found. Restart Premiere Pro and try again.':
    "No se encontró el efecto de audio «{p0}» de Premiere. Reinicia Premiere Pro e inténtalo de nuevo.",
  "{p0}, item {p1}: {p2}": "{p0}, elemento {p1}: {p2}",
  "Could not remove the previous render at {p0} before starting a new one — it may be locked by another process (antivirus scan, cloud-sync client). Close anything that might be reading it and try again.":
    "No se pudo eliminar el renderizado anterior en {p0} antes de empezar uno nuevo — puede que otro proceso lo tenga bloqueado (un análisis antivirus, un cliente de sincronización en la nube). Cierra lo que pueda estar leyéndolo y vuelve a intentarlo.",
  'Clip "{p0}" has an effect applied ("{p1}") that can\'t be carried over to After Effects — video is never rendered: it goes over as the original file, with only its cut points, position and speed. Remove it before sending, or exclude this clip from the selection.':
    "El clip «{p0}» tiene un efecto aplicado («{p1}») que no se puede trasladar a After Effects — el vídeo nunca se renderiza: pasa como el archivo original, solo con sus puntos de corte, posición y velocidad. Quítalo antes de enviar o excluye este clip de la selección.",
  'Clip "{p0}" has Pitch applied — Send to AE never renders: it rebuilds the cut in After Effects from the original file, with only cut points, positions and speed. Remove Pitch before sending, or use "Render full timeline for AE" in the Pacing tab instead, which bakes everything (including Pitch) into one file first.':
    "El clip «{p0}» tiene tono aplicado — «Enviar a After Effects» nunca renderiza: reconstruye el montaje en After Effects a partir del archivo original, solo con los puntos de corte, las posiciones y la velocidad. Quita el tono antes de enviar, o usa «Renderizar toda la línea de tiempo para AE» en la pestaña «Ritmo», que primero integra todo (incluido el tono) en un solo archivo.",
  'Clip "{p0}" has an effect applied ("{p1}") that can\'t be carried over to After Effects — Send to AE rebuilds the cut there from the original file, with only cut points, positions and speed. Remove it before sending, or use "Render full timeline for AE" in the Pacing tab instead, which bakes everything into one file first.':
    "El clip «{p0}» tiene un efecto aplicado («{p1}») que no se puede trasladar a After Effects — «Enviar a After Effects» reconstruye allí el montaje a partir del archivo original, solo con los puntos de corte, las posiciones y la velocidad. Quítalo antes de enviar, o usa «Renderizar toda la línea de tiempo para AE» en la pestaña «Ritmo», que primero integra todo en un solo archivo.",
  "Could not open {p0} for writing.": "No se pudo abrir {p0} para escritura.",
  "Rendered file not found on disk: {p0}": "No se encontró en el disco el archivo renderizado: {p0}",
  "Premiere rejected placing the rendered file at {p0}s.": "Premiere rechazó colocar el archivo renderizado en {p0} s.",
  "Removing the rendered clip failed ({p0}).": "Falló la eliminación del clip renderizado ({p0}).",
  "Restored a piece's position, but restoring its original Speed failed ({p0}).":
    "Se restauró la posición de un fragmento, pero falló restaurar su velocidad original ({p0}).",
  "Piece {p0}: its original audio track no longer exists — skipped.":
    "Fragmento {p0}: su pista de audio original ya no existe — se omitió.",
  "Piece {p0}: could not find its original source media in the Project panel — skipped.":
    "Fragmento {p0}: no se encontró su medio de origen en el panel Proyecto — se omitió.",
  "Piece {p0}: Premiere rejected placing it at {p1}s — skipped.": "Fragmento {p0}: Premiere rechazó colocarlo en {p1} s — se omitió.",
  "Piece {p0}: placed, but could not locate it afterward — its exact bounds/Speed were left unset.":
    "Fragmento {p0}: se colocó, pero después no se encontró — no se fijaron sus límites exactos ni su velocidad.",
  "Piece {p0}: placed, but setting its exact source range failed ({p1}).":
    "Fragmento {p0}: se colocó, pero falló fijar su rango de origen exacto ({p1}).",
  "Piece {p0}: restored, but setting its source range again after restoring its speed failed ({p1}).":
    "Fragmento {p0}: se restauró, pero falló volver a fijar su rango de origen tras restaurar la velocidad ({p1}).",
  "Piece {p0}: restored, but setting its exact end bound failed ({p1}).":
    "Fragmento {p0}: se restauró, pero falló fijar su límite final exacto ({p1}).",
  "Piece {p0}: restoring it failed ({p1}).": "Fragmento {p0}: falló su restauración ({p1}).",
  "Source media not found on disk: {p0}": "No se encontró en el disco el medio de origen: {p0}",
  "segment {p0}: {p1}": "Segmento {p0}: {p1}",
  'file {p0} ("{p1}"): not found on disk.': "Archivo {p0} («{p1}»): no se encontró en el disco.",
  'file {p0} ("{p1}"): {p2}': "Archivo {p0} («{p1}»): {p2}",
  "Could not make the composition longer ({p0}s needed). Pieces near its end may be cut off: {p1}":
    "No se pudo alargar la composición (se necesitan {p0} s). Los fragmentos cerca de su final pueden quedar recortados: {p1}",
  'The data sent from Premiere can\'t be read (unknown mode "{p0}"). Send it again from Premiere.':
    "Los datos enviados desde Premiere no se pueden leer (modo desconocido «{p0}»). Vuelve a enviarlos desde Premiere.",
  "Layer index {p0} is no longer an audio/video layer — skipped.": "La capa con índice {p0} ya no es una capa de audio/vídeo — se omitió.",
  "Layer index {p0}: {p1}": "Capa con índice {p0}: {p1}",
  "{p0} of {p1} cut points didn't actually split the clip (at {p2}s) — that silence may not have been fully removed.":
    "{p0} de {p1} puntos de corte no llegaron a dividir el clip (en {p2} s) — puede que ese silencio no se haya eliminado por completo.",
  "Cannot cut this clip: Premiere didn't split it — {p0} If its track is locked, unlock it and try again; otherwise run Diagnostics from the gear menu and add the report to a bug report.":
    "No se pudo cortar este clip: Premiere no lo dividió — {p0} Si su pista está bloqueada, desbloquéala e inténtalo de nuevo; si no, ejecuta el diagnóstico desde el menú del engranaje y adjunta el informe al comunicar el error.",
  "{p0} split(s) may already be on the track. Check the clip before trying again.":
    "puede que ya haya {p0} corte(s) en la pista. Revisa el clip antes de volver a intentarlo.",
  "left untouched.": "se dejó sin cambios.",
  'Audio track {p0} already has a clip here ("{p1}", {p2}s–{p3}s) — inserting the generated voice-over at the playhead ({p4}s) would overwrite it. Move the playhead to an empty stretch of that track, or make another audio track the first targeted one (turn on its track-targeting button in the track header, and turn it off on the audio tracks above it), and try again.':
    "La pista de audio {p0} ya tiene un clip aquí («{p1}», {p2}–{p3} s) — insertar la locución generada en el cabezal de reproducción ({p4} s) lo sobrescribiría. Mueve el cabezal a un tramo vacío de esa pista, o haz que otra pista de audio sea la primera de destino (activa su botón de destino de pista en la cabecera y desactívalo en las pistas de audio de encima), y vuelve a intentarlo.",
  "the alternating audio track ({p0})": "la pista de audio alterna ({p0})",
  "the same audio track": "la misma pista de audio",
  "the alternating video track": "la pista de vídeo alterna",
  "the linked video track": "la pista de vídeo vinculada",
  "The plugin's scripting part didn't load. Quit and reopen the host application (Premiere Pro or After Effects).":
    "La parte de scripts del plugin no se cargó. Cierra y vuelve a abrir la aplicación (Premiere Pro o After Effects).",
  "audio": "audio",
  "video": "vídeo",
  // Eleven v4, v3's 5,000-character limit, v2 break-tag tip.
  'Model: v2 (Multilingual v2) is the default. v3 and v4 are ElevenLabs\' expressive models; for them, "Improve for voice" can add audio tags such as [excited] or [whispers] and mark the pronunciation of hard words with inline IPA. v4 is the newest. ElevenLabs calls it an upgrade over v3 in almost every case, and it follows tags more reliably. It uses only Stability and Similarity, without Speed, Style or Speaker Boost; v3 uses Stability alone. v3\'s audio tags work mainly at the lower, "Creative" end of Realism. Per request, v2 and v4 take up to 10,000 characters and v3 up to 5,000.':
    "Modelo: v2 (Multilingual v2) es el predeterminado. v3 y v4 son los modelos expresivos de ElevenLabs; para ellos, «Mejorar para voz» puede añadir etiquetas de audio como [excited] o [whispers] y marcar la pronunciación de palabras difíciles con AFI en línea. v4 es el más nuevo. Según ElevenLabs, supera a v3 en casi todos los casos, y sigue las etiquetas con más fiabilidad. Solo usa Estabilidad y Similitud, sin Velocidad, Estilo ni Refuerzo de voz; v3 solo usa Estabilidad. Las etiquetas de audio de v3 funcionan sobre todo en el extremo bajo del realismo («Creative»). Por solicitud, v2 y v4 admiten hasta 10 000 caracteres y v3 hasta 5000.",
  '"Improve for voice" sends your text to OpenAI or Anthropic, whichever you pick, with your own API key (stored locally like the ElevenLabs key), to tighten the phrasing and punctuation for speaking. On v2 it changes only wording and punctuation, because v2 would read bracketed tags aloud as text. On v3 and v4, which understand tags, it can also add audio tags; the Pacing only / Natural / Expressive switch under the button sets how far it goes.':
    "«Mejorar para voz» envía tu texto a OpenAI o Anthropic, el que elijas, con tu propia clave de API (guardada localmente igual que la de ElevenLabs), para ajustar la redacción y la puntuación pensando en la lectura en voz alta. En v2 solo cambia la redacción y la puntuación, porque v2 leería en voz alta las etiquetas entre corchetes como texto. En v3 y v4, que entienden las etiquetas, también puede añadir etiquetas de audio; el selector Solo ritmo / Natural / Expresivo bajo el botón define hasta dónde llega.",
  'Pacing only / Natural / Expressive: "Pacing only" adjusts punctuation (and, on v3 and v4, adds plain [pause] tags) and adds no emotion tags. "Natural", the default, sits in between. "Expressive" (v3 and v4 only) uses emotion and reaction tags more freely, for a more dramatic read.':
    "Solo ritmo / Natural / Expresivo: «Solo ritmo» ajusta la puntuación (y, en v3 y v4, añade etiquetas simples [pause]) sin añadir etiquetas de emoción. «Natural», el predeterminado, queda en medio. «Expresivo» (solo v3 y v4) usa con más libertad las etiquetas de emoción y reacción, para una lectura más dramática.",
  "Style: leave it near 0 unless you want a stronger character or more emotion. It exists only on v2 and for Voice Changer: v3 uses Stability alone, v4 Stability and Similarity.":
    "Estilo: déjalo cerca de 0 salvo que quieras una lectura con más carácter o emoción. Solo existe en v2 y para el Conversor de voz: v3 usa solo Estabilidad, y v4 Estabilidad y Similitud.",
  "v4 (newest)": "v4 (más nuevo)",
  "v4 has no Speed, Style or Speaker Boost setting — set the pace with punctuation and tags in the text instead.":
    "v4 no tiene ajustes de Velocidad, Estilo ni Refuerzo de voz — marca el ritmo con la puntuación y las etiquetas del texto.",
  "v3 takes Stability only: it has no Similarity, Style, Speed or Speaker Boost setting. Set the pace and delivery with punctuation and audio tags in the text instead.":
    "v3 solo usa Estabilidad: no tiene Similitud, Estilo, Velocidad ni Refuerzo de voz. Marca el ritmo y la entrega con la puntuación y las etiquetas de audio del texto.",
  "Forces v3/v4 to read the text in a specific language instead of auto-detecting it — only useful for short/ambiguous text the model might otherwise misread. Ignored on v2 (it always auto-detects).":
    "Obliga a v3/v4 a leer el texto en un idioma específico en lugar de detectarlo automáticamente — solo es útil para texto corto o ambiguo que el modelo podría leer mal de otro modo. Se ignora en v2 (que siempre detecta el idioma automáticamente).",
  "{count} characters — v3 caps requests at 5,000. Split this into multiple generations or switch to v2 or v4 above.":
    "{count} caracteres — v3 limita las solicitudes a 5000. Divide el texto en varias generaciones o cambia a v2 o v4 arriba.",
  "model, which also takes an explicit pause tag,": "de ElevenLabs, que además acepta una etiqueta de pausa explícita,",
  "(up to 3 seconds) — the only model here that does. Bracketed emotion tags like":
    "(hasta 3 segundos) — el único modelo de aquí que lo hace. Las etiquetas de emoción entre corchetes como",
  "only work on v3 and v4 (switch above), so they won't do anything here.":
    "solo funcionan en v3 y v4 (cámbiate arriba) — aquí no tendrán ningún efecto.",
  "— v4 follows them more reliably than v3, also takes short directions in plain words, e.g.":
    "— v4 las sigue con más fiabilidad que v3 y también acepta indicaciones breves en palabras normales, por ejemplo",
  ", and performs several tags in a row in the order written.": ", y ejecuta varias etiquetas seguidas en el orden en que están escritas.",
  "comes from punctuation (ellipses for a pause and weight, CAPS for emphasis) and the plain":
    "viene de la puntuación (puntos suspensivos para pausa y peso, MAYÚSCULAS para énfasis) y de las etiquetas simples",
  "tags — v4 has no": "— v4 no tiene la etiqueta",
  "tag and no Speed setting.": "ni ajuste de Velocidad.",
  '— "Improve for voice" applies this automatically when v4 is selected.':
    "— «Mejorar para voz» aplica esto automáticamente cuando se selecciona v4.",
  "— {count} chars, over v3's 5,000 cap": "— {count} caracteres, supera el límite de 5000 de v3",
  "One or more queued lines exceed v3's 5,000-character cap (marked above). Split them into shorter lines or switch to v2 or v4 — Generate All stays off until then.":
    "Una o más líneas en cola superan el límite de 5000 caracteres de v3 (marcado arriba). Divídelas en líneas más cortas o cambia a v2 o v4 — hasta entonces «Generar todo» queda desactivado.",
  // Batch request stitching.
  "On ElevenLabs v2 and v4, each line is sent together with the end of the line before it and the start of the line after it, so the voice carries its intonation across clips instead of starting fresh every time (ElevenLabs' \"request stitching\"; not available on v3). Only the line itself is spoken. ElevenLabs doesn't say whether that neighbouring text counts toward your credits; the Diagnostics report (gear icon > Run Diagnostics) lists the cost ElevenLabs reports for each line.":
    "En ElevenLabs v2 y v4, cada línea se envía junto con el final de la anterior y el comienzo de la siguiente, para que la voz mantenga la entonación entre clips en lugar de empezar de cero cada vez («request stitching» de ElevenLabs; no disponible en v3). Solo se pronuncia la propia línea. ElevenLabs no indica si ese texto vecino cuenta para tus créditos; el informe de diagnóstico (icono del engranaje > «Ejecutar diagnóstico») muestra el coste que ElevenLabs informa para cada línea.",
  // Natural pitch
  "Natural pitch is applied to the cut pieces. Revert it first (Pacing → Pitch correction → Natural), then undo the Cut.":
    "Se aplicó el tono natural a los fragmentos cortados. Reviértelo primero (Ritmo → Corrección de tono → Natural) y luego deshaz el corte.",
  "Natural pitch is applied to these pieces. Revert it first (Pitch correction → Natural), change Speed, then apply Natural pitch again.":
    "Se aplicó el tono natural a estos fragmentos. Reviértelo primero (Corrección de tono → Natural), cambia la velocidad y vuelve a aplicar el tono natural.",
  "Natural pitch is already applied to these pieces. Revert it first to apply it again.":
    "El tono natural ya está aplicado a estos fragmentos. Reviértelo primero para volver a aplicarlo.",
  "Reading the selected pieces…": "Leyendo los fragmentos seleccionados…",
  "Rendering natural pitch ({n} of {total})…": "Renderizando el tono natural ({n} de {total})…",
  "Replacing the pieces…": "Reemplazando los fragmentos…",
  "Some of the original pieces had Pitch Shifter and some didn't — add it again where you need it (Calculator gives the values).":
    "Algunos de los fragmentos originales tenían Pitch Shifter y otros no: vuelve a añadirlo donde lo necesites (Calculadora da los valores).",
  "J/L Pacing was run after Natural pitch. The replaced pieces are back where they were before Natural pitch; pieces at 100% speed keep their later J/L position. Run Reset and Make J/L Cut again to line everything up.":
    "Se ejecutó J/L Pacing después del tono natural. Los fragmentos reemplazados vuelven a donde estaban antes del tono natural; los fragmentos al 100 % de velocidad conservan su posición posterior de J/L. Pulsa «Restablecer» y luego otra vez «Aplicar J/L Cut» para alinearlo todo.",
  "Re-renders each sped-up piece with ffmpeg so it keeps the original pitch, and puts it back in the same place at 100% speed. Uses each piece's current speed — set it with Speed % above first. J/L Pacing and Send to After Effects keep working on the result; send pieces from one file at a time (the rendered pieces of one speed, or the untouched ones).":
    "Vuelve a renderizar con ffmpeg cada fragmento acelerado para que conserve el tono original y lo coloca en el mismo lugar al 100 % de velocidad. Usa la velocidad actual de cada fragmento: ajústala antes con «Velocidad, %» arriba. J/L Pacing y el envío a After Effects siguen funcionando con el resultado; envía fragmentos de un solo archivo cada vez (los renderizados de una misma velocidad o los que no se tocaron).",
  "Apply Natural pitch": "Aplicar tono natural",
  "Revert": "Revertir",
  "Natural pitch applied to {count} piece(s).": "Tono natural aplicado a {count} fragmento(s).",
  "No selected piece has a speed change — nothing to do.":
    "Ningún fragmento seleccionado tiene un cambio de velocidad: no hay nada que hacer.",
  'To change the speed again, Revert first. The rendered files are in the "Renders" folder under "AI Voice Master Tool".':
    "Para cambiar la velocidad de nuevo, pulsa Revertir primero. Los archivos renderizados están en la carpeta «Renders» dentro de «AI Voice Master Tool».",
  "Nothing to replace — no selected piece has a speed change.":
    "No hay nada que reemplazar: ningún fragmento seleccionado tiene un cambio de velocidad.",
  "Natural pitch: the rendered files don't match the selected pieces. Nothing was replaced. Run Natural pitch again.":
    "Tono natural: los archivos renderizados no coinciden con los fragmentos seleccionados. No se reemplazó nada. Vuelve a aplicar el tono natural.",
  "The timeline changed while rendering — a selected piece moved or is gone. Nothing was replaced. Select the pieces and run Natural pitch again.":
    "La línea de tiempo cambió durante el renderizado: un fragmento seleccionado se movió o ya no está. No se reemplazó nada. Selecciona los fragmentos y vuelve a aplicar el tono natural.",
  "Premiere rejected importing the rendered natural-pitch files. Nothing was replaced.":
    "Premiere rechazó importar los archivos renderizados. No se reemplazó nada.",
  "Import appeared to succeed, but a rendered file could not be found in the project. Nothing was replaced.":
    "La importación pareció funcionar, pero no se encontró un archivo renderizado en el proyecto. No se reemplazó nada.",
  "No original pieces were recorded for Natural pitch — nothing to restore.":
    "No se registraron fragmentos originales para el tono natural: no hay nada que restaurar.",
  "Could not find the natural-pitch clips on the timeline — they may already have been deleted. Restoring the original pieces anyway.":
    "No se encontraron los clips con tono natural en la línea de tiempo; puede que ya se hayan eliminado. Se restauran los fragmentos originales de todos modos.",
  'Piece {p0}: its effect "{p1}" is not in the rendered audio — add it again if you need it.':
    "Fragmento {p0}: su efecto «{p1}» no está en el audio renderizado; vuelve a añadirlo si lo necesitas.",
  "Piece {p0}: its source range falls outside the rendered file — left unchanged.":
    "Fragmento {p0}: su rango de origen queda fuera del archivo renderizado; se dejó sin cambios.",
  "Piece {p0}: could not link the new audio to its video. J/L Pacing would move this audio without its video.":
    "Fragmento {p0}: no se pudo vincular el nuevo audio con su vídeo. J/L Pacing movería este audio sin su vídeo.",
  "Removing a natural-pitch clip failed ({p0}).": "No se pudo eliminar un clip con tono natural ({p0}).",
  "Restored piece at {p0}s: could not link it to its video again.":
    "Fragmento restaurado en {p0} s: no se pudo volver a vincular con su vídeo.",
  'Natural mode re-renders each sped-up piece with the bundled ffmpeg (its "atempo" time-stretch, which keeps the original pitch) and puts the result back in the same place at 100% speed, instead of adding Pitch Shifter. It usually sounds more natural than speed plus a pitch effect. It uses each piece\'s current speed, so set the speed with Speed % and Apply Speed first. The original pieces are replaced; Revert puts them back in one click. J/L Pacing and Send to After Effects keep working on the result, and J/L fades already on the pieces are kept while the plugin remembers that J/L run. Send to After Effects needs the selected pieces to come from one file: select the rendered pieces of one speed, or the untouched ones, and send each group separately. To change the speed again, Revert first. Effects other than Pitch on a replaced piece are not in the rendered audio. The rendered WAV files go to the "Renders" folder under "AI Voice Master Tool" (in Documents, or next to your project if Save Renders is set to "Next to project"). Next to each rendered WAV is a small ".source.json" file that holds the path of the recording it came from; J/L Pacing reads it to tell the pieces of one Cut from other clips.':
    "El modo Natural vuelve a renderizar cada fragmento acelerado con el ffmpeg incluido (su estiramiento «atempo», que conserva el tono original) y coloca el resultado en el mismo lugar al 100 % de velocidad, en lugar de añadir Pitch Shifter. Suele sonar más natural que la velocidad más un efecto de tono. Usa la velocidad actual de cada fragmento, así que ajústala antes con «Velocidad, %» y Aplicar velocidad. Los fragmentos originales se reemplazan; Revertir los devuelve con un clic. J/L Pacing y el envío a After Effects siguen funcionando con el resultado, y se conservan los fundidos J/L que ya tengan los fragmentos mientras el plugin recuerde esa ejecución de J/L. Enviar a After Effects necesita que los fragmentos seleccionados vengan de un solo archivo: selecciona los fragmentos renderizados de una misma velocidad, o los que no se tocaron, y envía cada grupo por separado. Para cambiar la velocidad de nuevo, pulsa Revertir primero. Los efectos distintos del tono de un fragmento reemplazado no están en el audio renderizado. Los archivos WAV renderizados se guardan en la carpeta «Renders» dentro de «AI Voice Master Tool» (en Documentos, o junto a tu proyecto si «Guardar renderizados» está en «Junto al proyecto»). Junto a cada WAV renderizado hay un pequeño archivo «.source.json» con la ruta de la grabación de la que procede; J/L Pacing lo lee para distinguir los fragmentos de un corte de otros clips.",
  "Long texts are split into sentences, generated in parts and joined into one file, with a short pause at each join.":
    "Los textos largos se dividen en frases, se generan por partes y se unen en un solo archivo, con una breve pausa en cada unión.",
  "The text was too long for one Kokoro pass, so it was generated in {count} parts and joined into one file. Listen to the joins.":
    "El texto era demasiado largo para una sola pasada de Kokoro, así que se generó en {count} partes y se unió en un solo archivo. Escucha las uniones.",
  "This clip has more linked audio channels on audio track(s) {tracks}. Cut works on one channel, so the others would go out of sync: Alt/Option-click the channel you don't need and delete it (the clip stays linked to its video), then Scan again. Scan hears the file's full mix, so if that channel carries other sound, export the voice channel as its own mono file first.":
    "Este clip tiene más canales de audio vinculados en la(s) pista(s) de audio {tracks}. El corte trabaja con un solo canal, así que los demás se desincronizarían: haz Alt/Opción-clic en el canal que no necesitas y bórralo (el clip sigue vinculado a su vídeo), luego vuelve a analizar. El análisis escucha la mezcla completa del archivo, así que si ese canal lleva otro sonido, exporta antes el canal de voz como su propio archivo mono.",
  "Some pieces were trimmed or changed since the Cut — applying Speed to the current selection instead of rebuilding, so your manual edits are kept.":
    "Algunos fragmentos se recortaron o cambiaron después del corte — la velocidad se aplica a la selección actual sin reconstruir, para conservar tus ediciones manuales.",
  "Every line is already on the timeline. Add new lines, or use Undo to place them again.":
    "Todas las líneas ya están en la línea de tiempo. Añade líneas nuevas o usa Deshacer para volver a colocarlas.",
  "The selected clip isn't the one that was scanned: it's another part of \"{name}\", or it was trimmed since Scan. Select the scanned clip again, or Scan this one, before cutting.":
    "El clip seleccionado no es el que se analizó: es otra parte de «{name}» o se recortó después del análisis. Vuelve a seleccionar el clip analizado, o analiza este, antes de cortar.",
  "Effects on these pieces will be removed": "Los efectos de estos fragmentos se perderán",
  "{action} places fresh clips from the source file, so effects, volume and Motion changes and keyframes on the current pieces are not kept.":
    "«{action}» coloca clips nuevos desde el archivo de origen, así que los efectos, los cambios de volumen y de Movimiento y los fotogramas clave de los fragmentos actuales no se conservan.",
  "Found: {effects}": "Encontrado: {effects}",
  "Tip: add effects after Cut, J/L Pacing and Speed, as the last step.":
    "Consejo: añade los efectos después del corte, J/L Pacing y la velocidad, como último paso.",
  "Continue": "Continuar",
  "Can't apply J/L Pacing: audio track {p0} is locked. Unlock it and try again.":
    "No se puede aplicar J/L Pacing: la pista de audio {p0} está bloqueada. Desbloquéala e inténtalo de nuevo.",
  'Cannot undo: "{p0}" ({p1}s–{p2}s) plays the same part of the recording as another of this Cut\'s pieces, so it looks like a copy. Move it to free space, then try again. Nothing was changed.':
    "No se puede deshacer: «{p0}» ({p1} s–{p2} s) reproduce la misma parte de la grabación que otro fragmento de este corte, así que parece una copia. Muévela a un espacio libre e inténtalo de nuevo. No se cambió nada.",
  'Cannot apply Speed: "{p0}" on audio track {p1} ({p2}s–{p3}s) plays the same part of the recording as another of this Cut\'s pieces, so it looks like a copy. Move it to free space, then try again.':
    "No se puede aplicar la velocidad: «{p0}» en la pista de audio {p1} ({p2} s–{p3} s) reproduce la misma parte de la grabación que otro fragmento de este corte, así que parece una copia. Muévela a un espacio libre e inténtalo de nuevo.",
  "Can't apply J/L Pacing: \"{p0}\" on audio track {p1} ({p2}s–{p3}s) comes from the same recording as the pieces but isn't selected, and J/L Pacing, which uses that track for its overlaps, would remove it. If it is one of the pieces, select it too; if it is another part of the recording (a second speaker, for example), move it to another audio track. Then try again.":
    "No se puede aplicar J/L Pacing: «{p0}» en la pista de audio {p1} ({p2} s–{p3} s) viene de la misma grabación que los fragmentos, pero no está seleccionado, y J/L Pacing, que usa esa pista para los solapamientos, lo eliminaría. Si es uno de los fragmentos, selecciónalo también; si es otra parte de la grabación (un segundo hablante, por ejemplo), muévelo a otra pista de audio. Después inténtalo de nuevo.",
  "Can't apply J/L Pacing: \"{p0}\" on video track {p1} ({p2}s–{p3}s) comes from the same recording as the pieces but isn't selected, and J/L Pacing, which uses that track for its overlaps, would remove it. If it is one of the pieces, select it too; if it is another part of the recording (a second speaker, for example), move it to another video track. Then try again.":
    "No se puede aplicar J/L Pacing: «{p0}» en la pista de vídeo {p1} ({p2} s–{p3} s) viene de la misma grabación que los fragmentos, pero no está seleccionado, y J/L Pacing, que usa esa pista para los solapamientos, lo eliminaría. Si es uno de los fragmentos, selecciónalo también; si es otra parte de la grabación (un segundo hablante, por ejemplo), muévelo a otra pista de vídeo. Después inténtalo de nuevo.",
  "Can't apply J/L Pacing: \"{p0}\" on audio track {p1} ({p2}s–{p3}s) comes from the same recording as the pieces but isn't selected, and J/L Pacing would remove it. Select it too, or move it out of that stretch, then try again.":
    "No se puede aplicar J/L Pacing: «{p0}» en la pista de audio {p1} ({p2} s–{p3} s) viene de la misma grabación que los fragmentos, pero no está seleccionado, y J/L Pacing lo eliminaría. Selecciónalo también o sácalo de ese tramo e inténtalo de nuevo.",
  "Can't apply J/L Pacing: \"{p0}\" on video track {p1} ({p2}s–{p3}s) comes from the same recording as the pieces but isn't selected, and J/L Pacing would remove it. Select it too, or move it out of that stretch, then try again.":
    "No se puede aplicar J/L Pacing: «{p0}» en la pista de vídeo {p1} ({p2} s–{p3} s) viene de la misma grabación que los fragmentos, pero no está seleccionado, y J/L Pacing lo eliminaría. Selecciónalo también o sácalo de ese tramo e inténtalo de nuevo.",
  "Can't apply J/L Pacing: video track {p0} is locked. Unlock it and try again.":
    "No se puede aplicar J/L Pacing: la pista de vídeo {p0} está bloqueada. Desbloquéala e inténtalo de nuevo.",
  'Can\'t apply J/L Pacing safely: "{p0}" on {p1} runs across {p2}s, where piece {p3} goes. Move it to free space (or onto a different track) before running J/L Pacing.':
    "No se puede aplicar J/L Pacing con seguridad: «{p0}» en {p1} pasa por {p2} s, donde va el fragmento {p3}. Muévelo a un espacio libre (o a otra pista) antes de aplicar J/L Pacing.",
  "Cannot apply Speed: audio track {p0} is locked. Unlock it, then try again.":
    "No se puede aplicar la velocidad: la pista de audio {p0} está bloqueada. Desbloquéala e inténtalo de nuevo.",
  "Cannot apply Speed: video track {p0} is locked. Unlock it, then try again.":
    "No se puede aplicar la velocidad: la pista de vídeo {p0} está bloqueada. Desbloquéala e inténtalo de nuevo.",
  'Cannot apply Speed: "{p0}" on audio track {p1} sits where the re-timed pieces will go ({p2}s–{p3}s). Move it to free space, then try again.':
    "No se puede aplicar la velocidad: «{p0}» en la pista de audio {p1} está donde irán los fragmentos con la nueva velocidad ({p2} s–{p3} s). Muévelo a un espacio libre e inténtalo de nuevo.",
  'Cannot apply Speed: "{p0}" on video track {p1} sits where the re-timed pieces will go ({p2}s–{p3}s). Move it to free space, then try again.':
    "No se puede aplicar la velocidad: «{p0}» en la pista de vídeo {p1} está donde irán los fragmentos con la nueva velocidad ({p2} s–{p3} s). Muévelo a un espacio libre e inténtalo de nuevo.",
  'Cannot apply Speed: this Cut was made in the sequence "{p0}". Open that sequence, then try again.':
    "No se puede aplicar la velocidad: este corte se hizo en la secuencia «{p0}». Abre esa secuencia e inténtalo de nuevo.",
  'Cannot undo: this Cut was made in the sequence "{p0}". Open that sequence, then try again. Nothing was changed.':
    "No se puede deshacer: este corte se hizo en la secuencia «{p0}». Abre esa secuencia e inténtalo de nuevo. No se cambió nada.",
  'Cannot revert: these pieces were rendered in the sequence "{p0}". Open that sequence, then try again. Nothing was changed.':
    "No se puede revertir: estos fragmentos se renderizaron en la secuencia «{p0}». Abre esa secuencia e inténtalo de nuevo. No se cambió nada.",
  'Cannot revert: Natural pitch was applied in the sequence "{p0}". Open that sequence, then try again. Nothing was changed.':
    "No se puede revertir: el tono natural se aplicó en la secuencia «{p0}». Abre esa secuencia e inténtalo de nuevo. No se cambió nada.",
  "Cannot revert: a Natural pitch render is on the timeline more often than Natural pitch placed it (at {p0}), so Revert can't tell its own clips from your copies. Delete the copies you don't need, then try again. Nothing was changed.":
    "No se puede revertir: un renderizado del tono natural aparece en la línea de tiempo más veces de las que el tono natural lo colocó (en {p0}), así que Revertir no puede distinguir sus clips de tus copias. Elimina las copias que no necesites e inténtalo de nuevo. No se cambió nada.",
  "{p0} other clip(s) of a Natural pitch render stay on the timeline (at {p1}): they aren't the clips Natural pitch placed, so Revert leaves them where they are.":
    "{p0} clip(s) más de un renderizado del tono natural siguen en la línea de tiempo (en {p1}): no son los clips que colocó el tono natural, así que Revertir los deja donde están.",
  "Cannot revert: audio track {p0}, where an original piece goes back, no longer exists. Add audio tracks (Sequence > Add Tracks) until it is there again, then try again. Nothing was changed.":
    "No se puede revertir: la pista de audio {p0}, donde vuelve un fragmento original, ya no existe. Añade pistas de audio (Sequence > Add Tracks) hasta que vuelva a estar e inténtalo de nuevo. No se cambió nada.",
  "Cannot revert: audio track {p0}, where an original piece goes back, is locked. Unlock it, then try again. Nothing was changed.":
    "No se puede revertir: la pista de audio {p0}, donde vuelve un fragmento original, está bloqueada. Desbloquéala e inténtalo de nuevo. No se cambió nada.",
  'Cannot undo: the original clip goes back at 100% speed for a moment before its Speed is set again, so it needs {p0}s of free space after {p1}s, where "{p2}" sits. Move that clip {p3}s later, then try again. Nothing was changed.':
    "No se puede deshacer: el clip original vuelve un momento a velocidad 100 % antes de recuperar su velocidad, así que necesita {p0} s de espacio libre después de {p1} s, donde está «{p2}». Mueve ese clip {p3} s más tarde e inténtalo de nuevo. No se cambió nada.",
  'Cannot revert: sped-up piece {p0} goes back at 100% speed for a moment before its Speed is set again, so it needs {p1}s of free space after {p2}s on audio track {p3}, where "{p4}" sits. Move that clip {p5}s later, then try again. Nothing was changed.':
    "No se puede revertir: el fragmento acelerado {p0} vuelve un momento a velocidad 100 % antes de recuperar su velocidad, así que necesita {p1} s de espacio libre después de {p2} s en la pista de audio {p3}, donde está «{p4}». Mueve ese clip {p5} s más tarde e inténtalo de nuevo. No se cambió nada.",
  "Audio track {p0}, where a selected piece is replaced, is locked. Unlock it, then run Natural pitch again. Nothing was replaced.":
    "La pista de audio {p0}, donde se reemplaza un fragmento seleccionado, está bloqueada. Desbloquéala y vuelve a aplicar el tono natural. No se reemplazó nada.",
  'The timeline changed since rendering — one or more of the original pieces was moved or trimmed. Nothing was removed. Run "Render full timeline for AE" again.':
    "La línea de tiempo cambió después del renderizado — uno o varios de los fragmentos originales se movieron o se recortaron. No se eliminó nada. Vuelve a ejecutar «Renderizar toda la línea de tiempo para AE».",
  "Cannot undo: a track the original clip goes back onto is locked. Unlock it, then try again. Nothing was changed.":
    "No se puede deshacer: una pista a la que vuelve el clip original está bloqueada. Desbloquéala e inténtalo de nuevo. No se cambió nada.",
  'Cannot undo: "{p0}" now sits where the original clip goes back ({p1}s–{p2}s). Move it to free space, then try again. Nothing was changed.':
    "No se puede deshacer: «{p0}» está ahora donde vuelve el clip original ({p1} s–{p2} s). Muévelo a un espacio libre e inténtalo de nuevo. No se cambió nada.",
  "Cannot undo: \"{p0}\" ({p1}s–{p2}s) plays another part of the recording, so it isn't one of this Cut's pieces. Move it to free space, then try again. Nothing was changed.":
    "No se puede deshacer: «{p0}» ({p1} s–{p2} s) reproduce otra parte de la grabación, así que no es uno de los fragmentos de este corte. Muévelo a un espacio libre e inténtalo de nuevo. No se cambió nada.",
  "Cannot apply Speed: \"{p0}\" on audio track {p1} ({p2}s–{p3}s) plays another part of the recording, so it isn't one of this Cut's pieces. Move it to free space, then try again.":
    "No se puede aplicar la velocidad: «{p0}» en la pista de audio {p1} ({p2} s–{p3} s) reproduce otra parte de la grabación, así que no es uno de los fragmentos de este corte. Muévelo a un espacio libre e inténtalo de nuevo.",
  "The selected clip isn't the one that was scanned. Select it again, or Scan this clip, before cutting. Nothing was changed.":
    "El clip seleccionado no es el que se analizó. Vuelve a seleccionarlo, o analiza este clip, antes de cortar. No se cambió nada.",
  "This clip has more linked audio channels on audio track(s) {p0}. Cut works on one channel, so the others would go out of sync: Alt/Option-click the channel you don't need and delete it (the clip stays linked to its video), then Scan and Cut again. Nothing was changed.":
    "Este clip tiene más canales de audio vinculados en la(s) pista(s) de audio {p0}. El corte trabaja con un solo canal, así que los demás se desincronizarían: haz Alt/Opción-clic en el canal que no necesitas y bórralo (el clip sigue vinculado a su vídeo), luego vuelve a analizar y cortar. No se cambió nada.",
  "Natural pitch can't be used on a clip with more linked audio channels (audio track(s) {p0}): its render mixes the file's channels together, and would still after deleting a channel. Export the voice channel as its own mono file and cut that, or correct the pitch with a pitch plug-in of your own, using the values in Pitch correction → Calculator.":
    "El tono natural no se puede usar en un clip con más canales de audio vinculados (pista(s) de audio {p0}): su renderizado mezcla los canales del archivo, también después de borrar un canal. Exporta el canal de voz como su propio archivo mono y corta ese, o corrige el tono con tu propio plugin de tono, con los valores de Corrección de tono → Calculadora.",
  "Details": "Detalles",
  "Bundled {p0} binary not found at {p1}. This computer needs the {p2} package of the plugin — if the other one was installed, install this one instead; otherwise reinstall the plugin.":
    "No se encontró el binario incluido de {p0} en {p1}. Este equipo necesita el paquete del plugin para {p2}: si se instaló el otro, instala este; si no, reinstala el plugin.",
  "Render did not finish writing in time ({p0}). Premiere couldn't render it itself, so it went to Adobe Media Encoder, which doesn't appear to be installed on this machine. Install it (included with any Creative Cloud plan that has Premiere Pro), open it once, then in Media Encoder's own Preferences → General enable \"Automatically start queue\" — then try again.":
    "El renderizado no terminó de escribirse a tiempo ({p0}). Premiere no pudo renderizarlo por sí mismo, así que se envió a Adobe Media Encoder, que no parece estar instalado en este equipo. Instálalo (incluido en cualquier plan de Creative Cloud con Premiere Pro), ábrelo una vez y, en las preferencias del propio Media Encoder (Preferences → General), activa «Automatically start queue»; luego inténtalo de nuevo.",
  "Render did not finish writing in time ({p0}). Premiere couldn't render it itself, so it went to Adobe Media Encoder: check Media Encoder's own Queue panel — the render may be waiting there for its \"auto-start queue\" preference to be enabled (a separate application, separate setting from Premiere's own preferences).":
    "El renderizado no terminó de escribirse a tiempo ({p0}). Premiere no pudo renderizarlo por sí mismo, así que se envió a Adobe Media Encoder: revisa el panel de cola (Queue) del propio Media Encoder; puede que el renderizado esté esperando ahí a que se active la preferencia «auto-start queue» (una aplicación aparte, con un ajuste distinto de las preferencias de Premiere).",
  "The folder for generated audio could not be created ({p0}). Nothing was sent to ElevenLabs.":
    "No se pudo crear la carpeta para el audio generado ({p0}). No se envió nada a ElevenLabs.",
  "Generated audio could not be saved to {p0}: {p1}": "No se pudo guardar el audio generado en {p0}: {p1}",
  "Converted audio could not be saved to {p0}: {p1}": "No se pudo guardar el audio convertido en {p0}: {p1}",
  "ElevenLabs stopped sending the audio partway through (nothing arrived for 60 seconds). Nothing was saved or placed. Check your connection, then try again.":
    "ElevenLabs dejó de enviar el audio a mitad de camino (no llegó nada en 60 segundos). No se guardó ni se colocó nada. Revisa tu conexión y vuelve a intentarlo.",
  "ffmpeg exited with code {p0}: {p1}": "ffmpeg terminó con el código {p0}: {p1}",
  "ffmpeg finished but wrote no audio to {p0}": "ffmpeg terminó pero no escribió audio en {p0}",
  'ffmpeg got stuck reading "{p0}" and was stopped. The file may be damaged, or on a slow or disconnected drive: copy it to a local drive, or export the voice as a WAV file, and try again.':
    "ffmpeg se quedó atascado leyendo «{p0}» y el plugin lo detuvo. Puede que el archivo esté dañado o en una unidad lenta o desconectada: cópialo a una unidad local, o exporta la voz como archivo WAV, y vuelve a intentarlo.",
  'The plugin can\'t read the audio in "{p0}"{p1}. Export the voice as a WAV file (File > Export > Media, Format: Waveform Audio), import it and use that clip.':
    "El plugin no puede leer el audio de «{p0}»{p1}. Exporta la voz como archivo WAV (File > Export > Media, Format: Waveform Audio), impórtala y usa ese clip.",
  "Kokoro model failed to load{p0}. Check Diagnostics, and that the plugin installed correctly.":
    "No se pudo cargar el modelo Kokoro{p0}. Revisa el diagnóstico y que el plugin se instaló correctamente.",
  "OpenAI API returned no text.": "La API de OpenAI no devolvió texto.",
  "Claude API returned no text.": "La API de Claude no devolvió texto.",
  "Bundled export preset not found at {p0}. Reinstall the plugin.":
    "No se encontró el preajuste de exportación incluido en {p0}. Reinstala el plugin.",
  "Cannot cut: audio track {p0} is locked. Unlock it, then try again. Nothing was changed.":
    "No se puede cortar: la pista de audio {p0} está bloqueada. Desbloquéala e inténtalo de nuevo. No se cambió nada.",
  "Cannot cut: video track {p0} is locked. Unlock it, then try again. Nothing was changed.":
    "No se puede cortar: la pista de vídeo {p0} está bloqueada. Desbloquéala e inténtalo de nuevo. No se cambió nada.",
  "The project hasn't been saved yet, so new files go to Documents/AI Voice Master Tool instead of next to the project. Save the project once to use the project folder.":
    "El proyecto aún no se ha guardado, así que los archivos nuevos van a Documentos/AI Voice Master Tool en lugar de junto al proyecto. Guarda el proyecto una vez para usar su carpeta.",
  "Premiere rejected placing the rendered file at {p0}s. {p1}": "Premiere rechazó colocar el archivo renderizado en {p0} s. {p1}",
  "The original pieces were put back; nothing was replaced.": "Los fragmentos originales se volvieron a colocar; no se reemplazó nada.",
  "Nothing was removed; nothing was replaced.": "No se quitó nada; no se reemplazó nada.",
  "The removed pieces could not be put back (no restore data); use Premiere's Undo (Cmd/Ctrl+Z) to bring them back.":
    "Los fragmentos quitados no se pudieron devolver (sin datos de restauración); recupéralos con Deshacer de Premiere (Cmd/Ctrl+Z).",
  "Every original piece went back, but not exactly as before ({p0}); nothing was replaced.":
    "Todos los fragmentos originales volvieron, pero no exactamente como antes ({p0}); no se reemplazó nada.",
  "{p0} of {p1} removed piece(s) went back ({p2}). Use Premiere's Undo (Cmd/Ctrl+Z) for the rest; nothing was replaced.":
    "Volvieron {p0} de {p1} fragmento(s) quitado(s) ({p2}). Recupera el resto con Deshacer de Premiere (Cmd/Ctrl+Z); no se reemplazó nada.",
  '{p0} of the {p1} selected piece(s) could not be recorded for "Revert to segments" (their source media was not found in the project), so nothing was replaced. Reconnect the media, select the pieces and run "Render full timeline for AE" again.':
    "{p0} de los {p1} fragmento(s) seleccionado(s) no se pudieron registrar para «Restaurar fragmentos» (su medio de origen no se encontró en el proyecto), así que no se reemplazó nada. Vuelve a vincular el medio, selecciona los fragmentos y ejecuta «Renderizar toda la línea de tiempo para AE» otra vez.",
  'J/L Pacing works on the pieces of one Cut, which all play one file, but the selected audio comes from {p0} files ("{p1}" and "{p2}", for example). Select only the cut pieces (and their video), then try again. Nothing was changed.':
    "J/L Pacing trabaja con los fragmentos de un solo corte, que reproducen un mismo archivo, pero el audio seleccionado proviene de {p0} archivos (por ejemplo, «{p1}» y «{p2}»). Selecciona solo los fragmentos cortados (y su vídeo) y vuelve a intentarlo. No se cambió nada.",
  "J/L Pacing works on the pieces of one Cut, which all play one file, but the selected audio comes from {count} files. Select only the cut pieces (and their video), then try again. Nothing was changed.":
    "J/L Pacing trabaja con los fragmentos de un solo corte, que reproducen un mismo archivo, pero el audio seleccionado proviene de {count} archivos. Selecciona solo los fragmentos cortados (y su vídeo) y vuelve a intentarlo. No se cambió nada.",
  "Some selected pieces are Natural pitch renders whose source recording isn't known, selected together with other clips, so J/L Pacing can't tell whether they all belong to one Cut. Select only the Natural pitch pieces, or only clips of one file, then try again. Nothing was changed.":
    "Algunos fragmentos seleccionados son renderizados de tono natural cuya grabación de origen no se conoce, seleccionados junto con otros clips, así que J/L Pacing no puede saber si todos pertenecen a un mismo corte. Selecciona solo los fragmentos de tono natural, o solo clips de un archivo, y vuelve a intentarlo. No se cambió nada.",
  "espeak-ng exited with code {p0}: {p1}": "espeak-ng terminó con el código {p0}: {p1}",
  "No connection to the service. Check the internet connection, then try again.":
    "No hay conexión con el servicio. Comprueba la conexión a internet y vuelve a intentarlo.",
  "Revert now covers only this run. The pieces of the earlier Natural pitch run stay as rendered; Premiere's own undo history still has them.":
    "«Revertir» ahora cubre solo esta ejecución. Los fragmentos de la ejecución anterior del tono natural quedan renderizados; el historial de deshacer de Premiere aún los tiene.",
  "This voice-over was edited after it was placed (it now plays in more pieces), so the plugin's Undo can't restore it exactly. Nothing was changed — delete the pieces by hand, or use Cmd/Ctrl+Z.":
    "Esta locución se editó después de colocarla (ahora suena en varios fragmentos), así que el Deshacer del plugin no puede restaurarla con exactitud. No se cambió nada — borra los fragmentos a mano o usa Cmd/Ctrl+Z.",
  'Audio track {p0} already has a clip at the playhead ("{p1}", {p2}s–{p3}s). Move the playhead to an empty stretch of that track, or make another audio track the first targeted one (turn on its track-targeting button in the track header, and turn it off on the audio tracks above it), and try again.':
    "La pista de audio {p0} ya tiene un clip en el cabezal («{p1}», {p2} s–{p3} s). Mueve el cabezal a un tramo vacío de esa pista, o haz que otra pista de audio sea la primera de destino (activa su botón de destino de pista en la cabecera y desactívalo en las pistas de audio de encima), y vuelve a intentarlo.",
  "The selected clip is only part of a generated voice-over (it was cut or trimmed). Replace swaps a whole generated clip and would drop the full new take here. Use Generate & Insert instead, or select an uncut generated clip.":
    "El clip seleccionado es solo una parte de una locución generada (se cortó o recortó). Reemplazar cambia un clip generado entero y dejaría aquí toda la toma nueva. Usa Generar e insertar, o selecciona un clip generado sin cortar.",
  "{count} characters — this model takes up to 10,000 per generation. Split the text into several generations, for example with Batch.":
    "{count} caracteres — este modelo admite hasta 10 000 por generación. Divide el texto en varias generaciones, por ejemplo con el modo por lotes.",
  "One or more queued lines exceed this model's 10,000-character limit. Split them into shorter lines — Generate All stays off until then.":
    "Una o más líneas en cola superan el límite de 10 000 caracteres de este modelo. Divídelas en líneas más cortas — hasta entonces «Generar todo» queda desactivado.",
  "Starting over: the plugin's Undo and Revert for the previous clip are no longer available (Cmd/Ctrl+Z in Premiere still works).":
    "Empezamos de nuevo: el Deshacer y Revertir del plugin para el clip anterior ya no están disponibles (Cmd/Ctrl+Z en Premiere sigue funcionando).",
  "The selection contains Natural pitch renders, which already play at the new tempo. Revert Natural pitch first, or select the original pieces.":
    "La selección contiene renderizados de tono natural, que ya suenan al nuevo ritmo. Revierte primero el tono natural o selecciona los fragmentos originales.",
  "After Natural pitch or a full-timeline render, the pieces come from more than one file. Send each group separately (select pieces of one kind), or use Render full timeline for AE.":
    "Después del tono natural o de un renderizado de toda la línea de tiempo, los fragmentos vienen de más de un archivo. Envía cada grupo por separado (selecciona fragmentos de un mismo tipo) o usa Renderizar toda la línea de tiempo para AE.",
  "Undo, Revert and the plugin's memory": "Deshacer, Revertir y la memoria del plugin",
  "Scan works with mono and stereo files; a stereo file is heard as one mix. A file with more than two channels, or with its channels as separate audio tracks (common in camera files), is refused, and so is Natural pitch on it: export the voice as a mono file (File > Export > Media, Audio > Channels: Mono), import it and use that clip. A clip that shows up on the timeline as linked audio clips on two or more audio tracks is refused too: Alt/Option-click the channel you don't need and delete it (the clip stays linked to its video), then Scan again. Scan hears the file's full mix and Natural pitch renders it, so when that channel carries other sound, use the mono export instead.":
    "El análisis funciona con archivos mono y estéreo; un archivo estéreo se escucha como una sola mezcla. Un archivo con más de dos canales, o con los canales en pistas de audio separadas (habitual en archivos de cámara), se rechaza, y también el tono natural sobre él: exporta la voz en mono (File > Export > Media, sección Audio, Channels: Mono), impórtala y usa ese clip. Un clip que aparece en la línea de tiempo como clips de audio vinculados en dos o más pistas de audio también se rechaza: haz Alt/Opción-clic en el canal que no necesitas y bórralo (el clip sigue vinculado a su vídeo), luego vuelve a analizar. El análisis escucha la mezcla completa del archivo y el tono natural la renderiza, así que cuando ese canal lleve otro sonido, usa la exportación en mono.",
  "Scan and Natural pitch read the audio of the common files Premiere Pro imports: WAV and BWF, AIFF, MP3, AAC and M4A (also Apple Lossless), and the AAC, PCM, AC-3, MP2/MP3 or WMA audio in MOV, MP4, MXF, AVI, MTS/M2TS, MPG/VOB, MKV and WMV files. Audio in another format, such as FLAC, Opus or ADPCM, is refused with a note: export the voice as a WAV file (File > Export > Media, Format: Waveform Audio), import it and use that clip.":
    "El análisis y el tono natural leen el audio de los archivos habituales que importa Premiere Pro: WAV y BWF, AIFF, MP3, AAC y M4A (también Apple Lossless), y el audio AAC, PCM, AC-3, MP2/MP3 o WMA de los archivos MOV, MP4, MXF, AVI, MTS/M2TS, MPG/VOB, MKV y WMV. El audio en otro formato, como FLAC, Opus o ADPCM, se rechaza con un aviso: exporta la voz como archivo WAV (File > Export > Media, Format: Waveform Audio), impórtala y usa ese clip.",
  "Problems and bug reports": "Problemas e informes de errores",
  "Gear icon > Run Diagnostics saves a plain-text report to Documents/AI Voice Master Tool/Diagnostics/. It contains no API keys, and your home folder is shortened to ~, but it lists clip, sequence and file names: read it before you share it.":
    "Icono del engranaje > «Ejecutar diagnóstico» guarda un informe de texto en Documentos/AI Voice Master Tool/Diagnostics/. No contiene claves de API y tu carpeta personal aparece abreviada como ~, pero incluye nombres de clips, secuencias y archivos: léelo antes de compartirlo.",
  "To report a problem, open an issue on the project's GitHub page, github.com/ominousopera/AIVoiceMasterTool, and paste the report's text into it.":
    "Para informar de un problema, abre un issue en la página del proyecto en GitHub, github.com/ominousopera/AIVoiceMasterTool, y pega en él el texto del informe.",
  "The plugin's own Undo and Revert buttons (Cut's Undo, Revert to segments, Natural pitch's Revert, AI Voice's Undo) work from what the plugin remembers about the last operation. A new Scan clears Cut's Undo and Natural pitch's Revert and keeps Revert to segments. A new Cut clears Natural pitch's Revert and Revert to segments, and its own Undo replaces the previous Cut's. Neither touches AI Voice's Undo. Reopening the plugin or restarting Premiere clears all of them, and the buttons go away. Premiere's own Cmd/Ctrl+Z always works, one step at a time.":
    "Los propios botones Deshacer y Revertir del plugin (Deshacer del corte, Restaurar fragmentos, Revertir del tono natural, Deshacer de Voz IA) funcionan con lo que el plugin recuerda de la última operación. Un nuevo análisis borra Deshacer del corte y Revertir del tono natural, y conserva Restaurar fragmentos. Un nuevo corte borra Revertir del tono natural y Restaurar fragmentos, y su propio Deshacer sustituye al del corte anterior. Ninguno de los dos afecta a Deshacer de Voz IA. Volver a abrir el plugin o reiniciar Premiere los borra todos, y los botones desaparecen. El propio Cmd/Ctrl+Z de Premiere funciona siempre, un paso a la vez.",
  "original audio": "pista de audio original",
  "alternate audio": "pista de audio alterna",
  "original video": "pista de vídeo original",
  "alternate video": "pista de vídeo alterna",
  "The plugin can't play this file (a format its preview doesn't decode). Cutting still works; preview it in Premiere.":
    "El plugin no puede reproducir este archivo (un formato que su vista previa no decodifica). El corte funciona igual; escúchalo en Premiere.",
  "No waveform measurement for these pieces: a flat, un-measured overlap was used at every boundary. Scan the clip these pieces came from, then run J/L Pacing again for measured pacing.":
    "No hay medición de la forma de onda para estos fragmentos: en cada límite se usó un solape fijo, sin medir. Analiza el clip del que salieron estos fragmentos y vuelve a ejecutar J/L Pacing para un ritmo medido.",
  "The pieces were moved on the timeline since the Cut — applying Speed to the current selection in place instead of rebuilding, so they stay where they are.":
    "Los fragmentos se movieron en la línea de tiempo después del corte — la velocidad se aplica a la selección actual en su sitio, sin reconstruir, para que se queden donde están.",
  "Placing the generated voice-over…": "Colocando la locución generada…",
  "Undo of the last Cut is still available; the scan was cleared when another clip was selected.":
    "Deshacer el último corte sigue disponible; el análisis se borró al seleccionar otro clip.",
  "The last take was generated and saved, but not placed. Fix the spot on the timeline, then place it without generating again.":
    "La última toma se generó y se guardó, pero no se colocó. Arregla el sitio en la línea de tiempo y colócala sin generarla de nuevo.",
  "Place it again": "Colocarla de nuevo",
  "Cut works on the audio part of a clip. Select the audio clip (click it with Linked Selection on, or Alt/Option-click the audio part), then Scan and Cut again. Nothing was changed.":
    "El corte trabaja con la parte de audio del clip. Selecciona el clip de audio (haz clic con la selección vinculada activada, o Alt/Opción-clic en la parte de audio) y vuelve a analizar y cortar. No se cambió nada.",
  "Cut works on a clip whose video and audio start and end together. This clip's video part is trimmed differently from its audio (a J- or L-cut made by hand): unlink the two and cut the audio on its own, or trim both to the same bounds, then Scan and Cut again. Nothing was changed.":
    "El corte trabaja con un clip cuyo vídeo y audio empiezan y terminan juntos. La parte de vídeo de este clip está recortada de forma distinta a su audio (un corte J o L hecho a mano): desvincúlalos y corta el audio por separado, o recorta ambos a los mismos límites, y vuelve a analizar y cortar. No se cambió nada.",
  "The selected video was not sent: its clips come from more than one file, or have no media file on disk. Only the audio was sent; select video from one file to send it too.":
    "El vídeo seleccionado no se envió: sus clips vienen de más de un archivo o no tienen archivo multimedia en el disco. Solo se envió el audio; selecciona vídeo de un solo archivo para enviarlo también.",
  "Nothing was rendered or sent.": "No se renderizó ni se envió nada.",
  "Nothing was rendered.": "No se renderizó nada.",
  'Cannot apply Speed: "{p0}" on video track {p1} ({p2}s–{p3}s) shows the same part of the recording as one of this Cut\'s pieces, so it looks like a copy. Move it to free space, then try again.':
    "No se puede aplicar la velocidad: «{p0}» en la pista de vídeo {p1} ({p2} s–{p3} s) muestra la misma parte de la grabación que uno de los fragmentos de este corte, así que parece una copia. Muévelo a un espacio libre e inténtalo de nuevo.",
  "Cannot apply Speed: \"{p0}\" on video track {p1} ({p2}s–{p3}s) shows another part of the recording, so it isn't one of this Cut's pieces. Move it to free space, then try again.":
    "No se puede aplicar la velocidad: «{p0}» en la pista de vídeo {p1} ({p2} s–{p3} s) muestra otra parte de la grabación, así que no es uno de los fragmentos de este corte. Muévelo a un espacio libre e inténtalo de nuevo.",
  'Cannot undo: "{p0}" on the video track ({p1}s–{p2}s) shows the same part of the recording as one of this Cut\'s pieces, so it looks like a copy. Move it to free space, then try again. Nothing was changed.':
    "No se puede deshacer: «{p0}» en la pista de vídeo ({p1} s–{p2} s) muestra la misma parte de la grabación que uno de los fragmentos de este corte, así que parece una copia. Muévelo a un espacio libre e inténtalo de nuevo. No se cambió nada.",
  "Cannot undo: \"{p0}\" on the video track ({p1}s–{p2}s) shows another part of the recording, so it isn't one of this Cut's pieces. Move it to free space, then try again. Nothing was changed.":
    "No se puede deshacer: «{p0}» en la pista de vídeo ({p1} s–{p2} s) muestra otra parte de la grabación, así que no es uno de los fragmentos de este corte. Muévelo a un espacio libre e inténtalo de nuevo. No se cambió nada.",
  '"{p0}" is disabled (greyed out), so its render would be silent. Enable it (right-click > Enable), or select the take that is playing, then try again. {p1}':
    "«{p0}» está desactivado (en gris), así que su renderizado sería silencio. Habilítalo (clic derecho > Habilitar (Enable)), o selecciona la toma que suena, e inténtalo de nuevo. {p1}",
  "Audio track {p0} is muted, so the render would be silent. Unmute it, then try again. {p1}":
    "La pista de audio {p0} está silenciada, así que el renderizado sería silencio. Quita el silencio e inténtalo de nuevo. {p1}",
  "Audio track {p0} is locked, so the generated voice-over can't be placed there. Unlock it, or make another audio track the first targeted one (turn on its track-targeting button in the track header, and turn it off on the audio tracks above it), and try again.":
    "La pista de audio {p0} está bloqueada, así que la locución generada no se puede colocar ahí. Desbloquéala, o haz que otra pista de audio sea la primera de destino (activa su botón de destino de pista en la cabecera y desactívalo en las pistas de audio de encima), y vuelve a intentarlo.",
  'Cannot apply Speed: the re-timed pieces go back at 100% speed for a moment before their Speed is set, so they need {p0}s of free space after {p1}s, where "{p2}" sits. Move that clip {p3}s later, then try again.':
    "No se puede aplicar la velocidad: los fragmentos reconstruidos vuelven un momento a velocidad 100 % antes de recibir su velocidad, así que necesitan {p0} s de espacio libre después de {p1} s, donde está «{p2}». Mueve ese clip {p3} s más tarde e inténtalo de nuevo.",
  "Cannot undo: pieces of this Cut now run past the original clip's end ({p0}s), most likely after a Speed below 100%. Set Speed back to 100% in the Pacing tab, then undo. Nothing was changed.":
    "No se puede deshacer: los fragmentos de este corte ahora pasan del final del clip original ({p0} s), probablemente tras una velocidad inferior al 100 %. Vuelve a poner la velocidad al 100 % en la pestaña Ritmo y luego deshaz. No se cambió nada.",
  "The folder {p0} could not be created. Check that the location is writable, then try again.":
    "No se pudo crear la carpeta {p0}. Comprueba que se puede escribir en esa ubicación e inténtalo de nuevo.",
  'Audio track {p0}, where an original piece sits, is locked. Unlock it, then run "Render full timeline for AE" again. Nothing was removed.':
    "La pista de audio {p0}, donde está un fragmento original, está bloqueada. Desbloquéala y vuelve a ejecutar «Renderizar toda la línea de tiempo para AE». No se quitó nada.",
  'Audio track {p0}, where the rendered file goes, is locked. Unlock it, then run "Render full timeline for AE" again. Nothing was removed.':
    "La pista de audio {p0}, donde va el archivo renderizado, está bloqueada. Desbloquéala y vuelve a ejecutar «Renderizar toda la línea de tiempo para AE». No se quitó nada.",
  "Audio track {p0}, where a selected piece sits, is locked. Unlock it, then try again. Nothing was rendered.":
    "La pista de audio {p0}, donde está un fragmento seleccionado, está bloqueada. Desbloquéala e inténtalo de nuevo. No se renderizó nada.",
  'Premiere could not remove "{p0}" ({p1}). {p2}': "Premiere no pudo quitar «{p0}» ({p1}). {p2}",
  'Premiere did not remove "{p0}". {p1}': "Premiere no quitó «{p0}». {p1}",
  "Premiere failed while placing the rendered file ({p0}). {p1}": "Premiere falló al colocar el archivo renderizado ({p0}). {p1}",
  "Premiere failed while placing the rendered file ({p0}).": "Premiere falló al colocar el archivo renderizado ({p0}).",
  "Natural pitch: Premiere rejected placing the audio for piece {p0}{p1}. Everything was put back; nothing was replaced. Try again, or check that stretch of the timeline in Premiere.":
    "Tono natural: Premiere rechazó colocar el audio del fragmento {p0}{p1}. Todo se devolvió; no se reemplazó nada. Inténtalo de nuevo o revisa ese tramo de la línea de tiempo en Premiere.",
  "Could not remove an already placed natural-pitch clip ({p0}).": "No se pudo quitar un clip de tono natural ya colocado ({p0}).",
  "Render did not finish writing in time ({p0}). Premiere reported the render as done, so check that folder: if the file is there and plays, the location is slow to report it — try again; otherwise render again.":
    "El renderizado no terminó de escribirse a tiempo ({p0}). Premiere informó de que el renderizado estaba hecho, así que revisa esa carpeta: si el archivo está y se reproduce, esa ubicación tarda en informar — inténtalo de nuevo; si no, renderiza otra vez.",
  // settings.json / presets.json that can't be read (dataFileMessages.ts).
  "saved API keys and settings": "claves de API y ajustes guardados",
  "saved Silence Cut presets": "preajustes guardados de Corte de silencios",
  "Couldn't read {file} ({what}): {code}. Another program, such as an antivirus or backup tool, may be using it. What it holds isn't shown here, and nothing was written over it. Close and reopen the plugin to try again.":
    "No se pudo leer {file} ({what}): {code}. Puede que otro programa, como un antivirus o una herramienta de copia de seguridad, lo esté usando. Su contenido no se muestra aquí y no se escribió nada encima. Cierra y vuelve a abrir el plugin para intentarlo de nuevo.",
  "A change wasn't saved: couldn't read {file} ({what}): {code}. Saving now would have replaced what it holds. Another program, such as an antivirus or backup tool, may be using it. Try again in a moment.":
    "Un cambio no se guardó: no se pudo leer {file} ({what}): {code}. Guardar ahora habría reemplazado su contenido. Puede que otro programa, como un antivirus o una herramienta de copia de seguridad, lo esté usando. Inténtalo de nuevo en un momento.",
  "The file {file} ({what}) is damaged and can't be read, so what it holds isn't shown here. A copy was kept as {copy}. Nothing is saved over the damaged file until you close and reopen the plugin; after that, your next change replaces it.":
    "El archivo {file} ({what}) está dañado y no se puede leer, así que su contenido no se muestra aquí. Se guardó una copia como {copy}. No se guarda nada encima del archivo dañado hasta que cierres y vuelvas a abrir el plugin; después, tu próximo cambio lo reemplaza.",
  "The file {file} ({what}) is damaged and can't be read, so what it holds isn't shown here. A copy of it was kept earlier as {copy}. Your next change replaces the damaged file.":
    "El archivo {file} ({what}) está dañado y no se puede leer, así que su contenido no se muestra aquí. Antes se guardó una copia como {copy}. Tu próximo cambio reemplaza el archivo dañado.",
  "The file {file} ({what}) is damaged and can't be read, so what it holds isn't shown here. A copy of it couldn't be made, so nothing is saved over it.":
    "El archivo {file} ({what}) está dañado y no se puede leer, así que su contenido no se muestra aquí. No se pudo hacer una copia, así que no se guarda nada encima.",
  "A sped-up voice also sounds higher, and Pitch correction brings the pitch back. Natural re-renders the pieces at their original pitch. Calculator only shows the correction values, to type into a pitch plugin of your own.":
    "Una voz acelerada también suena más aguda, y Corrección de tono devuelve el tono original. Natural vuelve a renderizar los fragmentos con su tono original. Calculadora solo muestra los valores de corrección, para escribirlos en tu propio plugin de tono.",
  "Calculator shows the semitones, cents and ratio that undo the pitch change of the Speed % value above, to type into a pitch plugin's own controls (Premiere's own Pitch Shifter or a third-party one). It changes nothing on the timeline. Use it where Natural can't be used, such as a camera clip whose audio Premiere shows as several linked channels: Natural refuses those, since its render would mix the channels together.":
    "Calculadora muestra los semitonos, cents y ratio que deshacen el cambio de tono del valor de «Velocidad, %» de arriba, para escribirlos en los controles de un plugin de tono (el propio Pitch Shifter de Premiere o uno de terceros). No cambia nada en la línea de tiempo. Úsala donde Natural no se puede usar, como un clip de cámara cuyo audio Premiere muestra como varios canales vinculados: Natural los rechaza, porque su renderizado mezclaría los canales.",
  "In After Effects the pieces climb as a staircase: the first piece on the lowest layer, each later one a layer above. Where pieces with picture overlap after J/L Pacing, the one Premiere shows on top stays on top, so neighbours there swap in pairs. Pieces made by Natural pitch are sent the same way, one layer each, at 100% speed.":
    "En After Effects los fragmentos suben en escalera: el primero en la capa más baja y cada uno de los siguientes una capa más arriba. Donde fragmentos con imagen se solapan tras J/L Pacing, el que Premiere muestra encima sigue encima, así que ahí los vecinos se intercambian por parejas. Los fragmentos hechos con el tono natural se envían igual, una capa cada uno, al 100 % de velocidad.",
  "Calculator": "Calculadora",
  "Selected clips have different speeds ({speeds}%) — type one manually above, or use Natural instead (it corrects each piece at its own speed).":
    "Los clips seleccionados tienen velocidades distintas ({speeds}%) — escribe un valor manualmente arriba, o usa Natural (corrige cada fragmento a su propia velocidad).",
  "Pitch Shifter couldn't be put back on every rebuilt piece:":
    "No se pudo volver a poner Pitch Shifter en todos los fragmentos reconstruidos:",
  // Update notice (updateCheck.ts).
  "Could not check: no internet connection.": "No se pudo comprobar: no hay conexión a internet.",
  "Could not check: GitHub's limit of checks from this address is used up for now. The release page shows the newest version.":
    "No se pudo comprobar: por ahora se agotó el límite de consultas a GitHub desde esta dirección. La página de la versión muestra la más reciente.",
  "Could not check: GitHub did not answer within {seconds} seconds.": "No se pudo comprobar: GitHub no respondió en {seconds} segundos.",
  "Could not check: GitHub answered with code {status}.": "No se pudo comprobar: GitHub respondió con el código {status}.",
  "Could not check: GitHub could not be reached.": "No se pudo comprobar: no se pudo conectar con GitHub.",
  "Could not check: GitHub's answer could not be read.": "No se pudo comprobar: no se pudo leer la respuesta de GitHub.",
  "Diagnostics & feedback (a new version is out)": "Diagnóstico y comentarios (hay una versión nueva)",
  "Updates": "Actualizaciones",
  "Tell me when a new version is out": "Avisarme cuando salga una versión nueva",
  "Checking…": "Comprobando…",
  "Check now": "Comprobar ahora",
  "Version {latest} is out (you have {version}).": "Ya está la versión {latest} (tienes la {version}).",
  "No newer release found. Installed version: {version}.": "No hay una versión más reciente. Versión instalada: {version}.",
  "It will try again the next time the plugin opens.": "Se volverá a intentar la próxima vez que se abra el plugin.",
  "Open the release page": "Abrir la página de la versión",
  "Check now asks GitHub once for the newest version number. With the switch on, the plugin also asks when it opens, every three days at most. Nothing about you or your projects is sent, and nothing is downloaded: install an update yourself from the release page.":
    "«Comprobar ahora» consulta a GitHub una sola vez el número de la versión más reciente. Con la casilla activada, el plugin también consulta al abrirse, como mucho cada tres días. No se envía nada sobre ti ni sobre tus proyectos, y no se descarga nada: instala la actualización tú mismo desde la página de la versión.",
  "Tell you about new versions?": "¿Avisarte de versiones nuevas?",
  "The plugin can ask GitHub every three days whether a newer version is out, and put a dot on the gear icon when one is. Nothing about you or your projects is sent, and nothing is downloaded or installed: you install updates yourself from the release page. Silence Cut, Pacing and Kokoro work offline either way.":
    "El plugin puede consultar a GitHub cada tres días si hay una versión nueva y poner un punto en el icono del engranaje cuando la haya. No se envía nada sobre ti ni sobre tus proyectos, y no se descarga ni se instala nada: las actualizaciones las instalas tú desde la página de la versión. Corte de silencios, Ritmo y Kokoro funcionan sin internet en cualquier caso.",
  "Yes, tell me": "Sí, avísame",
  "No, don't check": "No, no comprobar",
  "You can change this anytime from the gear icon, and check by hand there with Check now.":
    "Puedes cambiarlo cuando quieras desde el icono del engranaje y comprobar a mano allí con «Comprobar ahora».",
  "The plugin asks once whether to tell you about new versions. If you say yes, it asks GitHub for the newest release number when it opens, at most every three days, and puts a dot on the gear icon when a newer version is out. Gear icon > Updates has the switch, Check now (one check, also with the switch off) and, when a newer version is out, Open the release page. Nothing about you or your projects is sent, and the plugin never downloads or installs anything: download the new package from the release page and install it the same way as the first one.":
    "El plugin pregunta una vez si quieres que te avise de versiones nuevas. Si respondes que sí, al abrirse consulta a GitHub el número de la versión más reciente, como mucho cada tres días, y pone un punto en el icono del engranaje cuando hay una versión más nueva. Icono del engranaje > «Actualizaciones» tiene la casilla, «Comprobar ahora» (una sola comprobación, también con la casilla desactivada) y, cuando hay una versión más nueva, «Abrir la página de la versión». No se envía nada sobre ti ni sobre tus proyectos, y el plugin nunca descarga ni instala nada: descarga el paquete nuevo desde la página de la versión e instálalo igual que el primero.",
};
