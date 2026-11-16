// Helpers used by ppro.ts, trimmed from the bolt-cep scaffold utilities down
// to what this extension actually calls, so no unexercised ExtendScript code
// sits around untested (this engine lacks things like Object.keys).

// Sequence Helpers

export const getSequenceFromProjectItem = (item: ProjectItem) => {
  for (let i = 0; i < app.project.sequences.numSequences; i++) {
    const seq = app.project.sequences[i];
    if (seq.projectItem.nodeId === item.nodeId) {
      return seq;
    }
  }
};

// Time Helpers

export const secondsToTime = (seconds: number) => {
  let time = new Time();
  time.seconds = seconds;
  return time;
};

// QE DOM Methods

export const qeGetClipAt = (track: Track, index: number) => {
  let curClipIndex = -1;
  for (let i = 0; i < track.numItems; i++) {
    const item = track.getItemAt(i);
    //@ts-ignore
    const type = item.type as "Empty" | "Clip";
    if (type === "Clip") {
      curClipIndex++;
      if (curClipIndex === index) {
        return item;
      }
    }
  }
};

// Metadata Helpers

export const getPrMetadata = (projectItem: ProjectItem, fields: string[]) => {
  let PProMetaURI = "http://ns.adobe.com/premierePrivateProjectMetaData/1.0/";
  if (ExternalObject.AdobeXMPScript === undefined) {
    ExternalObject.AdobeXMPScript = new ExternalObject("lib:AdobeXMPScript");
  }
  if (!app.isDocumentOpen() || !ExternalObject.AdobeXMPScript || !XMPMeta) {
    return {};
  }
  let xmp = new XMPMeta(projectItem.getProjectMetadata());
  let result: {
    [key: string]: string;
  } = {};
  for (let i = 0; i < fields.length; i++) {
    if (xmp.doesPropertyExist(PProMetaURI, fields[i])) {
      result[fields[i]] = xmp.getProperty(PProMetaURI, fields[i]).value;
    }
  }
  return result;
};

export const getItemFrameRate = (item: ProjectItem) => {
  if (item.isSequence()) {
    const sequence = getSequenceFromProjectItem(item);
    if (sequence) {
      return 1 / sequence.getSettings().videoFrameRate.seconds;
    }
  } else {
    const key = "Column.Intrinsic.MediaTimebase";
    const mediaTimeBase = getPrMetadata(item, [key]);
    return parseFloat(mediaTimeBase[key]);
  }
};
