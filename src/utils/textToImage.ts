/**
 * Text to Image Converter for Thermal Printing
 * Converts text (including Tamil) to images for printers that don't support Unicode
 */

export interface TextToImageOptions {
    text: string;
    width: number; // Image width in pixels
    fontSize: number;
    fontFamily?: string;
    backgroundColor?: string;
    textColor?: string;
    bold?: boolean;
    padding?: number;
}

/**
 * Convert text to base64 image data
 */
export const textToImage = (options: TextToImageOptions): string => {
    const {
        text,
        width,
        fontSize,
        fontFamily = 'Arial, sans-serif',
        backgroundColor = '#FFFFFF', // White background recommended for thermal printing
        textColor = '#000000', // Black text for best contrast
        bold = false,
        padding = 10
    } = options;

    // Create canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');

    // Set canvas dimensions
    canvas.width = width;
    
    // Set font to measure text height
    ctx.font = `${bold ? 'bold ' : ''}${fontSize}px ${fontFamily}`;
    
    // Split text into lines if needed
    const lines = wrapText(ctx, text, width - padding * 2);
    const lineHeight = fontSize * 1.3;
    const totalHeight = (lines.length * lineHeight) + (padding * 2);
    
    canvas.height = totalHeight;

    // Fill background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw text
    ctx.fillStyle = textColor;
    ctx.font = `${bold ? 'bold ' : ''}${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    lines.forEach((line, index) => {
        const y = padding + (index * lineHeight);
        ctx.fillText(line, width / 2, y);
    });

    // Convert to base64
    return canvas.toDataURL('image/png');
};

/**
 * Wrap text to fit within specified width
 */
const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }
    
    if (currentLine) {
        lines.push(currentLine);
    }

    return lines;
};

/**
 * Convert base64 image to bytes for thermal printer
 */
export const imageToThermalBytes = async (base64Image: string, paperWidth: '58mm' | '80mm' = '58mm'): Promise<Uint8Array> => {
    // Load image
    const img = await loadImage(base64Image);
    
    // Calculate printer pixel width (8 dots per mm for most thermal printers)
    const printerWidth = paperWidth === '80mm' ? 576 : 384; // 72mm and 48mm printable width
    
    // Create canvas for processing
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');
    
    // Set canvas size maintaining aspect ratio
    const scale = printerWidth / img.width;
    canvas.width = printerWidth;
    canvas.height = Math.floor(img.height * scale);
    
    // Draw and convert to grayscale
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Convert to 1-bit black and white
    const threshold = 128;
    for (let i = 0; i < imageData.data.length; i += 4) {
        const brightness = (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3;
        const binary = brightness > threshold ? 255 : 0;
        imageData.data[i] = imageData.data[i + 1] = imageData.data[i + 2] = binary;
    }
    
    // Convert to ESC/POS bitmap format
    return convertToBitmap(imageData, canvas.width, canvas.height);
};

/**
 * Load image from base64 string
 */
const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
};

/**
 * Convert image data to ESC/POS bitmap format
 */
const convertToBitmap = (imageData: ImageData, width: number, height: number): Uint8Array => {
    const bytes: number[] = [];
    
    // ESC * command for bitmap printing
    // ESC * m nL nH [data]
    const bytesPerLine = Math.ceil(width / 8);
    
    for (let y = 0; y < height; y++) {
        // Line header
        bytes.push(0x1B, 0x2A, 0x00); // ESC * 0 (single density)
        bytes.push(bytesPerLine & 0xFF, (bytesPerLine >> 8) & 0xFF); // Width in bytes
        
        // Convert line to bytes
        for (let x = 0; x < width; x += 8) {
            let byte = 0;
            for (let bit = 0; bit < 8; bit++) {
                const pixelX = x + bit;
                if (pixelX < width) {
                    const index = (y * width + pixelX) * 4;
                    const isBlack = imageData.data[index] < 128;
                    if (isBlack) {
                        byte |= (1 << (7 - bit));
                    }
                }
            }
            bytes.push(byte);
        }
        
        // Line feed
        bytes.push(0x0A);
    }
    
    return new Uint8Array(bytes);
};

/**
 * Recommended background colors for thermal printing
 */
export const THERMAL_COLORS = {
    // Best for thermal printing
    WHITE_BLACK: { background: '#FFFFFF', text: '#000000', name: 'White with Black Text (Recommended)' },
    
    // Alternative options
    LIGHT_GRAY_BLACK: { background: '#F5F5F5', text: '#000000', name: 'Light Gray with Black Text' },
    LIGHT_BLUE_DARK: { background: '#E3F2FD', text: '#0D47A1', name: 'Light Blue with Dark Blue Text' },
    LIGHT_GREEN_DARK: { background: '#E8F5E9', text: '#1B5E20', name: 'Light Green with Dark Green Text' },
    LIGHT_YELLOW_DARK: { background: '#FFFDE7', text: '#F57F17', name: 'Light Yellow with Dark Yellow Text' },
};
