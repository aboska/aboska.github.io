const fileInput = document.getElementById('fileInput');
const copyToast = document.getElementById("copyToast");
const toastBody = document.getElementById("toastBody");
const copyBtn = document.getElementById("copyToClipboard");

fileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const jsonObject = JSON.parse(text);
        console.log(jsonObject);
        copyCMajorArraysToClipboard(jsonObject);

        
    } catch (error) {
        console.error('Error reading or parsing file:', error);
    }
});

function extractNestedStructure(jsonObject) {
    const FALLBACK_PREROLL_MS = 50;

    return jsonObject.articulations.map((articulation, aIdx) => ({
        name: aIdx,
        variations: articulation.variations.map((variation, vIdx) => ({
            name: vIdx,
            groups: variation.groups.map((group, gIdx) => {

                const baseNotes = group.zones.map(zone => zone.baseNote);
                const loRange = group.zones.map(zone => zone.keyRange.low);
                const hiRange = group.zones.map(zone => zone.keyRange.high);

                const sampleRate = group.zones[0].voices[0].sampleRate;
                const preRollSamples = (FALLBACK_PREROLL_MS * sampleRate) / 1000;

                const offsets = new Array(128).fill(0);
                
                for (let i = 0; i < baseNotes.length; i++) {
                    const lo = loRange[i];
                    const hi = hiRange[i];
                    const base = baseNotes[i];

                    for (let j = lo; j <= hi; j++) {
                        const diff = j - base;
                        const signedOffset = preRollSamples * (1 - Math.pow(0.5, diff / 12));
                        offsets[j] = Math.round(signedOffset);
                    }
                }
                return { name: gIdx, offsets };
            })
        }))
    }));

}

function toFlatCMajorArray(articulations) {
    const NOTE_COUNT = 128;
    const maxVariations = Math.max(...articulations.map(a => a.variations.length))
    const maxGroups = Math.max(
        ...articulations.flatMap(a => a.variations.map(v => v.groups.length))
    );
    const numArticulations = articulations.length;
    const totalSize = numArticulations * maxVariations * maxGroups * NOTE_COUNT;

    const flat = new Array(totalSize).fill(0);

    articulations.forEach((art, aIdx) => {
        art.variations.forEach((variation, vIdx) => {
            variation.groups.forEach((group, gIdx) => {
                for (let note = 0; note < NOTE_COUNT; note++) {
                    const flatIndex = ((aIdx * maxVariations + vIdx) * maxGroups + gIdx) * NOTE_COUNT + note;
                    flat[flatIndex] = group.offsets[note];
                }
            });
        });
    });

    let output = "";
    output += `// dims: [articulations=${numArticulations}][variations=${maxVariations}][groups=${maxGroups}][notes=${NOTE_COUNT}]\n`;
    output += `int[${totalSize}] preRollOffsetTable = (\n   ${flat.join(", ")}\n);\n`;

    return output;
}

let currentCMajorText = "";

copyBtn.addEventListener("click", async function() {
    await navigator.clipboard.writeText(currentCMajorText);

    const originalLabel = copyBtn.innerText;
    copyBtn.innerText = "Copied!";

    setTimeout(() => {
        copyBtn.innerText = originalLabel;
    }, 1500);
});

async function copyCMajorArraysToClipboard(jsonObject) {
    const articulations = extractNestedStructure(jsonObject);
    const currentCMajorText = toFlatCMajorArray(articulations);

    const toastBootstrap = bootstrap.Toast.getOrCreateInstance(copyToast);
    toastBody.innerText = currentCMajorText;
    toastBootstrap.show();
    
    console.log(currentCMajorText);
}