# AI Voice Master Tool guide

[English](USER-GUIDE.md) · [Russian](USER-GUIDE.ru.md) · [Spanish](USER-GUIDE.es.md)

The same text as the plugin's built-in guide (gear icon → Guide / FAQ), generated from `src/js/main/guideText.ts`.

## Silence Cut: Scan

Scan reads the source media of the one clip selected on your timeline and finds where speech starts and stops, using a voice-activity model that runs on your computer. It then runs a local speech-to-text pass to check that no cut lands in the middle of a word. That check can only make a kept region longer, to cover a word that would otherwise be split, and it does so only where there is real audio at that spot, not silence.

Scan works with mono and stereo files; a stereo file is heard as one mix. A file with more than two channels, or with its channels as separate audio tracks (common in camera files), is refused, and so is Natural pitch on it: export the voice as a mono file (File > Export > Media, Audio > Channels: Mono), import it and use that clip. A clip that shows up on the timeline as linked audio clips on two or more audio tracks is refused too: Alt/Option-click the channel you don't need and delete it (the clip stays linked to its video), then Scan again. Scan hears the file's full mix and Natural pitch renders it, so when that channel carries other sound, use the mono export instead.

Scan and Natural pitch read the audio of the common files Premiere Pro imports: WAV and BWF, AIFF, MP3, AAC and M4A (also Apple Lossless), and the AAC, PCM, AC-3, MP2/MP3 or WMA audio in MOV, MP4, MXF, AVI, MTS/M2TS, MPG/VOB, MKV and WMV files. Audio in another format, such as FLAC, Opus or ADPCM, is refused with a note: export the voice as a WAV file (File > Export > Media, Format: Waveform Audio), import it and use that clip.

## Silence Cut: Automatic and Advanced detection

Automatic picks from 3 ready-made sensitivity presets. Advanced lets you set the exact silence threshold and minimum pause length by hand, with a live preview of the result, and save them as presets.

Cut threshold: audio quieter than this counts as silence. A more negative value cuts only near-total silence; a value closer to 0 cuts more, including quiet breaths.

Min. silence: how long a quiet patch must last before it gets cut. Lower catches tiny pauses between words; higher only cuts clearly dead air.

Local threshold safety check (off by default) adds a second threshold, worked out for each region, next to the global one. A moment is cut only if both call it silence, so the check can only save quiet speech that the global threshold might cut by mistake in a clip whose level drifts, for example under a music bed or after a recording-level change partway through. On clean AI-generated voice, where the level stays put, it usually makes no difference; it helps most on mixed or human recordings.

Presets: save the current threshold and min. silence under a name to use again later.

## Silence Cut: Preview and Cut

In the waveform preview, solid amber is kept, hatched is cut, and a small red triangle marks a kept stretch whose edge the plugin is unsure of, worth a quick listen. The toolbar has two modes. In Seek (the arrow, on by default), click anywhere to play from there. In Edit (the razor), click a region to flip it between kept and cut, drag a region's edge to move it, or drag across the waveform to set a whole stretch: a drag that starts in a kept region cuts the stretch, and one that starts in a cut region keeps it. The strip under the waveform always seeks, and the undo arrow reverts the last preview edit. Use +/− to zoom in on a long track for precise edits.

Cut rebuilds the selected clip from the segments shown, removing everything else. The new pieces are left selected, ready for Pacing.

Undo puts the original, uncut clip back. It rebuilds the clip from the source file instead of stepping back through Premiere's undo history, so effects added to the pieces after the Cut are not kept (the plugin lists them and asks first). It works only in the sequence the Cut was made in, and refuses when another clip now sits where the original goes back. Cmd/Ctrl+Z also works, one step at a time. The button turns off once J/L Pacing has run, because J/L moves pieces onto a second track that this rebuild doesn't clear. To turn it back on, select every piece of the Cut and click Reset in the Pacing tab, or use Cmd/Ctrl+Z.

## Pacing: J/L Pacing

J/L Pacing is meant for fast-paced short-form content. It pulls each piece slightly earlier, so it starts before the previous one has finished, which tightens the pacing. Pieces alternate onto the audio track directly below, since one track can't hold overlapping clips; it refuses when another clip, such as music, sits where a piece would go. How far a piece moves depends on whether the waveform on both sides of the boundary allows an overlap. Gentle goes by the measurement only and leaves a boundary alone when it doesn't allow one. Aggressive and Normal also apply a minimum overlap where the measurement finds none, which is why they feel tighter. That minimum applies in full on clean synthetic voice and shrinks on noisier recordings, down to nothing on the noisiest, where the waveform can't safely show where a word ends. A boundary with no gap in the source at all, such as a spot you split by hand in the middle of a phrase, is never overlapped, because there is no pause there to overlap into. Every piece also gets a short Premiere fade at its start and end (1 to 5 frames, sized from the audio at that boundary) to avoid a click.

It works on the pieces that Cut just made in Silence Cut, and on a timeline you edited by hand after the Cut. You can click it again with a different preset without a Reset first. It works in any order with Speed and Pitch. Applying Speed afterward re-syncs the overlaps to the new durations on this run's pieces while the plugin still remembers the run; after the plugin is reopened, or on other clips, run Make J/L Cut again. Premiere's Pitch Shifter is applied again automatically when every piece had it. J/L Pacing and Reset place the pieces fresh from the source file, so other effects, volume and Motion changes and keyframes on them are not kept; the plugin lists them and asks first. Add effects as the last step.

Make J/L Cut applies the preset selected above. Reset puts every piece back in a plain row, with no overlap and no pacing fade. Neither button changes the Cut itself.

## Pacing: Speed

100 is the original speed, as in Premiere's own Speed/Duration dialog. Above 100 speeds the voice up and shortens the clip; below 100 slows it down and lengthens it. AI-generated voice (from ElevenLabs, for example) picks up artifacts easily: stay under about 105 (5% faster), or correct the pitch with Pitch correction. Recordings of real people can be sped up more.

Apply Speed sets the speed of every selected clip and adds no pitch correction of its own. If every piece already has Premiere's Pitch Shifter, the plugin updates it to the new speed. Right after a Cut, Speed rebuilds the pieces from the source file, so repeated changes can't drift, and puts them back where the Cut left them; pieces you moved elsewhere get the new speed in place. Effects on rebuilt pieces are not kept; the plugin lists them and asks first.

## Pacing: Pitch correction

A sped-up voice also sounds higher, and Pitch correction brings the pitch back. Natural re-renders the pieces at their original pitch. Calculator only shows the correction values, to type into a pitch plugin of your own.

Natural mode re-renders each sped-up piece with the bundled ffmpeg (its "atempo" time-stretch, which keeps the original pitch) and puts the result back in the same place at 100% speed, instead of adding Pitch Shifter. It usually sounds more natural than speed plus a pitch effect. It uses each piece's current speed, so set the speed with Speed % and Apply Speed first. The original pieces are replaced; Revert puts them back in one click. J/L Pacing and Send to After Effects keep working on the result, and J/L fades already on the pieces are kept while the plugin remembers that J/L run. Send to After Effects needs the selected pieces to come from one file: select the rendered pieces of one speed, or the untouched ones, and send each group separately. To change the speed again, Revert first. Effects other than Pitch on a replaced piece are not in the rendered audio. The rendered WAV files go to the "Renders" folder under "AI Voice Master Tool" (in Documents, or next to your project if Save Renders is set to "Next to project"). Next to each rendered WAV is a small ".source.json" file that holds the path of the recording it came from; J/L Pacing reads it to tell the pieces of one Cut from other clips.

Calculator shows the semitones, cents and ratio that undo the pitch change of the Speed % value above, to type into a pitch plugin's own controls (Premiere's own Pitch Shifter or a third-party one). It changes nothing on the timeline. Use it where Natural can't be used, such as a camera clip whose audio Premiere shows as several linked channels: Natural refuses those, since its render would mix the channels together.

Read from selected clip (in Calculator) fills the Speed % field with the speed the selected clip plays at right now. Otherwise the field shows 100 or the value you last typed, which may not match the clip.

Recommended third-party plugin: kHs Pitch Shifter (Kilohearts AB, kilohearts.com/products/pitch_shifter). Open its Pitch slider (shown in semitones) and type the semitones value from Calculator. Premiere's scripting can't set a third-party plugin's parameters reliably, so type the value into the plugin's own window. This is an independent recommendation, not a partnership with, sponsorship by or endorsement from Kilohearts AB. AI Voice Master Tool doesn't bundle, download or install the plugin.

## Pacing: Render full timeline for AE

Pitch, and any other effect besides Speed and J/L Pacing, exists only inside Premiere's playback engine. "Send to After Effects" can't carry it over piece by piece, so it refuses whenever such an effect is applied. This button bakes the selected audio over the whole selected span into one file (audio tracks without selected pieces, such as music, are muted for the render) and puts that file on the timeline in place of the original pieces, so you can see that the bake happened. Then click "Send to After Effects" as usual: the new clip has no Pitch on it and sends normally. Video is left untouched; it is still sent separately and is not baked. The render includes the track's own fader and effects and the Master, and the rendered clip goes back on the same track, where they apply again: set them to their defaults before rendering, or mix afterward.

"Revert to segments" puts the original pieces back in one click, as long as the plugin hasn't been reopened since. Premiere's own Cmd/Ctrl+Z also works, one step at a time.

## AI Voice: ElevenLabs API key and voice

Calls go straight from this computer to api.elevenlabs.io with your own key. The plugin has no key of its own and doesn't see or resell your usage. The key is stored only on this computer, in a plain settings file with the plugin's other settings, and is sent nowhere but api.elevenlabs.io. The status dot is green when ElevenLabs accepted the key, grey when it is saved but not confirmed yet (still checking, or ElevenLabs couldn't be reached), and red when no key is saved or ElevenLabs rejected it.

The Voice picker loads from your ElevenLabs account each time the plugin opens and after you save a key, in two groups: "My Voices" (anything you cloned, designed or added to your account) and "Stock voices" (ElevenLabs' own premade voices). Click the star on a voice to pin it to the quick-access row above the picker. To use a voice that isn't listed, add it to your ElevenLabs account first (favorite, clone or design it at elevenlabs.io or in the ElevenLabs app), then click "Reload voices".

Model: v2 (Multilingual v2) is the default. v3 and v4 are ElevenLabs' expressive models; for them, "Improve for voice" can add audio tags such as [excited] or [whispers] and mark the pronunciation of hard words with inline IPA. v4 is the newest. ElevenLabs calls it an upgrade over v3 in almost every case, and it follows tags more reliably. It uses only Stability and Similarity, without Speed, Style or Speaker Boost; v3 uses Stability alone. v3's audio tags work mainly at the lower, "Creative" end of Realism. Per request, v2 and v4 take up to 10,000 characters and v3 up to 5,000.

## AI Voice: Kokoro (offline)

Kokoro comes with the plugin and runs fully offline, without an API key or internet connection. It has English (American and British), Spanish, French, Hindi, Italian and Brazilian Portuguese voices. It has no fine-grained stability or style sliders like ElevenLabs; the result depends mostly on the voice preset and on clean, well-punctuated text in that voice's language.

The Language field only filters the Voice picker below by language and has no effect on generation. The voice you pick sets the language (bundled Kokoro-82M presets, Apache-2.0), so type your script in that voice's language; the plugin doesn't detect or translate languages.

Long texts are split into sentences, generated in parts and joined into one file, with a short pause at each join.

## AI Voice: Text and Improve for voice

Text: use full sentences and real punctuation. Commas, ellipses and paragraph breaks do the most for natural pacing on every model. On ElevenLabs, texts shorter than about 250 characters can come out inconsistent.

"Improve for voice" sends your text to OpenAI or Anthropic, whichever you pick, with your own API key (stored locally like the ElevenLabs key), to tighten the phrasing and punctuation for speaking. On v2 it changes only wording and punctuation, because v2 would read bracketed tags aloud as text. On v3 and v4, which understand tags, it can also add audio tags; the Pacing only / Natural / Expressive switch under the button sets how far it goes.

Pacing only / Natural / Expressive: "Pacing only" adjusts punctuation (and, on v3 and v4, adds plain [pause] tags) and adds no emotion tags. "Natural", the default, sits in between. "Expressive" (v3 and v4 only) uses emotion and reaction tags more freely, for a more dramatic read.

The model picker lists the models your OpenAI or Anthropic account offers, fetched when the plugin opens, when you save a key and when you switch provider. It defaults to the smallest, cheapest one, which is enough for rewriting a short script.

Cost: rewriting one script with the default small model costs little; the provider's pricing page has current rates. Get a key at platform.openai.com (API keys, separate from a ChatGPT Plus subscription) or console.anthropic.com (separate from a Claude Pro subscription). Both need a small prepaid balance instead of a monthly plan.

## AI Voice: Realism (ElevenLabs)

Automatic sets Stability, Similarity and Style together to a sensible combination. Advanced shows the sliders themselves, for fine-tuning beyond a preset: Stability on every model, Similarity on all but v3, and Style on v2 and for Voice Changer.

Stability: lower values (about 30 to 50%) sound more emotional and lively but less consistent. Higher values (about 65 to 75%) sound clearer and more consistent but can sound flat.

Similarity / Clarity: keep it in the 75 to 90% range, together with Stability. Pushed to 100%, the voice tends to over-enunciate into an unnatural news-anchor sound. Not on v3.

Style: leave it near 0 unless you want a stronger character or more emotion. It exists only on v2 and for Voice Changer: v3 uses Stability alone, v4 Stability and Similarity.

## AI Voice: Generate, Replace and Voice Changer

"Generate & Insert" generates the audio, saves it under "AI Voice Master Tool/Generated" (in Documents, or next to your project if Save Renders is set to "Next to project") and places it at the playhead on the active sequence's target audio track (the first audio track targeted in Premiere, or else track 1). It is then ready for Silence Cut and Pacing. If something already sits at that spot, it refuses instead of overwriting: the playhead position is checked before generating, and the full length before placing. Move the playhead to an empty stretch, or target another track, and try again.

"Replace Voice" generates the text again with the voice selected now and places it at the selected clip's start; the rest of your edit stays as it is. It speaks what the Text field holds. If the field held other text when you selected the clip, the banner says so and offers "Load its text", and Replace Voice asks for a second click before speaking that other text over the clip. The new take goes on the audio track below, and the previous take is disabled and stays on the timeline: bring it back with Enable in the clip's right-click menu, or with the plugin's Undo. Replace needs a free audio track below the clip; without one, it asks you to add a track before generating anything.

Voice Changer's "Convert Selected Clip's Voice" renders the selected timeline clip, with any Speed or Pitch already on it, and sends it to ElevenLabs' Voice Changer (speech-to-speech) with the voice picked above. Other audio tracks are muted for the render, so music under the clip isn't sent. The words stay the same and only the voice changes. Like Replace, it needs a spare audio track directly below the clip's own track, so the result can be undone. Premiere renders the clip itself; only if it can't does the render go to Adobe Media Encoder's queue. If that render then times out, check Media Encoder's Queue panel and its "auto-start queue" preference. ElevenLabs takes clips up to 5 minutes long: cut a longer one into parts and convert them one at a time.

## AI Voice: Batch

Each line of the batch script becomes one generated clip, with the voice, model and Realism settings set above. Lines are generated one at a time, to stay within ElevenLabs' rate limits, and placed one after another on the timeline from the playhead.

"Generate All" skips lines already generated and doesn't place lines already on the timeline, so you can add lines and click again to generate and place only the new ones. Before generating anything, it checks that the target audio track (the first targeted one, or else track 1) is free after the playhead.

On ElevenLabs v2 and v4, each line is sent together with the end of the line before it and the start of the line after it, so the voice carries its intonation across clips instead of starting fresh every time (ElevenLabs' "request stitching"; not available on v3). Only the line itself is spoken. ElevenLabs doesn't say whether that neighbouring text counts toward your credits; the Diagnostics report (gear icon > Run Diagnostics) lists the cost ElevenLabs reports for each line.

## Send to After Effects

Open After Effects (2025 or later), then in the "AI Voice Master Tool Bridge" plugin there (Window > Extensions), click "Place in current composition."

Send to After Effects passes the pieces selected on the timeline to After Effects through a small hand-off file, since the two apps share no clipboard for timeline clips. In After Effects, each piece's speed comes back as a time-stretch, and its J/L position is kept. There is no crossfade: overlapping pieces play at full volume during the overlap. The pieces stay linked to your original media, so you can still nudge their edges in After Effects.

In After Effects the pieces climb as a staircase: the first piece on the lowest layer, each later one a layer above. Where pieces with picture overlap after J/L Pacing, the one Premiere shows on top stays on top, so neighbours there swap in pairs. Pieces made by Natural pitch are sent the same way, one layer each, at 100% speed.

Video is always sent linked to its media and never rendered. A plain linked audio and video clip, such as a camera's own file, arrives as one linked layer with picture and sound, as it sits in Premiere. Only a clip whose audio and video come from two different source files arrives as two separate layers.

Send to After Effects never renders anything. If a selected clip has Pitch, or any other effect besides Speed and J/L Pacing, it refuses, because that effect exists only in Premiere's playback engine and not in the file. For that case, use "Render full timeline for AE" in the Pacing tab first.

An audio file made by "Render full timeline for AE" has no spare material past its edges, so in After Effects you can't extend it the way you can extend a trimmed clip; to make it longer, render again in Premiere. Video, if any, is not affected: it is always sent linked to the original media, so you can still adjust it freely.

## Undo, Revert and the plugin's memory

The plugin's own Undo and Revert buttons (Cut's Undo, Revert to segments, Natural pitch's Revert, AI Voice's Undo) work from what the plugin remembers about the last operation. A new Scan clears Cut's Undo and Natural pitch's Revert and keeps Revert to segments. A new Cut clears Natural pitch's Revert and Revert to segments, and its own Undo replaces the previous Cut's. Neither touches AI Voice's Undo. Reopening the plugin or restarting Premiere clears all of them, and the buttons go away. Premiere's own Cmd/Ctrl+Z always works, one step at a time.

## Problems and bug reports

Gear icon > Run Diagnostics saves a plain-text report to Documents/AI Voice Master Tool/Diagnostics/. It contains no API keys, and your home folder is shortened to ~, but it lists clip, sequence and file names: read it before you share it.

To report a problem, open an issue on the project's GitHub page, github.com/ominousopera/AIVoiceMasterTool, and paste the report's text into it.
