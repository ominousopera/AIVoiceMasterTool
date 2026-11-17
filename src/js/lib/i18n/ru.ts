/** Russian translation dictionary — key is the exact English source string
 *  as it appears in the `tr("...")` call site (see `./index.ts`'s header
 *  comment for why). Keys are grouped roughly by source file (main.tsx,
 *  Waveform.tsx, analyze.ts's `MODES`, guideText.ts, bridge/main.tsx,
 *  hostMessages.ts) and by topic; the order has no meaning.
 *  scripts/check-i18n.mjs lists keys missing here. A key missing here just
 *  falls back to English — never a crash, never a blank string.
 *
 *  Deliberately NOT translated (left to fall back to English on purpose,
 *  not an oversight): the product name "AI Voice Master Tool", third-party
 *  proper nouns (ElevenLabs, Kokoro, OpenAI, Claude/Anthropic, Kilohearts
 *  AB, kHs Pitch Shifter), and the stylized feature names "J/L Pacing" /
 *  "J/L Cut" (a made-up compound name for this product's own pacing
 *  feature, not a standard translatable phrase — kept as a fixed technical
 *  name in every language, the same way a lot of NLE software keeps
 *  "J-cut"/"L-cut" itself in English even in a localized UI).
 */
export const ru: Record<string, string> = {
  "This is the key's ID, not the key itself. ElevenLabs shows the key, which starts with sk_, only once, when it is created. Create a new key there and paste that one.":
    "Это идентификатор ключа, а не сам ключ. ElevenLabs показывает ключ, который начинается с sk_, только один раз, при создании. Создайте там новый ключ и вставьте его.",
  "Not enough ElevenLabs credits for this request.": "На счёте ElevenLabs не хватает кредитов для этого запроса.",
  "This key works, but it isn't allowed to do this. In ElevenLabs, turn on the permission named below in the key's settings, or create a key with full access.":
    "Ключ рабочий, но ему не разрешено это действие. В ElevenLabs включите в настройках ключа разрешение, указанное ниже, или создайте ключ с полным доступом.",
  "No pause in this clip is long enough for {mode}: the detector found {count}, the longest is {longest} s, and {mode} only cuts pauses longer than about {min} s. Aggressive does cut this clip, or you can set your own minimum pause in Advanced.":
    "Для режима «{mode}» в этом клипе нет достаточно длинных пауз: детектор нашёл {count}, самая длинная {longest} с, а режим «{mode}» режет только паузы длиннее примерно {min} с. Агрессивный режим этот клип режет, или задайте свой минимум паузы в режиме «Расширенный».",
  "No pause in this clip is long enough for {mode}: the detector found {count}, the longest is {longest} s, and {mode} only cuts pauses longer than about {min} s. To cut them anyway, set your own minimum pause in Advanced.":
    "Для режима «{mode}» в этом клипе нет достаточно длинных пауз: детектор нашёл {count}, самая длинная {longest} с, а режим «{mode}» режет только паузы длиннее примерно {min} с. Чтобы всё же их вырезать, задайте свой минимум паузы в режиме «Расширенный».",
  "Invalid API key — double-check it was copied correctly.": "Неверный API-ключ — проверьте, что он скопирован правильно.",
  "This API key doesn't have permission for this request — check your account's plan/scopes.":
    "У этого API-ключа нет прав на этот запрос — проверьте тариф и области доступа аккаунта.",
  "Rate limit or quota exceeded — wait a moment and try again, or check your usage/billing.":
    "Превышен лимит запросов или квота — подождите и попробуйте снова, либо проверьте использование и оплату.",
  "Unknown error.": "Неизвестная ошибка.",
  "Filter voices…": "Поиск голосов…",
  "No matches.": "Совпадений нет.",
  "Remove from favorites": "Убрать из избранного",
  "Add to favorites": "Добавить в избранное",
  "Working…": "Выполняется…",
  "My Voices": "Мои голоса",
  "Stock voices": "Стандартные голоса",
  "English (US)": "Английский (США)",
  "English (UK)": "Английский (Великобритания)",
  "Spanish": "Испанский",
  "French": "Французский",
  "Hindi": "Хинди",
  "Italian": "Итальянский",
  "Portuguese (Brazil)": "Португальский (Бразилия)",
  "All languages": "Все языки",
  "No voices returned for this key — check it's correct and active.":
    "По этому ключу голоса не найдены — убедитесь, что он верный и активен.",
  "Kokoro model failed to load{detail}.": "Не удалось загрузить модель Kokoro{detail}.",
  "Scanning audio…": "Анализ аудио…",
  "Selected clip has no linked media file on disk.": "У выбранного клипа нет связанного медиафайла на диске.",
  "Cutting silence…": "Вырезаем тишину…",
  "Undoing Cut…": "Отмена вырезки…",
  "Making J/L Cut…": "Выполняется J/L Cut…",
  "Resetting J/L Cut…": "Сброс J/L Cut…",
  "Applying Speed…": "Применяем скорость…",
  'Improved text was generated, but you edited the script while waiting — your edit was kept and the improvement wasn\'t applied. Run "Improve for voice" again if you still want it.':
    "Улучшенный текст сгенерирован, но пока шло ожидание вы отредактировали сценарий — ваша правка сохранена, а улучшение не применено. Запустите «Улучшить для озвучки» снова, если оно всё ещё нужно.",
  "Generating voice-over…": "Генерация озвучки…",
  "No items generated successfully — nothing to place on the timeline.":
    "Ни один элемент не сгенерирован успешно — на таймлайн нечего помещать.",
  "Converting voice…": "Конвертация голоса…",
  "Rendering selected clip…": "Рендер выбранного клипа…",
  "Waiting for the render to finish writing…": "Ждём завершения записи рендера…",
  "Placing on timeline…": "Размещение на таймлайне…",
  "Sending to After Effects…": "Отправка в After Effects…",
  "Rendering full timeline for After Effects…": "Рендер всего таймлайна для After Effects…",
  "Waiting for Premiere to finish rendering the full timeline…": "Ждём, пока Premiere закончит рендер всего таймлайна…",
  "Replacing the original pieces with the rendered clip…": "Замена исходных кусков отрендеренным клипом…",
  "Running diagnostics…": "Выполняется диагностика…",
  "Clearing data…": "Очистка данных…",
  "Aggressive": "Агрессивный",
  "Normal": "Обычный",
  "Gentle": "Мягкий",
  "Diagnostics & feedback": "Диагностика и обратная связь",
  "Guide / FAQ": "Инструкция / FAQ",
  "Language": "Язык",
  "Save Renders": "Сохранение рендеров",
  "Documents": "Документы",
  "Next to project": "Рядом с проектом",
  '"Next to project" saves beside your .prproj file instead of Documents, and survives "Clear all data" below (which never touches the project folder).':
    "Вариант «Рядом с проектом» сохраняет файлы рядом с .prproj вместо папки «Документы» и не удаляется кнопкой «Очистить все данные» ниже (она никогда не трогает папку проекта).",
  "Clearing…": "Очистка…",
  "Clear all data": "Очистить все данные",
  'Deletes everything under "AI Voice Master Tool" in Documents — Renders, voice-overs, Diagnostics reports — and your API keys, presets and settings. Any generated clip already on your timeline goes offline immediately (Premiere links to that file by path).':
    "Удаляет всё в папке «AI Voice Master Tool» внутри «Документов» — рендеры, озвучки, отчёты диагностики, — а также ваши ключи API, пресеты и настройки. Любой сгенерированный клип, уже стоящий на таймлайне, сразу становится офлайн (Premiere ссылается на файл по пути).",
  "Cleared.": "Очищено.",
  "Some files couldn't be removed (in use elsewhere?) — check {path}.":
    "Некоторые файлы не удалось удалить (заняты другим процессом?) — проверьте {path}.",
  "Running…": "Выполняется…",
  "Run Diagnostics": "Запустить диагностику",
  "Saves a troubleshooting report to your Documents folder.": "Сохраняет отчёт для диагностики в папку «Документы».",
  "Saved to": "Сохранено в",
  "Give Feedback": "Оставить отзыв",
  "License": "Лицензия",
  "Licenses / Third-party notices": "Лицензии / уведомления о сторонних компонентах",
  "secure build": "защищённая сборка",
  "dev build": "сборка для разработки",
  "Also removes your API keys, presets and settings from this computer. The plugin then restarts as on first install.":
    "Также удаляет с этого компьютера ваши ключи API, пресеты и настройки. После этого плагин запустится заново, как при первой установке.",
  "To undo this, use Cmd/Ctrl+Z in Premiere.": "Чтобы отменить это, нажмите Cmd/Ctrl+Z в Premiere.",
  "A generated clip is no longer on the timeline — nothing to remove there.":
    "Сгенерированного клипа уже нет на таймлайне — удалять нечего.",
  "A generated clip now plays a different file — it was left on the timeline.":
    "Сгенерированный клип теперь воспроизводит другой файл — он оставлен на таймлайне.",
  "The original take could not be found to turn it back on. Select it and choose Clip > Enable in Premiere.":
    "Не удалось найти исходный дубль, чтобы снова включить его. Выделите его и включите командой Clip > Enable (Клип > Включить) в Premiere.",
  "Removing a generated clip failed ({p0}).": "Не удалось удалить сгенерированный клип ({p0}).",
  "Turning the original take back on failed ({p0}).": "Не удалось снова включить исходный дубль ({p0}).",
  "A generated clip could not be removed — it is still on the timeline.":
    "Сгенерированный клип не удалось удалить — он всё ещё на таймлайне.",
  "The original take was left muted because the new take is still on the timeline. Remove the new take by hand, then select the original and choose Clip > Enable in Premiere.":
    "Исходный дубль оставлен выключенным, потому что новый дубль всё ещё на таймлайне. Удалите новый дубль вручную, затем выделите исходный и включите командой Clip > Enable (Клип > Включить) в Premiere.",
  'Cannot place: this batch\'s earlier clips were placed in the sequence "{p0}". Open that sequence, then click Generate All again; the generated lines are kept. Nothing was placed.':
    "Нельзя разместить: прежние клипы этого пакета размещены в секвенции «{p0}». Откройте эту секвенцию и снова нажмите «Сгенерировать всё»; сгенерированные строки сохранены. Ничего не размещено.",
  'This batch\'s earlier clips were placed in the sequence "{p0}". Open that sequence, then click Generate All again. Nothing was generated.':
    "Прежние клипы этого пакета размещены в секвенции «{p0}». Откройте эту секвенцию и снова нажмите «Сгенерировать всё». Ничего не сгенерировано.",
  "Natural pitch: Premiere did not remove the original audio of piece {p0} ({p1}). Putting the originals back failed too: {p2} of {p3} original piece(s) went back{p4}. Check that stretch of the timeline in Premiere, or use Cmd/Ctrl+Z there to step back. Nothing else was replaced.":
    "Естественный питч: Premiere не удалил исходный звук куска {p0} ({p1}). Вернуть оригиналы на место тоже не удалось: вернулось {p2} из {p3} исходных кусков{p4}. Проверьте этот участок таймлайна в Premiere или откатите шаги там через Cmd/Ctrl+Z. Больше ничего не заменено.",
  "Natural pitch: Premiere rejected placing the audio for piece {p0}{p1}. Putting the originals back failed too: {p2} of {p3} original piece(s) went back{p4}. Check that stretch of the timeline in Premiere, or use Cmd/Ctrl+Z there to step back. Nothing else was replaced.":
    "Естественный питч: Premiere отверг размещение звука для куска {p0}{p1}. Вернуть оригиналы на место тоже не удалось: вернулось {p2} из {p3} исходных кусков{p4}. Проверьте этот участок таймлайна в Premiere или откатите шаги там через Cmd/Ctrl+Z. Больше ничего не заменено.",
  "Natural pitch: Premiere did not remove the original audio of piece {p0} ({p1}). Every original piece went back, but not exactly as before ({p2}). Check that stretch of the timeline in Premiere, or use Cmd/Ctrl+Z there to step back. Nothing else was replaced.":
    "Естественный питч: Premiere не удалил исходный звук куска {p0} ({p1}). Все исходные куски вернулись, но не совсем такими, как были ({p2}). Проверьте этот участок таймлайна в Premiere или откатите шаги там через Cmd/Ctrl+Z. Больше ничего не заменено.",
  "Natural pitch: Premiere rejected placing the audio for piece {p0}{p1}. Every original piece went back, but not exactly as before ({p2}). Check that stretch of the timeline in Premiere, or use Cmd/Ctrl+Z there to step back. Nothing else was replaced.":
    "Естественный питч: Premiere отверг размещение звука для куска {p0}{p1}. Все исходные куски вернулись, но не совсем такими, как были ({p2}). Проверьте этот участок таймлайна в Premiere или откатите шаги там через Cmd/Ctrl+Z. Больше ничего не заменено.",
  "Premiere Pro applied less than {p0}% to {p1} piece(s) (lowest {p2}%). They still play all of their audio, at that lower speed.":
    "Premiere Pro не выставил скорость {p0}% кускам: {p1} (самый медленный: {p2}%). Они всё равно звучат целиком, только медленнее.",
  "Premiere Pro put back less than the earlier Speed on {p0} piece(s) (lowest {p1}% of it). They still play all of their audio, at that lower speed.":
    "Premiere Pro вернул кускам не всю прежнюю скорость: {p0} (самый медленный: {p1}% от неё). Они всё равно звучат целиком, только медленнее.",
  "Premiere Pro restored the clip at {p0}% instead of {p1}%. It still plays all of its audio, at that lower speed.":
    "Premiere Pro вернул клипу скорость {p0}% вместо {p1}%. Он всё равно звучит целиком, только медленнее.",
  "{p0} piece(s) could not be linked to their video again. Select each one with its video and use Clip > Link.":
    "Не удалось снова связать с видео кусков: {p0}. Выделите каждый вместе с его видео и выберите Clip > Link (Клип > Связать).",
  "Could not unlock audio track {p0} after placing audio ({p1}). Unlock it by hand.":
    "Не удалось разблокировать аудиодорожку {p0} после размещения звука ({p1}). Разблокируйте её вручную.",
  "Placing the audio also added a copy of another of its channels on audio track {p0} at {p1}s, and it could not be removed ({p2}). Delete that clip by hand.":
    "Размещение звука добавило копию другого его канала на аудиодорожке {p0} на {p1} с, и её не удалось убрать ({p2}). Удалите этот клип вручную.",
  "Could not unlock video track {p0} after placing video ({p1}). Unlock it by hand.":
    "Не удалось разблокировать видеодорожку {p0} после размещения видео ({p1}). Разблокируйте её вручную.",
  "Placing the video also added a copy of another of its channels on video track {p0} at {p1}s, and it could not be removed ({p2}). Delete that clip by hand.":
    "Размещение видео добавило копию другого его канала на видеодорожке {p0} на {p1} с, и её не удалось убрать ({p2}). Удалите этот клип вручную.",
  "Could not unlock audio track {p0} after placing video ({p1}). Unlock it by hand.":
    "Не удалось разблокировать аудиодорожку {p0} после размещения видео ({p1}). Разблокируйте её вручную.",
  "Placing the video also added a copy of its audio at {p0}s, and it could not be removed ({p1}). Delete that audio clip by hand.":
    "Размещение видео добавило копию его звука на {p0} с, и её не удалось убрать ({p1}). Удалите этот аудиоклип вручную.",
  "Could not unlock video track {p0} after placing audio ({p1}). Unlock it by hand.":
    "Не удалось разблокировать видеодорожку {p0} после размещения звука ({p1}). Разблокируйте её вручную.",
  "Placing the audio also added a copy of its video at {p0}s, and it could not be removed ({p1}). Delete that video clip by hand.":
    "Размещение звука добавило копию его видео на {p0} с, и её не удалось убрать ({p1}). Удалите этот видеоклип вручную.",
  'Could not unlock track "{p0}" after cutting ({p1}). Unlock it by hand.':
    "Не удалось разблокировать дорожку «{p0}» после разреза ({p1}). Разблокируйте её вручную.",
  "{p0} restored piece(s) could not be linked to their video again.":
    "Восстановленных кусков, которые не удалось снова связать с видео: {p0}.",
  'Cannot undo: this voice-over was placed in the sequence "{p0}". Open that sequence, then try again. Nothing was changed.':
    "Нельзя отменить: эта озвучка размещена в секвенции «{p0}». Откройте эту секвенцию и попробуйте снова. Ничего не изменено.",
  "Cannot undo: audio track {p0} is locked. Unlock it, then try again. Nothing was changed.":
    "Нельзя отменить: аудиодорожка {p0} заблокирована. Разблокируйте её и попробуйте снова. Ничего не изменено.",
  "Natural pitch: Premiere did not remove the original audio of piece {p0} ({p1}). Everything was put back; nothing was replaced. Try again, or check that stretch of the timeline in Premiere.":
    "Естественный питч: Premiere не удалил исходный звук куска {p0} ({p1}). Всё возвращено на место; ничего не заменено. Попробуйте снова или проверьте этот участок таймлайна в Premiere.",
  "the clip is still on the timeline": "клип всё ещё на таймлайне",
  "The rendered audio is larger than 4 GB, more than a WAV file can hold. Select fewer pieces from this source, or a shorter stretch, and try again.":
    "Отрендеренный звук больше 4 ГБ — столько файл WAV не вмещает. Выберите меньше кусков из этого исходника или более короткий участок и попробуйте ещё раз.",
  "{p0} original piece(s) would land on other clips that were moved there after the replace step (for example by J/L Pacing) — nothing was changed. Click Reset in J/L Pacing, or move those clips, then try again.":
    "Исходные куски ({p0}) легли бы на другие клипы, перемещённые туда после замены (например, J/L Pacing) — ничего не изменено. Нажмите «Сбросить» в J/L Pacing или передвиньте эти клипы и попробуйте ещё раз.",
  'Audio track {p0} already has a clip where the new take would go ("{p1}", {p2}s–{p3}s) — nothing was replaced, to avoid overwriting it. Free that stretch of the track, then try again.':
    "На аудиодорожке {p0} уже есть клип там, куда лёг бы новый дубль («{p1}», {p2}–{p3} с) — ничего не заменено, чтобы его не перезаписать. Освободите это место на дорожке и попробуйте ещё раз.",
  "The rewrite stopped before the end, most likely because the text is too long for one pass. Your text was left unchanged — split it into shorter parts and improve each one.":
    "Переписанный текст оборвался, скорее всего потому, что исходный текст слишком длинный для одного прохода. Ваш текст оставлен без изменений — разделите его на части и улучшайте каждую отдельно.",
  "OpenAI did not finish the rewrite. Your text was left unchanged.":
    "OpenAI не закончил переписывать текст. Ваш текст оставлен без изменений.",
  "Claude did not finish the rewrite. Your text was left unchanged.":
    "Claude не закончил переписывать текст. Ваш текст оставлен без изменений.",
  "release build": "релизная сборка",
  "Silence Cut": "Вырезка тишины",
  "Pacing": "Темп",
  "AI Voice": "ИИ-голос",
  "Send to AE": "Отправить в AE",
  "Scanning…": "Сканирование…",
  "SCAN CLIP": "СКАНИРОВАТЬ КЛИП",
  "Select one clip on the timeline, then click Scan Clip.": "Выберите один клип на таймлайне, затем нажмите «Сканировать клип».",
  '"{name}" has {count} separate audio tracks. The plugin works with files that have one mono or stereo audio track: export the voice as a mono file (File > Export > Media, Audio > Channels: Mono), import it and use that clip.':
    "В файле «{name}» отдельных аудиодорожек: {count}. Плагин работает с файлами, где одна моно- или стереодорожка: экспортируйте голос в моно (File > Export > Media, раздел Audio, Channels: Mono), импортируйте его и используйте этот клип.",
  '"{name}" has {count} audio channels. The plugin works with mono and stereo files: export the voice as a mono file (File > Export > Media, Audio > Channels: Mono), import it and use that clip.':
    "В файле «{name}» аудиоканалов: {count}. Плагин работает с моно- и стереофайлами: экспортируйте голос в моно (File > Export > Media, раздел Audio, Channels: Mono), импортируйте его и используйте этот клип.",
  "Scan a clip first.": "Сначала отсканируйте клип.",
  "The sequence runs at {seqFps} fps and the clip at {srcFps} fps, so audio and video may drift. Consider a {srcFps} fps sequence.":
    "Секвенция идёт с частотой {seqFps} к/с, а клип — {srcFps} к/с, поэтому звук и видео могут разойтись. Лучше использовать секвенцию на {srcFps} к/с.",
  'Nothing is currently selected on the timeline (or more than one clip) — this is still showing the last Scan\'s results for "{name}". Re-select it before cutting.':
    "На таймлайне сейчас ничего не выбрано (или выбрано больше одного клипа) — показаны результаты последнего скана для «{name}». Выберите его заново перед вырезкой.",
  'Selected clip has changed since Scan (was "{prev}", now "{current}") — Cut would apply to what\'s selected now, not what was analyzed. Scan again before cutting.':
    "Выбранный клип изменился после скана (был «{prev}», теперь «{current}») — вырезка применится к текущему выбору, а не к проанализированному клипу. Отсканируйте заново перед вырезкой.",
  "This clip's Speed has changed since Scan (was {prev}%, now {current}%) — Cut should still apply correctly (Scan's own analysis doesn't depend on Speed), but Scan again first if the cut looks wrong.":
    "Скорость этого клипа изменилась после скана (было {prev}%, стало {current}%) — вырезка всё равно должна примениться корректно (анализ скана не зависит от скорости), но если результат выглядит не так, отсканируйте заново.",
  "Sequence audio was mono — Cut switched it to stereo so audio plugins can be applied; levels or panning may sound different afterwards.":
    "Аудио секвенции было моно — вырезка переключила его в стерео, чтобы можно было применять аудиоплагины; громкость или панорама после этого могут звучать иначе.",
  "duration": "длительность",
  "noise": "шум",
  "speech": "речь",
  "segments": "сегментов",
  "Speech detection:": "Распознавание речи:",
  "level-based fallback": "резервный режим по уровню сигнала",
  "AI model": "ИИ-модель",
  "Word check:": "Проверка слов:",
  "on (words: {count})": "включено (слов: {count})",
  "unavailable": "недоступно",
  "Automatic": "Автоматический",
  "Advanced": "Расширенный",
  "Segments: {count} · cuts {pct}": "Сегментов: {count} · вырезано {pct}",
  "noise {floor} · speech {speech}": "шум {floor} · речь {speech}",
  "cut threshold: {value}": "порог вырезки: {value}",
  "min. silence: {value}s": "мин. тишина: {value} с",
  "Local threshold safety check": "Локальная проверка порога",
  "Presets": "Пресеты",
  "name this preset": "название пресета",
  "Save": "Сохранить",
  "Preview": "Превью",
  "Cutting…": "Вырезка…",
  "CUT": "ВЫРЕЗАТЬ",
  "Undo": "Отменить",
  "Segments cut: {count}.": "Вырезано сегментов: {count}.",
  // ExtendScript-originated warning, translated through main.tsx's
  // translateWarning pattern match (see its doc comment), since ppro.ts has no
  // access to this dictionary. The placeholder must stay {clipName}, matching
  // translateWarning's substitution exactly.
  'Note: a clip from another file ("{clipName}") is close to this Cut on the same track. J/L Pacing on either file may be blocked later as a safety measure. If you plan to use J/L Pacing on either one, do it now, before cutting anything else nearby, or leave more space between the files\' cuts (or use a different track).':
    "Обратите внимание: рядом с этой вырезкой на той же дорожке стоит клип из другого файла («{clipName}»). Позже J/L Pacing для любого из этих файлов может быть заблокирован ради безопасности. Если собираетесь применять J/L Pacing к одному из них, сделайте это сейчас, до новых вырезок рядом, или оставьте больше места между вырезками разных файлов (или используйте другую дорожку).",
  "Note: these pieces now sit at {currentSec}s, far from where Cut placed them ({originalSec}s), so they were rebuilt where they are now, not moved back.":
    "Обратите внимание: эти куски сейчас находятся на {currentSec} с — далеко от того места, куда их поместила вырезка ({originalSec} с), поэтому они собраны там, где стоят сейчас, а не возвращены назад.",
  "J/L Pacing has run since this Cut. To use Undo again, select every piece of this Cut and click Reset in the Pacing tab; or use Cmd/Ctrl+Z repeatedly to go back to before Cut.":
    "После этой вырезки уже применялся J/L Pacing. Чтобы снова можно было нажать «Отменить», выделите все куски этой вырезки и нажмите «Сбросить» во вкладке «Темп»; или нажмите Cmd/Ctrl+Z несколько раз, чтобы вернуться к состоянию перед вырезкой.",
  "J/L Pacing": "J/L Pacing",
  "Works on the pieces a Cut created — run Cut in Silence Cut, or just select already-cut pieces directly on the timeline (e.g. after reopening this project).":
    "Работает с кусками, созданными вырезкой — сначала выполните вырезку во вкладке «Вырезка тишины», либо просто выделите уже вырезанные куски прямо на таймлайне (например, после повторного открытия проекта).",
  'Working on: pieces cut from "{name}" earlier this session.': "В работе: куски, вырезанные из «{name}» ранее в этой сессии.",
  "Select at least 2 of the pieces Cut just made (they're left selected right after Cut).":
    "Выделите минимум 2 куска из тех, что только что создала вырезка (сразу после вырезки они остаются выделенными).",
  "Tightest pacing: the longest overlaps (recommended).": "Самый плотный темп: самые длинные перекрытия (рекомендуется).",
  "Balanced: clear pacing, with shorter overlaps than Aggressive.":
    "Сбалансированно: темп заметно плотнее, а перекрытия короче, чем у пресета «Агрессивный».",
  "Lightest: small overlaps only where the audio allows them, plus a short fade at each edit.":
    "Самый лёгкий: небольшие перекрытия только там, где позволяет звук, плюс короткий фейд на каждой склейке.",
  "Make J/L Cut": "Сделать J/L Cut",
  "Reset": "Сбросить",
  "{pieces} pieces · {overlaps} boundaries overlapped · {fades} fades applied.":
    "{pieces} кусков · перекрыто границ: {overlaps} · применено фейдов: {fades}.",
  "Speed %": "Скорость, %",
  "Above 105%, AI voice often picks up audible artifacts. Stay at 105% or below, or correct the pitch with Pitch correction below.":
    "Выше 105% у ИИ-голоса часто появляются заметные на слух артефакты. Оставайтесь на 105% или ниже либо скорректируйте питч в разделе «Коррекция питча» ниже.",
  "Applying…": "Применение…",
  "Apply Speed": "Применить скорость",
  "Speed applied to {count} clip(s).": "Скорость применена к клипам: {count}.",
  "Pitch correction": "Коррекция питча",
  "{count} clip(s) already at 100% speed — skipped.": "Клипов уже на скорости 100%: {count} — пропущено.",
  "Read from selected clip": "Считать с выбранного клипа",
  "values for Speed % above — type into your plugin's own controls":
    "значения для поля «Скорость, %» выше — введите их в элементы управления своего плагина",
  "{semitones} semitones · {cents} cents · Ratio {ratio}": "{semitones} полутона · {cents} цента · Ratio {ratio}",
  "Speed % above is at 100 — nothing to compute yet.": "В поле «Скорость, %» выше стоит 100 — считать пока нечего.",
  "Recommended:": "Рекомендуем:",
  "(Kilohearts AB,": "(Kilohearts AB,",
  ") — open its Pitch slider (shown in semitones) and type the semitones value above. Premiere's scripting can't set a third-party plugin's controls reliably, so type the value into the plugin's own window. This is an independent recommendation, not a partnership, sponsorship, or endorsement by Kilohearts AB — AI Voice Master Tool doesn't bundle, download, or install it; get it directly from them under their own terms.":
    ") — откройте его ползунок Pitch (показан в полутонах) и введите значение полутонов выше. Скрипты Premiere не могут надёжно задавать элементы управления сторонних плагинов, поэтому вводите значение в окне самого плагина. Это независимая рекомендация, а не партнёрство, спонсорство или одобрение со стороны Kilohearts AB — AI Voice Master Tool не поставляет, не скачивает и не устанавливает этот плагин; получите его напрямую у Kilohearts AB на их собственных условиях.",
  "Render full timeline for AE": "Рендер всего таймлайна для AE",
  'Pitch, and any other effect besides Speed and J/L Pacing, exists only inside Premiere, so "Send to After Effects" (the Send to AE tab) refuses it. Finish your cut, pacing, speed and pitch edits, then click this: it bakes the selected audio span into one file (audio tracks without selected pieces, such as music, are muted for the render) and puts it on the timeline in place of the pieces. The render includes the track\'s fader and effects and the Master, which then apply to the new clip again: set them to their defaults first, or mix afterward. Then click "Send to After Effects" as usual. Video is not baked and is sent separately.':
    "Питч, как и любой другой эффект, кроме скорости и J/L Pacing, существует только внутри Premiere, поэтому «Отправить в After Effects» (вкладка «Отправить в AE») отказывается отправлять клипы с ним. Закончите правки вырезки, темпа, скорости и питча, затем нажмите эту кнопку: она сводит выбранный участок аудио в один файл (аудиодорожки без выбранных кусков, например с музыкой, на время рендера глушатся) и ставит его на таймлайн вместо кусков. Рендер включает фейдер и эффекты дорожки и мастер-шину, которые затем снова применяются к новому клипу: сначала верните их к значениям по умолчанию или сводите уже после. После этого нажмите «Отправить в After Effects» как обычно. Видео не сводится и отправляется отдельно.",
  "Rendering…": "Рендер…",
  'Replaced {count} piece(s) with one rendered clip at {seconds}s. It is selected: click "Send to After Effects" in the Send to AE tab next.':
    "Заменено кусков: {count} — одним отрендеренным клипом на {seconds} с. Он выбран: теперь нажмите «Отправить в After Effects» во вкладке «Отправить в AE».",
  "Revert to segments": "Вернуть куски",
  "Reverting…": "Возврат…",
  "Reverted to {count} original piece(s).": "Возвращено исходных кусков: {count}.",
  "Reverting to the original pieces…": "Возврат к исходным кускам…",
  "Restoring Pitch…": "Восстановление питча…",
  "Restoring Pitch failed: {error}": "Не удалось вернуть питч: {error}",
  "Generate a voice-over from text. The result is an ordinary clip: Silence Cut and Pacing work on it as on any other.":
    "Сгенерируйте озвучку из текста. Результат — обычный клип: «Вырезка тишины» и «Темп» работают с ним так же, как с любым другим.",
  "Selected clip was generated with": "Выбранный клип сгенерирован голосом",
  "({engine}):": "({engine}):",
  '— text loaded below. Pick a different voice and click "Replace Voice" to swap it in place.':
    "— текст загружен ниже. Выберите другой голос и нажмите «Заменить голос», чтобы подставить его на то же место.",
  '— the Text field below holds other text, so this clip\'s text was not loaded. "Replace Voice" speaks what the Text field holds.':
    "— в поле «Текст» ниже другой текст, поэтому текст этого клипа не загружен. «Заменить голос» озвучивает то, что стоит в поле «Текст».",
  "Load its text": "Загрузить его текст",
  'The Text field holds different text from the selected clip. Click "Load its text" above to use the clip\'s own text, or click "Replace Voice" again to speak the Text field\'s text over the clip.':
    "В поле «Текст» не тот текст, что у выбранного клипа. Нажмите «Загрузить его текст» выше, чтобы взять текст клипа, или нажмите «Заменить голос» ещё раз, чтобы озвучить поверх клипа текст из поля.",
  "Kokoro (offline)": "Kokoro (офлайн)",
  "Text to Speech": "Текст в речь",
  "Voice Changer": "Смена голоса",
  "Batch": "Пакетная генерация",
  "ElevenLabs API key": "API-ключ ElevenLabs",
  "Edit": "Изменить",
  "Cancel": "Отмена",
  "Voice": "Голос",
  "Save an API key first": "Сначала сохраните API-ключ",
  "Loading voices…": "Загрузка голосов…",
  "No voices found": "Голоса не найдены",
  "Loading…": "Загрузка…",
  "Reload voices": "Обновить список голосов",
  'Don\'t see a voice you want to use? Add it to your ElevenLabs account first — favorite, clone, or design it at elevenlabs.io or in their own app — then click "Reload voices" above to pick it up here.':
    "Не нашли нужный голос? Сначала добавьте его в свой аккаунт ElevenLabs — в избранное, клонированием или созданием на elevenlabs.io или в их приложении — затем нажмите «Обновить список голосов» выше, чтобы он появился здесь.",
  "Model": "Модель",
  "v2 (stable)": "v2 (стабильная)",
  "v3 (expressive)": "v3 (экспрессивная)",
  "Speed: {value}x": "Скорость: {value}x",
  "Speed of the generation itself — separate from Speed in the Pacing tab, which retimes audio already on the timeline.":
    "Скорость самой генерации — отдельно от скорости во вкладке «Темп», которая меняет темп уже готового аудио на таймлайне.",
  "Output Quality": "Качество вывода",
  "Choose a quality": "Выберите качество",
  "MP3 (compressed)": "MP3 (сжатый)",
  "MP3 · 32 kbps (smallest file)": "MP3 · 32 кбит/с (самый маленький файл)",
  "MP3 · 64 kbps": "MP3 · 64 кбит/с",
  "MP3 · 96 kbps": "MP3 · 96 кбит/с",
  "MP3 · 128 kbps (default)": "MP3 · 128 кбит/с (по умолчанию)",
  "MP3 · 192 kbps (Creator tier+)": "MP3 · 192 кбит/с (тариф Creator и выше)",
  "WAV (uncompressed)": "WAV (несжатый)",
  "WAV · 44.1kHz (lossless, Pro tier+)": "WAV · 44,1 кГц (без потерь, тариф Pro и выше)",
  "WAV · 48kHz (lossless, may need a higher ElevenLabs plan)": "WAV · 48 кГц (без потерь, может потребоваться тариф ElevenLabs повыше)",
  "Higher bitrate or WAV sounds clearer but makes a bigger file. 128 kbps MP3 is a good default for voice-over and works on every ElevenLabs plan, including Free. 192 kbps MP3 and WAV need a paid ElevenLabs plan; if your plan doesn't include a format, ElevenLabs returns an error.":
    "Более высокий битрейт или WAV звучит чище, но файл получается больше. MP3 128 кбит/с — хороший выбор по умолчанию для озвучки и работает на любом тарифе ElevenLabs, включая Free. MP3 192 кбит/с и WAV требуют платного тарифа ElevenLabs; если формат не входит в ваш тариф, ElevenLabs вернёт ошибку.",
  "Language Override": "Переопределение языка",
  "Auto-detect": "Автоопределение",
  "Speaker Boost": "Усиление голоса",
  "Boosts similarity to the original voice; generation takes slightly longer. Worth leaving on.":
    "Усиливает схожесть с исходным голосом; генерация идёт немного дольше. Стоит оставить включённым.",
  "Afrikaans": "Африкаанс",
  "Arabic": "Арабский",
  "Armenian": "Армянский",
  "Assamese": "Ассамский",
  "Azerbaijani": "Азербайджанский",
  "Belarusian": "Белорусский",
  "Bengali": "Бенгальский",
  "Bosnian": "Боснийский",
  "Bulgarian": "Болгарский",
  "Catalan": "Каталанский",
  "Croatian": "Хорватский",
  "Czech": "Чешский",
  "Danish": "Датский",
  "Dutch": "Нидерландский",
  "English": "Английский",
  "Estonian": "Эстонский",
  "Finnish": "Финский",
  "Galician": "Галисийский",
  "Georgian": "Грузинский",
  "German": "Немецкий",
  "Greek": "Греческий",
  "Gujarati": "Гуджарати",
  "Hausa": "Хауса",
  "Hebrew": "Иврит",
  "Hungarian": "Венгерский",
  "Icelandic": "Исландский",
  "Indonesian": "Индонезийский",
  "Irish": "Ирландский",
  "Japanese": "Японский",
  "Javanese": "Яванский",
  "Kannada": "Каннада",
  "Kazakh": "Казахский",
  "Kirghiz": "Киргизский",
  "Korean": "Корейский",
  "Latvian": "Латышский",
  "Lingala": "Лингала",
  "Lithuanian": "Литовский",
  "Luxembourgish": "Люксембургский",
  "Macedonian": "Македонский",
  "Malay": "Малайский",
  "Malayalam": "Малаялам",
  "Mandarin Chinese": "Китайский (путунхуа)",
  "Marathi": "Маратхи",
  "Nepali": "Непальский",
  "Norwegian": "Норвежский",
  "Chichewa": "Чичева",
  "Pashto": "Пушту",
  "Persian": "Персидский",
  "Polish": "Польский",
  "Portuguese": "Португальский",
  "Punjabi": "Панджаби",
  "Romanian": "Румынский",
  "Russian": "Русский",
  "Serbian": "Сербский",
  "Sindhi": "Синдхи",
  "Slovak": "Словацкий",
  "Slovenian": "Словенский",
  "Somali": "Сомалийский",
  "Swahili": "Суахили",
  "Swedish": "Шведский",
  "Tamil": "Тамильский",
  "Telugu": "Телугу",
  "Thai": "Тайский",
  "Turkish": "Турецкий",
  "Ukrainian": "Украинский",
  "Urdu": "Урду",
  "Vietnamese": "Вьетнамский",
  "Welsh": "Валлийский",
  "Kokoro comes with the plugin and runs fully offline, without an API key or internet connection. It has English (American and British), Spanish, French, Hindi, Italian and Brazilian Portuguese voices. It has no fine-grained stability or style sliders like ElevenLabs; the result depends mostly on the voice preset and on clean, well-punctuated text in that voice's language.":
    "Kokoro встроен в плагин и работает полностью офлайн, без API-ключа и интернета. Есть голоса на английском (американский и британский), испанском, французском, хинди, итальянском и бразильском португальском. Тонких ползунков стабильности и стиля, как у ElevenLabs, здесь нет: результат зависит в основном от выбранного голоса и от чистого текста с правильной пунктуацией на языке этого голоса.",
  "Loading model…": "Загрузка модели…",
  "Unavailable": "Недоступно",
  "Retry": "Повторить",
  "Text": "Текст",
  "Type or paste the narration to generate…": "Введите или вставьте текст для озвучки…",
  "Improving…": "Улучшение…",
  "Improve for voice": "Улучшить для озвучки",
  "Pacing only": "Только темп",
  "Natural": "Естественно",
  "Expressive": "Экспрессивно",
  "Loading models…": "Загрузка моделей…",
  "Choose a model": "Выберите модель",
  "— using a built-in fallback model instead.": "— используется встроенная резервная модель.",
  "Sends your text to OpenAI or Anthropic, whichever you pick, with your own API key, and puts the rewrite back in the Text field: one click instead of copy-pasting your script into ChatGPT or Claude and back. On v2 and Kokoro it changes only wording and punctuation; on v3 and v4, which understand audio tags, it can also add them.":
    "Отправляет ваш текст в OpenAI или Anthropic, смотря что вы выбрали, с вашим собственным API-ключом и возвращает переписанный текст в поле «Текст»: одна кнопка вместо ручного копирования сценария в ChatGPT или Claude и обратно. В v2 и Kokoro меняются только формулировки и пунктуация; в v3 и v4, которые понимают аудиотеги, функция может и добавить их.",
  "Realism": "Реализм",
  "Narration": "Дикторская речь",
  "Calm & Steady": "Спокойно и ровно",
  "Stability: {value}%": "Стабильность: {value}%",
  "Similarity / Clarity: {value}%": "Похожесть / чёткость: {value}%",
  "Style: {value}%": "Стиль: {value}%",
  "Hide tips": "Скрыть советы",
  "Tips for realistic voice": "Советы для реалистичной озвучки",
  "Voice choice matters more than any setting here": "Выбор голоса важнее любой из этих настроек",
  "— pick (or clone) a voice whose natural register already matches the delivery you want, rather than forcing a mismatched voice via sliders.":
    "— выбирайте (или клонируйте) голос, чей естественный регистр уже соответствует нужной подаче, вместо того чтобы натягивать несоответствующий голос ползунками.",
  "Pacing/pauses": "Темп и паузы",
  'come from punctuation — commas, ellipses ("…"), and paragraph breaks are the main lever, on every model. This is generating with ElevenLabs\'':
    "определяются пунктуацией — запятые, многоточия («…») и разрывы абзацев — главный рычаг в любой модели. Сейчас генерация идёт через модель ElevenLabs",
  "Voice choice still matters most": "Выбор голоса всё равно важнее всего",
  "— audio tags shape an already-fitting voice, they don't fix a mismatched one.":
    "— аудиотеги дорабатывают уже подходящий голос, но не исправляют несоответствующий.",
  "Bracket audio tags": "Аудиотеги в скобках",
  "like": "вроде",
  'only register reliably when Realism sits toward the lower/"Creative" end of Stability — the "Expressive" preset above is tuned for this; high stability ("Robust") mostly ignores them.':
    "надёжно срабатывают только когда параметр «Стабильность» ближе к нижнему краю («Creative») — пресет «Экспрессивно» выше настроен как раз под это; при высокой стабильности («Robust») они в основном игнорируются.",
  "still comes from punctuation (ellipses for a pause and weight, CAPS for emphasis) — v3 has no":
    "по-прежнему определяется пунктуацией (многоточие — для паузы и веса, ЗАГЛАВНЫЕ — для акцента) — в v3 нет тега",
  "tag at all.": "вовсе.",
  "Hard-to-pronounce words": "Сложные для произношения слова",
  "(invented names, foreign words) can be respelled inline with IPA in forward slashes, e.g.":
    "(выдуманные имена, иностранные слова) можно записать транскрипцией IPA прямо в тексте, между слэшами, например",
  '— "Improve for voice" applies this automatically when v3 is selected.':
    "— «Улучшить для озвучки» делает это автоматически, когда выбрана v3.",
  "Generating…": "Генерация…",
  "Generate & Insert": "Сгенерировать и вставить",
  "Replacing…": "Замена…",
  "Replace Voice": "Заменить голос",
  "Placed at {seconds}s on audio track {track}.": "Размещено на {seconds} с на аудиодорожке {track}.",
  "Selected clip": "Выбранный клип",
  "Selected: {name}": "Выбрано: {name}",
  "Select one audio clip on the timeline to convert.": "Выберите один аудиоклип на таймлайне для конвертации.",
  "Converting…": "Конвертация…",
  "Convert Selected Clip's Voice": "Сконвертировать голос выбранного клипа",
  "Batch script": "Пакетный сценарий",
  "One line per clip, e.g.:\nWelcome back to the show.\nToday we're covering three topics.":
    "По одной строке на клип, например:\nС возвращением на канал.\nСегодня разберём три темы.",
  "Add to Queue": "Добавить в очередь",
  "Clear queue": "Очистить очередь",
  "Queue ({count})": "Очередь ({count})",
  "{count} characters still to generate — roughly {count} ElevenLabs credits at the standard 1 credit/character rate (exact cost depends on your plan and the model used).":
    "Символов осталось сгенерировать: {count} — примерно {count} кредитов ElevenLabs по стандартному тарифу 1 кредит/символ (точная стоимость зависит от вашего тарифа и используемой модели).",
  "Generate All": "Сгенерировать всё",
  "{count} clip(s) placed sequentially from the playhead.": "Размещено клипов подряд от позиции курсора: {count}.",
  "Sending…": "Отправка…",
  "Send to After Effects": "Отправить в After Effects",
  "Sent {count} {kind}": "Отправлено {kind}: {count}",
  "rendered piece(s)": "отрендеренных кусков",
  "segment(s)": "сегментов",
  " + {count} video piece(s)": " + видеокусков: {count}",
  'Open After Effects and use the "AI Voice Master Tool Bridge" plugin there to place them.':
    "Откройте After Effects и используйте там плагин «AI Voice Master Tool Bridge», чтобы разместить их.",
  "Send to AE file written to: {path}": "Файл для «Отправить в AE» записан в: {path}",
  "Choose your interface language": "Выберите язык интерфейса",
  "You can change this anytime from the gear icon.": "Вы можете изменить это в любой момент через значок шестерёнки.",
  "Where should rendered audio be saved?": "Куда сохранять отрендеренное аудио?",
  "Rendered audio (Render full timeline, Natural pitch, Voice Changer) and AI Voice's generated voice-overs need somewhere to live on disk. Pick a default now — you can change it anytime from the gear icon.":
    "Отрендеренному звуку («Рендер всего таймлайна для AE», «Естественно», «Смена голоса») и сгенерированным озвучкам из вкладки ИИ-голос нужно где-то храниться на диске. Выберите значение по умолчанию сейчас — его всегда можно изменить через значок шестерёнки.",
  '"Documents" is the recommended default. "Next to project" saves beside your .prproj file instead, and survives "Clear all data" (which never touches the project folder).':
    "«Документы» — рекомендуемый вариант по умолчанию. «Рядом с проектом» сохраняет файлы рядом с .prproj и не удаляется кнопкой «Очистить все данные» (она никогда не трогает папку проекта).",
  "Clear all data?": "Очистить все данные?",
  'Deletes everything under "AI Voice Master Tool" in Documents — Renders, generated voice-overs, Diagnostics reports, and any pending Send to AE data.':
    "Удаляет всё в папке «AI Voice Master Tool» внутри «Документов» — рендеры, сгенерированные озвучки, отчёты диагностики и все неотправленные данные «Отправить в AE».",
  "If you haven't saved the rendered voice pieces (WAV files) somewhere else yet, they will be permanently lost.":
    "Если отрендеренные куски озвучки (файлы WAV) ещё не сохранены где-то ещё, они будут безвозвратно потеряны.",
  "Any generated voice-over already placed on your timeline goes offline immediately — Premiere links to that file by path, and this deletes it.":
    "Любая сгенерированная озвучка, уже размещённая на таймлайне, сразу становится офлайн — Premiere ссылается на файл по пути, а это действие его удаляет.",
  "This can't be undone.": "Это действие нельзя отменить.",
  "Delete everything": "Удалить всё",
  "Open link in your browser?": "Открыть ссылку в браузере?",
  "This opens": "Это откроет",
  "in your default browser, outside of Premiere.": "в браузере по умолчанию, вне Premiere.",
  "in your default browser, outside of After Effects.": "в браузере по умолчанию, вне After Effects.",
  "Remember my choice": "Запомнить мой выбор",
  "Open": "Открыть",
  "Close": "Закрыть",
  "Kept": "Оставлено",
  "Cut": "Вырезано",
  "Play": "Воспроизвести",
  "Pause": "Пауза",
  "Click to seek": "Клик для перемотки",
  "Undo last preview edit": "Отменить последнюю правку превью",
  "Zoom out": "Уменьшить масштаб",
  "Zoom in": "Увеличить масштаб",
  "Fit to width": "По ширине",
  "Uncertain edge — worth a quick listen": "Сомнительная граница — стоит быстро прослушать",
  // Short legend-label form of the tooltip above (a static, always-visible
  // legend entry).
  "Uncertain edge": "Сомнительная граница",
  "Interaction mode": "Режим взаимодействия",
  "Edit mode — click a region to toggle keep/cut": "Режим правки — клик по участку переключает оставить/вырезать",
  "Seek mode — click anywhere to move the playhead": "Режим перемотки — клик в любом месте перемещает курсор",

  // analyze.ts MODES: detection-mode picker cards. Translations follow the
  // English descriptions exactly.
  "Mode 1 — Aggressive (recommended)": "Режим 1 — Агрессивный (рекомендуется)",
  "Tightest cut: catches short pauses the other modes leave alone, for maximum pacing. Breaths between phrases are cut like any other pause; best for fast-cut, high-density content.":
    "Самая плотная вырезка: ловит короткие паузы, которые другие режимы пропускают, ради максимального темпа. Вдохи между фразами вырезаются, как любая другая пауза. Лучше всего для быстрого, плотного монтажа.",
  "Mode 2 — Normal": "Режим 2 — Обычный",
  "Tight, punchy cut — removes brief pauses for brisk pacing while keeping natural speech rhythm. A good middle ground for most content.":
    "Плотная, бодрая вырезка — убирает короткие паузы ради живого темпа, сохраняя естественный ритм речи. Золотая середина для большинства контента.",
  "Mode 3 — Gentle": "Режим 3 — Мягкий",
  "Balanced, moderate touch — removes clear dead air while preserving natural speech rhythm and breathing. Best for interviews/podcasts or careful content.":
    "Сбалансированное, умеренное вмешательство — убирает явные паузы, сохраняя естественный ритм речи и дыхание. Лучше всего для интервью/подкастов или бережного монтажа.",

  // guideText.ts — "Guide / FAQ" modal
  "AI Voice Master Tool guide": "Инструкция AI Voice Master Tool",
  "Silence Cut: Scan": "Вырезка тишины: Скан",
  "Scan reads the source media of the one clip selected on your timeline and finds where speech starts and stops, using a voice-activity model that runs on your computer. It then runs a local speech-to-text pass to check that no cut lands in the middle of a word. That check can only make a kept region longer, to cover a word that would otherwise be split, and it does so only where there is real audio at that spot, not silence.":
    "Скан читает исходное медиа одного клипа, выбранного на таймлайне, и находит, где речь начинается и заканчивается. Для этого он использует модель определения речи, которая работает на вашем компьютере. Затем он локально распознаёт речь в текст и проверяет, что ни одна граница вырезки не попадает в середину слова. Эта проверка может только удлинить оставленный участок, чтобы не разрезать слово, и делает это лишь там, где в этом месте есть настоящий звук, а не тишина.",
  "Silence Cut: Automatic and Advanced detection": "Вырезка тишины: автоматическое и расширенное определение",
  "Automatic picks from 3 ready-made sensitivity presets. Advanced lets you set the exact silence threshold and minimum pause length by hand, with a live preview of the result, and save them as presets.":
    "«Автоматический» предлагает на выбор 3 готовых пресета чувствительности. «Расширенный» позволяет вручную задать точный порог тишины и минимальную длину паузы, сразу показывает результат и даёт сохранить настройки как пресет.",
  "Cut threshold: audio quieter than this counts as silence. A more negative value cuts only near-total silence; a value closer to 0 cuts more, including quiet breaths.":
    "Порог вырезки: звук тише этого значения считается тишиной. Чем ниже значение, тем ближе к полной тишине должен быть участок, чтобы его вырезали; ближе к 0 вырезается больше, включая тихое дыхание.",
  "Min. silence: how long a quiet patch must last before it gets cut. Lower catches tiny pauses between words; higher only cuts clearly dead air.":
    "Мин. тишина: сколько должен длиться тихий участок, чтобы его вырезали. Меньшее значение ловит крошечные паузы между словами, большее вырезает только явные паузы.",
  "Local threshold safety check (off by default) adds a second threshold, worked out for each region, next to the global one. A moment is cut only if both call it silence, so the check can only save quiet speech that the global threshold might cut by mistake in a clip whose level drifts, for example under a music bed or after a recording-level change partway through. On clean AI-generated voice, where the level stays put, it usually makes no difference; it helps most on mixed or human recordings.":
    "Локальная проверка порога (по умолчанию выключена) добавляет к общему порогу второй, свой для каждого участка. Момент вырезается, только если оба порога считают его тишиной, поэтому проверка может лишь спасти тихую речь, которую общий порог мог бы вырезать по ошибке в клипе с плавающей громкостью, например под музыкальной подложкой или после смены уровня записи посреди клипа. На чистом ИИ-голосе, где уровень не плавает, она обычно ничего не меняет; больше всего она помогает на смешанных записях и записях живых людей.",
  "Presets: save the current threshold and min. silence under a name to use again later.":
    "Пресеты: сохраните текущий порог и мин. тишину под своим именем, чтобы использовать их позже.",
  "Silence Cut: Preview and Cut": "Вырезка тишины: превью и вырезка",
  "In the waveform preview, solid amber is kept, hatched is cut, and a small red triangle marks a kept stretch whose edge the plugin is unsure of, worth a quick listen. The toolbar has two modes. In Seek (the arrow, on by default), click anywhere to play from there. In Edit (the razor), click a region to flip it between kept and cut, drag a region's edge to move it, or drag across the waveform to set a whole stretch: a drag that starts in a kept region cuts the stretch, and one that starts in a cut region keeps it. The strip under the waveform always seeks, and the undo arrow reverts the last preview edit. Use +/− to zoom in on a long track for precise edits.":
    "На превью формы волны сплошной янтарный цвет означает «оставлено», штриховка означает «вырезано», а маленький красный треугольник отмечает оставленный участок, в границе которого плагин не уверен: его стоит быстро прослушать. На панели инструментов два режима. В режиме «Перемотка» (стрелка, включён по умолчанию) клик в любом месте запускает воспроизведение оттуда. В режиме «Правка» (лезвие) клик по участку переключает его между «оставлено» и «вырезано», перетаскивание края двигает границу, а протяжка по волне задаёт целый отрезок: если начать протяжку в оставленном участке, отрезок вырезается, если в вырезанном, он остаётся. Полоса под волной всегда перематывает, а стрелка отмены отменяет последнюю правку превью. Кнопки +/− увеличивают масштаб на длинной дорожке для точной правки.",
  "Cut rebuilds the selected clip from the segments shown, removing everything else. The new pieces are left selected, ready for Pacing.":
    "«Вырезать» пересобирает выбранный клип из показанных сегментов и удаляет всё остальное. Новые куски остаются выбранными и готовы для вкладки «Темп».",
  "Undo puts the original, uncut clip back. It rebuilds the clip from the source file instead of stepping back through Premiere's undo history, so effects added to the pieces after the Cut are not kept (the plugin lists them and asks first). It works only in the sequence the Cut was made in, and refuses when another clip now sits where the original goes back. Cmd/Ctrl+Z also works, one step at a time. The button turns off once J/L Pacing has run, because J/L moves pieces onto a second track that this rebuild doesn't clear. To turn it back on, select every piece of the Cut and click Reset in the Pacing tab, or use Cmd/Ctrl+Z.":
    "«Отменить» возвращает исходный, невырезанный клип. Плагин заново собирает клип из исходного файла, а не откатывает историю отмены Premiere, поэтому эффекты, добавленные на куски после вырезки, не сохраняются (плагин перечислит их и спросит, продолжать ли). Кнопка работает только в той секвенции, где была вырезка, и отказывается, если на месте исходного клипа теперь лежит другой клип. Cmd/Ctrl+Z тоже работает, по одному шагу. После J/L Pacing кнопка отключается, потому что J/L переносит куски на вторую дорожку, которую эта пересборка не очищает. Чтобы включить её снова, выделите все куски вырезки и нажмите «Сбросить» во вкладке «Темп» или используйте Cmd/Ctrl+Z.",
  "Pacing: J/L Pacing": "Темп: J/L Pacing",
  "J/L Pacing is meant for fast-paced short-form content. It pulls each piece slightly earlier, so it starts before the previous one has finished, which tightens the pacing. Pieces alternate onto the audio track directly below, since one track can't hold overlapping clips; it refuses when another clip, such as music, sits where a piece would go. How far a piece moves depends on whether the waveform on both sides of the boundary allows an overlap. Gentle goes by the measurement only and leaves a boundary alone when it doesn't allow one. Aggressive and Normal also apply a minimum overlap where the measurement finds none, which is why they feel tighter. That minimum applies in full on clean synthetic voice and shrinks on noisier recordings, down to nothing on the noisiest, where the waveform can't safely show where a word ends. A boundary with no gap in the source at all, such as a spot you split by hand in the middle of a phrase, is never overlapped, because there is no pause there to overlap into. Every piece also gets a short Premiere fade at its start and end (1 to 5 frames, sized from the audio at that boundary) to avoid a click.":
    "J/L Pacing рассчитан на динамичный короткий контент. Он подтягивает каждый кусок чуть раньше, чтобы тот начинался до конца предыдущего, и темп становится плотнее. Куски по очереди ставятся на свою дорожку и на аудиодорожку прямо под ней, потому что на одной дорожке клипы не могут перекрываться; если там, куда встанет кусок, лежит другой клип, например музыка, функция откажется работать. Насколько сдвинется кусок, зависит от того, позволяет ли перекрытие форма волны по обе стороны границы. Мягкий режим опирается только на измерение и не трогает границу, где перекрытие не подходит. Агрессивный и обычный режимы вдобавок дают минимальное перекрытие даже там, где измерение его не нашло, поэтому они и ощущаются плотнее. Этот минимум действует полностью на чистом синтетическом голосе и уменьшается на более шумных записях, вплоть до нуля на самых шумных, где по форме волны нельзя надёжно увидеть конец слова. Границу, у которой в исходнике вообще нет зазора, например место, разрезанное вручную посреди фразы, плагин никогда не перекрывает: там нет паузы, в которую можно зайти. Каждый кусок к тому же получает короткий фейд Premiere в начале и в конце (от 1 до 5 кадров, по звуку на этой границе), чтобы не было щелчка.",
  "It works on the pieces that Cut just made in Silence Cut, and on a timeline you edited by hand after the Cut. You can click it again with a different preset without a Reset first. It works in any order with Speed and Pitch. Applying Speed afterward re-syncs the overlaps to the new durations on this run's pieces while the plugin still remembers the run; after the plugin is reopened, or on other clips, run Make J/L Cut again. Premiere's Pitch Shifter is applied again automatically when every piece had it. J/L Pacing and Reset place the pieces fresh from the source file, so other effects, volume and Motion changes and keyframes on them are not kept; the plugin lists them and asks first. Add effects as the last step.":
    "J/L Pacing работает с кусками, которые только что создала вырезка во вкладке «Вырезка тишины», и с таймлайном, который вы правили вручную после вырезки. Нажать его снова с другим пресетом можно сразу, без «Сбросить». Порядок со скоростью и питчем не важен. Если применить скорость после J/L, перекрытия подстроятся под новые длительности на кусках этого запуска, пока плагин его помнит; после повторного открытия плагина или на других клипах снова нажмите «Сделать J/L Cut». Pitch Shifter Premiere ставится заново автоматически, если он был на всех кусках. J/L Pacing и «Сбросить» ставят куски заново из исходного файла, поэтому другие эффекты, изменения громкости и Motion и ключевые кадры на них не сохраняются; плагин перечислит их и спросит, продолжать ли. Эффекты добавляйте последним шагом.",
  "Make J/L Cut applies the preset selected above. Reset puts every piece back in a plain row, with no overlap and no pacing fade. Neither button changes the Cut itself.":
    "«Сделать J/L Cut» применяет выбранный выше пресет. «Сбросить» ставит все куски обратно подряд, без перекрытия и без фейдов темпа. Саму вырезку ни одна из кнопок не меняет.",
  "Pacing: Speed": "Темп: Скорость",
  "100 is the original speed, as in Premiere's own Speed/Duration dialog. Above 100 speeds the voice up and shortens the clip; below 100 slows it down and lengthens it. AI-generated voice (from ElevenLabs, for example) picks up artifacts easily: stay under about 105 (5% faster), or correct the pitch with Pitch correction. Recordings of real people can be sped up more.":
    "100 означает исходную скорость, как в диалоге Speed/Duration самого Premiere. Выше 100 голос ускоряется и клип укорачивается, ниже 100 голос замедляется и клип удлиняется. На ИИ-голосе (например, ElevenLabs) легко появляются артефакты: держитесь в пределах примерно 105 (на 5% быстрее) или исправляйте питч коррекцией питча. Записи живых людей можно ускорять сильнее.",
  "Apply Speed sets the speed of every selected clip and adds no pitch correction of its own. If every piece already has Premiere's Pitch Shifter, the plugin updates it to the new speed. Right after a Cut, Speed rebuilds the pieces from the source file, so repeated changes can't drift, and puts them back where the Cut left them; pieces you moved elsewhere get the new speed in place. Effects on rebuilt pieces are not kept; the plugin lists them and asks first.":
    "«Применить скорость» задаёт скорость каждого выбранного клипа и сама питч не корректирует. Если на всех кусках уже есть Pitch Shifter Premiere, плагин подстроит его под новую скорость. Сразу после вырезки скорость пересобирает куски из исходного файла, чтобы повторные изменения не накапливали сдвиг, и ставит их туда, где их оставила вырезка; куски, которые вы передвинули в другое место, получают новую скорость на месте. Эффекты на пересобранных кусках не сохраняются; плагин перечислит их и спросит, продолжать ли.",
  "Pacing: Pitch correction": "Темп: Коррекция питча",
  "Read from selected clip (in Calculator) fills the Speed % field with the speed the selected clip plays at right now. Otherwise the field shows 100 or the value you last typed, which may not match the clip.":
    "«Считать с выбранного клипа» (в «Калькуляторе») заполняет поле «Скорость, %» скоростью, с которой выбранный клип воспроизводится сейчас. Иначе в поле стоит 100 или то, что вы ввели последним, и это может не совпадать с клипом.",
  "Recommended third-party plugin: kHs Pitch Shifter (Kilohearts AB, kilohearts.com/products/pitch_shifter). Open its Pitch slider (shown in semitones) and type the semitones value from Calculator. Premiere's scripting can't set a third-party plugin's parameters reliably, so type the value into the plugin's own window. This is an independent recommendation, not a partnership with, sponsorship by or endorsement from Kilohearts AB. AI Voice Master Tool doesn't bundle, download or install the plugin.":
    "Рекомендуемый сторонний плагин: kHs Pitch Shifter (Kilohearts AB, kilohearts.com/products/pitch_shifter). Откройте его ползунок Pitch (в полутонах) и введите значение полутонов из «Калькулятора». Скрипты Premiere не могут надёжно задавать параметры сторонних плагинов, поэтому вводите значение прямо в окне плагина. Это независимая рекомендация, а не партнёрство, спонсорство или одобрение со стороны Kilohearts AB. AI Voice Master Tool не поставляет, не скачивает и не устанавливает этот плагин.",
  "Pacing: Render full timeline for AE": "Темп: Рендер всего таймлайна для AE",
  'Pitch, and any other effect besides Speed and J/L Pacing, exists only inside Premiere\'s playback engine. "Send to After Effects" can\'t carry it over piece by piece, so it refuses whenever such an effect is applied. This button bakes the selected audio over the whole selected span into one file (audio tracks without selected pieces, such as music, are muted for the render) and puts that file on the timeline in place of the original pieces, so you can see that the bake happened. Then click "Send to After Effects" as usual: the new clip has no Pitch on it and sends normally. Video is left untouched; it is still sent separately and is not baked. The render includes the track\'s own fader and effects and the Master, and the rendered clip goes back on the same track, where they apply again: set them to their defaults before rendering, or mix afterward.':
    "Питч, как и любой другой эффект, кроме скорости и J/L Pacing, существует только внутри движка воспроизведения Premiere. «Отправить в After Effects» не может передать его по кускам и отказывается, если такой эффект применён. Эта кнопка сводит выбранное аудио на всём выбранном участке в один файл (аудиодорожки без выбранных кусков, например с музыкой, на время рендера глушатся) и ставит этот файл на таймлайн вместо исходных кусков, чтобы было видно, что сведение произошло. Затем нажмите «Отправить в After Effects» как обычно: на новом клипе питча уже нет, и он отправляется без проблем. Видео остаётся нетронутым и по-прежнему отправляется отдельно, без сведения. Рендер включает фейдер и эффекты самой дорожки и мастер-шину, а отрендеренный клип возвращается на ту же дорожку, где они применяются ещё раз: перед рендером верните их к значениям по умолчанию или сводите уже после.",
  "\"Revert to segments\" puts the original pieces back in one click, as long as the plugin hasn't been reopened since. Premiere's own Cmd/Ctrl+Z also works, one step at a time.":
    "«Вернуть куски» одним нажатием возвращает исходные куски, если плагин с тех пор не открывали заново. Cmd/Ctrl+Z в самом Premiere тоже работает, по одному шагу.",
  "AI Voice: ElevenLabs API key and voice": "ИИ-голос: API-ключ ElevenLabs и голос",
  "Calls go straight from this computer to api.elevenlabs.io with your own key. The plugin has no key of its own and doesn't see or resell your usage. The key is stored only on this computer, in a plain settings file with the plugin's other settings, and is sent nowhere but api.elevenlabs.io. The status dot is green when ElevenLabs accepted the key, grey when it is saved but not confirmed yet (still checking, or ElevenLabs couldn't be reached), and red when no key is saved or ElevenLabs rejected it.":
    "Запросы идут напрямую с этого компьютера на api.elevenlabs.io с вашим собственным ключом. У плагина нет своего ключа, и он не видит и не перепродаёт ваше использование. Ключ хранится только на этом компьютере, в обычном файле настроек вместе с остальными настройками плагина, и никуда не отправляется, кроме api.elevenlabs.io. Точка статуса зелёная, если ElevenLabs принял ключ; серая, если ключ сохранён, но ещё не подтверждён (идёт проверка или ElevenLabs недоступен); красная, если ключа нет или ElevenLabs его отклонил.",
  'The Voice picker loads from your ElevenLabs account each time the plugin opens and after you save a key, in two groups: "My Voices" (anything you cloned, designed or added to your account) and "Stock voices" (ElevenLabs\' own premade voices). Click the star on a voice to pin it to the quick-access row above the picker. To use a voice that isn\'t listed, add it to your ElevenLabs account first (favorite, clone or design it at elevenlabs.io or in the ElevenLabs app), then click "Reload voices".':
    "Список голосов загружается из вашего аккаунта ElevenLabs при каждом открытии плагина и после сохранения ключа и делится на две группы: «Мои голоса» (всё, что вы клонировали, создали или добавили в аккаунт) и «Стандартные голоса» (готовые голоса самого ElevenLabs). Нажмите на звёздочку у голоса, чтобы закрепить его в строке быстрого доступа над списком. Если нужного голоса нет в списке, сначала добавьте его в аккаунт ElevenLabs (в избранное, клонированием или созданием на elevenlabs.io или в приложении ElevenLabs), затем нажмите «Обновить список голосов».",
  "AI Voice: Kokoro (offline)": "ИИ-голос: Kokoro (офлайн)",
  "The Language field only filters the Voice picker below by language and has no effect on generation. The voice you pick sets the language (bundled Kokoro-82M presets, Apache-2.0), so type your script in that voice's language; the plugin doesn't detect or translate languages.":
    "Поле «Язык» только фильтрует список голосов ниже по языку и на генерацию не влияет. Язык задаёт выбранный голос (встроенные пресеты Kokoro-82M, Apache-2.0), поэтому пишите сценарий на языке этого голоса: плагин не определяет и не переводит язык.",
  "AI Voice: Text and Improve for voice": "ИИ-голос: текст и «Улучшить для озвучки»",
  "Text: use full sentences and real punctuation. Commas, ellipses and paragraph breaks do the most for natural pacing on every model. On ElevenLabs, texts shorter than about 250 characters can come out inconsistent.":
    "Текст: пишите полными предложениями и с настоящей пунктуацией. Запятые, многоточия и абзацы сильнее всего влияют на естественный темп в любой модели. В ElevenLabs тексты короче примерно 250 символов могут звучать нестабильно.",
  "The model picker lists the models your OpenAI or Anthropic account offers, fetched when the plugin opens, when you save a key and when you switch provider. It defaults to the smallest, cheapest one, which is enough for rewriting a short script.":
    "Список моделей показывает модели, доступные вашему аккаунту OpenAI или Anthropic; он загружается при открытии плагина, после сохранения ключа и при смене провайдера. По умолчанию выбрана самая маленькая и дешёвая модель: для переписывания короткого сценария её хватает.",
  "Cost: rewriting one script with the default small model costs little; the provider's pricing page has current rates. Get a key at platform.openai.com (API keys, separate from a ChatGPT Plus subscription) or console.anthropic.com (separate from a Claude Pro subscription). Both need a small prepaid balance instead of a monthly plan.":
    "Стоимость: переписать один сценарий маленькой моделью по умолчанию стоит недорого; актуальные цены есть на странице тарифов провайдера. Ключ можно получить на platform.openai.com (API-ключи, отдельно от подписки ChatGPT Plus) или console.anthropic.com (отдельно от подписки Claude Pro). В обоих случаях нужен небольшой предоплаченный баланс, а не месячная подписка.",
  "AI Voice: Realism (ElevenLabs)": "ИИ-голос: Реализм (ElevenLabs)",
  "Automatic sets Stability, Similarity and Style together to a sensible combination. Advanced shows the sliders themselves, for fine-tuning beyond a preset: Stability on every model, Similarity on all but v3, and Style on v2 and for Voice Changer.":
    "«Автоматический» выставляет стабильность, похожесть и стиль вместе в разумном сочетании. «Расширенный» показывает сами ползунки для тонкой настройки сверх пресета: стабильность есть на всех моделях, похожесть на всех, кроме v3, а стиль на v2 и для «Смены голоса».",
  "Stability: lower values (about 30 to 50%) sound more emotional and lively but less consistent. Higher values (about 65 to 75%) sound clearer and more consistent but can sound flat.":
    "Стабильность: при низких значениях (примерно от 30 до 50%) голос эмоциональнее и живее, но менее стабилен. При высоких (примерно от 65 до 75%) он чище и стабильнее, но может звучать плоско.",
  "Similarity / Clarity: keep it in the 75 to 90% range, together with Stability. Pushed to 100%, the voice tends to over-enunciate into an unnatural news-anchor sound. Not on v3.":
    "Похожесть / чёткость: держите её вместе со стабильностью в диапазоне примерно от 75 до 90%. Ближе к 100% голос обычно начинает неестественно чеканить слова, как диктор новостей. В v3 этого параметра нет.",
  "AI Voice: Generate, Replace and Voice Changer": "ИИ-голос: генерация, замена и смена голоса",
  '"Generate & Insert" generates the audio, saves it under "AI Voice Master Tool/Generated" (in Documents, or next to your project if Save Renders is set to "Next to project") and places it at the playhead on the active sequence\'s target audio track (the first audio track targeted in Premiere, or else track 1). It is then ready for Silence Cut and Pacing. If something already sits at that spot, it refuses instead of overwriting: the playhead position is checked before generating, and the full length before placing. Move the playhead to an empty stretch, or target another track, and try again.':
    "«Сгенерировать и вставить» генерирует аудио, сохраняет его в «AI Voice Master Tool/Generated» (в «Документах» или рядом с проектом, если в «Сохранение рендеров» выбрано «Рядом с проектом») и ставит в позицию курсора на целевую аудиодорожку активной секвенции (первую из аудиодорожек, выбранных целевыми в Premiere, а если таких нет, первую). После этого клип сразу готов для вырезки тишины и вкладки «Темп». Если это место на дорожке уже занято, плагин ничего не перезаписывает и отказывается: позиция курсора проверяется до генерации, а вся длина перед вставкой. Переместите курсор на свободный участок или выберите другую целевую дорожку и попробуйте снова.",
  '"Replace Voice" generates the text again with the voice selected now and places it at the selected clip\'s start; the rest of your edit stays as it is. It speaks what the Text field holds. If the field held other text when you selected the clip, the banner says so and offers "Load its text", and Replace Voice asks for a second click before speaking that other text over the clip. The new take goes on the audio track below, and the previous take is disabled and stays on the timeline: bring it back with Enable in the clip\'s right-click menu, or with the plugin\'s Undo. Replace needs a free audio track below the clip; without one, it asks you to add a track before generating anything.':
    "«Заменить голос» заново озвучивает текст выбранным сейчас голосом и ставит результат в начало выбранного клипа; остальной монтаж не меняется. Озвучивается то, что стоит в поле «Текст». Если при выборе клипа в поле был другой текст, баннер сообщит об этом и предложит «Загрузить его текст», а «Заменить голос» попросит нажать ещё раз, прежде чем озвучить этот другой текст поверх клипа. Новый дубль ставится на аудиодорожку ниже, а предыдущий отключается и остаётся на таймлайне: включить его обратно можно командой Enable (Включить) в контекстном меню клипа или кнопкой «Отменить» плагина. Для замены нужна свободная аудиодорожка под клипом; если её нет, плагин попросит добавить дорожку ещё до генерации.",
  "Voice Changer's \"Convert Selected Clip's Voice\" renders the selected timeline clip, with any Speed or Pitch already on it, and sends it to ElevenLabs' Voice Changer (speech-to-speech) with the voice picked above. Other audio tracks are muted for the render, so music under the clip isn't sent. The words stay the same and only the voice changes. Like Replace, it needs a spare audio track directly below the clip's own track, so the result can be undone. Premiere renders the clip itself; only if it can't does the render go to Adobe Media Encoder's queue. If that render then times out, check Media Encoder's Queue panel and its \"auto-start queue\" preference. ElevenLabs takes clips up to 5 minutes long: cut a longer one into parts and convert them one at a time.":
    "«Сконвертировать голос выбранного клипа» во вкладке «Смена голоса» рендерит выбранный на таймлайне клип вместе с уже применёнными скоростью и питчем и отправляет его в ElevenLabs на смену голоса (speech-to-speech) с голосом, выбранным выше. Остальные аудиодорожки на время рендера глушатся, поэтому музыка под клипом не отправляется. Слова остаются теми же, меняется только голос. Как и «Заменить голос», функции нужна свободная аудиодорожка прямо под дорожкой клипа, чтобы результат можно было отменить. Premiere рендерит клип сам; только если он не может, рендер уходит в очередь Adobe Media Encoder. Если этот рендер не уложится по времени, проверьте панель очереди в Media Encoder и его настройку «auto-start queue». ElevenLabs принимает клипы длиной до 5 минут: разрежьте более длинный клип на части и сконвертируйте их по одной.",
  "AI Voice: Batch": "ИИ-голос: пакетная генерация",
  "Each line of the batch script becomes one generated clip, with the voice, model and Realism settings set above. Lines are generated one at a time, to stay within ElevenLabs' rate limits, and placed one after another on the timeline from the playhead.":
    "Каждая строка пакетного сценария становится одним сгенерированным клипом с настройками голоса, модели и реализма, заданными выше. Строки озвучиваются по одной, чтобы не выйти за лимиты запросов ElevenLabs, и встают на таймлайн друг за другом, начиная с позиции курсора.",
  '"Generate All" skips lines already generated and doesn\'t place lines already on the timeline, so you can add lines and click again to generate and place only the new ones. Before generating anything, it checks that the target audio track (the first targeted one, or else track 1) is free after the playhead.':
    "«Сгенерировать всё» пропускает уже озвученные строки и не ставит повторно те, что уже на таймлайне, поэтому можно добавить строки и нажать снова: сгенерированы и поставлены будут только новые. Перед генерацией плагин проверяет, что целевая аудиодорожка (первая из выбранных целевыми, а если таких нет, первая) после курсора свободна.",
  'Open After Effects (2025 or later), then in the "AI Voice Master Tool Bridge" plugin there (Window > Extensions), click "Place in current composition."':
    "Откройте After Effects (2025 или новее), затем в плагине «AI Voice Master Tool Bridge» (Window > Extensions) нажмите «Разместить в текущей композиции».",
  "Send to After Effects passes the pieces selected on the timeline to After Effects through a small hand-off file, since the two apps share no clipboard for timeline clips. In After Effects, each piece's speed comes back as a time-stretch, and its J/L position is kept. There is no crossfade: overlapping pieces play at full volume during the overlap. The pieces stay linked to your original media, so you can still nudge their edges in After Effects.":
    "«Отправить в After Effects» передаёт выбранные на таймлайне куски в After Effects через небольшой файл, потому что общего буфера обмена для клипов таймлайна у этих приложений нет. В After Effects скорость каждого куска восстанавливается растяжением по времени, а положение от J/L Pacing сохраняется. Кроссфейда нет: перекрывающиеся куски в зоне перекрытия звучат на полной громкости. Куски остаются связанными с исходным медиа, поэтому их границы можно подвинуть уже в After Effects.",
  "Video is always sent linked to its media and never rendered. A plain linked audio and video clip, such as a camera's own file, arrives as one linked layer with picture and sound, as it sits in Premiere. Only a clip whose audio and video come from two different source files arrives as two separate layers.":
    "Видео всегда отправляется связанным с медиа и никогда не рендерится. Обычный клип со связанными аудио и видео, например файл прямо с камеры, приходит одним связанным слоем с картинкой и звуком, как он и лежит в Premiere. Двумя отдельными слоями приходит только клип, у которого аудио и видео берутся из двух разных исходных файлов.",
  'Send to After Effects never renders anything. If a selected clip has Pitch, or any other effect besides Speed and J/L Pacing, it refuses, because that effect exists only in Premiere\'s playback engine and not in the file. For that case, use "Render full timeline for AE" in the Pacing tab first.':
    "«Отправить в After Effects» никогда ничего не рендерит. Если на выбранном клипе есть питч или любой другой эффект, кроме скорости и J/L Pacing, функция отказывается, потому что такой эффект существует только в движке воспроизведения Premiere, а не в файле. В этом случае сначала используйте «Рендер всего таймлайна для AE» во вкладке «Темп».",
  'An audio file made by "Render full timeline for AE" has no spare material past its edges, so in After Effects you can\'t extend it the way you can extend a trimmed clip; to make it longer, render again in Premiere. Video, if any, is not affected: it is always sent linked to the original media, so you can still adjust it freely.':
    "У аудиофайла из «Рендер всего таймлайна для AE» нет запаса материала за краями, поэтому в After Effects его нельзя удлинить, как обрезанный клип; чтобы сделать его длиннее, отрендерите заново в Premiere. Видео, если оно есть, это не касается: оно всегда отправляется связанным с исходным медиа, и его можно свободно двигать.",

  // bridge/main.tsx — the "AI Voice Master Tool Bridge" panel (After Effects side)
  "Checking for a cut sent from Premiere…": "Проверяем, не отправлена ли вырезка из Premiere…",
  'Nothing sent yet. In Premiere, use "Send to After Effects" (in the AI Voice Master Tool plugin\'s Send to AE tab) after cutting.':
    "Пока ничего не отправлено. В Premiere используйте «Отправить в After Effects» (во вкладке «Отправить в AE» плагина AI Voice Master Tool) после вырезки.",
  'from "{name}"{fileName}': "из «{name}»{fileName}",
  "Sent {when}": "Отправлено {when}",
  "Placing…": "Размещение…",
  "Place in current composition": "Разместить в текущей композиции",
  "Refresh": "Обновить",
  "Placed {count} {kind}": "Размещено {kind}: {count}",
  "Reading: {path}": "Чтение: {path}",
  " · modified {when}": " · изменено {when}",
  " · {count} bytes": " · {count} байт",
  " · the Bridge last checked {when}": " · последняя проверка Bridge: {when}",
  "Saves an After Effects-specific troubleshooting report to your Documents folder.":
    "Сохраняет отчёт для диагностики, специфичный для After Effects, в папку «Документы».",
  "The Bridge's scripting part didn't load, so it can't place anything. Quit and reopen After Effects; if that doesn't help, reinstall the plugin.":
    "Скриптовая часть Bridge не загрузилась, поэтому он ничего не может разместить. Закройте и снова откройте After Effects; если не поможет — переустановите плагин.",
  "The plugin's scripting part didn't load, so nothing that works on the timeline can run. Quit and reopen Premiere Pro; if that doesn't help, reinstall the plugin.":
    "Скриптовая часть плагина не загрузилась, поэтому ничего, что работает с таймлайном, не запустится. Закройте и снова откройте Premiere Pro; если не поможет — переустановите плагин.",
  "This isn't a key: it contains spaces, so other text was probably pasted or typed into this field. Copy the key again from your account's API keys page.":
    "Это не ключ: в нём есть пробелы, похоже, в поле вставили или напечатали другой текст. Скопируйте ключ заново со страницы API-ключей в своём аккаунте.",
  "The key contains non-Latin characters, for example a Cyrillic letter that looks like a Latin one. Copy the key again from your account's API keys page, or retype it with an English keyboard layout.":
    "В ключе есть не-латинские символы, например кириллическая буква, похожая на латинскую. Скопируйте ключ заново со страницы API-ключей в своём аккаунте или наберите его в английской раскладке.",
  "Couldn't read the current selection, so Speed is applied to the selected clips in place instead of rebuilding them from the original Cut. Nothing you edited by hand can be lost this way.":
    "Не удалось прочитать текущее выделение, поэтому скорость применяется к выделенным клипам на месте, без пересборки из исходной вырезки. Так ничего из сделанного вручную не потеряется.",
  "The timeline no longer matches the original Cut ({live} pieces selected vs {expected} from that Cut) — applying Speed to the current selection instead of rebuilding, so your manual edits are kept.":
    "Таймлайн больше не совпадает с исходной вырезкой (выделено {live} кусков против {expected} из той вырезки) — скорость применяется к текущему выделению, а не пересобирается заново, чтобы сохранить ваши ручные правки.",
  "Speed was applied, but re-applying J/L Pacing afterwards failed: {error}. Don't run Speed again; re-apply J/L Pacing from the Pacing tab.":
    "Скорость применена, но повторно применить J/L Pacing не удалось: {error}. Не запускайте скорость снова; примените J/L Pacing заново на вкладке «Темп».",

  // ---- Messages from the ExtendScript side (see hostMessages.ts).
  "Please select exactly one clip on the timeline.": "Выберите на таймлайне ровно один клип.",
  "Could not locate the selected clip on any track.": "Не удалось найти выбранный клип ни на одной дорожке.",
  "Premiere couldn't read this clip's effects.": "Premiere не смог прочитать эффекты этого клипа.",
  "No active sequence. Open a sequence first.": "Нет активной секвенции. Сначала откройте секвенцию.",
  "Cannot cut this clip: Premiere's editing interface isn't available in this session. Restart Premiere Pro and try again; the clip was left untouched.":
    "Этот клип нельзя разрезать: интерфейс редактирования Premiere в этой сессии недоступен. Перезапустите Premiere Pro и попробуйте снова; клип оставлен без изменений.",
  "Cannot cut this clip: no active sequence. Open the sequence in the Timeline and try again; the clip was left untouched.":
    "Этот клип нельзя разрезать: нет активной секвенции. Откройте секвенцию на таймлайне и попробуйте снова; клип оставлен без изменений.",
  "No segments to cut — scan the clip first.": "Нечего вырезать — сначала отсканируйте клип.",
  "Selected clip has no source media.": "У выбранного клипа нет исходного медиафайла.",
  "Cannot undo: the original audio track no longer exists.": "Отмена невозможна: исходной аудиодорожки больше нет.",
  "The original video track no longer exists — only the audio was restored.":
    "Исходной видеодорожки больше нет — восстановлено только аудио.",
  "Cannot undo: could not find the original source media in the Project panel. Nothing was changed.":
    "Отмена невозможна: не удалось найти исходный медиафайл в панели «Проект». Ничего не изменено.",
  "Could not find the original source media of {p0} piece(s) in the Project panel — nothing was changed. Import the source file again, then try again.":
    "Не найден исходный медиафайл для кусков ({p0}) в панели «Проект» — ничего не изменено. Импортируйте исходный файл заново и попробуйте ещё раз.",
  "Restored the clip's position, but couldn't restore its original Speed (Premiere's editing interface was not available).":
    "Позиция клипа восстановлена, но его исходную скорость восстановить не удалось (интерфейс редактирования Premiere был недоступен).",
  "Restored the clip's position, but couldn't restore its original Speed (no active sequence).":
    "Позиция клипа восстановлена, но его исходную скорость восстановить не удалось (нет активной секвенции).",
  "Restored the clip's position, but couldn't find it in Premiere's editing interface to restore its original Speed.":
    "Позиция клипа восстановлена, но найти его в интерфейсе редактирования Premiere, чтобы вернуть исходную скорость, не удалось.",
  "Premiere rejected restoring the original clip — the track may not be clear at that position.":
    "Premiere отказался восстановить исходный клип — возможно, на этом месте дорожка занята.",
  "Could not restore the linked video — Premiere rejected placing it.":
    "Не удалось восстановить связанное видео — Premiere отказался его разместить.",
  "Restored the clip, but couldn't verify its exact placement afterward.":
    "Клип восстановлен, но проверить его точное положение после этого не удалось.",
  "No original Cut segments to rebuild from — re-run Cut first.":
    "Нет исходных сегментов вырезки для пересборки — выполните вырезку заново.",
  "The original audio track no longer exists in this sequence.": "Исходной аудиодорожки в этой секвенции больше нет.",
  "Could not find the original source media in the Project panel.": "Не удалось найти исходный медиафайл в панели «Проект».",
  "Premiere's editing interface was not available, so no edge fades were added.":
    "Интерфейс редактирования Premiere был недоступен, поэтому фейды на краях кусков не добавлены.",
  "Couldn't add the fade-in.": "Не удалось добавить фейд-ин.",
  "Couldn't add the fade-out.": "Не удалось добавить фейд-аут.",
  "neither fade-in nor fade-out could be added": "не удалось добавить ни фейд на входе, ни фейд на выходе",
  "Could not locate the selected pieces on any track.": "Не удалось найти выбранные куски ни на одной дорожке.",
  "J/L Pacing works on audio only. Select the pieces Cut made on an audio track.":
    "J/L Pacing работает только со звуком. Выделите на аудиодорожке куски, которые сделала вырезка.",
  "J/L Pacing needs a spare audio track directly below the selected pieces to alternate onto. Add one more audio track to this sequence and try again.":
    "Для J/L Pacing нужна свободная аудиодорожка сразу под выбранными кусками, чтобы чередовать на неё куски. Добавьте в эту секвенцию ещё одну аудиодорожку и попробуйте снова.",
  "Some pieces have a linked video, but there's no spare video track to alternate onto — only audio pacing was applied, the video was left where it was. Add one more video track and re-run if you need the video repositioned too.":
    "У некоторых кусков есть связанное видео, но свободной видеодорожки для чередования нет — темп применён только к аудио, видео осталось на месте. Добавьте ещё одну видеодорожку и повторите, если видео тоже нужно переставить.",
  "The original Cut position wasn't available — the pieces were placed at their current position instead.":
    "Исходная позиция вырезки недоступна — куски размещены по их текущему положению.",
  "No audio file path given.": "Не указан путь к аудиофайлу.",
  "Premiere rejected importing the generated audio file.": "Premiere отказался импортировать сгенерированный аудиофайл.",
  "Import appeared to succeed, but the new project item could not be located.":
    "Импорт вроде бы прошёл, но найти новый элемент проекта не удалось.",
  "Select the audio clip whose voice you want to replace.": "Выберите аудиоклип, голос в котором нужно заменить.",
  "The selected clip changed while the new voice was being made — nothing was replaced, to avoid overwriting the wrong clip. Re-select the original clip and try again.":
    "Выбранный клип изменился, пока создавался новый голос — ничего не заменено, чтобы не перезаписать не тот клип. Выберите исходный клип заново и повторите.",
  "Active sequence has no audio track to place the generated voice-over on.":
    "В активной секвенции нет аудиодорожки, чтобы разместить сгенерированную озвучку.",
  "Placed on the timeline, but could not auto-select the new clip.":
    "Размещено на таймлайне, но выделить новый клип автоматически не удалось.",
  "Placed on the timeline, but could not locate the new clip afterward to select it.":
    "Размещено на таймлайне, но найти новый клип после этого, чтобы выделить его, не удалось.",
  "No files to place.": "Нет файлов для размещения.",
  "Active sequence has no audio track to place generated voice-overs on.":
    "В активной секвенции нет аудиодорожки, чтобы разместить сгенерированные озвучки.",
  'Audio track {p0} has "{p1}" at or after the playhead. Batch places its clips one after another from the playhead and would overwrite it. Make an empty audio track the first targeted one (turn on its track-targeting button in the track header, and turn it off on the audio tracks above it), or move the playhead to {p2}s or later, the end of that track\'s last clip, and click Generate All again. Nothing was generated.':
    "На аудиодорожке {p0} в позиции курсора или после неё есть «{p1}». Пакет ставит клипы один за другим от курсора и перезаписал бы его. Сделайте пустую аудиодорожку первой целевой (включите на её заголовке кнопку выбора целевой дорожки и выключите эту кнопку на аудиодорожках выше) или поставьте курсор на {p2} с или дальше, туда, где кончается последний клип этой дорожки, и снова нажмите «Сгенерировать всё». Ничего не сгенерировано.",
  'Audio track {p0} has "{p1}" at or after the playhead. Batch places its clips one after another from the playhead and would overwrite it. Make an empty audio track the first targeted one (turn on its track-targeting button in the track header, and turn it off on the audio tracks above it), or move the playhead to {p2}s or later, the end of that track\'s last clip, and click Generate All again. The generated lines are kept. Nothing was placed.':
    "На аудиодорожке {p0} в позиции курсора или после неё есть «{p1}». Пакет ставит клипы один за другим от курсора и перезаписал бы его. Сделайте пустую аудиодорожку первой целевой (включите на её заголовке кнопку выбора целевой дорожки и выключите эту кнопку на аудиодорожках выше) или поставьте курсор на {p2} с или дальше, туда, где кончается последний клип этой дорожки, и снова нажмите «Сгенерировать всё». Сгенерированные строки сохранены. Ничего не размещено.",
  "Premiere's editing interface is not available. Restart Premiere Pro and try again.":
    "Интерфейс редактирования Premiere недоступен. Перезапустите Premiere Pro и попробуйте снова.",
  "No active sequence. Open the sequence in the Timeline and try again.":
    "Нет активной секвенции. Откройте секвенцию на таймлайне и попробуйте снова.",
  "Select one or more clips on the timeline first (the pieces Cut just made are auto-selected).":
    "Сначала выберите один или несколько клипов на таймлайне (куски, созданные вырезкой, выделяются автоматически).",
  "Select one or more clips on the timeline first.": "Сначала выберите один или несколько клипов на таймлайне.",
  "Premiere didn't start the render. Check that Adobe Media Encoder is installed.":
    "Premiere не запустил рендер. Проверьте, что Adobe Media Encoder установлен.",
  "No export preset path given.": "Не указан путь к пресету экспорта.",
  "Select the audio clip you want to convert.": "Выберите аудиоклип, который нужно сконвертировать.",
  "Rendering isn't available in this version of Premiere Pro.": "Рендер недоступен в этой версии Premiere Pro.",
  "Select the cut segments to send first (they're auto-selected right after Cut).":
    "Сначала выберите вырезанные сегменты для отправки (сразу после вырезки они выделены автоматически).",
  "All selected clips must come from the same source media to send as segments.":
    "Чтобы отправить сегменты, все выбранные клипы должны быть из одного и того же исходного медиафайла.",
  "Select the audio to render first.": "Сначала выберите аудио для рендера.",
  "No rendered file path given.": "Не указан путь к отрендеренному файлу.",
  "No audio pieces recorded from the render step — nothing to replace.":
    "На шаге рендера не записано ни одного аудиокуска — заменять нечего.",
  'The timeline changed since rendering — one or more of the original pieces can no longer be found. Nothing was removed. Run "Render full timeline for AE" again.':
    "Таймлайн изменился после рендера — одного или нескольких исходных кусков больше нет. Ничего не удалено. Запустите «Рендер всего таймлайна для AE» ещё раз.",
  '"{p0}" now sits on audio track {p1} where the rendered file goes ({p2}s–{p3}s). Nothing was removed. Move it out of that stretch, then run "Render full timeline for AE" again.':
    "«{p0}» теперь лежит на аудиодорожке {p1} там, куда встаёт отрендеренный файл ({p2} с–{p3} с). Ничего не удалено. Уберите его с этого участка и запустите «Рендер всего таймлайна для AE» ещё раз.",
  '"{p0}" on audio track {p1} ({p2}s–{p3}s) sits between the selected pieces but isn\'t selected: the render would include it and then replace it. Select it too, or move it out of that stretch, then try again. Nothing was rendered.':
    "«{p0}» на аудиодорожке {p1} ({p2} с–{p3} с) лежит между выделенными кусками, но не выделен: рендер включил бы его, а затем заменил. Выделите и его или уберите его с этого участка, затем попробуйте снова. Ничего не отрендерено.",
  "Could not locate a track for the original audio pieces.": "Не удалось найти дорожку для исходных аудиокусков.",
  "Premiere rejected importing the rendered file.": "Premiere отказался импортировать отрендеренный файл.",
  "No original pieces were recorded for this render — nothing to restore.":
    "Для этого рендера не записано исходных кусков — восстанавливать нечего.",
  "Could not find the rendered clip on the timeline to remove — it may already have been moved or deleted. Restoring the original pieces anyway.":
    "Не удалось найти отрендеренный клип на таймлайне, чтобы удалить его — возможно, его уже переместили или удалили. Исходные куски всё равно восстанавливаются.",
  "Restored a piece's position, but couldn't restore its original Speed (Premiere's editing interface was not available).":
    "Позиция куска восстановлена, но его исходную скорость восстановить не удалось (интерфейс редактирования Premiere был недоступен).",
  "Restored a piece's position, but couldn't restore its original Speed (no active sequence).":
    "Позиция куска восстановлена, но его исходную скорость восстановить не удалось (нет активной секвенции).",
  "Restored a piece's position, but couldn't find it in Premiere's editing interface to restore its original Speed.":
    "Позиция куска восстановлена, но найти его в интерфейсе редактирования Premiere, чтобы вернуть исходную скорость, не удалось.",
  "Nothing to place — send a cut from Premiere first.": "Размещать нечего — сначала отправьте вырезку из Premiere.",
  "Open (or select) a composition in After Effects first.": "Сначала откройте (или выберите) композицию в After Effects.",
  "The data sent from Premiere is missing its source media path. Send it again from Premiere.":
    "В данных, отправленных из Premiere, нет пути к исходному медиафайлу. Отправьте их из Premiere ещё раз.",
  "The data sent from Premiere has no segments. Send it again from Premiere.":
    "В данных, отправленных из Premiere, нет сегментов. Отправьте их из Premiere ещё раз.",
  "The data sent from Premiere has no rendered files. Send it again from Premiere.":
    "В данных, отправленных из Premiere, нет отрендеренных файлов. Отправьте их из Premiere ещё раз.",
  "Active item is no longer a composition — skipped repositioning.": "Активный элемент больше не композиция — перестановка пропущена.",
  "Please select exactly one clip (currently {p0} selected). For a clip with several linked audio channels, Alt/Option-click one audio clip to select it alone.":
    "Выберите ровно один клип (сейчас выбрано: {p0}). Если у клипа несколько связанных аудиоканалов, щёлкните по одному аудиоклипу с Alt/Option, чтобы выбрать только его.",
  '"{p0}" added, but its "{p1}" parameter was not found.{p2}': "«{p0}» добавлен, но его параметр «{p1}» не найден.{p2}",
  '"{p0}": its "{p1}" setting could not be changed ({p2}).': "«{p0}»: не удалось изменить параметр «{p1}» ({p2}).",
  '"{p0}" was added but can\'t be found on the clip. Add it again by hand in Effect Controls.':
    "«{p0}» добавлен, но не найден на клипе. Добавьте его вручную ещё раз на панели «Элементы управления эффектами» (Effect Controls).",
  "Razoring at {p0}s failed ({p1}).": "Разрез в {p0} с не удался ({p1}).",
  "Removing a silence piece failed ({p0}).": "Не удалось удалить кусок тишины ({p0}).",
  "Closing a gap failed ({p0}).": "Не удалось закрыть промежуток ({p0}).",
  "Removing a piece failed ({p0}).": "Не удалось удалить кусок ({p0}).",
  "Restored the clip's position, but restoring its original Speed failed ({p0}).":
    "Позиция клипа восстановлена, но восстановить его исходную скорость не удалось ({p0}).",
  "Restoring the linked video failed ({p0}).": "Не удалось восстановить связанное видео ({p0}).",
  "Premiere did not match it to the selection, so its Speed was left unchanged.":
    "Premiere не сопоставил его с выделением, поэтому его скорость не изменена.",
  'Speed was applied to "{p0}", but moving it into place failed ({p1}). Check it on the timeline.':
    "Скорость к «{p0}» применена, но поставить его на место не удалось ({p1}). Проверьте его на таймлайне.",
  "Restored the clip, but setting its exact bounds failed ({p0}).": "Клип восстановлен, но задать его точные границы не удалось ({p0}).",
  "Restored the video, but setting its exact bounds failed ({p0}).": "Видео восстановлено, но задать его точные границы не удалось ({p0}).",
  "Could not remove an existing piece before rebuilding ({p0}).": "Не удалось удалить существующий кусок перед пересборкой ({p0}).",
  "Piece {p0}: Premiere rejected placing it at {p1}s — left out.": "Кусок {p0}: Premiere отказался разместить его на {p1} с — пропущен.",
  "Piece {p0}: placed, but could not locate it afterward — left as-is.":
    "Кусок {p0}: размещён, но найти его после этого не удалось — оставлен как есть.",
  "Piece {p0}: placed, but setting its source in/out failed ({p1}).":
    "Кусок {p0}: размещён, но задать его вход и выход в исходнике не удалось ({p1}).",
  "Piece {p0} (video): Premiere rejected placing it at {p1}s — left out.":
    "Кусок {p0} (видео): Premiere отказался разместить его на {p1} с — пропущен.",
  "Piece {p0} (video): placed, but could not locate it afterward — left as-is.":
    "Кусок {p0} (видео): размещён, но найти его после этого не удалось — оставлен как есть.",
  "Piece {p0} (video): placed, but setting its exact bounds failed ({p1}).":
    "Кусок {p0} (видео): размещён, но задать его точные границы не удалось ({p1}).",
  "Could not remove a leftover stray fragment ({p0}).": "Не удалось удалить оставшийся лишний фрагмент ({p0}).",
  "Could not restore a piece's own duration after setting its speed ({p0}).":
    "Не удалось восстановить собственную длительность куска после установки скорости ({p0}).",
  '"{p0}" audio transition not found — edge fades skipped for all pieces.':
    "Аудиопереход «{p0}» не найден — фейды по краям пропущены для всех кусков.",
  'Premiere refused the "{p0}" audio transition on every piece — no edge fades were added; the pieces themselves are in place.':
    "Premiere не принял аудиопереход «{p0}» ни на одном куске — фейды по краям не добавлены; сами куски на месте.",
  "Couldn't add the fade-in ({p0}).": "Не удалось добавить фейд-ин ({p0}).",
  "Couldn't add the fade-out ({p0}).": "Не удалось добавить фейд-аут ({p0}).",
  "Could not set the source clip's in/out {p0} ({p1}).": "Не удалось задать точки входа и выхода исходного клипа {p0} ({p1}).",
  "for piece {p0} before placing it": "для куска {p0} перед размещением",
  "for the video of piece {p0} before placing it": "для видео куска {p0} перед размещением",
  "back to its original range after placing the pieces": "обратно в прежние значения после размещения кусков",
  "{p0} video clip{p1} in the selection could not be matched to a linked audio piece — video pacing was skipped for {p2} this run.":
    "Видеоклипов в выделении, которые не удалось сопоставить со связанным аудиокуском: {p0} — темп видео для них в этот раз не применялся.",
  "Piece {p0}: its audio and video were already {p1} frame(s) apart before J/L Pacing ran.":
    "Кусок {p0}: звук и видео расходились на {p1} кадр(ов) ещё до запуска J/L Pacing.",
  "{p0} pieces are selected, but this run expected {p1} — the selection may have changed. Re-select the pieces from that Cut and try again.":
    "Выбрано кусков: {p0}, а этот запуск ожидал {p1} — возможно, выделение изменилось. Выберите куски из той вырезки заново и повторите.",
  "Piece {p0} has no source media.": "У куска {p0} нет исходного медиафайла.",
  "Placing pieces at the original Cut position ({p0}s) instead of where they currently sit ({p1}s).":
    "Куски размещаются на исходной позиции вырезки ({p0} с), а не там, где они сейчас ({p1} с).",
  "Can't apply J/L Pacing safely: another clip on {p0} starts at {p1}s, closer than piece {p2} needs ({p3}s). Move it further away (or onto a different track) before running J/L Pacing.":
    "Безопасно применить J/L Pacing нельзя: другой клип на {p0} начинается на {p1} с — ближе, чем нужно куску {p2} ({p3} с). Отодвиньте его дальше (или перенесите на другую дорожку) перед запуском J/L Pacing.",
  "Can't apply J/L Pacing safely: another clip on {p0} starts at {p1}s, closer than piece {p2} needs ({p3}s). Move it further away before running J/L Pacing.":
    "Безопасно применить J/L Pacing нельзя: другой клип на {p0} начинается на {p1} с — ближе, чем нужно куску {p2} ({p3} с). Отодвиньте его дальше перед запуском J/L Pacing.",
  "Piece {p0} (video): could not remove for repositioning ({p1}) — left in its original spot.":
    "Кусок {p0} (видео): не удалось убрать его для перестановки ({p1}) — оставлен на исходном месте.",
  "Piece {p0} may have landed {p1}s away from where it belongs. Check it on the timeline.":
    "Кусок {p0}, возможно, встал в {p1} с от своего места. Проверьте его на таймлайне.",
  "Piece {p0}: placed, but setting its source in/out failed ({p1}) — kept with default source framing.":
    "Кусок {p0}: размещён, но задать его вход и выход в исходнике не удалось ({p1}) — оставлено исходное кадрирование.",
  "Piece {p0} (video): placed, but setting its source in/out failed ({p1}) — kept with default source framing.":
    "Кусок {p0} (видео): размещён, но задать его вход и выход в исходнике не удалось ({p1}) — оставлено исходное кадрирование.",
  "Reset: {p0} piece(s) are not back to back: {p1}.": "Сброс: кусков, стоящих не вплотную, {p0}: {p1}.",
  "Video piece {p0} is missing near {p1}s. Check the video track.": "Видеокусок {p0} не найден около {p1} с. Проверьте видеодорожку.",
  "Video piece {p0} near {p1}s is only {p2}s long. Check the video track.":
    "Видеокусок {p0} около {p1} с длится всего {p2} с. Проверьте видеодорожку.",
  "Could not restore a piece's own duration after resetting its speed ({p0}).":
    "Не удалось восстановить собственную длительность куска после сброса его скорости ({p0}).",
  "The number of clips on the {p0} track changed while restoring speed. Check the track.":
    "Число клипов изменилось при восстановлении скорости ({p0}). Проверьте дорожку.",
  "A {p0}s clip at {p1}s was removed as a leftover fragment. If it was a real piece, undo (Cmd/Ctrl+Z), then run Diagnostics from the gear menu and add the report to a bug report.":
    "Клип длиной {p0} с на {p1} с удалён как лишний фрагмент. Если это был настоящий кусок, отмените (Cmd/Ctrl+Z), затем запустите диагностику из меню шестерёнки и приложите отчёт к сообщению об ошибке.",
  "Piece {p0}: audio and video moved {p1} frame(s) out of sync.": "Кусок {p0}: звук и видео разошлись на {p1} кадр(ов).",
  "Piece {p0}: adding fades moved audio and video {p1} frame(s) out of sync.":
    "Кусок {p0}: после добавления фейдов звук и видео разошлись на {p1} кадр(ов).",
  "Video track: {p0} clip(s) where {p1} were expected (alternate track: {p2} of {p3}). Some leftover fragments may remain, or a piece was removed.":
    "Видеодорожка: клипов {p0}, а ожидалось {p1} (чередующаяся дорожка: {p2} из {p3}). Возможно, остались лишние фрагменты или удалён кусок.",
  "Audio track: {p0} clip(s) where {p1} were expected (alternate track: {p2} of {p3}). Some leftover fragments may remain, or a piece was removed.":
    "Аудиодорожка: клипов {p0}, а ожидалось {p1} (чередующаяся дорожка: {p2} из {p3}). Возможно, остались лишние фрагменты или удалён кусок.",
  "Generated audio file not found on disk: {p0}": "Сгенерированный аудиофайл не найден на диске: {p0}",
  "Premiere rejected placing the generated audio at {p0}s.": "Premiere отказался разместить сгенерированное аудио на {p0} с.",
  "Audio track {p0} is locked, so the new take can't be placed. Unlock it, then try again. Nothing was replaced.":
    "Аудиодорожка {p0} заблокирована, поэтому новый дубль нельзя поставить. Разблокируйте её и попробуйте снова. Ничего не заменено.",
  "The new take goes on the audio track below and the previous take stays as a disabled clip, but audio track {p0} is the last one. Add an audio track (Sequence > Add Tracks), then try again. Nothing was replaced.":
    "Новый дубль ставится на аудиодорожку ниже, а предыдущий остаётся отключённым клипом, но аудиодорожка {p0} последняя. Добавьте аудиодорожку (Sequence > Add Tracks) и попробуйте снова. Ничего не заменено.",
  "This clip is {p0} long, and ElevenLabs Voice Changer takes at most 5:00. Cut it into shorter clips and convert them one at a time. Nothing was rendered or sent.":
    "Этот клип длится {p0}, а ElevenLabs Voice Changer принимает не больше 5:00. Разрежьте его на клипы покороче и преобразуйте их по одному. Ничего не отрендерено и не отправлено.",
  "Premiere rejected placing the generated audio at {p0}s. The previous take was turned back on.":
    "Premiere отказался разместить сгенерированное аудио на {p0} с. Предыдущий дубль снова включён.",
  "Premiere rejected placing the generated audio at {p0}s. The previous take is still disabled: select it and choose Clip > Enable.":
    "Premiere отказался разместить сгенерированное аудио на {p0} с. Предыдущий дубль по-прежнему отключён: выделите его и включите командой Clip > Enable (Клип > Включить).",
  "File {p0} of {p1}: not found on disk ({p2}).": "Файл {p0} из {p1}: не найден на диске ({p2}).",
  "File {p0} of {p1}: Premiere rejected importing it.": "Файл {p0} из {p1}: Premiere отказался его импортировать.",
  "File {p0} of {p1}: import appeared to succeed, but the new project item could not be located.":
    "Файл {p0} из {p1}: импорт вроде бы прошёл, но найти новый элемент проекта не удалось.",
  "File {p0} of {p1}: Premiere rejected placing it at {p2}s.": "Файл {p0} из {p1}: Premiere отказался разместить его на {p2} с.",
  "File {p0} of {p1}: placed, but could not be located afterward to place the next file.":
    "Файл {p0} из {p1}: размещён, но найти его после этого, чтобы поставить следующий файл, не удалось.",
  "File {p0} of {p1}: {p2}": "Файл {p0} из {p1}: {p2}",
  'Clip {p0} ("{p1}"): couldn\'t find its track.': "Клип {p0} («{p1}»): не удалось найти его дорожку.",
  'Clip {p0} ("{p1}"): Premiere couldn\'t find it on its track.': "Клип {p0} («{p1}»): Premiere не нашёл его на дорожке.",
  'Clip {p0} ("{p1}"): {p2}': "Клип {p0} («{p1}»): {p2}",
  "After Speed, a video clip and its audio no longer line up (start differs by {p0} frame(s), end by {p1} frame(s)). Check them on the timeline.":
    "После изменения скорости видеоклип и его звук больше не совпадают (начало расходится на {p0} кадр(ов), конец — на {p1}). Проверьте их на таймлайне.",
  'Premiere\'s "{p0}" audio effect could not be found. Restart Premiere Pro and try again.':
    "Аудиоэффект Premiere «{p0}» не найден. Перезапустите Premiere Pro и попробуйте снова.",
  "{p0}, item {p1}: {p2}": "{p0}, элемент {p1}: {p2}",
  "Could not remove the previous render at {p0} before starting a new one — it may be locked by another process (antivirus scan, cloud-sync client). Close anything that might be reading it and try again.":
    "Не удалось удалить предыдущий рендер {p0} перед новым — возможно, файл занят другим процессом (антивирусная проверка, облачная синхронизация). Закройте всё, что может его читать, и повторите.",
  'Clip "{p0}" has an effect applied ("{p1}") that can\'t be carried over to After Effects — video is never rendered: it goes over as the original file, with only its cut points, position and speed. Remove it before sending, or exclude this clip from the selection.':
    "У клипа «{p0}» есть эффект («{p1}»), который нельзя перенести в After Effects — видео никогда не рендерится: оно переносится исходным файлом, только с точками разреза, позицией и скоростью. Уберите эффект перед отправкой или исключите этот клип из выделения.",
  'Clip "{p0}" has Pitch applied — Send to AE never renders: it rebuilds the cut in After Effects from the original file, with only cut points, positions and speed. Remove Pitch before sending, or use "Render full timeline for AE" in the Pacing tab instead, which bakes everything (including Pitch) into one file first.':
    "На клипе «{p0}» применён питч — «Отправить в After Effects» никогда не рендерит: функция заново собирает монтаж в After Effects из исходного файла, только с точками разреза, позициями и скоростью. Уберите питч перед отправкой или используйте «Рендер всего таймлайна для AE» во вкладке «Темп»: он сначала запекает всё, включая питч, в один файл.",
  'Clip "{p0}" has an effect applied ("{p1}") that can\'t be carried over to After Effects — Send to AE rebuilds the cut there from the original file, with only cut points, positions and speed. Remove it before sending, or use "Render full timeline for AE" in the Pacing tab instead, which bakes everything into one file first.':
    "У клипа «{p0}» есть эффект («{p1}»), который нельзя перенести в After Effects — «Отправить в After Effects» заново собирает там монтаж из исходного файла, только с точками разреза, позициями и скоростью. Уберите эффект перед отправкой или используйте «Рендер всего таймлайна для AE» во вкладке «Темп»: он сначала запекает всё в один файл.",
  "Could not open {p0} for writing.": "Не удалось открыть {p0} для записи.",
  "Rendered file not found on disk: {p0}": "Отрендеренный файл не найден на диске: {p0}",
  "Premiere rejected placing the rendered file at {p0}s.": "Premiere отказался разместить отрендеренный файл на {p0} с.",
  "Removing the rendered clip failed ({p0}).": "Не удалось удалить отрендеренный клип ({p0}).",
  "Restored a piece's position, but restoring its original Speed failed ({p0}).":
    "Позиция куска восстановлена, но восстановить его исходную скорость не удалось ({p0}).",
  "Piece {p0}: its original audio track no longer exists — skipped.": "Кусок {p0}: его исходной аудиодорожки больше нет — пропущен.",
  "Piece {p0}: could not find its original source media in the Project panel — skipped.":
    "Кусок {p0}: не удалось найти его исходный медиафайл в панели «Проект» — пропущен.",
  "Piece {p0}: Premiere rejected placing it at {p1}s — skipped.": "Кусок {p0}: Premiere отказался разместить его на {p1} с — пропущен.",
  "Piece {p0}: placed, but could not locate it afterward — its exact bounds/Speed were left unset.":
    "Кусок {p0}: размещён, но найти его после этого не удалось — его точные границы и скорость не заданы.",
  "Piece {p0}: placed, but setting its exact source range failed ({p1}).":
    "Кусок {p0}: размещён, но задать его точный диапазон в исходнике не удалось ({p1}).",
  "Piece {p0}: restored, but setting its source range again after restoring its speed failed ({p1}).":
    "Кусок {p0}: восстановлен, но повторно задать его диапазон в исходнике после восстановления скорости не удалось ({p1}).",
  "Piece {p0}: restored, but setting its exact end bound failed ({p1}).":
    "Кусок {p0}: восстановлен, но задать его точную конечную границу не удалось ({p1}).",
  "Piece {p0}: restoring it failed ({p1}).": "Кусок {p0}: восстановить его не удалось ({p1}).",
  "Source media not found on disk: {p0}": "Исходный медиафайл не найден на диске: {p0}",
  "segment {p0}: {p1}": "Сегмент {p0}: {p1}",
  'file {p0} ("{p1}"): not found on disk.': "Файл {p0} («{p1}»): не найден на диске.",
  'file {p0} ("{p1}"): {p2}': "Файл {p0} («{p1}»): {p2}",
  "Could not make the composition longer ({p0}s needed). Pieces near its end may be cut off: {p1}":
    "Не удалось удлинить композицию (нужно {p0} с). Куски у её конца могут обрезаться: {p1}",
  'The data sent from Premiere can\'t be read (unknown mode "{p0}"). Send it again from Premiere.':
    "Данные, отправленные из Premiere, не читаются (неизвестный режим «{p0}»). Отправьте их из Premiere ещё раз.",
  "Layer index {p0} is no longer an audio/video layer — skipped.": "Слой с индексом {p0} больше не аудио- или видеослой — пропущен.",
  "Layer index {p0}: {p1}": "Слой с индексом {p0}: {p1}",
  "{p0} of {p1} cut points didn't actually split the clip (at {p2}s) — that silence may not have been fully removed.":
    "Точек разреза, которые на самом деле не разделили клип: {p0} из {p1} (на {p2} с) — эта тишина могла быть удалена не полностью.",
  "Cannot cut this clip: Premiere didn't split it — {p0} If its track is locked, unlock it and try again; otherwise run Diagnostics from the gear menu and add the report to a bug report.":
    "Не удалось вырезать клип: Premiere не разрезал его — {p0} Если дорожка заблокирована, разблокируйте её и попробуйте снова; иначе запустите диагностику из меню шестерёнки и приложите отчёт к сообщению об ошибке.",
  "{p0} split(s) may already be on the track. Check the clip before trying again.":
    "разрезы, возможно, уже есть на дорожке ({p0}). Проверьте клип, прежде чем пробовать снова.",
  "left untouched.": "оставлен без изменений.",
  'Audio track {p0} already has a clip here ("{p1}", {p2}s–{p3}s) — inserting the generated voice-over at the playhead ({p4}s) would overwrite it. Move the playhead to an empty stretch of that track, or make another audio track the first targeted one (turn on its track-targeting button in the track header, and turn it off on the audio tracks above it), and try again.':
    "На аудиодорожке {p0} здесь уже есть клип («{p1}», {p2}–{p3} с) — вставка сгенерированной озвучки в позиции курсора ({p4} с) перезаписала бы его. Переместите курсор на свободный участок этой дорожки или сделайте другую аудиодорожку первой целевой (включите на её заголовке кнопку выбора целевой дорожки и выключите эту кнопку на аудиодорожках выше) и попробуйте снова.",
  "the alternating audio track ({p0})": "чередующейся аудиодорожке ({p0})",
  "the same audio track": "той же аудиодорожке",
  "the alternating video track": "чередующейся видеодорожке",
  "the linked video track": "связанной видеодорожке",
  "The plugin's scripting part didn't load. Quit and reopen the host application (Premiere Pro or After Effects).":
    "Скриптовая часть плагина не загрузилась. Закройте и снова откройте программу (Premiere Pro или After Effects).",
  "audio": "аудио",
  "video": "видео",
  // Eleven v4, v3's 5,000-character limit, v2 break-tag tip.
  'Model: v2 (Multilingual v2) is the default. v3 and v4 are ElevenLabs\' expressive models; for them, "Improve for voice" can add audio tags such as [excited] or [whispers] and mark the pronunciation of hard words with inline IPA. v4 is the newest. ElevenLabs calls it an upgrade over v3 in almost every case, and it follows tags more reliably. It uses only Stability and Similarity, without Speed, Style or Speaker Boost; v3 uses Stability alone. v3\'s audio tags work mainly at the lower, "Creative" end of Realism. Per request, v2 and v4 take up to 10,000 characters and v3 up to 5,000.':
    "Модель: по умолчанию стоит v2 (Multilingual v2). v3 и v4 у ElevenLabs экспрессивные: для них «Улучшить для озвучки» может добавлять аудиотеги вроде [excited] или [whispers] и записывать произношение сложных слов через инлайн-IPA. v4 самая новая. По словам ElevenLabs, она лучше v3 почти во всех случаях и точнее следует тегам. Она использует только «Стабильность» и «Похожесть», без «Скорости», «Стиля» и «Усиления голоса»; v3 использует только «Стабильность». Аудиотеги v3 срабатывают в основном ближе к нижнему краю «Реализма» («Creative»). За один запрос v2 и v4 принимают до 10 000 символов, v3 до 5000.",
  '"Improve for voice" sends your text to OpenAI or Anthropic, whichever you pick, with your own API key (stored locally like the ElevenLabs key), to tighten the phrasing and punctuation for speaking. On v2 it changes only wording and punctuation, because v2 would read bracketed tags aloud as text. On v3 and v4, which understand tags, it can also add audio tags; the Pacing only / Natural / Expressive switch under the button sets how far it goes.':
    "«Улучшить для озвучки» отправляет ваш текст в OpenAI или Anthropic, смотря что вы выбрали, с вашим собственным API-ключом (он хранится локально так же, как ключ ElevenLabs), чтобы подтянуть формулировки и пунктуацию для чтения вслух. В v2 меняются только формулировки и пунктуация, потому что v2 прочитала бы теги в квадратных скобках вслух как обычный текст. В v3 и v4, которые понимают теги, функция может добавлять и аудиотеги; насколько смело, задаёт переключатель «Только темп / Естественно / Экспрессивно» под кнопкой.",
  'Pacing only / Natural / Expressive: "Pacing only" adjusts punctuation (and, on v3 and v4, adds plain [pause] tags) and adds no emotion tags. "Natural", the default, sits in between. "Expressive" (v3 and v4 only) uses emotion and reaction tags more freely, for a more dramatic read.':
    "«Только темп / Естественно / Экспрессивно»: «Только темп» правит пунктуацию (а в v3 и v4 ещё ставит простые теги [pause]) и не добавляет тегов эмоций. «Естественно» стоит по умолчанию и находится посередине. «Экспрессивно» (только v3 и v4) свободнее использует теги эмоций и реакций для более драматичной подачи.",
  "Style: leave it near 0 unless you want a stronger character or more emotion. It exists only on v2 and for Voice Changer: v3 uses Stability alone, v4 Stability and Similarity.":
    "Стиль: держите около 0, если только вам не нужна более яркая характерность или эмоция. Он есть только на v2 и для «Смены голоса»: v3 использует только «Стабильность», v4 использует «Стабильность» и «Похожесть».",
  "v4 (newest)": "v4 (новейшая)",
  "v4 has no Speed, Style or Speaker Boost setting — set the pace with punctuation and tags in the text instead.":
    "У v4 нет настроек «Скорость», «Стиль» и «Усиление голоса» — темп задавайте пунктуацией и тегами в тексте.",
  "v3 takes Stability only: it has no Similarity, Style, Speed or Speaker Boost setting. Set the pace and delivery with punctuation and audio tags in the text instead.":
    "У v3 есть только «Стабильность»: «Похожесть», «Стиль», «Скорость» и «Усиление голоса» к ней не применяются. Темп и подачу задавайте пунктуацией и аудиотегами в тексте.",
  "Forces v3/v4 to read the text in a specific language instead of auto-detecting it — only useful for short/ambiguous text the model might otherwise misread. Ignored on v2 (it always auto-detects).":
    "Заставляет v3/v4 читать текст на определённом языке вместо автоопределения — полезно только для короткого или неоднозначного текста, который модель иначе может прочитать неверно. На v2 игнорируется (там язык всегда определяется автоматически).",
  "{count} characters — v3 caps requests at 5,000. Split this into multiple generations or switch to v2 or v4 above.":
    "Символов: {count} — v3 ограничивает запрос 5000 символами. Разбейте текст на несколько генераций или переключитесь выше на v2 или v4.",
  "model, which also takes an explicit pause tag,": "— она также понимает явный тег паузы",
  "(up to 3 seconds) — the only model here that does. Bracketed emotion tags like":
    "(до 3 секунд); из моделей здесь так умеет только она. Теги эмоций в скобках вроде",
  "only work on v3 and v4 (switch above), so they won't do anything here.":
    "работают только в v3 и v4 (переключитесь выше) — здесь они не дадут никакого эффекта.",
  "— v4 follows them more reliably than v3, also takes short directions in plain words, e.g.":
    "— v4 следует им надёжнее, чем v3, и понимает короткие указания обычными словами, например",
  ", and performs several tags in a row in the order written.":
    ", а несколько тегов подряд исполняет в том порядке, в котором они написаны.",
  "comes from punctuation (ellipses for a pause and weight, CAPS for emphasis) and the plain":
    "задаётся пунктуацией (многоточие — для паузы и веса, ЗАГЛАВНЫЕ — для акцента) и простыми тегами",
  "tags — v4 has no": "— в v4 нет тега",
  "tag and no Speed setting.": "и нет настройки скорости.",
  '— "Improve for voice" applies this automatically when v4 is selected.':
    "— «Улучшить для озвучки» делает это автоматически, когда выбрана v4.",
  "— {count} chars, over v3's 5,000 cap": "— {count} симв., сверх лимита v3 в 5000",
  "One or more queued lines exceed v3's 5,000-character cap (marked above). Split them into shorter lines or switch to v2 or v4 — Generate All stays off until then.":
    "Одна или несколько строк в очереди превышают лимит v3 в 5000 символов (отмечено выше). Разбейте их на более короткие строки или переключитесь на v2 или v4 — до тех пор «Сгенерировать всё» недоступно.",
  // Batch request stitching.
  "On ElevenLabs v2 and v4, each line is sent together with the end of the line before it and the start of the line after it, so the voice carries its intonation across clips instead of starting fresh every time (ElevenLabs' \"request stitching\"; not available on v3). Only the line itself is spoken. ElevenLabs doesn't say whether that neighbouring text counts toward your credits; the Diagnostics report (gear icon > Run Diagnostics) lists the cost ElevenLabs reports for each line.":
    "В ElevenLabs v2 и v4 каждая строка отправляется вместе с концом предыдущей и началом следующей, поэтому голос держит интонацию от клипа к клипу и не начинает каждый раз заново (функция ElevenLabs «request stitching»; в v3 её нет). Озвучивается только сама строка. ElevenLabs не сообщает, засчитывается ли соседний текст в кредиты; отчёт диагностики (значок шестерёнки > «Запустить диагностику») показывает стоимость, которую ElevenLabs указывает для каждой строки.",
  // Natural pitch
  "Natural pitch is applied to the cut pieces. Revert it first (Pacing → Pitch correction → Natural), then undo the Cut.":
    "К вырезанным кускам применён естественный питч. Сначала верните исходные куски кнопкой «Вернуть» (Темп → Коррекция питча → Естественно), затем отмените вырезку.",
  "Natural pitch is applied to these pieces. Revert it first (Pitch correction → Natural), change Speed, then apply Natural pitch again.":
    "К этим кускам применён естественный питч. Сначала верните исходные куски кнопкой «Вернуть» (Коррекция питча → Естественно), измените скорость, затем примените естественный питч снова.",
  "Natural pitch is already applied to these pieces. Revert it first to apply it again.":
    "Естественный питч уже применён к этим кускам. Чтобы применить его снова, сначала нажмите «Вернуть».",
  "Reading the selected pieces…": "Чтение выбранных кусков…",
  "Rendering natural pitch ({n} of {total})…": "Рендер естественного питча ({n} из {total})…",
  "Replacing the pieces…": "Замена кусков…",
  "Some of the original pieces had Pitch Shifter and some didn't — add it again where you need it (Calculator gives the values).":
    "У части исходных кусков был Pitch Shifter, у части нет — добавьте его заново там, где он нужен (значения даёт «Калькулятор»).",
  "J/L Pacing was run after Natural pitch. The replaced pieces are back where they were before Natural pitch; pieces at 100% speed keep their later J/L position. Run Reset and Make J/L Cut again to line everything up.":
    "После естественного питча запускался J/L Pacing. Заменённые куски вернулись туда, где были до естественного питча; куски на скорости 100% остались в позиции после J/L. Нажмите «Сбросить», затем снова «Сделать J/L Cut», чтобы всё выровнять.",
  "Re-renders each sped-up piece with ffmpeg so it keeps the original pitch, and puts it back in the same place at 100% speed. Uses each piece's current speed — set it with Speed % above first. J/L Pacing and Send to After Effects keep working on the result; send pieces from one file at a time (the rendered pieces of one speed, or the untouched ones).":
    "Заново рендерит каждый ускоренный кусок через ffmpeg с сохранением исходного питча и ставит его на то же место со скоростью 100%. Берётся текущая скорость каждого куска — сначала задайте её полем «Скорость, %» выше. J/L Pacing и отправка в After Effects работают с результатом как обычно; отправляйте куски из одного файла за раз (отрендеренные куски одной скорости или нетронутые).",
  "Apply Natural pitch": "Применить естественный питч",
  "Revert": "Вернуть",
  "Natural pitch applied to {count} piece(s).": "Естественный питч применён к кускам: {count}.",
  "No selected piece has a speed change — nothing to do.": "Ни у одного выбранного куска скорость не менялась — делать нечего.",
  'To change the speed again, Revert first. The rendered files are in the "Renders" folder under "AI Voice Master Tool".':
    "Чтобы снова изменить скорость, сначала нажмите «Вернуть». Отрендеренные файлы лежат в папке «Renders» внутри «AI Voice Master Tool».",
  "Nothing to replace — no selected piece has a speed change.": "Заменять нечего — ни у одного выбранного куска скорость не менялась.",
  "Natural pitch: the rendered files don't match the selected pieces. Nothing was replaced. Run Natural pitch again.":
    "Естественный питч: отрендеренные файлы не совпадают с выбранными кусками. Ничего не заменено. Запустите естественный питч ещё раз.",
  "The timeline changed while rendering — a selected piece moved or is gone. Nothing was replaced. Select the pieces and run Natural pitch again.":
    "Таймлайн изменился во время рендера — выбранный кусок сдвинут или удалён. Ничего не заменено. Выберите куски и запустите естественный питч снова.",
  "Premiere rejected importing the rendered natural-pitch files. Nothing was replaced.":
    "Premiere отказался импортировать отрендеренные файлы. Ничего не заменено.",
  "Import appeared to succeed, but a rendered file could not be found in the project. Nothing was replaced.":
    "Импорт вроде бы прошёл, но отрендеренный файл не найден в проекте. Ничего не заменено.",
  "No original pieces were recorded for Natural pitch — nothing to restore.":
    "Исходные куски для естественного питча не сохранены — восстанавливать нечего.",
  "Could not find the natural-pitch clips on the timeline — they may already have been deleted. Restoring the original pieces anyway.":
    "Клипы с естественным питчем не найдены на таймлайне — возможно, они уже удалены. Исходные куски всё равно восстанавливаются.",
  'Piece {p0}: its effect "{p1}" is not in the rendered audio — add it again if you need it.':
    "Кусок {p0}: эффекта «{p1}» нет в отрендеренном звуке — добавьте его снова, если он нужен.",
  "Piece {p0}: its source range falls outside the rendered file — left unchanged.":
    "Кусок {p0}: его диапазон исходника выходит за пределы отрендеренного файла — оставлен без изменений.",
  "Piece {p0}: could not link the new audio to its video. J/L Pacing would move this audio without its video.":
    "Кусок {p0}: не удалось связать новый звук с его видео. J/L Pacing сдвинет этот звук без видео.",
  "Removing a natural-pitch clip failed ({p0}).": "Не удалось удалить клип с естественным питчем ({p0}).",
  "Restored piece at {p0}s: could not link it to its video again.":
    "Восстановленный кусок на {p0} с: не удалось снова связать его с видео.",
  'Natural mode re-renders each sped-up piece with the bundled ffmpeg (its "atempo" time-stretch, which keeps the original pitch) and puts the result back in the same place at 100% speed, instead of adding Pitch Shifter. It usually sounds more natural than speed plus a pitch effect. It uses each piece\'s current speed, so set the speed with Speed % and Apply Speed first. The original pieces are replaced; Revert puts them back in one click. J/L Pacing and Send to After Effects keep working on the result, and J/L fades already on the pieces are kept while the plugin remembers that J/L run. Send to After Effects needs the selected pieces to come from one file: select the rendered pieces of one speed, or the untouched ones, and send each group separately. To change the speed again, Revert first. Effects other than Pitch on a replaced piece are not in the rendered audio. The rendered WAV files go to the "Renders" folder under "AI Voice Master Tool" (in Documents, or next to your project if Save Renders is set to "Next to project"). Next to each rendered WAV is a small ".source.json" file that holds the path of the recording it came from; J/L Pacing reads it to tell the pieces of one Cut from other clips.':
    "Режим «Естественно» заново рендерит каждый ускоренный кусок встроенным ffmpeg (растяжение «atempo», которое сохраняет исходный питч) и ставит результат на то же место со скоростью 100%, вместо того чтобы добавлять Pitch Shifter. Обычно это звучит естественнее, чем скорость плюс эффект питча. Берётся текущая скорость каждого куска, поэтому сначала задайте её в «Скорость, %» и нажмите «Применить скорость». Исходные куски заменяются; «Вернуть» возвращает их одним нажатием. J/L Pacing и отправка в After Effects работают с результатом как обычно, а уже стоящие на кусках J/L-фейды сохраняются, пока плагин помнит тот запуск J/L. Для отправки в After Effects выбранные куски должны быть из одного файла: выберите отрендеренные куски одной скорости или нетронутые и отправьте каждую группу отдельно. Чтобы снова изменить скорость, сначала нажмите «Вернуть». Эффекты, кроме питча, на заменённом куске в отрендеренный звук не попадают. Отрендеренные WAV-файлы сохраняются в папку «Renders» внутри «AI Voice Master Tool» (в «Документах» или рядом с проектом, если в «Сохранение рендеров» выбрано «Рядом с проектом»). Рядом с каждым отрендеренным WAV лежит небольшой файл «.source.json» с путём к исходной записи; J/L Pacing читает его, чтобы отличать куски одной вырезки от других клипов.",
  "Long texts are split into sentences, generated in parts and joined into one file, with a short pause at each join.":
    "Длинный текст делится на предложения, озвучивается частями и склеивается в один файл с короткой паузой на каждом стыке.",
  "The text was too long for one Kokoro pass, so it was generated in {count} parts and joined into one file. Listen to the joins.":
    "Текст оказался слишком длинным для одного прохода Kokoro, поэтому он озвучен в {count} частях и склеен в один файл. Прослушайте стыки.",
  "This clip has more linked audio channels on audio track(s) {tracks}. Cut works on one channel, so the others would go out of sync: Alt/Option-click the channel you don't need and delete it (the clip stays linked to its video), then Scan again. Scan hears the file's full mix, so if that channel carries other sound, export the voice channel as its own mono file first.":
    "У этого клипа есть ещё связанные аудиоканалы на аудиодорожке(ах) {tracks}. Вырезка работает с одним каналом, остальные ушли бы из синхрона: Alt/Option-кликните ненужный канал и удалите его (клип остаётся связан со своим видео), затем отсканируйте снова. Скан слышит всю смесь файла, поэтому если в том канале другой звук, сначала экспортируйте голосовой канал отдельным монофайлом.",
  "Some pieces were trimmed or changed since the Cut — applying Speed to the current selection instead of rebuilding, so your manual edits are kept.":
    "Часть кусков подрезана или изменена после вырезки — скорость применяется к текущему выбору без пересборки, чтобы ваши ручные правки сохранились.",
  "Every line is already on the timeline. Add new lines, or use Undo to place them again.":
    "Все строки уже на таймлайне. Добавьте новые строки или нажмите «Отменить», чтобы поставить их заново.",
  "The selected clip isn't the one that was scanned: it's another part of \"{name}\", or it was trimmed since Scan. Select the scanned clip again, or Scan this one, before cutting.":
    "Выбран не тот клип, который сканировали: это другая часть «{name}» или клип подрезали после скана. Выберите отсканированный клип снова или отсканируйте этот перед вырезкой.",
  "Effects on these pieces will be removed": "Эффекты на этих кусках пропадут",
  "{action} places fresh clips from the source file, so effects, volume and Motion changes and keyframes on the current pieces are not kept.":
    "«{action}» ставит клипы заново из исходного файла, поэтому эффекты, изменения громкости и Motion и ключевые кадры на нынешних кусках не сохранятся.",
  "Found: {effects}": "Найдено: {effects}",
  "Tip: add effects after Cut, J/L Pacing and Speed, as the last step.":
    "Совет: добавляйте эффекты после вырезки, J/L Pacing и скорости, последним шагом.",
  "Continue": "Продолжить",
  "Can't apply J/L Pacing: audio track {p0} is locked. Unlock it and try again.":
    "Нельзя применить J/L Pacing: аудиодорожка {p0} заблокирована. Разблокируйте её и попробуйте снова.",
  'Cannot undo: "{p0}" ({p1}s–{p2}s) plays the same part of the recording as another of this Cut\'s pieces, so it looks like a copy. Move it to free space, then try again. Nothing was changed.':
    "Нельзя отменить: «{p0}» ({p1} с–{p2} с) играет ту же часть записи, что и другой кусок этой вырезки, — похоже, это копия. Перенесите её на свободное место и попробуйте снова. Ничего не изменено.",
  'Cannot apply Speed: "{p0}" on audio track {p1} ({p2}s–{p3}s) plays the same part of the recording as another of this Cut\'s pieces, so it looks like a copy. Move it to free space, then try again.':
    "Нельзя применить скорость: «{p0}» на аудиодорожке {p1} ({p2} с–{p3} с) играет ту же часть записи, что и другой кусок этой вырезки, — похоже, это копия. Перенесите её на свободное место и попробуйте снова.",
  "Can't apply J/L Pacing: \"{p0}\" on audio track {p1} ({p2}s–{p3}s) comes from the same recording as the pieces but isn't selected, and J/L Pacing, which uses that track for its overlaps, would remove it. If it is one of the pieces, select it too; if it is another part of the recording (a second speaker, for example), move it to another audio track. Then try again.":
    "Нельзя применить J/L Pacing: «{p0}» на аудиодорожке {p1} ({p2} с–{p3} с) взят из той же записи, что и куски, но не выделен, а J/L Pacing кладёт на эту дорожку перекрытия и удалил бы его. Если это один из кусков, выделите его тоже; если это другая часть записи (например, второй спикер), перенесите его на другую аудиодорожку. Затем попробуйте снова.",
  "Can't apply J/L Pacing: \"{p0}\" on video track {p1} ({p2}s–{p3}s) comes from the same recording as the pieces but isn't selected, and J/L Pacing, which uses that track for its overlaps, would remove it. If it is one of the pieces, select it too; if it is another part of the recording (a second speaker, for example), move it to another video track. Then try again.":
    "Нельзя применить J/L Pacing: «{p0}» на видеодорожке {p1} ({p2} с–{p3} с) взят из той же записи, что и куски, но не выделен, а J/L Pacing кладёт на эту дорожку перекрытия и удалил бы его. Если это один из кусков, выделите его тоже; если это другая часть записи (например, второй спикер), перенесите его на другую видеодорожку. Затем попробуйте снова.",
  "Can't apply J/L Pacing: \"{p0}\" on audio track {p1} ({p2}s–{p3}s) comes from the same recording as the pieces but isn't selected, and J/L Pacing would remove it. Select it too, or move it out of that stretch, then try again.":
    "Нельзя применить J/L Pacing: «{p0}» на аудиодорожке {p1} ({p2} с–{p3} с) взят из той же записи, что и куски, но не выделен, и J/L Pacing удалил бы его. Выделите его тоже или уберите из этого отрезка и попробуйте снова.",
  "Can't apply J/L Pacing: \"{p0}\" on video track {p1} ({p2}s–{p3}s) comes from the same recording as the pieces but isn't selected, and J/L Pacing would remove it. Select it too, or move it out of that stretch, then try again.":
    "Нельзя применить J/L Pacing: «{p0}» на видеодорожке {p1} ({p2} с–{p3} с) взят из той же записи, что и куски, но не выделен, и J/L Pacing удалил бы его. Выделите его тоже или уберите из этого отрезка и попробуйте снова.",
  "Can't apply J/L Pacing: video track {p0} is locked. Unlock it and try again.":
    "Нельзя применить J/L Pacing: видеодорожка {p0} заблокирована. Разблокируйте её и попробуйте снова.",
  'Can\'t apply J/L Pacing safely: "{p0}" on {p1} runs across {p2}s, where piece {p3} goes. Move it to free space (or onto a different track) before running J/L Pacing.':
    "Безопасно применить J/L Pacing нельзя: «{p0}» на {p1} проходит через {p2} с, где должен встать кусок {p3}. Перенесите его на свободное место (или на другую дорожку) перед запуском J/L Pacing.",
  "Cannot apply Speed: audio track {p0} is locked. Unlock it, then try again.":
    "Нельзя применить скорость: аудиодорожка {p0} заблокирована. Разблокируйте её и попробуйте снова.",
  "Cannot apply Speed: video track {p0} is locked. Unlock it, then try again.":
    "Нельзя применить скорость: видеодорожка {p0} заблокирована. Разблокируйте её и попробуйте снова.",
  'Cannot apply Speed: "{p0}" on audio track {p1} sits where the re-timed pieces will go ({p2}s–{p3}s). Move it to free space, then try again.':
    "Нельзя применить скорость: «{p0}» на аудиодорожке {p1} лежит там, куда встанут куски с новой скоростью ({p2} с–{p3} с). Перенесите его на свободное место и попробуйте снова.",
  'Cannot apply Speed: "{p0}" on video track {p1} sits where the re-timed pieces will go ({p2}s–{p3}s). Move it to free space, then try again.':
    "Нельзя применить скорость: «{p0}» на видеодорожке {p1} лежит там, куда встанут куски с новой скоростью ({p2} с–{p3} с). Перенесите его на свободное место и попробуйте снова.",
  'Cannot apply Speed: this Cut was made in the sequence "{p0}". Open that sequence, then try again.':
    "Нельзя применить скорость: эта вырезка сделана в секвенции «{p0}». Откройте эту секвенцию и попробуйте снова.",
  'Cannot undo: this Cut was made in the sequence "{p0}". Open that sequence, then try again. Nothing was changed.':
    "Нельзя отменить: эта вырезка сделана в секвенции «{p0}». Откройте эту секвенцию и попробуйте снова. Ничего не изменено.",
  'Cannot revert: these pieces were rendered in the sequence "{p0}". Open that sequence, then try again. Nothing was changed.':
    "Нельзя вернуть: эти куски отрендерены в секвенции «{p0}». Откройте эту секвенцию и попробуйте снова. Ничего не изменено.",
  'Cannot revert: Natural pitch was applied in the sequence "{p0}". Open that sequence, then try again. Nothing was changed.':
    "Нельзя вернуть: естественный питч применён в секвенции «{p0}». Откройте эту секвенцию и попробуйте снова. Ничего не изменено.",
  "Cannot revert: a Natural pitch render is on the timeline more often than Natural pitch placed it (at {p0}), so Revert can't tell its own clips from your copies. Delete the copies you don't need, then try again. Nothing was changed.":
    "Нельзя вернуть: рендер «Естественно» стоит на таймлайне больше раз, чем его поставил «Естественно» (на {p0}), поэтому «Вернуть» не может отличить свои клипы от ваших копий. Удалите ненужные копии и попробуйте снова. Ничего не изменено.",
  "{p0} other clip(s) of a Natural pitch render stay on the timeline (at {p1}): they aren't the clips Natural pitch placed, so Revert leaves them where they are.":
    "Другие клипы рендера «Естественно» ({p0}) остаются на таймлайне (на {p1}): их ставил не «Естественно», поэтому «Вернуть» оставляет их на месте.",
  "Cannot revert: audio track {p0}, where an original piece goes back, no longer exists. Add audio tracks (Sequence > Add Tracks) until it is there again, then try again. Nothing was changed.":
    "Нельзя вернуть: аудиодорожки {p0}, куда возвращается исходный кусок, больше нет. Добавьте аудиодорожки (Sequence > Add Tracks), чтобы она появилась опять, и попробуйте снова. Ничего не изменено.",
  "Cannot revert: audio track {p0}, where an original piece goes back, is locked. Unlock it, then try again. Nothing was changed.":
    "Нельзя вернуть: аудиодорожка {p0}, куда возвращается исходный кусок, заблокирована. Разблокируйте её и попробуйте снова. Ничего не изменено.",
  'Cannot undo: the original clip goes back at 100% speed for a moment before its Speed is set again, so it needs {p0}s of free space after {p1}s, where "{p2}" sits. Move that clip {p3}s later, then try again. Nothing was changed.':
    "Нельзя отменить: исходный клип на мгновение возвращается со скоростью 100%, и только потом ему снова ставится скорость, поэтому ему нужно {p0} с свободного места после {p1} с, а там лежит «{p2}». Сдвиньте этот клип на {p3} с позже и попробуйте снова. Ничего не изменено.",
  'Cannot revert: sped-up piece {p0} goes back at 100% speed for a moment before its Speed is set again, so it needs {p1}s of free space after {p2}s on audio track {p3}, where "{p4}" sits. Move that clip {p5}s later, then try again. Nothing was changed.':
    "Нельзя вернуть: ускоренный кусок {p0} на мгновение возвращается со скоростью 100%, и только потом ему снова ставится скорость, поэтому ему нужно {p1} с свободного места после {p2} с на аудиодорожке {p3}, а там лежит «{p4}». Сдвиньте этот клип на {p5} с позже и попробуйте снова. Ничего не изменено.",
  "Audio track {p0}, where a selected piece is replaced, is locked. Unlock it, then run Natural pitch again. Nothing was replaced.":
    "Аудиодорожка {p0}, где заменяется выбранный кусок, заблокирована. Разблокируйте её и запустите естественный питч снова. Ничего не заменено.",
  'The timeline changed since rendering — one or more of the original pieces was moved or trimmed. Nothing was removed. Run "Render full timeline for AE" again.':
    "Таймлайн изменился после рендера — один или несколько исходных кусков сдвинуты или подрезаны. Ничего не удалено. Запустите «Рендер всего таймлайна для AE» ещё раз.",
  "Cannot undo: a track the original clip goes back onto is locked. Unlock it, then try again. Nothing was changed.":
    "Нельзя отменить: дорожка, на которую возвращается исходный клип, заблокирована. Разблокируйте её и попробуйте снова. Ничего не изменено.",
  'Cannot undo: "{p0}" now sits where the original clip goes back ({p1}s–{p2}s). Move it to free space, then try again. Nothing was changed.':
    "Нельзя отменить: «{p0}» теперь лежит там, куда возвращается исходный клип ({p1} с–{p2} с). Перенесите его на свободное место и попробуйте снова. Ничего не изменено.",
  "Cannot undo: \"{p0}\" ({p1}s–{p2}s) plays another part of the recording, so it isn't one of this Cut's pieces. Move it to free space, then try again. Nothing was changed.":
    "Нельзя отменить: «{p0}» ({p1} с–{p2} с) играет другую часть записи, поэтому это не кусок этой вырезки. Перенесите его на свободное место и попробуйте снова. Ничего не изменено.",
  "Cannot apply Speed: \"{p0}\" on audio track {p1} ({p2}s–{p3}s) plays another part of the recording, so it isn't one of this Cut's pieces. Move it to free space, then try again.":
    "Нельзя применить скорость: «{p0}» на аудиодорожке {p1} ({p2} с–{p3} с) играет другую часть записи, поэтому это не кусок этой вырезки. Перенесите его на свободное место и попробуйте снова.",
  "The selected clip isn't the one that was scanned. Select it again, or Scan this clip, before cutting. Nothing was changed.":
    "Выбран не тот клип, который сканировали. Выберите его снова или отсканируйте этот клип перед вырезкой. Ничего не изменено.",
  "This clip has more linked audio channels on audio track(s) {p0}. Cut works on one channel, so the others would go out of sync: Alt/Option-click the channel you don't need and delete it (the clip stays linked to its video), then Scan and Cut again. Nothing was changed.":
    "У этого клипа есть ещё связанные аудиоканалы на аудиодорожке(ах) {p0}. Вырезка работает с одним каналом, остальные ушли бы из синхрона: Alt/Option-кликните ненужный канал и удалите его (клип остаётся связан со своим видео), затем снова отсканируйте и вырежьте. Ничего не изменено.",
  "Natural pitch can't be used on a clip with more linked audio channels (audio track(s) {p0}): its render mixes the file's channels together, and would still after deleting a channel. Export the voice channel as its own mono file and cut that, or correct the pitch with a pitch plug-in of your own, using the values in Pitch correction → Calculator.":
    "«Естественно» нельзя применить к клипу с несколькими связанными аудиоканалами (аудиодорожка(и) {p0}): его рендер смешивает каналы файла, и после удаления канала тоже. Экспортируйте голосовой канал отдельным монофайлом и режьте его или исправьте питч своим плагином питча по значениям из «Коррекция питча → Калькулятор».",
  "Details": "Подробнее",
  "Bundled {p0} binary not found at {p1}. This computer needs the {p2} package of the plugin — if the other one was installed, install this one instead; otherwise reinstall the plugin.":
    "Встроенная программа {p0} не найдена по пути {p1}. Этому компьютеру нужна версия плагина для {p2} — если установлена другая, установите эту; иначе переустановите плагин.",
  "Render did not finish writing in time ({p0}). Premiere couldn't render it itself, so it went to Adobe Media Encoder, which doesn't appear to be installed on this machine. Install it (included with any Creative Cloud plan that has Premiere Pro), open it once, then in Media Encoder's own Preferences → General enable \"Automatically start queue\" — then try again.":
    "Рендер не успел записаться ({p0}). Premiere не смог отрендерить его сам, поэтому рендер ушёл в Adobe Media Encoder, который, похоже, не установлен на этом компьютере. Установите его (он входит в любой план Creative Cloud с Premiere Pro), откройте один раз, затем в настройках самого Media Encoder (Preferences → General) включите «Automatically start queue» и попробуйте снова.",
  "Render did not finish writing in time ({p0}). Premiere couldn't render it itself, so it went to Adobe Media Encoder: check Media Encoder's own Queue panel — the render may be waiting there for its \"auto-start queue\" preference to be enabled (a separate application, separate setting from Premiere's own preferences).":
    "Рендер не успел записаться ({p0}). Premiere не смог отрендерить его сам, поэтому рендер ушёл в Adobe Media Encoder: проверьте панель очереди (Queue) в самом Media Encoder — рендер может ждать там, пока не включена настройка «auto-start queue» (это отдельная программа и отдельная настройка, не в Premiere).",
  "The folder for generated audio could not be created ({p0}). Nothing was sent to ElevenLabs.":
    "Не удалось создать папку для сгенерированного звука ({p0}). В ElevenLabs ничего не отправлено.",
  "Generated audio could not be saved to {p0}: {p1}": "Не удалось сохранить сгенерированный звук в {p0}: {p1}",
  "Converted audio could not be saved to {p0}: {p1}": "Не удалось сохранить сконвертированный звук в {p0}: {p1}",
  "ElevenLabs stopped sending the audio partway through (nothing arrived for 60 seconds). Nothing was saved or placed. Check your connection, then try again.":
    "ElevenLabs перестал присылать звук на середине (60 секунд ничего не приходило). Ничего не сохранено и не добавлено на таймлайн. Проверьте интернет и попробуйте снова.",
  "ffmpeg exited with code {p0}: {p1}": "ffmpeg завершился с кодом {p0}: {p1}",
  "ffmpeg finished but wrote no audio to {p0}": "ffmpeg завершился, но не записал звук в {p0}",
  'ffmpeg got stuck reading "{p0}" and was stopped. The file may be damaged, or on a slow or disconnected drive: copy it to a local drive, or export the voice as a WAV file, and try again.':
    "ffmpeg завис при чтении «{p0}» и был остановлен. Возможно, файл повреждён или лежит на медленном или отключившемся диске: скопируйте его на локальный диск или экспортируйте голос в WAV и попробуйте снова.",
  'The plugin can\'t read the audio in "{p0}"{p1}. Export the voice as a WAV file (File > Export > Media, Format: Waveform Audio), import it and use that clip.':
    "Плагин не может прочитать звук в «{p0}»{p1}. Экспортируйте голос в WAV (File > Export > Media, Format: Waveform Audio), импортируйте его и используйте этот клип.",
  "Kokoro model failed to load{p0}. Check Diagnostics, and that the plugin installed correctly.":
    "Не удалось загрузить модель Kokoro{p0}. Проверьте диагностику и правильность установки плагина.",
  "OpenAI API returned no text.": "API OpenAI не вернул текст.",
  "Claude API returned no text.": "API Claude не вернул текст.",
  "Bundled export preset not found at {p0}. Reinstall the plugin.":
    "Встроенный пресет экспорта не найден по пути {p0}. Переустановите плагин.",
  "Cannot cut: audio track {p0} is locked. Unlock it, then try again. Nothing was changed.":
    "Нельзя вырезать: аудиодорожка {p0} заблокирована. Разблокируйте её и попробуйте снова. Ничего не изменено.",
  "Cannot cut: video track {p0} is locked. Unlock it, then try again. Nothing was changed.":
    "Нельзя вырезать: видеодорожка {p0} заблокирована. Разблокируйте её и попробуйте снова. Ничего не изменено.",
  "The project hasn't been saved yet, so new files go to Documents/AI Voice Master Tool instead of next to the project. Save the project once to use the project folder.":
    "Проект ещё не сохранён, поэтому новые файлы сохраняются в «Документы/AI Voice Master Tool», а не рядом с проектом. Сохраните проект один раз, чтобы использовать его папку.",
  "Premiere rejected placing the rendered file at {p0}s. {p1}": "Premiere отказался ставить отрендеренный файл на {p0} с. {p1}",
  "The original pieces were put back; nothing was replaced.": "Исходные куски возвращены на место; ничего не заменено.",
  "Nothing was removed; nothing was replaced.": "Ничего не удалено; ничего не заменено.",
  "The removed pieces could not be put back (no restore data); use Premiere's Undo (Cmd/Ctrl+Z) to bring them back.":
    "Удалённые куски не удалось вернуть (нет данных для восстановления); верните их через отмену Premiere (Cmd/Ctrl+Z).",
  "Every original piece went back, but not exactly as before ({p0}); nothing was replaced.":
    "Все исходные куски вернулись, но не точно как было ({p0}); ничего не заменено.",
  "{p0} of {p1} removed piece(s) went back ({p2}). Use Premiere's Undo (Cmd/Ctrl+Z) for the rest; nothing was replaced.":
    "Вернулись {p0} из {p1} удалённых кусков ({p2}). Остальные верните через отмену Premiere (Cmd/Ctrl+Z); ничего не заменено.",
  '{p0} of the {p1} selected piece(s) could not be recorded for "Revert to segments" (their source media was not found in the project), so nothing was replaced. Reconnect the media, select the pieces and run "Render full timeline for AE" again.':
    "{p0} из {p1} выделенных кусков не удалось записать для «Вернуть куски» (их исходный медиафайл не найден в проекте), поэтому ничего не заменено. Переподключите медиа, выделите куски и снова запустите «Рендер всего таймлайна для AE».",
  'J/L Pacing works on the pieces of one Cut, which all play one file, but the selected audio comes from {p0} files ("{p1}" and "{p2}", for example). Select only the cut pieces (and their video), then try again. Nothing was changed.':
    "J/L Pacing работает с кусками одной вырезки, а они все играют один файл, но выделенное аудио взято из {p0} файлов (например, «{p1}» и «{p2}»). Выделите только вырезанные куски (и их видео), затем повторите. Ничего не изменено.",
  "J/L Pacing works on the pieces of one Cut, which all play one file, but the selected audio comes from {count} files. Select only the cut pieces (and their video), then try again. Nothing was changed.":
    "J/L Pacing работает с кусками одной вырезки, а они все играют один файл, но выделенное аудио взято из {count} файлов. Выделите только вырезанные куски (и их видео), затем повторите. Ничего не изменено.",
  "Some selected pieces are Natural pitch renders whose source recording isn't known, selected together with other clips, so J/L Pacing can't tell whether they all belong to one Cut. Select only the Natural pitch pieces, or only clips of one file, then try again. Nothing was changed.":
    "Среди выделенных кусков есть рендеры «Естественно», исходная запись которых неизвестна, и они выделены вместе с другими клипами, поэтому J/L Pacing не может понять, принадлежат ли все они одной вырезке. Выделите только куски «Естественно» или только клипы одного файла, затем повторите. Ничего не изменено.",
  "espeak-ng exited with code {p0}: {p1}": "espeak-ng завершился с кодом {p0}: {p1}",
  "No connection to the service. Check the internet connection, then try again.":
    "Нет соединения с сервисом. Проверьте подключение к интернету и повторите.",
  "Revert now covers only this run. The pieces of the earlier Natural pitch run stay as rendered; Premiere's own undo history still has them.":
    "«Вернуть» теперь относится только к этому запуску. Куски прежнего запуска «Естественно» остаются отрендеренными; в истории отмены Premiere они есть.",
  "This voice-over was edited after it was placed (it now plays in more pieces), so the plugin's Undo can't restore it exactly. Nothing was changed — delete the pieces by hand, or use Cmd/Ctrl+Z.":
    "Эту озвучку изменили после того, как она была поставлена (теперь она звучит в нескольких кусках), поэтому «Отменить» плагина не может точно её вернуть. Ничего не изменено — удалите куски вручную или используйте Cmd/Ctrl+Z.",
  'Audio track {p0} already has a clip at the playhead ("{p1}", {p2}s–{p3}s). Move the playhead to an empty stretch of that track, or make another audio track the first targeted one (turn on its track-targeting button in the track header, and turn it off on the audio tracks above it), and try again.':
    "На аудиодорожке {p0} под курсором уже есть клип («{p1}», {p2} с–{p3} с). Переместите курсор на свободный участок этой дорожки или сделайте другую аудиодорожку первой целевой (включите на её заголовке кнопку выбора целевой дорожки и выключите эту кнопку на аудиодорожках выше) и попробуйте снова.",
  "The selected clip is only part of a generated voice-over (it was cut or trimmed). Replace swaps a whole generated clip and would drop the full new take here. Use Generate & Insert instead, or select an uncut generated clip.":
    "Выбранный клип — только часть сгенерированной озвучки (её разрезали или подрезали). «Заменить голос» меняет целый сгенерированный клип и поставит сюда весь новый дубль. Используйте «Сгенерировать и вставить» или выберите неразрезанный сгенерированный клип.",
  "{count} characters — this model takes up to 10,000 per generation. Split the text into several generations, for example with Batch.":
    "Символов: {count} — эта модель принимает до 10 000 за одну генерацию. Разбейте текст на несколько генераций, например через пакетный режим.",
  "One or more queued lines exceed this model's 10,000-character limit. Split them into shorter lines — Generate All stays off until then.":
    "Одна или несколько строк в очереди превышают лимит этой модели в 10 000 символов. Разбейте их на более короткие строки — до тех пор «Сгенерировать всё» недоступно.",
  "Starting over: the plugin's Undo and Revert for the previous clip are no longer available (Cmd/Ctrl+Z in Premiere still works).":
    "Начинаем заново: «Отменить» и «Вернуть» плагина для предыдущего клипа больше недоступны (Cmd/Ctrl+Z в Premiere по-прежнему работает).",
  "The selection contains Natural pitch renders, which already play at the new tempo. Revert Natural pitch first, or select the original pieces.":
    "В выделении есть рендеры «Естественно», которые уже звучат в новом темпе. Сначала нажмите «Вернуть» для «Естественно» или выберите исходные куски.",
  "After Natural pitch or a full-timeline render, the pieces come from more than one file. Send each group separately (select pieces of one kind), or use Render full timeline for AE.":
    "После «Естественно» или рендера всего таймлайна куски взяты из нескольких файлов. Отправьте каждую группу отдельно (выделите куски одного вида) или используйте рендер всего таймлайна для AE.",
  "Undo, Revert and the plugin's memory": "«Отменить», «Вернуть» и память плагина",
  "Scan works with mono and stereo files; a stereo file is heard as one mix. A file with more than two channels, or with its channels as separate audio tracks (common in camera files), is refused, and so is Natural pitch on it: export the voice as a mono file (File > Export > Media, Audio > Channels: Mono), import it and use that clip. A clip that shows up on the timeline as linked audio clips on two or more audio tracks is refused too: Alt/Option-click the channel you don't need and delete it (the clip stays linked to its video), then Scan again. Scan hears the file's full mix and Natural pitch renders it, so when that channel carries other sound, use the mono export instead.":
    "Скан работает с моно- и стереофайлами и слышит стереофайл как одну смесь. Файл, где больше двух каналов или каналы записаны отдельными аудиодорожками (так часто бывает у камер), плагин отклоняет, и «Естественно» на нём тоже не работает. Экспортируйте голос в моно (File > Export > Media, раздел Audio, Channels: Mono), импортируйте его и используйте этот клип. Клип, который на таймлайне показан связанными аудиоклипами на двух или более аудиодорожках, тоже отклоняется: Alt/Option-кликните ненужный канал, удалите его (клип останется связан со своим видео) и отсканируйте снова. Скан слышит всю смесь файла, а «Естественно» её рендерит, поэтому если в том канале есть другой звук, используйте экспорт в моно.",
  "Scan and Natural pitch read the audio of the common files Premiere Pro imports: WAV and BWF, AIFF, MP3, AAC and M4A (also Apple Lossless), and the AAC, PCM, AC-3, MP2/MP3 or WMA audio in MOV, MP4, MXF, AVI, MTS/M2TS, MPG/VOB, MKV and WMV files. Audio in another format, such as FLAC, Opus or ADPCM, is refused with a note: export the voice as a WAV file (File > Export > Media, Format: Waveform Audio), import it and use that clip.":
    "Скан и «Естественно» читают звук распространённых файлов, которые импортирует Premiere Pro: WAV и BWF, AIFF, MP3, AAC и M4A (в том числе Apple Lossless), а также звук AAC, PCM, AC-3, MP2/MP3 или WMA в файлах MOV, MP4, MXF, AVI, MTS/M2TS, MPG/VOB, MKV и WMV. Звук в другом формате, например FLAC, Opus или ADPCM, плагин отклоняет с пояснением: экспортируйте голос в WAV (File > Export > Media, Format: Waveform Audio), импортируйте его и используйте этот клип.",
  "Problems and bug reports": "Проблемы и сообщения об ошибках",
  "Gear icon > Run Diagnostics saves a plain-text report to Documents/AI Voice Master Tool/Diagnostics/. It contains no API keys, and your home folder is shortened to ~, but it lists clip, sequence and file names: read it before you share it.":
    "Значок шестерёнки > «Запустить диагностику» сохраняет текстовый отчёт в папку «Документы/AI Voice Master Tool/Diagnostics/». В нём нет API-ключей, а домашняя папка сокращена до ~, но там перечислены имена клипов, секвенций и файлов: прочитайте отчёт, прежде чем им делиться.",
  "To report a problem, open an issue on the project's GitHub page, github.com/ominousopera/AIVoiceMasterTool, and paste the report's text into it.":
    "Чтобы сообщить о проблеме, создайте issue на странице проекта на GitHub, github.com/ominousopera/AIVoiceMasterTool, и вставьте в него текст отчёта.",
  "The plugin's own Undo and Revert buttons (Cut's Undo, Revert to segments, Natural pitch's Revert, AI Voice's Undo) work from what the plugin remembers about the last operation. A new Scan clears Cut's Undo and Natural pitch's Revert and keeps Revert to segments. A new Cut clears Natural pitch's Revert and Revert to segments, and its own Undo replaces the previous Cut's. Neither touches AI Voice's Undo. Reopening the plugin or restarting Premiere clears all of them, and the buttons go away. Premiere's own Cmd/Ctrl+Z always works, one step at a time.":
    "Собственные кнопки плагина «Отменить» и «Вернуть» («Отменить» для вырезки, «Вернуть куски», «Вернуть» для «Естественно», «Отменить» для ИИ-голоса) работают по тому, что плагин помнит о последнем действии. Новый скан сбрасывает «Отменить» для вырезки и «Вернуть» для «Естественно», а «Вернуть куски» сохраняет. Новая вырезка сбрасывает «Вернуть» для «Естественно» и «Вернуть куски», а её собственная кнопка «Отменить» заменяет такую же кнопку предыдущей вырезки. Ни скан, ни вырезка не сбрасывают «Отменить» для ИИ-голоса. Повторное открытие плагина или перезапуск Premiere сбрасывают их все, и кнопки пропадают. Собственный Cmd/Ctrl+Z Premiere работает всегда, по одному шагу.",
  "original audio": "исходная аудиодорожка",
  "alternate audio": "чередующаяся аудиодорожка",
  "original video": "исходная видеодорожка",
  "alternate video": "чередующаяся видеодорожка",
  "The plugin can't play this file (a format its preview doesn't decode). Cutting still works; preview it in Premiere.":
    "Плагин не может воспроизвести этот файл (формат, который его предпросмотр не декодирует). Вырезка всё равно работает; прослушайте его в Premiere.",
  "No waveform measurement for these pieces: a flat, un-measured overlap was used at every boundary. Scan the clip these pieces came from, then run J/L Pacing again for measured pacing.":
    "Для этих кусков нет измерения по волне: на каждой границе взят одинаковый, неизмеренный нахлёст. Просканируйте клип, из которого сделаны эти куски, и запустите J/L Pacing снова, чтобы нахлёсты были измерены.",
  "The pieces were moved on the timeline since the Cut — applying Speed to the current selection in place instead of rebuilding, so they stay where they are.":
    "Куски были сдвинуты по таймлайну после вырезки — скорость применяется к текущему выделению на месте, без пересборки, чтобы они остались там, где стоят.",
  "Placing the generated voice-over…": "Размещение сгенерированной озвучки…",
  "Undo of the last Cut is still available; the scan was cleared when another clip was selected.":
    "Отмена последней вырезки всё ещё доступна; скан сброшен, потому что был выбран другой клип.",
  "The last take was generated and saved, but not placed. Fix the spot on the timeline, then place it without generating again.":
    "Последний дубль сгенерирован и сохранён, но не размещён. Освободите место на таймлайне и разместите его, не генерируя заново.",
  "Place it again": "Разместить снова",
  "Cut works on the audio part of a clip. Select the audio clip (click it with Linked Selection on, or Alt/Option-click the audio part), then Scan and Cut again. Nothing was changed.":
    "Вырезка работает с аудиочастью клипа. Выберите аудиоклип (щёлкните его при включённом связанном выделении или Alt/Option-щелчком по аудиочасти), затем снова выполните скан и вырезку. Ничего не изменено.",
  "Cut works on a clip whose video and audio start and end together. This clip's video part is trimmed differently from its audio (a J- or L-cut made by hand): unlink the two and cut the audio on its own, or trim both to the same bounds, then Scan and Cut again. Nothing was changed.":
    "Вырезка работает с клипом, у которого видео и аудио начинаются и заканчиваются вместе. У этого клипа видеочасть подрезана иначе, чем аудио (J- или L-склейка, сделанная вручную): разъедините их и вырежьте аудио отдельно либо подрежьте обе части до одинаковых границ, затем снова выполните скан и вырезку. Ничего не изменено.",
  "The selected video was not sent: its clips come from more than one file, or have no media file on disk. Only the audio was sent; select video from one file to send it too.":
    "Выбранное видео не отправлено: его клипы из разных файлов или без медиафайла на диске. Отправлено только аудио; чтобы отправить и видео, выберите видео из одного файла.",
  "Nothing was rendered or sent.": "Ничего не отрендерено и не отправлено.",
  "Nothing was rendered.": "Ничего не отрендерено.",
  'Cannot apply Speed: "{p0}" on video track {p1} ({p2}s–{p3}s) shows the same part of the recording as one of this Cut\'s pieces, so it looks like a copy. Move it to free space, then try again.':
    "Нельзя применить скорость: «{p0}» на видеодорожке {p1} ({p2} с–{p3} с) показывает ту же часть записи, что и один из кусков этой вырезки, то есть похож на копию. Перенесите его на свободное место и попробуйте снова.",
  "Cannot apply Speed: \"{p0}\" on video track {p1} ({p2}s–{p3}s) shows another part of the recording, so it isn't one of this Cut's pieces. Move it to free space, then try again.":
    "Нельзя применить скорость: «{p0}» на видеодорожке {p1} ({p2} с–{p3} с) показывает другую часть записи, поэтому это не кусок этой вырезки. Перенесите его на свободное место и попробуйте снова.",
  'Cannot undo: "{p0}" on the video track ({p1}s–{p2}s) shows the same part of the recording as one of this Cut\'s pieces, so it looks like a copy. Move it to free space, then try again. Nothing was changed.':
    "Нельзя отменить: «{p0}» на видеодорожке ({p1} с–{p2} с) показывает ту же часть записи, что и один из кусков этой вырезки, то есть похож на копию. Перенесите его на свободное место и попробуйте снова. Ничего не изменено.",
  "Cannot undo: \"{p0}\" on the video track ({p1}s–{p2}s) shows another part of the recording, so it isn't one of this Cut's pieces. Move it to free space, then try again. Nothing was changed.":
    "Нельзя отменить: «{p0}» на видеодорожке ({p1} с–{p2} с) показывает другую часть записи, поэтому это не кусок этой вырезки. Перенесите его на свободное место и попробуйте снова. Ничего не изменено.",
  '"{p0}" is disabled (greyed out), so its render would be silent. Enable it (right-click > Enable), or select the take that is playing, then try again. {p1}':
    "«{p0}» отключён (показан серым), поэтому его рендер был бы тишиной. Включите его (правый щелчок > Enable (Включить)) или выберите звучащий дубль и попробуйте снова. {p1}",
  "Audio track {p0} is muted, so the render would be silent. Unmute it, then try again. {p1}":
    "Аудиодорожка {p0} заглушена, поэтому рендер был бы тишиной. Включите звук дорожки и попробуйте снова. {p1}",
  "Audio track {p0} is locked, so the generated voice-over can't be placed there. Unlock it, or make another audio track the first targeted one (turn on its track-targeting button in the track header, and turn it off on the audio tracks above it), and try again.":
    "Аудиодорожка {p0} заблокирована, поэтому сгенерированную озвучку туда не поставить. Разблокируйте её или сделайте другую аудиодорожку первой целевой (включите на её заголовке кнопку выбора целевой дорожки и выключите эту кнопку на аудиодорожках выше) и попробуйте снова.",
  'Cannot apply Speed: the re-timed pieces go back at 100% speed for a moment before their Speed is set, so they need {p0}s of free space after {p1}s, where "{p2}" sits. Move that clip {p3}s later, then try again.':
    "Нельзя применить скорость: пересобранные куски на мгновение возвращаются со скоростью 100%, и только потом им ставится скорость, поэтому им нужно {p0} с свободного места после {p1} с, а там лежит «{p2}». Сдвиньте этот клип на {p3} с позже и попробуйте снова.",
  "Cannot undo: pieces of this Cut now run past the original clip's end ({p0}s), most likely after a Speed below 100%. Set Speed back to 100% in the Pacing tab, then undo. Nothing was changed.":
    "Нельзя отменить: куски этой вырезки теперь выходят за конец исходного клипа ({p0} с), скорее всего после скорости ниже 100%. Верните скорость 100% во вкладке «Темп», затем отмените. Ничего не изменено.",
  "The folder {p0} could not be created. Check that the location is writable, then try again.":
    "Не удалось создать папку {p0}. Проверьте, что в это место можно записывать, и попробуйте снова.",
  'Audio track {p0}, where an original piece sits, is locked. Unlock it, then run "Render full timeline for AE" again. Nothing was removed.':
    "Аудиодорожка {p0}, на которой стоит исходный кусок, заблокирована. Разблокируйте её и снова запустите «Рендер всего таймлайна для AE». Ничего не удалено.",
  'Audio track {p0}, where the rendered file goes, is locked. Unlock it, then run "Render full timeline for AE" again. Nothing was removed.':
    "Аудиодорожка {p0}, куда ложится отрендеренный файл, заблокирована. Разблокируйте её и снова запустите «Рендер всего таймлайна для AE». Ничего не удалено.",
  "Audio track {p0}, where a selected piece sits, is locked. Unlock it, then try again. Nothing was rendered.":
    "Аудиодорожка {p0}, на которой стоит выбранный кусок, заблокирована. Разблокируйте её и попробуйте снова. Ничего не отрендерено.",
  'Premiere could not remove "{p0}" ({p1}). {p2}': "Premiere не смог удалить «{p0}» ({p1}). {p2}",
  'Premiere did not remove "{p0}". {p1}': "Premiere не удалил «{p0}». {p1}",
  "Premiere failed while placing the rendered file ({p0}). {p1}": "Premiere дал сбой при размещении отрендеренного файла ({p0}). {p1}",
  "Premiere failed while placing the rendered file ({p0}).": "Premiere дал сбой при размещении отрендеренного файла ({p0}).",
  "Natural pitch: Premiere rejected placing the audio for piece {p0}{p1}. Everything was put back; nothing was replaced. Try again, or check that stretch of the timeline in Premiere.":
    "Естественный питч: Premiere отверг размещение звука для куска {p0}{p1}. Всё возвращено на место; ничего не заменено. Попробуйте снова или проверьте этот участок таймлайна в Premiere.",
  "Could not remove an already placed natural-pitch clip ({p0}).": "Не удалось удалить уже размещённый клип естественного питча ({p0}).",
  "Render did not finish writing in time ({p0}). Premiere reported the render as done, so check that folder: if the file is there and plays, the location is slow to report it — try again; otherwise render again.":
    "Рендер не дописался вовремя ({p0}). Premiere сообщил, что рендер завершён, поэтому проверьте эту папку: если файл там и играет, это место медленно сообщает о файлах — попробуйте снова; иначе отрендерите заново.",
  // settings.json / presets.json that can't be read (dataFileMessages.ts).
  "saved API keys and settings": "сохранённые ключи API и настройки",
  "saved Silence Cut presets": "сохранённые пресеты «Вырезки тишины»",
  "Couldn't read {file} ({what}): {code}. Another program, such as an antivirus or backup tool, may be using it. What it holds isn't shown here, and nothing was written over it. Close and reopen the plugin to try again.":
    "Не удалось прочитать {file} ({what}): {code}. Возможно, файл занят другой программой, например антивирусом или программой резервного копирования. Его содержимое здесь не показано, и поверх него ничего не записано. Закройте и снова откройте плагин, чтобы попробовать ещё раз.",
  "A change wasn't saved: couldn't read {file} ({what}): {code}. Saving now would have replaced what it holds. Another program, such as an antivirus or backup tool, may be using it. Try again in a moment.":
    "Изменение не сохранено: не удалось прочитать {file} ({what}): {code}. Сохранение сейчас заменило бы его содержимое. Возможно, файл занят другой программой, например антивирусом или программой резервного копирования. Попробуйте ещё раз чуть позже.",
  "The file {file} ({what}) is damaged and can't be read, so what it holds isn't shown here. A copy was kept as {copy}. Nothing is saved over the damaged file until you close and reopen the plugin; after that, your next change replaces it.":
    "Файл {file} ({what}) повреждён и не читается, поэтому его содержимое здесь не показано. Копия сохранена как {copy}. Пока вы не закроете и снова не откроете плагин, поверх повреждённого файла ничего не сохраняется; после этого ваше следующее изменение заменит его.",
  "The file {file} ({what}) is damaged and can't be read, so what it holds isn't shown here. A copy of it was kept earlier as {copy}. Your next change replaces the damaged file.":
    "Файл {file} ({what}) повреждён и не читается, поэтому его содержимое здесь не показано. Его копия сохранена ранее как {copy}. Ваше следующее изменение заменит повреждённый файл.",
  "The file {file} ({what}) is damaged and can't be read, so what it holds isn't shown here. A copy of it couldn't be made, so nothing is saved over it.":
    "Файл {file} ({what}) повреждён и не читается, поэтому его содержимое здесь не показано. Сделать его копию не удалось, поэтому поверх него ничего не сохраняется.",
  "A sped-up voice also sounds higher, and Pitch correction brings the pitch back. Natural re-renders the pieces at their original pitch. Calculator only shows the correction values, to type into a pitch plugin of your own.":
    "Ускоренный голос звучит выше, и коррекция питча возвращает исходную высоту. «Естественно» заново рендерит куски с исходным питчем. «Калькулятор» только показывает значения коррекции, чтобы вы ввели их в свой плагин питча.",
  "Calculator shows the semitones, cents and ratio that undo the pitch change of the Speed % value above, to type into a pitch plugin's own controls (Premiere's own Pitch Shifter or a third-party one). It changes nothing on the timeline. Use it where Natural can't be used, such as a camera clip whose audio Premiere shows as several linked channels: Natural refuses those, since its render would mix the channels together.":
    "«Калькулятор» показывает полутона, центы и ratio, которые отменяют сдвиг питча для значения «Скорость, %» выше, чтобы ввести их в элементы управления плагина питча (встроенного Pitch Shifter Premiere или стороннего). На таймлайне он ничего не меняет. Он пригодится там, где «Естественно» не подходит, например на клипе с камеры, звук которого Premiere показывает несколькими связанными каналами: «Естественно» такие клипы отклоняет, потому что его рендер смешал бы каналы.",
  "In After Effects the pieces climb as a staircase: the first piece on the lowest layer, each later one a layer above. Where pieces with picture overlap after J/L Pacing, the one Premiere shows on top stays on top, so neighbours there swap in pairs. Pieces made by Natural pitch are sent the same way, one layer each, at 100% speed.":
    "В After Effects куски выстраиваются лесенкой: первый кусок на самом нижнем слое, каждый следующий слоем выше. Там, где куски с картинкой перекрываются после J/L Pacing, сверху остаётся тот, что сверху в Premiere, поэтому соседи там меняются местами попарно. Куски после «Естественно» отправляются так же, каждый своим слоем, со скоростью 100%.",
  "Calculator": "Калькулятор",
  "Selected clips have different speeds ({speeds}%) — type one manually above, or use Natural instead (it corrects each piece at its own speed).":
    "У выбранных клипов разная скорость ({speeds}%) — введите значение вручную выше или используйте «Естественно» (он корректирует каждый кусок по его собственной скорости).",
  "Pitch Shifter couldn't be put back on every rebuilt piece:": "Pitch Shifter не удалось вернуть на все пересобранные куски:",
  // Update notice (updateCheck.ts).
  "Could not check: no internet connection.": "Не удалось проверить: нет подключения к интернету.",
  "Could not check: GitHub's limit of checks from this address is used up for now. The release page shows the newest version.":
    "Не удалось проверить: лимит проверок GitHub с этого адреса пока исчерпан. На странице релиза видна самая новая версия.",
  "Could not check: GitHub did not answer within {seconds} seconds.": "Не удалось проверить: GitHub не ответил за {seconds} секунд.",
  "Could not check: GitHub answered with code {status}.": "Не удалось проверить: GitHub ответил кодом {status}.",
  "Could not check: GitHub could not be reached.": "Не удалось проверить: не получилось связаться с GitHub.",
  "Could not check: GitHub's answer could not be read.": "Не удалось проверить: ответ GitHub не читается.",
  "Diagnostics & feedback (a new version is out)": "Диагностика и обратная связь (вышла новая версия)",
  "Updates": "Обновления",
  "Tell me when a new version is out": "Сообщать о новой версии",
  "Checking…": "Проверяю…",
  "Check now": "Проверить сейчас",
  "Version {latest} is out (you have {version}).": "Вышла версия {latest} (у вас {version}).",
  "No newer release found. Installed version: {version}.": "Более новой версии нет. Установлена версия {version}.",
  "It will try again the next time the plugin opens.": "Плагин попробует снова при следующем открытии.",
  "Open the release page": "Открыть страницу релиза",
  "Check now asks GitHub once for the newest version number. With the switch on, the plugin also asks when it opens, every three days at most. Nothing about you or your projects is sent, and nothing is downloaded: install an update yourself from the release page.":
    "«Проверить сейчас» один раз спрашивает у GitHub номер самой новой версии. Если галочка включена, плагин спрашивает и сам при открытии, не чаще раза в три дня. Ничего о вас и ваших проектах не отправляется, и ничего не скачивается: обновление вы ставите сами со страницы релиза.",
  "Tell you about new versions?": "Сообщать о новых версиях?",
  "The plugin can ask GitHub every three days whether a newer version is out, and put a dot on the gear icon when one is. Nothing about you or your projects is sent, and nothing is downloaded or installed: you install updates yourself from the release page. Silence Cut, Pacing and Kokoro work offline either way.":
    "Плагин может раз в три дня спрашивать у GitHub, не вышла ли новая версия, и ставить точку на значке шестерёнки, когда она есть. Ничего о вас и ваших проектах не отправляется, ничего не скачивается и не устанавливается: обновления вы ставите сами со страницы релиза. «Вырезка тишины», «Темп» и Kokoro в любом случае работают без интернета.",
  "Yes, tell me": "Да, сообщать",
  "No, don't check": "Нет, не проверять",
  "You can change this anytime from the gear icon, and check by hand there with Check now.":
    "Это можно изменить в любой момент через значок шестерёнки; там же можно проверить вручную кнопкой «Проверить сейчас».",
  "The plugin asks once whether to tell you about new versions. If you say yes, it asks GitHub for the newest release number when it opens, at most every three days, and puts a dot on the gear icon when a newer version is out. Gear icon > Updates has the switch, Check now (one check, also with the switch off) and, when a newer version is out, Open the release page. Nothing about you or your projects is sent, and the plugin never downloads or installs anything: download the new package from the release page and install it the same way as the first one.":
    "Плагин один раз спрашивает, сообщать ли о новых версиях. Если ответить «да», при открытии он спрашивает у GitHub номер самой новой версии, не чаще раза в три дня, и ставит точку на значке шестерёнки, когда вышла более новая версия. В меню шестерёнки, в разделе «Обновления», есть галочка, кнопка «Проверить сейчас» (одна проверка, работает и при выключенной галочке) и, когда вышла новая версия, «Открыть страницу релиза». Ничего о вас и ваших проектах не отправляется, и плагин ничего не скачивает и не устанавливает: скачайте новый пакет со страницы релиза и установите его так же, как первый.",
};
