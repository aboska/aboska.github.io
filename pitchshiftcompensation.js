const fileInput = document.getElementById('fileInput');
const resultModal = document.getElementById("resultModal");
const modalBody = document.getElementById("modalBody");
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

                const offsets = new Array(128).fill(0);
                
                for (let i = 0; i < baseNotes.length; i++) {
                    const lo = loRange[i];
                    const hi = hiRange[i];
                    const base = baseNotes[i];

                    for (let j = lo; j <= hi; j++) {
                        const diff = j - base;
                        const signedOffset = FALLBACK_PREROLL_MS * (1 - Math.pow(0.5, diff / 12));
                        offsets[j] = signedOffset;
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

    const formattedValues = flat.map(v => `${v.toFixed(3)}f`).join(", ");

    let output = "";
    output += `// dims: [articulations=${numArticulations}][variations=${maxVariations}][groups=${maxGroups}][notes=${NOTE_COUNT}]\n`;
    output += `float[${totalSize}] preRollOffsetTableMs = (\n   ${formattedValues}\n);\n`;

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
    currentCMajorText = toFlatCMajorArray(articulations);

    modalBody.innerText = currentCMajorText;

    const modalInstance = bootstrap.Modal.getOrCreateInstance(resultModal);
    modalInstance.show();
    
    console.log(currentCMajorText);
}