const Jimp = require('jimp');

async function processImage() {
    try {
        const image = await Jimp.read('public/assets/logo.png');
        
        image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
            const red = this.bitmap.data[idx + 0];
            const green = this.bitmap.data[idx + 1];
            const blue = this.bitmap.data[idx + 2];
            
            // If pixel is black or very dark
            if (red < 20 && green < 20 && blue < 20) {
                this.bitmap.data[idx + 3] = 0; // Set alpha to 0
            }
        });
        
        image.autocrop();
        
        let foundIcon = false;
        let endY = image.bitmap.height;
        
        // Scan line-by-line horizontally. The Z icon is on top. There should be a transparent horizontal gap between Z icon and text below it.
        for (let y = 0; y < image.bitmap.height; y++) {
            let rowHasPixels = false;
            for (let x = 0; x < image.bitmap.width; x++) {
                const idx = image.getPixelIndex(x, y);
                if (image.bitmap.data[idx + 3] > 0) {
                    rowHasPixels = true;
                    break;
                }
            }
            if (rowHasPixels) {
                foundIcon = true;
            } else if (foundIcon) { 
                endY = y;
                break;
            }
        }
        
        image.crop(0, 0, image.bitmap.width, endY);
        image.autocrop();
        
        await image.writeAsync('public/assets/logo-icon-transparent.png');
        console.log("Image processed successfully. Smart crop applied.");
    } catch (e) {
        console.error("Error processing image with Jimp:", e);
    }
}

processImage();
