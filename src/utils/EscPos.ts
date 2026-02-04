export const ESC = 0x1B;
export const GS = 0x1D;
export const LF = 0x0A;

export const Commands = {
    // Initialization
    INIT: [ESC, 0x40],
    
    // Character Code Table (for UTF-8 support)
    CHAR_CODE_UTF8: [ESC, 0x74, 0x10], // Set character code table to UTF-8

    // Text Format
    TXT_NORMAL: [ESC, 0x21, 0x00],
    TXT_2HEIGHT: [ESC, 0x21, 0x10],
    TXT_2WIDTH: [ESC, 0x21, 0x20],
    TXT_4SQUARE: [ESC, 0x21, 0x30], // Double width & height

    TXT_BOLD_ON: [ESC, 0x45, 0x01],
    TXT_BOLD_OFF: [ESC, 0x45, 0x00],

    // Alignment
    TXT_ALIGN_LT: [ESC, 0x61, 0x00],
    TXT_ALIGN_CT: [ESC, 0x61, 0x01],
    TXT_ALIGN_RT: [ESC, 0x61, 0x02],

    // Cut
    CUT_FULL: [GS, 0x56, 0x00],
    CUT_PARTIAL: [GS, 0x56, 0x01],
};

export class EscPos {
    buffer: number[] = [];

    constructor() {
        this.reset();
    }

    reset() {
        this.buffer = [];
        this.add(Commands.INIT);
        this.add(Commands.CHAR_CODE_UTF8); // Enable UTF-8 encoding for Tamil and other languages
    }

    add(data: number[]) {
        this.buffer.push(...data);
        return this;
    }

    text(text: string) {
        // UTF-8 encoding to support Tamil and other Unicode characters
        const encoder = new TextEncoder();
        const utf8Bytes = encoder.encode(text);
        this.buffer.push(...Array.from(utf8Bytes));
        return this;
    }

    textLine(text: string) {
        this.text(text);
        this.buffer.push(LF);
        return this;
    }

    feed(lines: number = 1) {
        for (let i = 0; i < lines; i++) {
            this.buffer.push(LF);
        }
        return this;
    }

    align(align: 'LEFT' | 'CENTER' | 'RIGHT') {
        switch (align) {
            case 'CENTER': this.add(Commands.TXT_ALIGN_CT); break;
            case 'RIGHT': this.add(Commands.TXT_ALIGN_RT); break;
            default: this.add(Commands.TXT_ALIGN_LT); break;
        }
        return this;
    }

    bold(enable: boolean) {
        this.add(enable ? Commands.TXT_BOLD_ON : Commands.TXT_BOLD_OFF);
        return this;
    }

    size(size: 'NORMAL' | 'LARGE') {
        if (size === 'LARGE') this.add(Commands.TXT_2HEIGHT); // Often readable enough
        else this.add(Commands.TXT_NORMAL);
        return this;
    }

    cut() {
        this.feed(3); // Feed before cut
        this.add(Commands.CUT_PARTIAL);
        return this;
    }

    printQRCode(data: string, size: number = 6) {
        // QR Code Model (Model 2)
        this.buffer.push(GS, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
        
        // QR Code Size (1-16, default 6)
        this.buffer.push(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, size);
        
        // QR Code Error Correction Level (L=48, M=49, Q=50, H=51)
        this.buffer.push(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31); // M level
        
        // Store QR Code Data
        const dataLength = data.length + 3;
        const pL = dataLength & 0xFF;
        const pH = (dataLength >> 8) & 0xFF;
        this.buffer.push(GS, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30);
        
        for (let i = 0; i < data.length; i++) {
            this.buffer.push(data.charCodeAt(i));
        }
        
        // Print QR Code
        this.buffer.push(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30);
        this.feed(1);
        return this;
    }

    /**
     * Print image from base64 encoded data
     * Converts image to 1-bit bitmap and prints using ESC * command
     */
    async printImageFromBase64(base64Image: string): Promise<void> {
        // Load image
        const img = await this.loadImage(base64Image);
        
        // Create canvas for processing
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context not available');
        
        // Get paper width from settings
        const paperWidth = localStorage.getItem('printerPaperSize') || '58mm';
        const printerWidth = paperWidth === '80mm' ? 576 : 384; // 8 dots per mm
        
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
        
        // Convert to ESC/POS bitmap format and add to buffer
        this.convertImageToBitmap(imageData, canvas.width, canvas.height);
    }

    /**
     * Load image from base64 string
     */
    private loadImage(src: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }

    /**
     * Convert image data to ESC/POS bitmap format
     */
    private convertImageToBitmap(imageData: ImageData, width: number, height: number): void {
        const bytesPerLine = Math.ceil(width / 8);
        
        for (let y = 0; y < height; y++) {
            // ESC * m nL nH [data] - Bit image mode
            this.buffer.push(ESC, 0x2A, 0x00); // Single density mode
            this.buffer.push(bytesPerLine & 0xFF, (bytesPerLine >> 8) & 0xFF);
            
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
                this.buffer.push(byte);
            }
            
            // Line feed
            this.buffer.push(LF);
        }
    }

    getBytes(): Uint8Array {
        return new Uint8Array(this.buffer);
    }
}
