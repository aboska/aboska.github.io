function loadImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = event.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function canvasToBlob(canvas, format) {
    return new Promise((resolve) => canvas.toBlob(resolve, format));
}

async function convertImages() {
    const fileInput = document.getElementById("upload");
    const format = document.getElementById("format").value;
    const statusEl = document.getElementById("status");
    const link = document.getElementById("download");

    const files = Array.from(fileInput.files).filter(f => f.type.startsWith("image/"));
    
    if (!files.length) {
        alert("Please select a folder containing images");
        return;
    }

    const zip = new JSZip();
    let done = 0;

    for (const file of files) {
        statusEl.textContent = `Converting ${done + 1} of ${files.length}...`;

        try {
            const img = await loadImage(file);

            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);

            const blob = await canvasToBlob(canvas, format);

            const originalName = file.webkitRelativePath || file.name;
            const newName = originalName.replace(/\.[^/.]+$/, "") + ".webp";

            zip.file(newName, blob);
        } catch (err) {
            console.error(`Failed to convert ${file.name}:`, err);
        }

        done++;
    }

    statusEl.textContent = "Zipping...";

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const zipUrl = URL.createObjectURL(zipBlob);

    link.href = zipUrl;
    link.download = "converted-images.zip";
    link.style.display = "inline";
    link.innerText = "Download Converted Images (.zip)";

    statusEl.textContent = `Done - converted ${done} image(s).`;
}