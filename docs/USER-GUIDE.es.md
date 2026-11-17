# Guía de AI Voice Master Tool

[English](USER-GUIDE.md) · [Russian](USER-GUIDE.ru.md) · [Spanish](USER-GUIDE.es.md)

## Corte de silencios: Analizar

El análisis lee el medio de origen del único clip seleccionado en tu línea de tiempo y encuentra dónde empieza y termina el habla, con un modelo de detección de voz que se ejecuta en tu equipo. Después hace un paso local de voz a texto para comprobar que ningún corte cae en medio de una palabra. Esa comprobación solo puede alargar una región conservada, para cubrir una palabra que quedaría partida, y solo lo hace donde hay audio real en ese punto, no silencio.

El análisis funciona con archivos mono y estéreo; un archivo estéreo se escucha como una sola mezcla. Un archivo con más de dos canales, o con los canales en pistas de audio separadas (habitual en archivos de cámara), se rechaza, y también el tono natural sobre él: exporta la voz en mono (File > Export > Media, sección Audio, Channels: Mono), impórtala y usa ese clip. Un clip que aparece en la línea de tiempo como clips de audio vinculados en dos o más pistas de audio también se rechaza: haz Alt/Opción-clic en el canal que no necesitas y bórralo (el clip sigue vinculado a su vídeo), luego vuelve a analizar. El análisis escucha la mezcla completa del archivo y el tono natural la renderiza, así que cuando ese canal lleve otro sonido, usa la exportación en mono.

El análisis y el tono natural leen el audio de los archivos habituales que importa Premiere Pro: WAV y BWF, AIFF, MP3, AAC y M4A (también Apple Lossless), y el audio AAC, PCM, AC-3, MP2/MP3 o WMA de los archivos MOV, MP4, MXF, AVI, MTS/M2TS, MPG/VOB, MKV y WMV. El audio en otro formato, como FLAC, Opus o ADPCM, se rechaza con un aviso: exporta la voz como archivo WAV (File > Export > Media, Format: Waveform Audio), impórtala y usa ese clip.

## Corte de silencios: detección automática y avanzada

«Automático» elige entre 3 preajustes de sensibilidad ya listos. «Avanzado» permite fijar a mano el umbral de silencio exacto y la duración mínima de pausa, con una vista previa del resultado en tiempo real, y guardarlos como preajustes.

Umbral de corte: el audio más bajo que este valor cuenta como silencio. Un valor más negativo solo corta el silencio casi total; un valor más cerca de 0 corta más, incluidas las respiraciones suaves.

Silencio mín.: cuánto debe durar un tramo silencioso antes de cortarse. Un valor menor detecta pausas diminutas entre palabras; uno mayor solo corta pausas claras.

La verificación de umbral local (desactivada por defecto) añade un segundo umbral, calculado para cada región, junto al global. Un momento solo se corta si ambos lo consideran silencio, así que la verificación solo puede salvar voz suave que el umbral global podría cortar por error en un clip con un nivel que fluctúa, por ejemplo bajo una música de fondo o tras un cambio de nivel de grabación a mitad del clip. Con voz IA limpia, donde el nivel no varía, no suele cambiar nada; es más útil en grabaciones mixtas o de personas reales.

Preajustes: guarda el umbral actual y el silencio mín. con un nombre para usarlos más tarde.

## Corte de silencios: vista previa y corte

En la vista previa de la forma de onda, el ámbar sólido se conserva, lo rayado se corta, y un pequeño triángulo rojo marca un tramo conservado con un borde del que el plugin no está seguro, que conviene escuchar. La barra de herramientas tiene dos modos. En el modo desplazamiento (la flecha, activo por defecto), haz clic en cualquier punto para reproducir desde ahí. En el modo de edición (la cuchilla), haz clic en una región para alternarla entre conservada y cortada, arrastra el borde de una región para moverlo o arrastra sobre la forma de onda para fijar un tramo entero: si empiezas en una región conservada, el tramo se corta, y si empiezas en una cortada, se conserva. La franja bajo la forma de onda siempre mueve el cabezal, y la flecha de deshacer revierte la última edición de la vista previa. Usa +/− para acercar una pista larga y editar con precisión.

Cortar reconstruye el clip seleccionado a partir de los segmentos mostrados y elimina todo lo demás. Los nuevos fragmentos quedan seleccionados, listos para la pestaña Ritmo.

Deshacer vuelve a poner el clip original sin cortar. Lo reconstruye desde el archivo de origen en lugar de retroceder por el historial de deshacer de Premiere, así que los efectos añadidos a los fragmentos después del corte no se conservan (el plugin los enumera y pregunta antes). Solo funciona en la secuencia donde se hizo el corte, y se niega si ahora hay otro clip donde vuelve el original. Cmd/Ctrl+Z también funciona, un paso a la vez. El botón se desactiva después de ejecutar J/L Pacing, porque J/L mueve fragmentos a una segunda pista que esta reconstrucción no limpia. Para volver a activarlo, selecciona todos los fragmentos del corte y haz clic en «Restablecer» en la pestaña Ritmo, o usa Cmd/Ctrl+Z.

## Ritmo: J/L Pacing

J/L Pacing está pensado para contenido corto de ritmo rápido. Adelanta ligeramente cada fragmento para que empiece antes de que termine el anterior, lo que aprieta el ritmo. Los fragmentos se alternan con la pista de audio justo debajo, ya que una pista no puede tener clips solapados; se niega si otro clip, como la música, ocupa el lugar de un fragmento. Cuánto se mueve un fragmento depende de si la forma de onda a ambos lados del límite permite un solapamiento. El modo suave se guía solo por la medición y deja tal cual un límite que no lo permite. El agresivo y el normal aplican además un solapamiento mínimo donde la medición no encuentra ninguno, y por eso se sienten más ajustados. Ese mínimo se aplica por completo en voz sintética limpia y se reduce en grabaciones más ruidosas, hasta desaparecer en las más ruidosas, donde la forma de onda no permite ver con seguridad dónde termina una palabra. Un límite sin ningún hueco en el origen, como un punto que cortaste a mano en mitad de una frase, nunca se solapa, porque ahí no hay pausa en la que entrar. Además, cada fragmento recibe un fundido corto de Premiere al inicio y al final (de 1 a 5 fotogramas, según el audio en ese límite) para evitar un chasquido.

Funciona con los fragmentos que el corte acaba de crear en Corte de silencios, y también en una línea de tiempo que editaste a mano después del corte. Puedes volver a pulsarlo con otro preajuste sin restablecer antes. Funciona en cualquier orden con velocidad y tono. Si aplicas velocidad después, los solapamientos se resincronizan con las nuevas duraciones en los fragmentos de esta ejecución, mientras el plugin aún la recuerde; después de volver a abrir el plugin, o en otros clips, vuelve a pulsar «Aplicar J/L Cut». El Pitch Shifter de Premiere se vuelve a aplicar automáticamente cuando todos los fragmentos lo tenían. J/L Pacing y Restablecer colocan los fragmentos de nuevo desde el archivo de origen, así que otros efectos, cambios de volumen y de Movimiento y fotogramas clave en ellos no se conservan; el plugin los enumera y pregunta antes. Añade los efectos como último paso.

Aplicar J/L Cut aplica el preajuste seleccionado arriba. Restablecer vuelve a poner cada fragmento en fila, sin solapamiento ni fundido de ritmo. Ninguno de los dos botones cambia el corte en sí.

## Ritmo: Velocidad

100 es la velocidad original, como en el cuadro Velocidad/Duración de Premiere. Por encima de 100 la voz se acelera y el clip se acorta; por debajo de 100 se ralentiza y el clip se alarga. La voz generada por IA (de ElevenLabs, por ejemplo) se llena de artefactos con facilidad: no pases de unos 105 (un 5 % más rápido), o corrige el tono con Corrección de tono. Las grabaciones de personas reales se pueden acelerar más.

Aplicar velocidad fija la velocidad de todos los clips seleccionados y no añade ninguna corrección de tono por su cuenta. Si todos los fragmentos ya tienen el Pitch Shifter de Premiere, el plugin lo actualiza a la nueva velocidad. Justo después del corte, la velocidad reconstruye los fragmentos desde el archivo de origen, para que los cambios repetidos no acumulen desfase, y los devuelve a donde los dejó el corte; los fragmentos que moviste a otro sitio reciben la nueva velocidad en su lugar. Los efectos de los fragmentos reconstruidos no se conservan; el plugin los enumera y pregunta antes.

## Ritmo: Corrección de tono

Una voz acelerada también suena más aguda, y Corrección de tono devuelve el tono original. Natural vuelve a renderizar los fragmentos con su tono original. Calculadora solo muestra los valores de corrección, para escribirlos en tu propio plugin de tono.

El modo Natural vuelve a renderizar cada fragmento acelerado con el ffmpeg incluido (su estiramiento «atempo», que conserva el tono original) y coloca el resultado en el mismo lugar al 100 % de velocidad, en lugar de añadir Pitch Shifter. Suele sonar más natural que la velocidad más un efecto de tono. Usa la velocidad actual de cada fragmento, así que ajústala antes con «Velocidad, %» y Aplicar velocidad. Los fragmentos originales se reemplazan; Revertir los devuelve con un clic. J/L Pacing y el envío a After Effects siguen funcionando con el resultado, y se conservan los fundidos J/L que ya tengan los fragmentos mientras el plugin recuerde esa ejecución de J/L. Enviar a After Effects necesita que los fragmentos seleccionados vengan de un solo archivo: selecciona los fragmentos renderizados de una misma velocidad, o los que no se tocaron, y envía cada grupo por separado. Para cambiar la velocidad de nuevo, pulsa Revertir primero. Los efectos distintos del tono de un fragmento reemplazado no están en el audio renderizado. Los archivos WAV renderizados se guardan en la carpeta «Renders» dentro de «AI Voice Master Tool» (en Documentos, o junto a tu proyecto si «Guardar renderizados» está en «Junto al proyecto»). Junto a cada WAV renderizado hay un pequeño archivo «.source.json» con la ruta de la grabación de la que procede; J/L Pacing lo lee para distinguir los fragmentos de un corte de otros clips.

Calculadora muestra los semitonos, cents y ratio que deshacen el cambio de tono del valor de «Velocidad, %» de arriba, para escribirlos en los controles de un plugin de tono (el propio Pitch Shifter de Premiere o uno de terceros). No cambia nada en la línea de tiempo. Úsala donde Natural no se puede usar, como un clip de cámara cuyo audio Premiere muestra como varios canales vinculados: Natural los rechaza, porque su renderizado mezclaría los canales.

Leer del clip seleccionado (en Calculadora) rellena el campo «Velocidad, %» con la velocidad a la que se reproduce ahora el clip seleccionado. Si no, el campo muestra 100 o lo último que escribiste, que puede no coincidir con el clip.

Plugin de terceros recomendado: kHs Pitch Shifter (Kilohearts AB, kilohearts.com/products/pitch_shifter). Abre su deslizador Pitch (en semitonos) y escribe el valor de semitonos de Calculadora. Los scripts de Premiere no pueden ajustar de forma fiable los parámetros de un plugin de terceros, así que escribe el valor en la propia ventana del plugin. Esta es una recomendación independiente, no una asociación, patrocinio ni respaldo de Kilohearts AB. AI Voice Master Tool no incluye, descarga ni instala el plugin.

## Ritmo: Renderizar toda la línea de tiempo para AE

El tono, como cualquier otro efecto aparte de velocidad y J/L Pacing, solo existe dentro del motor de reproducción de Premiere. «Enviar a After Effects» no puede transferirlo fragmento a fragmento, así que se niega cuando hay un efecto así aplicado. Este botón combina el audio seleccionado de todo el tramo en un solo archivo (las pistas de audio sin fragmentos seleccionados, como la música, se silencian durante el renderizado) y pone ese archivo en la línea de tiempo en lugar de los fragmentos originales, para que se vea que la combinación ocurrió. Luego pulsa «Enviar a After Effects» como de costumbre: el nuevo clip ya no tiene tono y se envía con normalidad. El vídeo queda intacto y sigue enviándose por separado, sin combinar. El renderizado incluye el fader y los efectos de la propia pista y el máster, y el clip renderizado vuelve a la misma pista, donde se aplican otra vez: ponlos en sus valores por defecto antes de renderizar, o mezcla después.

«Restaurar fragmentos» vuelve a poner los fragmentos originales con un clic, siempre que el plugin no se haya vuelto a abrir desde entonces. El propio Cmd/Ctrl+Z de Premiere también funciona, un paso a la vez.

## Voz IA: clave de API de ElevenLabs y voz

Las llamadas van directamente desde este equipo a api.elevenlabs.io con tu propia clave. El plugin no tiene clave propia y no ve ni revende tu uso. La clave se guarda solo en este equipo, en un archivo de configuración normal junto al resto de la configuración del plugin, y no se envía a ningún sitio salvo api.elevenlabs.io. El punto de estado es verde cuando ElevenLabs aceptó la clave, gris cuando está guardada pero aún sin confirmar (se está comprobando o no se pudo contactar con ElevenLabs) y rojo cuando no hay clave guardada o ElevenLabs la rechazó.

El selector de voces se carga desde tu cuenta de ElevenLabs cada vez que se abre el plugin y al guardar una clave, en dos grupos: «Mis voces» (todo lo que hayas clonado, diseñado o añadido a tu cuenta) y «Voces predeterminadas» (las voces prediseñadas de ElevenLabs). Haz clic en la estrella de una voz para fijarla en la fila de acceso rápido encima del selector. Para usar una voz que no aparece, añádela primero a tu cuenta de ElevenLabs (márcala como favorita, clónala o diséñala en elevenlabs.io o en la app de ElevenLabs) y luego pulsa «Recargar voces».

Modelo: v2 (Multilingual v2) es el predeterminado. v3 y v4 son los modelos expresivos de ElevenLabs; para ellos, «Mejorar para voz» puede añadir etiquetas de audio como [excited] o [whispers] y marcar la pronunciación de palabras difíciles con AFI en línea. v4 es el más nuevo. Según ElevenLabs, supera a v3 en casi todos los casos, y sigue las etiquetas con más fiabilidad. Solo usa Estabilidad y Similitud, sin Velocidad, Estilo ni Refuerzo de voz; v3 solo usa Estabilidad. Las etiquetas de audio de v3 funcionan sobre todo en el extremo bajo del realismo («Creative»). Por solicitud, v2 y v4 admiten hasta 10 000 caracteres y v3 hasta 5000.

## Voz IA: Kokoro (sin conexión)

Kokoro viene incluido en el plugin y funciona completamente sin conexión, sin clave de API ni internet. Tiene voces en inglés (estadounidense y británico), español, francés, hindi, italiano y portugués de Brasil. No tiene controles finos de estabilidad o estilo como ElevenLabs; el resultado depende sobre todo de la voz elegida y de un texto limpio y bien puntuado en el idioma de esa voz.

El campo Idioma solo filtra por idioma el selector de voces de abajo y no afecta a la generación. El idioma lo fija la voz que elijas (preajustes de Kokoro-82M incluidos, Apache-2.0), así que escribe el guion en el idioma de esa voz; el plugin no detecta ni traduce idiomas.

Los textos largos se dividen en frases, se generan por partes y se unen en un solo archivo, con una breve pausa en cada unión.

## Voz IA: texto y «Mejorar para voz»

Texto: usa frases completas y puntuación real. Las comas, los puntos suspensivos y los saltos de párrafo son lo que más ayuda a un ritmo natural en todos los modelos. En ElevenLabs, los textos de menos de unos 250 caracteres pueden sonar irregulares.

«Mejorar para voz» envía tu texto a OpenAI o Anthropic, el que elijas, con tu propia clave de API (guardada localmente igual que la de ElevenLabs), para ajustar la redacción y la puntuación pensando en la lectura en voz alta. En v2 solo cambia la redacción y la puntuación, porque v2 leería en voz alta las etiquetas entre corchetes como texto. En v3 y v4, que entienden las etiquetas, también puede añadir etiquetas de audio; el selector Solo ritmo / Natural / Expresivo bajo el botón define hasta dónde llega.

Solo ritmo / Natural / Expresivo: «Solo ritmo» ajusta la puntuación (y, en v3 y v4, añade etiquetas simples [pause]) sin añadir etiquetas de emoción. «Natural», el predeterminado, queda en medio. «Expresivo» (solo v3 y v4) usa con más libertad las etiquetas de emoción y reacción, para una lectura más dramática.

El selector de modelo muestra los modelos que ofrece tu cuenta de OpenAI o Anthropic, obtenidos al abrir el plugin, al guardar una clave y al cambiar de proveedor. Por defecto elige el más pequeño y barato, que basta para reescribir un guion corto.

Coste: reescribir un guion con el modelo pequeño por defecto cuesta poco; la página de precios del proveedor tiene las tarifas actuales. Consigue una clave en platform.openai.com (claves de API, independientes de una suscripción a ChatGPT Plus) o en console.anthropic.com (independiente de una suscripción a Claude Pro). Ambos piden un pequeño saldo prepagado en lugar de un plan mensual.

## Voz IA: Realismo (ElevenLabs)

«Automático» ajusta juntos la estabilidad, la similitud y el estilo en una combinación razonable. «Avanzado» muestra los propios deslizadores para afinar más allá de un preajuste: estabilidad en todos los modelos, similitud en todos salvo v3, y estilo en v2 y para el Conversor de voz.

Estabilidad: con valores bajos (de un 30 a un 50 %) suena más emocional y viva pero menos constante. Con valores altos (de un 65 a un 75 %) suena más clara y constante, pero puede quedar plana.

Similitud / claridad: mantenla junto con la estabilidad entre un 75 y un 90 %, aproximadamente. Cerca del 100 % la voz tiende a sobrearticular, con un efecto poco natural de presentador de noticias. No existe en v3.

Estilo: déjalo cerca de 0 salvo que quieras una lectura con más carácter o emoción. Solo existe en v2 y para el Conversor de voz: v3 usa solo Estabilidad, y v4 Estabilidad y Similitud.

## Voz IA: generar, reemplazar y conversor de voz

«Generar e insertar» genera el audio, lo guarda en «AI Voice Master Tool/Generated» (en Documentos, o junto a tu proyecto si «Guardar renderizados» está en «Junto al proyecto») y lo coloca en la posición del cabezal, en la pista de audio de destino de la secuencia activa (la primera pista de audio marcada como destino en Premiere o, si no hay ninguna, la primera). Queda listo para el corte de silencios y el ritmo. Si ese punto de la pista ya está ocupado, se niega en lugar de sobrescribir: el cabezal se comprueba antes de generar y toda la duración antes de colocar. Mueve el cabezal a un tramo vacío, o marca otra pista como destino, y vuelve a intentarlo.

«Reemplazar voz» vuelve a generar el texto con la voz seleccionada en ese momento y lo coloca al inicio del clip seleccionado; el resto de tu montaje no cambia. Locuta lo que haya en el campo «Texto». Si al seleccionar el clip el campo tenía otro texto, el banner lo indica y ofrece «Cargar su texto», y «Reemplazar voz» pide un segundo clic antes de locutar ese otro texto sobre el clip. La nueva toma va en la pista de audio de debajo y la anterior se desactiva y sigue en la línea de tiempo: recupérala con Habilitar (Enable) en el menú contextual del clip o con Deshacer del plugin. Reemplazar necesita una pista de audio libre debajo del clip; si no la hay, te pide añadir una pista antes de generar nada.

«Convertir la voz del clip seleccionado», del conversor de voz, renderiza el clip seleccionado en la línea de tiempo, con la velocidad o el tono que ya tenga, y lo envía al conversor de voz de ElevenLabs (speech-to-speech) con la voz elegida arriba. Las demás pistas de audio se silencian durante el renderizado, así que la música de debajo no se envía. Las palabras siguen siendo las mismas y solo cambia la voz. Igual que Reemplazar, necesita una pista de audio libre justo debajo de la pista del clip, para que el resultado se pueda deshacer. Premiere renderiza el clip por sí mismo; solo si no puede, el renderizado va a la cola de Adobe Media Encoder. Si entonces se agota el tiempo de espera, revisa el panel de cola de Media Encoder y su preferencia «auto-start queue». ElevenLabs admite clips de hasta 5 minutos: corta uno más largo en partes y conviértelas una a una.

## Voz IA: generación por lotes

Cada línea del guion por lotes se convierte en un clip generado, con los ajustes de voz, modelo y realismo definidos arriba. Las líneas se generan una a una, para respetar los límites de solicitudes de ElevenLabs, y se colocan una tras otra en la línea de tiempo a partir del cabezal.

«Generar todo» omite las líneas ya generadas y no vuelve a colocar las que ya están en la línea de tiempo, así que puedes añadir líneas y pulsar otra vez para generar y colocar solo las nuevas. Antes de generar nada, comprueba que la pista de audio de destino (la primera marcada como destino o, si no hay ninguna, la primera) esté libre después del cabezal.

En ElevenLabs v2 y v4, cada línea se envía junto con el final de la anterior y el comienzo de la siguiente, para que la voz mantenga la entonación entre clips en lugar de empezar de cero cada vez («request stitching» de ElevenLabs; no disponible en v3). Solo se pronuncia la propia línea. ElevenLabs no indica si ese texto vecino cuenta para tus créditos; el informe de diagnóstico (icono del engranaje > «Ejecutar diagnóstico») muestra el coste que ElevenLabs informa para cada línea.

## Enviar a After Effects

Abre After Effects (2025 o posterior) y, en el plugin «AI Voice Master Tool Bridge» de allí (Window > Extensions), haz clic en «Colocar en la composición actual».

Enviar a After Effects pasa a After Effects los fragmentos seleccionados en la línea de tiempo mediante un pequeño archivo de traspaso, ya que las dos aplicaciones no comparten portapapeles para clips de línea de tiempo. En After Effects, la velocidad de cada fragmento se reconstruye como un estiramiento de tiempo y se conserva su posición de J/L. No hay fundido cruzado: los fragmentos solapados suenan a volumen completo durante el solapamiento. Los fragmentos siguen enlazados a tu medio original, así que todavía puedes ajustar sus bordes en After Effects.

En After Effects los fragmentos suben en escalera: el primero en la capa más baja y cada uno de los siguientes una capa más arriba. Donde fragmentos con imagen se solapan tras J/L Pacing, el que Premiere muestra encima sigue encima, así que ahí los vecinos se intercambian por parejas. Los fragmentos hechos con el tono natural se envían igual, una capa cada uno, al 100 % de velocidad.

El vídeo siempre se envía enlazado a su medio y nunca se renderiza. Un clip normal con audio y vídeo enlazados, como el archivo de una cámara, llega como una sola capa enlazada con imagen y sonido, igual que está en Premiere. Solo un clip cuyo audio y vídeo vienen de dos archivos de origen distintos llega como dos capas separadas.

Enviar a After Effects nunca renderiza nada. Si algún clip seleccionado tiene tono, o cualquier otro efecto aparte de velocidad y J/L Pacing, se niega, porque ese efecto solo existe en el motor de reproducción de Premiere y no en el archivo. En ese caso, usa antes «Renderizar toda la línea de tiempo para AE» en la pestaña Ritmo.

Un archivo de audio hecho con «Renderizar toda la línea de tiempo para AE» no tiene material de sobra más allá de sus bordes, así que en After Effects no se puede alargar como un clip recortado; para hacerlo más largo, vuelve a renderizar en Premiere. El vídeo, si lo hay, no se ve afectado: siempre se envía enlazado al medio original, así que todavía puedes ajustarlo libremente.

## Deshacer, Revertir y la memoria del plugin

Los propios botones Deshacer y Revertir del plugin (Deshacer del corte, Restaurar fragmentos, Revertir del tono natural, Deshacer de Voz IA) funcionan con lo que el plugin recuerda de la última operación. Un nuevo análisis borra Deshacer del corte y Revertir del tono natural, y conserva Restaurar fragmentos. Un nuevo corte borra Revertir del tono natural y Restaurar fragmentos, y su propio Deshacer sustituye al del corte anterior. Ninguno de los dos afecta a Deshacer de Voz IA. Volver a abrir el plugin o reiniciar Premiere los borra todos, y los botones desaparecen. El propio Cmd/Ctrl+Z de Premiere funciona siempre, un paso a la vez.

## Actualizaciones

El plugin pregunta una vez si quieres que te avise de versiones nuevas. Si respondes que sí, al abrirse consulta a GitHub el número de la versión más reciente, como mucho cada tres días, y pone un punto en el icono del engranaje cuando hay una versión más nueva. Icono del engranaje > «Actualizaciones» tiene la casilla, «Comprobar ahora» (una sola comprobación, también con la casilla desactivada) y, cuando hay una versión más nueva, «Abrir la página de la versión». No se envía nada sobre ti ni sobre tus proyectos, y el plugin nunca descarga ni instala nada: descarga el paquete nuevo desde la página de la versión e instálalo igual que el primero.

## Problemas e informes de errores

Icono del engranaje > «Ejecutar diagnóstico» guarda un informe de texto en Documentos/AI Voice Master Tool/Diagnostics/. No contiene claves de API y tu carpeta personal aparece abreviada como ~, pero incluye nombres de clips, secuencias y archivos: léelo antes de compartirlo.

Para informar de un problema, abre un issue en la página del proyecto en GitHub, github.com/ominousopera/AIVoiceMasterTool, y pega en él el texto del informe.
