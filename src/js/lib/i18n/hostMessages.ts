import { tr } from "./index";

/**
 * Translation for English messages that reach the panel's error and warning
 * display from code that does not use the dictionaries: thrown errors and
 * result `warnings` from the ExtendScript side (ppro.ts / aeft.ts — a separate
 * engine with no access to the i18n dictionaries, so every such message
 * arrives as plain English whatever the panel's language), and a few
 * panel-side errors built the same way (ffmpeg, ElevenLabs file saving, the
 * render wait, bundled-file paths).
 * - a message with fixed text is its own dictionary key, so `tr(raw)` finds it;
 * - a message with values in it is matched against a pattern built from its
 *   template — the literal text exactly, each `${...}` as a capture — and
 *   re-rendered through `tr(key, {p0, p1, ...})`.
 * Captured values are themselves passed through this function, so a nested
 * host message (an `errMsg(e)` inside another message) or a spliced-in phrase
 * ("the alternating audio track (2)") is translated too.
 *
 * Each pattern is the template literal of one such message: the literal text
 * regex-escaped and anchored with `^` and `$`, each `${...}` replaced by
 * `([\s\S]*?)`, and the key written with `{p0}`, `{p1}`, … in the same order
 * (add the key to ru.ts/es.ts too). If a message's text changes, its pattern
 * stops matching and the message shows in English — nothing is hidden and
 * nothing throws. Display only: nothing that inspects a raw message for logic
 * should call this.
 */
const HOST_PATTERN_SOURCES: [string, string][] = [
  [
    '^Audio track ([\\s\\S]*?) already has a clip here \\("([\\s\\S]*?)", ([\\s\\S]*?)s–([\\s\\S]*?)s\\) — inserting the generated voice-over at the playhead \\(([\\s\\S]*?)s\\) would overwrite it\\. Move the playhead to an empty stretch of that track, or make another audio track the first targeted one \\(turn on its track-targeting button in the track header, and turn it off on the audio tracks above it\\), and try again\\.$',
    'Audio track {p0} already has a clip here ("{p1}", {p2}s–{p3}s) — inserting the generated voice-over at the playhead ({p4}s) would overwrite it. Move the playhead to an empty stretch of that track, or make another audio track the first targeted one (turn on its track-targeting button in the track header, and turn it off on the audio tracks above it), and try again.',
  ],
  [
    '^Audio track ([\\s\\S]*?) already has a clip at the playhead \\("([\\s\\S]*?)", ([\\s\\S]*?)s–([\\s\\S]*?)s\\)\\. Move the playhead to an empty stretch of that track, or make another audio track the first targeted one \\(turn on its track-targeting button in the track header, and turn it off on the audio tracks above it\\), and try again\\.$',
    'Audio track {p0} already has a clip at the playhead ("{p1}", {p2}s–{p3}s). Move the playhead to an empty stretch of that track, or make another audio track the first targeted one (turn on its track-targeting button in the track header, and turn it off on the audio tracks above it), and try again.',
  ],
  [
    "^Premiere rejected placing the rendered file at ([\\s\\S]*?)s\\. ([\\s\\S]+)$",
    "Premiere rejected placing the rendered file at {p0}s. {p1}",
  ],
  [
    "^Every original piece went back, but not exactly as before \\(([\\s\\S]*?)\\); nothing was replaced\\.$",
    "Every original piece went back, but not exactly as before ({p0}); nothing was replaced.",
  ],
  [
    "^(\\d+) of (\\d+) removed piece\\(s\\) went back \\(([\\s\\S]*?)\\)\\. Use Premiere's Undo \\(Cmd/Ctrl\\+Z\\) for the rest; nothing was replaced\\.$",
    "{p0} of {p1} removed piece(s) went back ({p2}). Use Premiere's Undo (Cmd/Ctrl+Z) for the rest; nothing was replaced.",
  ],
  [
    '^(\\d+) of the (\\d+) selected piece\\(s\\) could not be recorded for "Revert to segments" \\(their source media was not found in the project\\), so nothing was replaced\\. Reconnect the media, select the pieces and run "Render full timeline for AE" again\\.$',
    '{p0} of the {p1} selected piece(s) could not be recorded for "Revert to segments" (their source media was not found in the project), so nothing was replaced. Reconnect the media, select the pieces and run "Render full timeline for AE" again.',
  ],
  [
    '^J/L Pacing works on the pieces of one Cut, which all play one file, but the selected audio comes from ([\\s\\S]*?) files \\("([\\s\\S]*?)" and "([\\s\\S]*?)", for example\\)\\. Select only the cut pieces \\(and their video\\), then try again\\. Nothing was changed\\.$',
    'J/L Pacing works on the pieces of one Cut, which all play one file, but the selected audio comes from {p0} files ("{p1}" and "{p2}", for example). Select only the cut pieces (and their video), then try again. Nothing was changed.',
  ],
  [
    '^This batch\'s earlier clips were placed in the sequence "([\\s\\S]*?)"\\. Open that sequence, then click Generate All again\\. Nothing was generated\\.$',
    'This batch\'s earlier clips were placed in the sequence "{p0}". Open that sequence, then click Generate All again. Nothing was generated.',
  ],
  [
    '^Audio track ([\\s\\S]*?) has "([\\s\\S]*?)" at or after the playhead\\. Batch places its clips one after another from the playhead and would overwrite it\\. Make an empty audio track the first targeted one \\(turn on its track-targeting button in the track header, and turn it off on the audio tracks above it\\), or move the playhead to ([\\s\\S]*?)s or later, the end of that track\'s last clip, and click Generate All again\\. Nothing was generated\\.$',
    'Audio track {p0} has "{p1}" at or after the playhead. Batch places its clips one after another from the playhead and would overwrite it. Make an empty audio track the first targeted one (turn on its track-targeting button in the track header, and turn it off on the audio tracks above it), or move the playhead to {p2}s or later, the end of that track\'s last clip, and click Generate All again. Nothing was generated.',
  ],
  [
    '^Audio track ([\\s\\S]*?) has "([\\s\\S]*?)" at or after the playhead\\. Batch places its clips one after another from the playhead and would overwrite it\\. Make an empty audio track the first targeted one \\(turn on its track-targeting button in the track header, and turn it off on the audio tracks above it\\), or move the playhead to ([\\s\\S]*?)s or later, the end of that track\'s last clip, and click Generate All again\\. The generated lines are kept\\. Nothing was placed\\.$',
    'Audio track {p0} has "{p1}" at or after the playhead. Batch places its clips one after another from the playhead and would overwrite it. Make an empty audio track the first targeted one (turn on its track-targeting button in the track header, and turn it off on the audio tracks above it), or move the playhead to {p2}s or later, the end of that track\'s last clip, and click Generate All again. The generated lines are kept. Nothing was placed.',
  ],
  ["^espeak-ng exited with code ([\\s\\S]*?): ([\\s\\S]*?)$", "espeak-ng exited with code {p0}: {p1}"],
  [
    "^Bundled ([\\s\\S]*?) binary not found at ([\\s\\S]*?)\\. This computer needs the ([\\s\\S]*?) package of the plugin — if the other one was installed, install this one instead; otherwise reinstall the plugin\\.$",
    "Bundled {p0} binary not found at {p1}. This computer needs the {p2} package of the plugin — if the other one was installed, install this one instead; otherwise reinstall the plugin.",
  ],
  [
    "^Render did not finish writing in time \\(([\\s\\S]*?)\\)\\. Premiere couldn't render it itself, so it went to Adobe Media Encoder, which doesn't appear to be installed on this machine\\. Install it \\(included with any Creative Cloud plan that has Premiere Pro\\), open it once, then in Media Encoder's own Preferences → General enable \"Automatically start queue\" — then try again\\.$",
    "Render did not finish writing in time ({p0}). Premiere couldn't render it itself, so it went to Adobe Media Encoder, which doesn't appear to be installed on this machine. Install it (included with any Creative Cloud plan that has Premiere Pro), open it once, then in Media Encoder's own Preferences → General enable \"Automatically start queue\" — then try again.",
  ],
  [
    "^Render did not finish writing in time \\(([\\s\\S]*?)\\)\\. Premiere couldn't render it itself, so it went to Adobe Media Encoder: check Media Encoder's own Queue panel — the render may be waiting there for its \"auto-start queue\" preference to be enabled \\(a separate application, separate setting from Premiere's own preferences\\)\\.$",
    "Render did not finish writing in time ({p0}). Premiere couldn't render it itself, so it went to Adobe Media Encoder: check Media Encoder's own Queue panel — the render may be waiting there for its \"auto-start queue\" preference to be enabled (a separate application, separate setting from Premiere's own preferences).",
  ],
  [
    "^The folder for generated audio could not be created \\(([\\s\\S]*?)\\)\\. Nothing was sent to ElevenLabs\\.$",
    "The folder for generated audio could not be created ({p0}). Nothing was sent to ElevenLabs.",
  ],
  ["^Generated audio could not be saved to ([\\s\\S]*?): ([\\s\\S]*?)$", "Generated audio could not be saved to {p0}: {p1}"],
  ["^Converted audio could not be saved to ([\\s\\S]*?): ([\\s\\S]*?)$", "Converted audio could not be saved to {p0}: {p1}"],
  ["^ffmpeg exited with code ([\\s\\S]*?): ([\\s\\S]*?)$", "ffmpeg exited with code {p0}: {p1}"],
  ["^ffmpeg finished but wrote no audio to ([\\s\\S]*?)$", "ffmpeg finished but wrote no audio to {p0}"],
  [
    '^ffmpeg got stuck reading "([\\s\\S]*?)" and was stopped\\. The file may be damaged, or on a slow or disconnected drive: copy it to a local drive, or export the voice as a WAV file, and try again\\.$',
    'ffmpeg got stuck reading "{p0}" and was stopped. The file may be damaged, or on a slow or disconnected drive: copy it to a local drive, or export the voice as a WAV file, and try again.',
  ],
  [
    '^The plugin can\'t read the audio in "([\\s\\S]*?)"([\\s\\S]*?)\\. Export the voice as a WAV file \\(File > Export > Media, Format: Waveform Audio\\), import it and use that clip\\.$',
    'The plugin can\'t read the audio in "{p0}"{p1}. Export the voice as a WAV file (File > Export > Media, Format: Waveform Audio), import it and use that clip.',
  ],
  [
    "^Kokoro model failed to load([\\s\\S]*?)\\. Check Diagnostics, and that the plugin installed correctly\\.$",
    "Kokoro model failed to load{p0}. Check Diagnostics, and that the plugin installed correctly.",
  ],
  [
    "^Bundled export preset not found at ([\\s\\S]*?)\\. Reinstall the plugin\\.$",
    "Bundled export preset not found at {p0}. Reinstall the plugin.",
  ],
  [
    "^Cannot cut: audio track ([\\s\\S]*?) is locked\\. Unlock it, then try again\\. Nothing was changed\\.$",
    "Cannot cut: audio track {p0} is locked. Unlock it, then try again. Nothing was changed.",
  ],
  [
    "^Cannot cut: video track ([\\s\\S]*?) is locked\\. Unlock it, then try again\\. Nothing was changed\\.$",
    "Cannot cut: video track {p0} is locked. Unlock it, then try again. Nothing was changed.",
  ],
  [
    "^Can't apply J\\/L Pacing: audio track ([\\s\\S]*?) is locked\\. Unlock it and try again\\.$",
    "Can't apply J/L Pacing: audio track {p0} is locked. Unlock it and try again.",
  ],
  [
    "^Can't apply J\\/L Pacing: video track ([\\s\\S]*?) is locked\\. Unlock it and try again\\.$",
    "Can't apply J/L Pacing: video track {p0} is locked. Unlock it and try again.",
  ],
  [
    '^Can\'t apply J\\/L Pacing safely: "([\\s\\S]*?)" on ([\\s\\S]*?) runs across ([\\s\\S]*?)s, where piece ([\\s\\S]*?) goes\\. Move it to free space \\(or onto a different track\\) before running J\\/L Pacing\\.$',
    'Can\'t apply J/L Pacing safely: "{p0}" on {p1} runs across {p2}s, where piece {p3} goes. Move it to free space (or onto a different track) before running J/L Pacing.',
  ],
  [
    "^Cannot apply Speed: audio track ([\\s\\S]*?) is locked\\. Unlock it, then try again\\.$",
    "Cannot apply Speed: audio track {p0} is locked. Unlock it, then try again.",
  ],
  [
    "^Cannot apply Speed: video track ([\\s\\S]*?) is locked\\. Unlock it, then try again\\.$",
    "Cannot apply Speed: video track {p0} is locked. Unlock it, then try again.",
  ],
  [
    '^Cannot apply Speed: "([\\s\\S]*?)" on audio track ([\\s\\S]*?) sits where the re-timed pieces will go \\(([\\s\\S]*?)s–([\\s\\S]*?)s\\)\\. Move it to free space, then try again\\.$',
    'Cannot apply Speed: "{p0}" on audio track {p1} sits where the re-timed pieces will go ({p2}s–{p3}s). Move it to free space, then try again.',
  ],
  [
    '^Cannot apply Speed: "([\\s\\S]*?)" on video track ([\\s\\S]*?) sits where the re-timed pieces will go \\(([\\s\\S]*?)s–([\\s\\S]*?)s\\)\\. Move it to free space, then try again\\.$',
    'Cannot apply Speed: "{p0}" on video track {p1} sits where the re-timed pieces will go ({p2}s–{p3}s). Move it to free space, then try again.',
  ],
  [
    '^Cannot apply Speed: this Cut was made in the sequence "([\\s\\S]*?)"\\. Open that sequence, then try again\\.$',
    'Cannot apply Speed: this Cut was made in the sequence "{p0}". Open that sequence, then try again.',
  ],
  [
    '^Cannot undo: this Cut was made in the sequence "([\\s\\S]*?)"\\. Open that sequence, then try again\\. Nothing was changed\\.$',
    'Cannot undo: this Cut was made in the sequence "{p0}". Open that sequence, then try again. Nothing was changed.',
  ],
  [
    '^Cannot undo: "([\\s\\S]*?)" now sits where the original clip goes back \\(([\\s\\S]*?)s–([\\s\\S]*?)s\\)\\. Move it to free space, then try again\\. Nothing was changed\\.$',
    'Cannot undo: "{p0}" now sits where the original clip goes back ({p1}s–{p2}s). Move it to free space, then try again. Nothing was changed.',
  ],
  [
    '^Cannot undo: the original clip goes back at 100% speed for a moment before its Speed is set again, so it needs ([\\s\\S]*?)s of free space after ([\\s\\S]*?)s, where "([\\s\\S]*?)" sits\\. Move that clip ([\\s\\S]*?)s later, then try again\\. Nothing was changed\\.$',
    'Cannot undo: the original clip goes back at 100% speed for a moment before its Speed is set again, so it needs {p0}s of free space after {p1}s, where "{p2}" sits. Move that clip {p3}s later, then try again. Nothing was changed.',
  ],
  [
    '^Cannot revert: sped-up piece ([\\s\\S]*?) goes back at 100% speed for a moment before its Speed is set again, so it needs ([\\s\\S]*?)s of free space after ([\\s\\S]*?)s on audio track ([\\s\\S]*?), where "([\\s\\S]*?)" sits\\. Move that clip ([\\s\\S]*?)s later, then try again\\. Nothing was changed\\.$',
    'Cannot revert: sped-up piece {p0} goes back at 100% speed for a moment before its Speed is set again, so it needs {p1}s of free space after {p2}s on audio track {p3}, where "{p4}" sits. Move that clip {p5}s later, then try again. Nothing was changed.',
  ],
  [
    "^Audio track ([\\s\\S]*?), where a selected piece is replaced, is locked\\. Unlock it, then run Natural pitch again\\. Nothing was replaced\\.$",
    "Audio track {p0}, where a selected piece is replaced, is locked. Unlock it, then run Natural pitch again. Nothing was replaced.",
  ],
  [
    "^This clip has more linked audio channels on audio track\\(s\\) ([\\s\\S]*?)\\. Cut works on one channel, so the others would go out of sync: Alt/Option-click the channel you don't need and delete it \\(the clip stays linked to its video\\), then Scan and Cut again\\. Nothing was changed\\.$",
    "This clip has more linked audio channels on audio track(s) {p0}. Cut works on one channel, so the others would go out of sync: Alt/Option-click the channel you don't need and delete it (the clip stays linked to its video), then Scan and Cut again. Nothing was changed.",
  ],
  [
    "^Natural pitch can't be used on a clip with more linked audio channels \\(audio track\\(s\\) ([\\s\\S]*?)\\): its render mixes the file's channels together, and would still after deleting a channel\\. Export the voice channel as its own mono file and cut that, or correct the pitch with a pitch plug-in of your own, using the values in Pitch correction → Calculator\\.$",
    "Natural pitch can't be used on a clip with more linked audio channels (audio track(s) {p0}): its render mixes the file's channels together, and would still after deleting a channel. Export the voice channel as its own mono file and cut that, or correct the pitch with a pitch plug-in of your own, using the values in Pitch correction → Calculator.",
  ],
  ["^Removing a generated clip failed \\(([\\s\\S]*?)\\)\\.$", "Removing a generated clip failed ({p0})."],
  ["^Turning the original take back on failed \\(([\\s\\S]*?)\\)\\.$", "Turning the original take back on failed ({p0})."],
  [
    '^Cannot place: this batch\'s earlier clips were placed in the sequence "([\\s\\S]*?)"\\. Open that sequence, then click Generate All again; the generated lines are kept\\. Nothing was placed\\.$',
    'Cannot place: this batch\'s earlier clips were placed in the sequence "{p0}". Open that sequence, then click Generate All again; the generated lines are kept. Nothing was placed.',
  ],
  [
    "^Natural pitch: Premiere did not remove the original audio of piece ([\\s\\S]*?) \\(([\\s\\S]*?)\\)\\. Putting the originals back failed too: ([\\s\\S]*?) of ([\\s\\S]*?) original piece\\(s\\) went back([\\s\\S]*?)\\. Check that stretch of the timeline in Premiere, or use Cmd/Ctrl\\+Z there to step back\\. Nothing else was replaced\\.$",
    "Natural pitch: Premiere did not remove the original audio of piece {p0} ({p1}). Putting the originals back failed too: {p2} of {p3} original piece(s) went back{p4}. Check that stretch of the timeline in Premiere, or use Cmd/Ctrl+Z there to step back. Nothing else was replaced.",
  ],
  [
    "^Natural pitch: Premiere rejected placing the audio for piece ([\\s\\S]*?)([\\s\\S]*?)\\. Putting the originals back failed too: ([\\s\\S]*?) of ([\\s\\S]*?) original piece\\(s\\) went back([\\s\\S]*?)\\. Check that stretch of the timeline in Premiere, or use Cmd/Ctrl\\+Z there to step back\\. Nothing else was replaced\\.$",
    "Natural pitch: Premiere rejected placing the audio for piece {p0}{p1}. Putting the originals back failed too: {p2} of {p3} original piece(s) went back{p4}. Check that stretch of the timeline in Premiere, or use Cmd/Ctrl+Z there to step back. Nothing else was replaced.",
  ],
  [
    "^Natural pitch: Premiere did not remove the original audio of piece ([\\s\\S]*?) \\(([\\s\\S]*?)\\)\\. Every original piece went back, but not exactly as before \\(([\\s\\S]*?)\\)\\. Check that stretch of the timeline in Premiere, or use Cmd/Ctrl\\+Z there to step back\\. Nothing else was replaced\\.$",
    "Natural pitch: Premiere did not remove the original audio of piece {p0} ({p1}). Every original piece went back, but not exactly as before ({p2}). Check that stretch of the timeline in Premiere, or use Cmd/Ctrl+Z there to step back. Nothing else was replaced.",
  ],
  [
    "^Natural pitch: Premiere rejected placing the audio for piece ([\\s\\S]*?)([\\s\\S]*?)\\. Every original piece went back, but not exactly as before \\(([\\s\\S]*?)\\)\\. Check that stretch of the timeline in Premiere, or use Cmd/Ctrl\\+Z there to step back\\. Nothing else was replaced\\.$",
    "Natural pitch: Premiere rejected placing the audio for piece {p0}{p1}. Every original piece went back, but not exactly as before ({p2}). Check that stretch of the timeline in Premiere, or use Cmd/Ctrl+Z there to step back. Nothing else was replaced.",
  ],
  [
    "^Could not unlock video track ([\\s\\S]*?) after placing audio \\(([\\s\\S]*?)\\)\\. Unlock it by hand\\.$",
    "Could not unlock video track {p0} after placing audio ({p1}). Unlock it by hand.",
  ],
  [
    "^([\\s\\S]*?) piece\\(s\\) could not be linked to their video again\\. Select each one with its video and use Clip > Link\\.$",
    "{p0} piece(s) could not be linked to their video again. Select each one with its video and use Clip > Link.",
  ],
  [
    "^Could not unlock audio track ([\\s\\S]*?) after placing audio \\(([\\s\\S]*?)\\)\\. Unlock it by hand\\.$",
    "Could not unlock audio track {p0} after placing audio ({p1}). Unlock it by hand.",
  ],
  [
    "^Placing the audio also added a copy of another of its channels on audio track ([\\s\\S]*?) at ([\\s\\S]*?)s, and it could not be removed \\(([\\s\\S]*?)\\)\\. Delete that clip by hand\\.$",
    "Placing the audio also added a copy of another of its channels on audio track {p0} at {p1}s, and it could not be removed ({p2}). Delete that clip by hand.",
  ],
  [
    "^Could not unlock video track ([\\s\\S]*?) after placing video \\(([\\s\\S]*?)\\)\\. Unlock it by hand\\.$",
    "Could not unlock video track {p0} after placing video ({p1}). Unlock it by hand.",
  ],
  [
    "^Placing the video also added a copy of another of its channels on video track ([\\s\\S]*?) at ([\\s\\S]*?)s, and it could not be removed \\(([\\s\\S]*?)\\)\\. Delete that clip by hand\\.$",
    "Placing the video also added a copy of another of its channels on video track {p0} at {p1}s, and it could not be removed ({p2}). Delete that clip by hand.",
  ],
  [
    "^Could not unlock audio track ([\\s\\S]*?) after placing video \\(([\\s\\S]*?)\\)\\. Unlock it by hand\\.$",
    "Could not unlock audio track {p0} after placing video ({p1}). Unlock it by hand.",
  ],
  [
    "^Placing the video also added a copy of its audio at ([\\s\\S]*?)s, and it could not be removed \\(([\\s\\S]*?)\\)\\. Delete that audio clip by hand\\.$",
    "Placing the video also added a copy of its audio at {p0}s, and it could not be removed ({p1}). Delete that audio clip by hand.",
  ],
  [
    "^Placing the audio also added a copy of its video at ([\\s\\S]*?)s, and it could not be removed \\(([\\s\\S]*?)\\)\\. Delete that video clip by hand\\.$",
    "Placing the audio also added a copy of its video at {p0}s, and it could not be removed ({p1}). Delete that video clip by hand.",
  ],
  [
    '^Could not unlock track "([\\s\\S]*?)" after cutting \\(([\\s\\S]*?)\\)\\. Unlock it by hand\\.$',
    'Could not unlock track "{p0}" after cutting ({p1}). Unlock it by hand.',
  ],
  [
    "^([\\s\\S]*?) restored piece\\(s\\) could not be linked to their video again\\.$",
    "{p0} restored piece(s) could not be linked to their video again.",
  ],
  [
    "^Premiere Pro applied less than ([\\s\\S]*?)% to ([\\s\\S]*?) piece\\(s\\) \\(lowest ([\\s\\S]*?)%\\)\\. They still play all of their audio, at that lower speed\\.$",
    "Premiere Pro applied less than {p0}% to {p1} piece(s) (lowest {p2}%). They still play all of their audio, at that lower speed.",
  ],
  [
    "^Premiere Pro put back less than the earlier Speed on ([\\s\\S]*?) piece\\(s\\) \\(lowest ([\\s\\S]*?)% of it\\)\\. They still play all of their audio, at that lower speed\\.$",
    "Premiere Pro put back less than the earlier Speed on {p0} piece(s) (lowest {p1}% of it). They still play all of their audio, at that lower speed.",
  ],
  [
    "^Premiere Pro restored the clip at ([\\s\\S]*?)% instead of ([\\s\\S]*?)%\\. It still plays all of its audio, at that lower speed\\.$",
    "Premiere Pro restored the clip at {p0}% instead of {p1}%. It still plays all of its audio, at that lower speed.",
  ],
  [
    '^Cannot undo: this voice-over was placed in the sequence "([\\s\\S]*?)"\\. Open that sequence, then try again\\. Nothing was changed\\.$',
    'Cannot undo: this voice-over was placed in the sequence "{p0}". Open that sequence, then try again. Nothing was changed.',
  ],
  [
    "^Cannot undo: audio track ([\\s\\S]*?) is locked\\. Unlock it, then try again\\. Nothing was changed\\.$",
    "Cannot undo: audio track {p0} is locked. Unlock it, then try again. Nothing was changed.",
  ],
  [
    "^Natural pitch: Premiere did not remove the original audio of piece ([\\s\\S]*?) \\(([\\s\\S]*?)\\)\\. Everything was put back; nothing was replaced\\. Try again, or check that stretch of the timeline in Premiere\\.$",
    "Natural pitch: Premiere did not remove the original audio of piece {p0} ({p1}). Everything was put back; nothing was replaced. Try again, or check that stretch of the timeline in Premiere.",
  ],
  [
    "^([\\s\\S]*?) original piece\\(s\\) would land on other clips that were moved there after the replace step \\(for example by J\\/L Pacing\\) — nothing was changed\\. Click Reset in J\\/L Pacing, or move those clips, then try again\\.$",
    "{p0} original piece(s) would land on other clips that were moved there after the replace step (for example by J/L Pacing) — nothing was changed. Click Reset in J/L Pacing, or move those clips, then try again.",
  ],
  [
    '^Audio track ([\\s\\S]*?) already has a clip where the new take would go \\("([\\s\\S]*?)", ([\\s\\S]*?)s–([\\s\\S]*?)s\\) — nothing was replaced, to avoid overwriting it\\. Free that stretch of the track, then try again\\.$',
    'Audio track {p0} already has a clip where the new take would go ("{p1}", {p2}s–{p3}s) — nothing was replaced, to avoid overwriting it. Free that stretch of the track, then try again.',
  ],
  // Natural pitch (the next five patterns; the rest are in no particular order)
  [
    '^Piece ([\\s\\S]*?): its effect "([\\s\\S]*?)" is not in the rendered audio \u2014 add it again if you need it\\.$',
    'Piece {p0}: its effect "{p1}" is not in the rendered audio \u2014 add it again if you need it.',
  ],
  [
    "^Piece ([\\s\\S]*?): its source range falls outside the rendered file \u2014 left unchanged\\.$",
    "Piece {p0}: its source range falls outside the rendered file \u2014 left unchanged.",
  ],
  [
    "^Piece ([\\s\\S]*?): could not link the new audio to its video\\. J\\/L Pacing would move this audio without its video\\.$",
    "Piece {p0}: could not link the new audio to its video. J/L Pacing would move this audio without its video.",
  ],
  ["^Removing a natural-pitch clip failed \\(([\\s\\S]*?)\\)\\.$", "Removing a natural-pitch clip failed ({p0})."],
  [
    "^Restored piece at ([\\s\\S]*?)s: could not link it to its video again\\.$",
    "Restored piece at {p0}s: could not link it to its video again.",
  ],
  [
    '^Clip "([\\s\\S]*?)" has an effect applied \\("([\\s\\S]*?)"\\) that can\'t be carried over to After Effects — Send to AE rebuilds the cut there from the original file, with only cut points, positions and speed\\. Remove it before sending, or use "Render full timeline for AE" in the Pacing tab instead, which bakes everything into one file first\\.$',
    'Clip "{p0}" has an effect applied ("{p1}") that can\'t be carried over to After Effects — Send to AE rebuilds the cut there from the original file, with only cut points, positions and speed. Remove it before sending, or use "Render full timeline for AE" in the Pacing tab instead, which bakes everything into one file first.',
  ],
  [
    '^Clip "([\\s\\S]*?)" has Pitch applied — Send to AE never renders: it rebuilds the cut in After Effects from the original file, with only cut points, positions and speed\\. Remove Pitch before sending, or use "Render full timeline for AE" in the Pacing tab instead, which bakes everything \\(including Pitch\\) into one file first\\.$',
    'Clip "{p0}" has Pitch applied — Send to AE never renders: it rebuilds the cut in After Effects from the original file, with only cut points, positions and speed. Remove Pitch before sending, or use "Render full timeline for AE" in the Pacing tab instead, which bakes everything (including Pitch) into one file first.',
  ],
  [
    '^Clip "([\\s\\S]*?)" has an effect applied \\("([\\s\\S]*?)"\\) that can\'t be carried over to After Effects — video is never rendered: it goes over as the original file, with only its cut points, position and speed\\. Remove it before sending, or exclude this clip from the selection\\.$',
    'Clip "{p0}" has an effect applied ("{p1}") that can\'t be carried over to After Effects — video is never rendered: it goes over as the original file, with only its cut points, position and speed. Remove it before sending, or exclude this clip from the selection.',
  ],
  [
    "^Piece ([\\s\\S]*?): its audio and video were already ([\\s\\S]*?) frame\\(s\\) apart before J\\/L Pacing ran\\.$",
    "Piece {p0}: its audio and video were already {p1} frame(s) apart before J/L Pacing ran.",
  ],
  [
    "^Video track: ([\\s\\S]*?) clip\\(s\\) where ([\\s\\S]*?) were expected \\(alternate track: ([\\s\\S]*?) of ([\\s\\S]*?)\\)\\. Some leftover fragments may remain, or a piece was removed\\.$",
    "Video track: {p0} clip(s) where {p1} were expected (alternate track: {p2} of {p3}). Some leftover fragments may remain, or a piece was removed.",
  ],
  [
    "^Audio track: ([\\s\\S]*?) clip\\(s\\) where ([\\s\\S]*?) were expected \\(alternate track: ([\\s\\S]*?) of ([\\s\\S]*?)\\)\\. Some leftover fragments may remain, or a piece was removed\\.$",
    "Audio track: {p0} clip(s) where {p1} were expected (alternate track: {p2} of {p3}). Some leftover fragments may remain, or a piece was removed.",
  ],
  [
    "^Could not remove the previous render at ([\\s\\S]*?) before starting a new one — it may be locked by another process \\(antivirus scan, cloud-sync client\\)\\. Close anything that might be reading it and try again\\.$",
    "Could not remove the previous render at {p0} before starting a new one — it may be locked by another process (antivirus scan, cloud-sync client). Close anything that might be reading it and try again.",
  ],
  [
    "^Can't apply J\\/L Pacing safely: another clip on ([\\s\\S]*?) starts at ([\\s\\S]*?)s, closer than piece ([\\s\\S]*?) needs \\(([\\s\\S]*?)s\\)\\. Move it further away \\(or onto a different track\\) before running J\\/L Pacing\\.$",
    "Can't apply J/L Pacing safely: another clip on {p0} starts at {p1}s, closer than piece {p2} needs ({p3}s). Move it further away (or onto a different track) before running J/L Pacing.",
  ],
  [
    "^The number of clips on the ([\\s\\S]*?) track changed while restoring speed\\. Check the track\\.$",
    "The number of clips on the {p0} track changed while restoring speed. Check the track.",
  ],
  [
    "^A ([\\s\\S]*?)s clip at ([\\s\\S]*?)s was removed as a leftover fragment\\. If it was a real piece, undo \\(Cmd\\/Ctrl\\+Z\\), then run Diagnostics from the gear menu and add the report to a bug report\\.$",
    "A {p0}s clip at {p1}s was removed as a leftover fragment. If it was a real piece, undo (Cmd/Ctrl+Z), then run Diagnostics from the gear menu and add the report to a bug report.",
  ],
  [
    "^Could not make the composition longer \\(([\\s\\S]*?)s needed\\)\\. Pieces near its end may be cut off: ([\\s\\S]*?)$",
    "Could not make the composition longer ({p0}s needed). Pieces near its end may be cut off: {p1}",
  ],
  [
    "^After Speed, a video clip and its audio no longer line up \\(start differs by ([\\s\\S]*?) frame\\(s\\), end by ([\\s\\S]*?) frame\\(s\\)\\)\\. Check them on the timeline\\.$",
    "After Speed, a video clip and its audio no longer line up (start differs by {p0} frame(s), end by {p1} frame(s)). Check them on the timeline.",
  ],
  [
    "^([\\s\\S]*?) split\\(s\\) may already be on the track\\. Check the clip before trying again\\.$",
    "{p0} split(s) may already be on the track. Check the clip before trying again.",
  ],
  [
    "^Can't apply J\\/L Pacing safely: another clip on ([\\s\\S]*?) starts at ([\\s\\S]*?)s, closer than piece ([\\s\\S]*?) needs \\(([\\s\\S]*?)s\\)\\. Move it further away before running J\\/L Pacing\\.$",
    "Can't apply J/L Pacing safely: another clip on {p0} starts at {p1}s, closer than piece {p2} needs ({p3}s). Move it further away before running J/L Pacing.",
  ],
  [
    "^Video piece ([\\s\\S]*?) near ([\\s\\S]*?)s is only ([\\s\\S]*?)s long\\. Check the video track\\.$",
    "Video piece {p0} near {p1}s is only {p2}s long. Check the video track.",
  ],
  [
    "^Piece ([\\s\\S]*?) may have landed ([\\s\\S]*?)s away from where it belongs\\. Check it on the timeline\\.$",
    "Piece {p0} may have landed {p1}s away from where it belongs. Check it on the timeline.",
  ],
  [
    "^Piece ([\\s\\S]*?): audio and video moved ([\\s\\S]*?) frame\\(s\\) out of sync\\.$",
    "Piece {p0}: audio and video moved {p1} frame(s) out of sync.",
  ],
  [
    "^([\\s\\S]*?) pieces are selected, but this run expected ([\\s\\S]*?) — the selection may have changed\\. Re-select the pieces from that Cut and try again\\.$",
    "{p0} pieces are selected, but this run expected {p1} — the selection may have changed. Re-select the pieces from that Cut and try again.",
  ],
  [
    "^([\\s\\S]*?) video clip([\\s\\S]*?) in the selection could not be matched to a linked audio piece — video pacing was skipped for ([\\s\\S]*?) this run\\.$",
    "{p0} video clip{p1} in the selection could not be matched to a linked audio piece — video pacing was skipped for {p2} this run.",
  ],
  [
    "^Video piece ([\\s\\S]*?) is missing near ([\\s\\S]*?)s\\. Check the video track\\.$",
    "Video piece {p0} is missing near {p1}s. Check the video track.",
  ],
  [
    "^Piece ([\\s\\S]*?): adding fades moved audio and video ([\\s\\S]*?) frame\\(s\\) out of sync\\.$",
    "Piece {p0}: adding fades moved audio and video {p1} frame(s) out of sync.",
  ],
  [
    "^([\\s\\S]*?) of ([\\s\\S]*?) cut points didn't actually split the clip \\(at ([\\s\\S]*?)s\\) — that silence may not have been fully removed\\.$",
    "{p0} of {p1} cut points didn't actually split the clip (at {p2}s) — that silence may not have been fully removed.",
  ],
  [
    "^Cannot cut this clip: Premiere didn't split it — ([\\s\\S]*?) If its track is locked, unlock it and try again; otherwise run Diagnostics from the gear menu and add the report to a bug report\\.$",
    "Cannot cut this clip: Premiere didn't split it — {p0} If its track is locked, unlock it and try again; otherwise run Diagnostics from the gear menu and add the report to a bug report.",
  ],
  [
    "^Piece ([\\s\\S]*?) \\(video\\): placed, but setting its source in\\/out failed \\(([\\s\\S]*?)\\) — kept with default source framing\\.$",
    "Piece {p0} (video): placed, but setting its source in/out failed ({p1}) — kept with default source framing.",
  ],
  [
    "^Piece ([\\s\\S]*?): placed, but could not locate it afterward — its exact bounds\\/Speed were left unset\\.$",
    "Piece {p0}: placed, but could not locate it afterward — its exact bounds/Speed were left unset.",
  ],
  [
    "^Piece ([\\s\\S]*?): placed, but setting its source in\\/out failed \\(([\\s\\S]*?)\\) — kept with default source framing\\.$",
    "Piece {p0}: placed, but setting its source in/out failed ({p1}) — kept with default source framing.",
  ],
  [
    "^Placing pieces at the original Cut position \\(([\\s\\S]*?)s\\) instead of where they currently sit \\(([\\s\\S]*?)s\\)\\.$",
    "Placing pieces at the original Cut position ({p0}s) instead of where they currently sit ({p1}s).",
  ],
  [
    "^Piece ([\\s\\S]*?): restored, but setting its source range again after restoring its speed failed \\(([\\s\\S]*?)\\)\\.$",
    "Piece {p0}: restored, but setting its source range again after restoring its speed failed ({p1}).",
  ],
  [
    "^Piece ([\\s\\S]*?) \\(video\\): could not remove for repositioning \\(([\\s\\S]*?)\\) — left in its original spot\\.$",
    "Piece {p0} (video): could not remove for repositioning ({p1}) — left in its original spot.",
  ],
  [
    "^File ([\\s\\S]*?) of ([\\s\\S]*?): import appeared to succeed, but the new project item could not be located\\.$",
    "File {p0} of {p1}: import appeared to succeed, but the new project item could not be located.",
  ],
  [
    "^Could not find the original source media of ([\\s\\S]*?) piece\\(s\\) in the Project panel — nothing was changed\\. Import the source file again, then try again\\.$",
    "Could not find the original source media of {p0} piece(s) in the Project panel — nothing was changed. Import the source file again, then try again.",
  ],
  [
    "^Piece ([\\s\\S]*?): could not find its original source media in the Project panel — skipped\\.$",
    "Piece {p0}: could not find its original source media in the Project panel — skipped.",
  ],
  [
    "^Restored the clip's position, but restoring its original Speed failed \\(([\\s\\S]*?)\\)\\.$",
    "Restored the clip's position, but restoring its original Speed failed ({p0}).",
  ],
  [
    "^Restored a piece's position, but restoring its original Speed failed \\(([\\s\\S]*?)\\)\\.$",
    "Restored a piece's position, but restoring its original Speed failed ({p0}).",
  ],
  [
    "^Piece ([\\s\\S]*?) \\(video\\): placed, but could not locate it afterward — left as-is\\.$",
    "Piece {p0} (video): placed, but could not locate it afterward — left as-is.",
  ],
  [
    "^File ([\\s\\S]*?) of ([\\s\\S]*?): placed, but could not be located afterward to place the next file\\.$",
    "File {p0} of {p1}: placed, but could not be located afterward to place the next file.",
  ],
  [
    "^Could not restore a piece's own duration after resetting its speed \\(([\\s\\S]*?)\\)\\.$",
    "Could not restore a piece's own duration after resetting its speed ({p0}).",
  ],
  [
    "^Could not restore a piece's own duration after setting its speed \\(([\\s\\S]*?)\\)\\.$",
    "Could not restore a piece's own duration after setting its speed ({p0}).",
  ],
  [
    '^"([\\s\\S]*?)" audio transition not found — edge fades skipped for all pieces\\.$',
    '"{p0}" audio transition not found — edge fades skipped for all pieces.',
  ],
  [
    '^Premiere refused the "([\\s\\S]*?)" audio transition on every piece — no edge fades were added; the pieces themselves are in place\\.$',
    'Premiere refused the "{p0}" audio transition on every piece — no edge fades were added; the pieces themselves are in place.',
  ],
  [
    "^Piece ([\\s\\S]*?) \\(video\\): placed, but setting its exact bounds failed \\(([\\s\\S]*?)\\)\\.$",
    "Piece {p0} (video): placed, but setting its exact bounds failed ({p1}).",
  ],
  [
    "^Piece ([\\s\\S]*?): placed, but could not locate it afterward — left as-is\\.$",
    "Piece {p0}: placed, but could not locate it afterward — left as-is.",
  ],
  [
    "^Piece ([\\s\\S]*?) \\(video\\): Premiere rejected placing it at ([\\s\\S]*?)s — left out\\.$",
    "Piece {p0} (video): Premiere rejected placing it at {p1}s — left out.",
  ],
  [
    "^Piece ([\\s\\S]*?): placed, but setting its exact source range failed \\(([\\s\\S]*?)\\)\\.$",
    "Piece {p0}: placed, but setting its exact source range failed ({p1}).",
  ],
  [
    "^Piece ([\\s\\S]*?): its original audio track no longer exists — skipped\\.$",
    "Piece {p0}: its original audio track no longer exists — skipped.",
  ],
  [
    "^Piece ([\\s\\S]*?): restored, but setting its exact end bound failed \\(([\\s\\S]*?)\\)\\.$",
    "Piece {p0}: restored, but setting its exact end bound failed ({p1}).",
  ],
  [
    "^Restored the video, but setting its exact bounds failed \\(([\\s\\S]*?)\\)\\.$",
    "Restored the video, but setting its exact bounds failed ({p0}).",
  ],
  [
    '^Speed was applied to "([\\s\\S]*?)", but moving it into place failed \\(([\\s\\S]*?)\\)\\. Check it on the timeline\\.$',
    'Speed was applied to "{p0}", but moving it into place failed ({p1}). Check it on the timeline.',
  ],
  [
    "^Restored the clip, but setting its exact bounds failed \\(([\\s\\S]*?)\\)\\.$",
    "Restored the clip, but setting its exact bounds failed ({p0}).",
  ],
  [
    "^Layer index ([\\s\\S]*?) is no longer an audio\\/video layer — skipped\\.$",
    "Layer index {p0} is no longer an audio/video layer — skipped.",
  ],
  ["^Reset: ([\\s\\S]*?) piece\\(s\\) are not back to back: ([\\s\\S]*?)\\.$", "Reset: {p0} piece(s) are not back to back: {p1}."],
  [
    "^Piece ([\\s\\S]*?): placed, but setting its source in\\/out failed \\(([\\s\\S]*?)\\)\\.$",
    "Piece {p0}: placed, but setting its source in/out failed ({p1}).",
  ],
  [
    "^Could not remove an existing piece before rebuilding \\(([\\s\\S]*?)\\)\\.$",
    "Could not remove an existing piece before rebuilding ({p0}).",
  ],
  ["^Could not set the source clip's in\\/out ([\\s\\S]*?) \\(([\\s\\S]*?)\\)\\.$", "Could not set the source clip's in/out {p0} ({p1})."],
  ["^for piece ([\\s\\S]*?) before placing it$", "for piece {p0} before placing it"],
  ["^for the video of piece ([\\s\\S]*?) before placing it$", "for the video of piece {p0} before placing it"],
  [
    "^Please select exactly one clip \\(currently ([\\s\\S]*?) selected\\)\\. For a clip with several linked audio channels, Alt\\/Option-click one audio clip to select it alone\\.$",
    "Please select exactly one clip (currently {p0} selected). For a clip with several linked audio channels, Alt/Option-click one audio clip to select it alone.",
  ],
  [
    "^Piece ([\\s\\S]*?): Premiere rejected placing it at ([\\s\\S]*?)s — left out\\.$",
    "Piece {p0}: Premiere rejected placing it at {p1}s — left out.",
  ],
  [
    "^Piece ([\\s\\S]*?): Premiere rejected placing it at ([\\s\\S]*?)s — skipped\\.$",
    "Piece {p0}: Premiere rejected placing it at {p1}s — skipped.",
  ],
  ["^Premiere rejected placing the generated audio at ([\\s\\S]*?)s\\.$", "Premiere rejected placing the generated audio at {p0}s."],
  ["^Premiere rejected placing the rendered file at ([\\s\\S]*?)s\\.$", "Premiere rejected placing the rendered file at {p0}s."],
  [
    '^Premiere\'s "([\\s\\S]*?)" audio effect could not be found\\. Restart Premiere Pro and try again\\.$',
    'Premiere\'s "{p0}" audio effect could not be found. Restart Premiere Pro and try again.',
  ],
  [
    '^"([\\s\\S]*?)" was added but can\'t be found on the clip\\. Add it again by hand in Effect Controls\\.$',
    '"{p0}" was added but can\'t be found on the clip. Add it again by hand in Effect Controls.',
  ],
  [
    '^Clip ([\\s\\S]*?) \\("([\\s\\S]*?)"\\): Premiere couldn\'t find it on its track\\.$',
    'Clip {p0} ("{p1}"): Premiere couldn\'t find it on its track.',
  ],
  ["^Could not remove a leftover stray fragment \\(([\\s\\S]*?)\\)\\.$", "Could not remove a leftover stray fragment ({p0})."],
  [
    '^"([\\s\\S]*?)" added, but its "([\\s\\S]*?)" parameter was not found\\.([\\s\\S]*?)$',
    '"{p0}" added, but its "{p1}" parameter was not found.{p2}',
  ],
  ["^File ([\\s\\S]*?) of ([\\s\\S]*?): Premiere rejected importing it\\.$", "File {p0} of {p1}: Premiere rejected importing it."],
  [
    "^File ([\\s\\S]*?) of ([\\s\\S]*?): Premiere rejected placing it at ([\\s\\S]*?)s\\.$",
    "File {p0} of {p1}: Premiere rejected placing it at {p2}s.",
  ],
  ["^Generated audio file not found on disk: ([\\s\\S]*?)$", "Generated audio file not found on disk: {p0}"],
  ['^Clip ([\\s\\S]*?) \\("([\\s\\S]*?)"\\): couldn\'t find its track\\.$', 'Clip {p0} ("{p1}"): couldn\'t find its track.'],
  ["^Restoring the linked video failed \\(([\\s\\S]*?)\\)\\.$", "Restoring the linked video failed ({p0})."],
  ["^Removing the rendered clip failed \\(([\\s\\S]*?)\\)\\.$", "Removing the rendered clip failed ({p0})."],
  ["^Couldn't add the fade-out \\(([\\s\\S]*?)\\)\\.$", "Couldn't add the fade-out ({p0})."],
  ["^Couldn't add the fade-in \\(([\\s\\S]*?)\\)\\.$", "Couldn't add the fade-in ({p0})."],
  ["^Removing a silence piece failed \\(([\\s\\S]*?)\\)\\.$", "Removing a silence piece failed ({p0})."],
  ["^Rendered file not found on disk: ([\\s\\S]*?)$", "Rendered file not found on disk: {p0}"],
  ["^File ([\\s\\S]*?) of ([\\s\\S]*?): not found on disk \\(([\\s\\S]*?)\\)\\.$", "File {p0} of {p1}: not found on disk ({p2})."],
  ["^Source media not found on disk: ([\\s\\S]*?)$", "Source media not found on disk: {p0}"],
  ["^Piece ([\\s\\S]*?): restoring it failed \\(([\\s\\S]*?)\\)\\.$", "Piece {p0}: restoring it failed ({p1})."],
  ['^file ([\\s\\S]*?) \\("([\\s\\S]*?)"\\): not found on disk\\.$', 'file {p0} ("{p1}"): not found on disk.'],
  ["^the alternating audio track \\(([\\s\\S]*?)\\)$", "the alternating audio track ({p0})"],
  ["^Could not open ([\\s\\S]*?) for writing\\.$", "Could not open {p0} for writing."],
  ["^Piece ([\\s\\S]*?) has no source media\\.$", "Piece {p0} has no source media."],
  ["^Removing a piece failed \\(([\\s\\S]*?)\\)\\.$", "Removing a piece failed ({p0})."],
  ["^Closing a gap failed \\(([\\s\\S]*?)\\)\\.$", "Closing a gap failed ({p0})."],
  [
    '^"([\\s\\S]*?)": its "([\\s\\S]*?)" setting could not be changed \\(([\\s\\S]*?)\\)\\.$',
    '"{p0}": its "{p1}" setting could not be changed ({p2}).',
  ],
  ["^Razoring at ([\\s\\S]*?)s failed \\(([\\s\\S]*?)\\)\\.$", "Razoring at {p0}s failed ({p1})."],
  [
    '^The data sent from Premiere can\'t be read \\(unknown mode "([\\s\\S]*?)"\\)\\. Send it again from Premiere\\.$',
    'The data sent from Premiere can\'t be read (unknown mode "{p0}"). Send it again from Premiere.',
  ],
  ["^Layer index ([\\s\\S]*?): ([\\s\\S]*?)$", "Layer index {p0}: {p1}"],
  ['^Clip ([\\s\\S]*?) \\("([\\s\\S]*?)"\\): ([\\s\\S]*?)$', 'Clip {p0} ("{p1}"): {p2}'],
  ['^file ([\\s\\S]*?) \\("([\\s\\S]*?)"\\): ([\\s\\S]*?)$', 'file {p0} ("{p1}"): {p2}'],
  ["^segment ([\\s\\S]*?): ([\\s\\S]*?)$", "segment {p0}: {p1}"],
  ["^([\\s\\S]*?), item ([\\s\\S]*?): ([\\s\\S]*?)$", "{p0}, item {p1}: {p2}"],
  ["^File ([\\s\\S]*?) of ([\\s\\S]*?): ([\\s\\S]*?)$", "File {p0} of {p1}: {p2}"],
  [
    "^Cannot undo: \"([\\s\\S]*?)\" \\(([\\s\\S]*?)s–([\\s\\S]*?)s\\) plays another part of the recording, so it isn't one of this Cut's pieces\\. Move it to free space, then try again\\. Nothing was changed\\.$",
    "Cannot undo: \"{p0}\" ({p1}s–{p2}s) plays another part of the recording, so it isn't one of this Cut's pieces. Move it to free space, then try again. Nothing was changed.",
  ],
  [
    "^Cannot apply Speed: \"([\\s\\S]*?)\" on audio track ([\\s\\S]*?) \\(([\\s\\S]*?)s–([\\s\\S]*?)s\\) plays another part of the recording, so it isn't one of this Cut's pieces\\. Move it to free space, then try again\\.$",
    "Cannot apply Speed: \"{p0}\" on audio track {p1} ({p2}s–{p3}s) plays another part of the recording, so it isn't one of this Cut's pieces. Move it to free space, then try again.",
  ],
  [
    '^Cannot revert: Natural pitch was applied in the sequence "([\\s\\S]*?)"\\. Open that sequence, then try again\\. Nothing was changed\\.$',
    'Cannot revert: Natural pitch was applied in the sequence "{p0}". Open that sequence, then try again. Nothing was changed.',
  ],
  [
    "^Cannot revert: a Natural pitch render is on the timeline more often than Natural pitch placed it \\(at ([\\s\\S]*?)\\), so Revert can't tell its own clips from your copies\\. Delete the copies you don't need, then try again\\. Nothing was changed\\.$",
    "Cannot revert: a Natural pitch render is on the timeline more often than Natural pitch placed it (at {p0}), so Revert can't tell its own clips from your copies. Delete the copies you don't need, then try again. Nothing was changed.",
  ],
  [
    "^([\\s\\S]*?) other clip\\(s\\) of a Natural pitch render stay on the timeline \\(at ([\\s\\S]*?)\\): they aren't the clips Natural pitch placed, so Revert leaves them where they are\\.$",
    "{p0} other clip(s) of a Natural pitch render stay on the timeline (at {p1}): they aren't the clips Natural pitch placed, so Revert leaves them where they are.",
  ],
  [
    "^Cannot revert: audio track ([\\s\\S]*?), where an original piece goes back, no longer exists\\. Add audio tracks \\(Sequence > Add Tracks\\) until it is there again, then try again\\. Nothing was changed\\.$",
    "Cannot revert: audio track {p0}, where an original piece goes back, no longer exists. Add audio tracks (Sequence > Add Tracks) until it is there again, then try again. Nothing was changed.",
  ],
  [
    "^Cannot revert: audio track ([\\s\\S]*?), where an original piece goes back, is locked\\. Unlock it, then try again\\. Nothing was changed\\.$",
    "Cannot revert: audio track {p0}, where an original piece goes back, is locked. Unlock it, then try again. Nothing was changed.",
  ],
  [
    '^Cannot revert: these pieces were rendered in the sequence "([\\s\\S]*?)"\\. Open that sequence, then try again\\. Nothing was changed\\.$',
    'Cannot revert: these pieces were rendered in the sequence "{p0}". Open that sequence, then try again. Nothing was changed.',
  ],
  [
    '^"([\\s\\S]*?)" on audio track ([\\s\\S]*?) \\(([\\s\\S]*?)s–([\\s\\S]*?)s\\) sits between the selected pieces but isn\'t selected: the render would include it and then replace it\\. Select it too, or move it out of that stretch, then try again\\. Nothing was rendered\\.$',
    '"{p0}" on audio track {p1} ({p2}s–{p3}s) sits between the selected pieces but isn\'t selected: the render would include it and then replace it. Select it too, or move it out of that stretch, then try again. Nothing was rendered.',
  ],
  [
    '^"([\\s\\S]*?)" now sits on audio track ([\\s\\S]*?) where the rendered file goes \\(([\\s\\S]*?)s–([\\s\\S]*?)s\\)\\. Nothing was removed\\. Move it out of that stretch, then run "Render full timeline for AE" again\\.$',
    '"{p0}" now sits on audio track {p1} where the rendered file goes ({p2}s–{p3}s). Nothing was removed. Move it out of that stretch, then run "Render full timeline for AE" again.',
  ],
  [
    "^Premiere rejected placing the generated audio at ([\\s\\S]*?)s\\. The previous take is still disabled: select it and choose Clip > Enable\\.$",
    "Premiere rejected placing the generated audio at {p0}s. The previous take is still disabled: select it and choose Clip > Enable.",
  ],
  [
    "^Premiere rejected placing the generated audio at ([\\s\\S]*?)s\\. The previous take was turned back on\\.$",
    "Premiere rejected placing the generated audio at {p0}s. The previous take was turned back on.",
  ],
  [
    "^Audio track ([\\s\\S]*?) is locked, so the new take can't be placed\\. Unlock it, then try again\\. Nothing was replaced\\.$",
    "Audio track {p0} is locked, so the new take can't be placed. Unlock it, then try again. Nothing was replaced.",
  ],
  [
    "^The new take goes on the audio track below and the previous take stays as a disabled clip, but audio track ([\\s\\S]*?) is the last one\\. Add an audio track \\(Sequence > Add Tracks\\), then try again\\. Nothing was replaced\\.$",
    "The new take goes on the audio track below and the previous take stays as a disabled clip, but audio track {p0} is the last one. Add an audio track (Sequence > Add Tracks), then try again. Nothing was replaced.",
  ],
  [
    "^This clip is ([\\s\\S]*?) long, and ElevenLabs Voice Changer takes at most 5:00\\. Cut it into shorter clips and convert them one at a time\\. Nothing was rendered or sent\\.$",
    "This clip is {p0} long, and ElevenLabs Voice Changer takes at most 5:00. Cut it into shorter clips and convert them one at a time. Nothing was rendered or sent.",
  ],
  [
    '^Cannot undo: "([\\s\\S]*?)" \\(([\\s\\S]*?)s–([\\s\\S]*?)s\\) plays the same part of the recording as another of this Cut\'s pieces, so it looks like a copy\\. Move it to free space, then try again\\. Nothing was changed\\.$',
    'Cannot undo: "{p0}" ({p1}s–{p2}s) plays the same part of the recording as another of this Cut\'s pieces, so it looks like a copy. Move it to free space, then try again. Nothing was changed.',
  ],
  [
    '^Cannot apply Speed: "([\\s\\S]*?)" on audio track ([\\s\\S]*?) \\(([\\s\\S]*?)s–([\\s\\S]*?)s\\) plays the same part of the recording as another of this Cut\'s pieces, so it looks like a copy\\. Move it to free space, then try again\\.$',
    'Cannot apply Speed: "{p0}" on audio track {p1} ({p2}s–{p3}s) plays the same part of the recording as another of this Cut\'s pieces, so it looks like a copy. Move it to free space, then try again.',
  ],
  [
    "^Can't apply J\\/L Pacing: \"([\\s\\S]*?)\" on audio track ([\\s\\S]*?) \\(([\\s\\S]*?)s–([\\s\\S]*?)s\\) comes from the same recording as the pieces but isn't selected, and J\\/L Pacing, which uses that track for its overlaps, would remove it\\. If it is one of the pieces, select it too; if it is another part of the recording \\(a second speaker, for example\\), move it to another audio track\\. Then try again\\.$",
    "Can't apply J/L Pacing: \"{p0}\" on audio track {p1} ({p2}s–{p3}s) comes from the same recording as the pieces but isn't selected, and J/L Pacing, which uses that track for its overlaps, would remove it. If it is one of the pieces, select it too; if it is another part of the recording (a second speaker, for example), move it to another audio track. Then try again.",
  ],
  [
    "^Can't apply J\\/L Pacing: \"([\\s\\S]*?)\" on video track ([\\s\\S]*?) \\(([\\s\\S]*?)s–([\\s\\S]*?)s\\) comes from the same recording as the pieces but isn't selected, and J\\/L Pacing, which uses that track for its overlaps, would remove it\\. If it is one of the pieces, select it too; if it is another part of the recording \\(a second speaker, for example\\), move it to another video track\\. Then try again\\.$",
    "Can't apply J/L Pacing: \"{p0}\" on video track {p1} ({p2}s–{p3}s) comes from the same recording as the pieces but isn't selected, and J/L Pacing, which uses that track for its overlaps, would remove it. If it is one of the pieces, select it too; if it is another part of the recording (a second speaker, for example), move it to another video track. Then try again.",
  ],
  [
    "^Can't apply J\\/L Pacing: \"([\\s\\S]*?)\" on audio track ([\\s\\S]*?) \\(([\\s\\S]*?)s–([\\s\\S]*?)s\\) comes from the same recording as the pieces but isn't selected, and J\\/L Pacing would remove it\\. Select it too, or move it out of that stretch, then try again\\.$",
    "Can't apply J/L Pacing: \"{p0}\" on audio track {p1} ({p2}s–{p3}s) comes from the same recording as the pieces but isn't selected, and J/L Pacing would remove it. Select it too, or move it out of that stretch, then try again.",
  ],
  [
    "^Can't apply J\\/L Pacing: \"([\\s\\S]*?)\" on video track ([\\s\\S]*?) \\(([\\s\\S]*?)s–([\\s\\S]*?)s\\) comes from the same recording as the pieces but isn't selected, and J\\/L Pacing would remove it\\. Select it too, or move it out of that stretch, then try again\\.$",
    "Can't apply J/L Pacing: \"{p0}\" on video track {p1} ({p2}s–{p3}s) comes from the same recording as the pieces but isn't selected, and J/L Pacing would remove it. Select it too, or move it out of that stretch, then try again.",
  ],
  [
    '^Cannot apply Speed: "([\\s\\S]*?)" on video track ([\\s\\S]*?) \\(([\\s\\S]*?)s–([\\s\\S]*?)s\\) shows the same part of the recording as one of this Cut\'s pieces, so it looks like a copy\\. Move it to free space, then try again\\.$',
    'Cannot apply Speed: "{p0}" on video track {p1} ({p2}s–{p3}s) shows the same part of the recording as one of this Cut\'s pieces, so it looks like a copy. Move it to free space, then try again.',
  ],
  [
    "^Cannot apply Speed: \"([\\s\\S]*?)\" on video track ([\\s\\S]*?) \\(([\\s\\S]*?)s–([\\s\\S]*?)s\\) shows another part of the recording, so it isn't one of this Cut's pieces\\. Move it to free space, then try again\\.$",
    "Cannot apply Speed: \"{p0}\" on video track {p1} ({p2}s–{p3}s) shows another part of the recording, so it isn't one of this Cut's pieces. Move it to free space, then try again.",
  ],
  [
    '^Cannot undo: "([\\s\\S]*?)" on the video track \\(([\\s\\S]*?)s–([\\s\\S]*?)s\\) shows the same part of the recording as one of this Cut\'s pieces, so it looks like a copy\\. Move it to free space, then try again\\. Nothing was changed\\.$',
    'Cannot undo: "{p0}" on the video track ({p1}s–{p2}s) shows the same part of the recording as one of this Cut\'s pieces, so it looks like a copy. Move it to free space, then try again. Nothing was changed.',
  ],
  [
    "^Cannot undo: \"([\\s\\S]*?)\" on the video track \\(([\\s\\S]*?)s–([\\s\\S]*?)s\\) shows another part of the recording, so it isn't one of this Cut's pieces\\. Move it to free space, then try again\\. Nothing was changed\\.$",
    "Cannot undo: \"{p0}\" on the video track ({p1}s–{p2}s) shows another part of the recording, so it isn't one of this Cut's pieces. Move it to free space, then try again. Nothing was changed.",
  ],
  [
    '^"([\\s\\S]*?)" is disabled \\(greyed out\\), so its render would be silent\\. Enable it \\(right-click > Enable\\), or select the take that is playing, then try again\\. ([\\s\\S]*?)$',
    '"{p0}" is disabled (greyed out), so its render would be silent. Enable it (right-click > Enable), or select the take that is playing, then try again. {p1}',
  ],
  [
    "^Audio track ([\\s\\S]*?) is muted, so the render would be silent\\. Unmute it, then try again\\. ([\\s\\S]*?)$",
    "Audio track {p0} is muted, so the render would be silent. Unmute it, then try again. {p1}",
  ],
  [
    "^Audio track ([\\s\\S]*?) is locked, so the generated voice-over can't be placed there\\. Unlock it, or make another audio track the first targeted one \\(turn on its track-targeting button in the track header, and turn it off on the audio tracks above it\\), and try again\\.$",
    "Audio track {p0} is locked, so the generated voice-over can't be placed there. Unlock it, or make another audio track the first targeted one (turn on its track-targeting button in the track header, and turn it off on the audio tracks above it), and try again.",
  ],
  [
    '^Cannot apply Speed: the re-timed pieces go back at 100% speed for a moment before their Speed is set, so they need ([\\s\\S]*?)s of free space after ([\\s\\S]*?)s, where "([\\s\\S]*?)" sits\\. Move that clip ([\\s\\S]*?)s later, then try again\\.$',
    'Cannot apply Speed: the re-timed pieces go back at 100% speed for a moment before their Speed is set, so they need {p0}s of free space after {p1}s, where "{p2}" sits. Move that clip {p3}s later, then try again.',
  ],
  [
    "^Cannot undo: pieces of this Cut now run past the original clip's end \\(([\\s\\S]*?)s\\), most likely after a Speed below 100%\\. Set Speed back to 100% in the Pacing tab, then undo\\. Nothing was changed\\.$",
    "Cannot undo: pieces of this Cut now run past the original clip's end ({p0}s), most likely after a Speed below 100%. Set Speed back to 100% in the Pacing tab, then undo. Nothing was changed.",
  ],
  [
    "^The folder ([\\s\\S]*?) could not be created\\. Check that the location is writable, then try again\\.$",
    "The folder {p0} could not be created. Check that the location is writable, then try again.",
  ],
  [
    '^Audio track ([\\s\\S]*?), where an original piece sits, is locked\\. Unlock it, then run "Render full timeline for AE" again\\. Nothing was removed\\.$',
    'Audio track {p0}, where an original piece sits, is locked. Unlock it, then run "Render full timeline for AE" again. Nothing was removed.',
  ],
  [
    '^Audio track ([\\s\\S]*?), where the rendered file goes, is locked\\. Unlock it, then run "Render full timeline for AE" again\\. Nothing was removed\\.$',
    'Audio track {p0}, where the rendered file goes, is locked. Unlock it, then run "Render full timeline for AE" again. Nothing was removed.',
  ],
  [
    "^Audio track ([\\s\\S]*?), where a selected piece sits, is locked\\. Unlock it, then try again\\. Nothing was rendered\\.$",
    "Audio track {p0}, where a selected piece sits, is locked. Unlock it, then try again. Nothing was rendered.",
  ],
  ['^Premiere could not remove "([\\s\\S]*?)" \\(([\\s\\S]*?)\\)\\. ([\\s\\S]+)$', 'Premiere could not remove "{p0}" ({p1}). {p2}'],
  ['^Premiere did not remove "([\\s\\S]*?)"\\. ([\\s\\S]+)$', 'Premiere did not remove "{p0}". {p1}'],
  [
    "^Premiere failed while placing the rendered file \\(([\\s\\S]*?)\\)\\. ([\\s\\S]+)$",
    "Premiere failed while placing the rendered file ({p0}). {p1}",
  ],
  ["^Premiere failed while placing the rendered file \\(([\\s\\S]*?)\\)\\.$", "Premiere failed while placing the rendered file ({p0})."],
  [
    "^Natural pitch: Premiere rejected placing the audio for piece ([\\s\\S]*?)([\\s\\S]*?)\\. Everything was put back; nothing was replaced\\. Try again, or check that stretch of the timeline in Premiere\\.$",
    "Natural pitch: Premiere rejected placing the audio for piece {p0}{p1}. Everything was put back; nothing was replaced. Try again, or check that stretch of the timeline in Premiere.",
  ],
  [
    "^Could not remove an already placed natural-pitch clip \\(([\\s\\S]*?)\\)\\.$",
    "Could not remove an already placed natural-pitch clip ({p0}).",
  ],
  [
    "^Render did not finish writing in time \\(([\\s\\S]*?)\\)\\. Premiere reported the render as done, so check that folder: if the file is there and plays, the location is slow to report it — try again; otherwise render again\\.$",
    "Render did not finish writing in time ({p0}). Premiere reported the render as done, so check that folder: if the file is there and plays, the location is slow to report it — try again; otherwise render again.",
  ],
];

const HOST_PATTERNS = HOST_PATTERN_SOURCES.map(([source, key]) => ({ re: new RegExp(source), key }));

export const translateHostMessage = (raw: string, depth = 0): string => {
  if (typeof raw !== "string" || !raw) return raw;
  const exact = tr(raw);
  if (exact !== raw) return exact;
  for (const { re, key } of HOST_PATTERNS) {
    const m = re.exec(raw);
    if (!m) continue;
    const vars: Record<string, string> = {};
    for (let i = 1; i < m.length; i++) {
      const value = m[i] ?? "";
      vars[`p${i - 1}`] = depth < 2 ? translateHostMessage(value, depth + 1) : value;
    }
    return tr(key, vars);
  }
  return raw;
};
