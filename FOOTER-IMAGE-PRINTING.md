# Footer Message as Image - Thermal Printing Guide

## Overview
This feature allows you to print the footer message as an image instead of text, which is especially useful for thermal printers that don't support Tamil or other Unicode characters.

## Why Use Footer as Image?

### Problem
Many thermal printers have limited character set support:
- ❌ Cannot print Tamil text correctly
- ❌ Limited Unicode support
- ❌ Show garbled characters or question marks for non-ASCII text

### Solution
Convert the footer message to an image:
- ✅ Works with any text including Tamil, Unicode symbols
- ✅ Consistent appearance across all printers
- ✅ Better control over font size and styling
- ✅ High-quality thermal printing

## How to Enable

### Step 1: Open Settings
1. Go to **Settings** page in the app
2. Scroll down to **Bill Template** section
3. Find **"Footer Message as Image"** section

### Step 2: Enable the Feature
1. Toggle **"Enable Footer Image"** checkbox to ON
2. Configure the following options:

#### Image Background Color
**Recommended: White Background** ⚪
- **White (#FFFFFF)** - Best contrast for thermal printing (RECOMMENDED)
- Light Gray (#F5F5F5) - Subtle background
- Light Blue (#E3F2FD) - Cool tone
- Light Green (#E8F5E9) - Natural look
- Light Yellow (#FFFDE7) - Warm tone

> **💡 Tip:** White background with black text provides the best contrast and clarity for thermal printers.

#### Text Color
**Recommended: Black** ⚫
- **Black (#000000)** - Maximum contrast (RECOMMENDED)
- Dark Blue (#0D47A1) - Professional look
- Dark Green (#1B5E20) - Natural tone
- Dark Yellow (#F57F17) - Warm emphasis
- Dark Red (#B71C1C) - Strong emphasis

#### Font Size
Choose the font size for the image:
- Small (12px) - Compact
- Medium (14px) - Readable
- **Normal (16px)** - Good balance (RECOMMENDED)
- Large (18px) - Prominent
- Extra Large (20px) - Maximum visibility

### Step 3: Set Your Footer Message
Enter your footer message in the **"Footer Message"** field:
- English: "Thank You! Visit Again"
- Tamil: "நன்றி! மீண்டும் வாருங்கள்"
- Mixed: "நன்றி - Thank You"

## Technical Details

### Image Generation
- Uses HTML5 Canvas to render text
- Converts to base64 PNG image
- Automatically adjusts width based on paper size (58mm or 80mm)
- Text wrapping for long messages

### Thermal Printing Process
1. Text → Canvas rendering
2. Canvas → Base64 PNG
3. PNG → Grayscale conversion
4. Grayscale → 1-bit black/white
5. 1-bit → ESC/POS bitmap format
6. Bitmap → Thermal printer

### Printer Compatibility
- ✅ Works with 58mm thermal printers
- ✅ Works with 80mm thermal printers
- ✅ Compatible with ESC/POS protocol
- ✅ Supports Bluetooth and USB connections

## Best Practices

### 1. Color Selection
- **Always use high contrast** (white background + black text)
- Avoid light colors on light backgrounds
- Thermal printers work best with black/white

### 2. Font Size
- **58mm printers**: Use 14-16px for best results
- **80mm printers**: Can use up to 20px comfortably
- Test print to find optimal size

### 3. Message Length
- Keep messages concise (1-2 lines)
- Very long messages will auto-wrap
- Test with actual printer for best layout

### 4. Testing
1. Enable the feature
2. Configure colors and size
3. Print a test bill
4. Adjust settings as needed
5. Save your preferred configuration

## Troubleshooting

### Image Not Printing
- ✅ Check "Enable Footer Image" is ON
- ✅ Verify printer connection (Bluetooth/USB)
- ✅ Try disabling and re-enabling the feature
- ✅ Check printer paper isn't jammed

### Image Quality Issues
- ✅ Use white background + black text for best results
- ✅ Increase font size if text is too small
- ✅ Reduce font size if image is cut off
- ✅ Check paper size setting matches your printer

### Image Too Large/Small
- ✅ Verify paper size setting (58mm vs 80mm)
- ✅ Adjust font size setting
- ✅ Keep message text shorter

### Tamil Text Still Not Showing
- ✅ Confirm "Enable Footer Image" is checked
- ✅ Clear browser cache and reload
- ✅ Try a test print
- ✅ Contact support if issue persists

## Example Configurations

### Configuration 1: Classic (Recommended)
- Background: White (#FFFFFF)
- Text Color: Black (#000000)
- Font Size: 16px
- Message: "நன்றி - Thank You! Visit Again"

### Configuration 2: Subtle Professional
- Background: Light Gray (#F5F5F5)
- Text Color: Dark Blue (#0D47A1)
- Font Size: 14px
- Message: "நன்றி வாருங்கள்"

### Configuration 3: Bold Emphasis
- Background: White (#FFFFFF)
- Text Color: Black (#000000)
- Font Size: 20px
- Bold Footer: ON
- Message: "*** Thank You ***"

## Performance Notes

### Processing Time
- Image generation: ~50ms
- Bitmap conversion: ~100ms
- Printing: Same as text mode
- Total overhead: Minimal (< 200ms)

### Memory Usage
- Small image (~5-10KB)
- Negligible memory impact
- Safe for mobile devices

## When to Use

### Use Footer Image When:
- ✅ Printing Tamil or Unicode text
- ✅ Printer doesn't support required characters
- ✅ Need consistent appearance across printers
- ✅ Want custom fonts not supported by printer

### Use Text Footer When:
- ✅ Printing only English/ASCII text
- ✅ Printer fully supports your language
- ✅ Prefer faster processing
- ✅ Limited to basic characters

## Additional Resources

- [Printer Setup Guide](PRINTER_SETUP.md)
- [Bluetooth Connection Guide](BLUETOOTH_PRINTER_CONNECTION_GUIDE.md)
- [Mobile Build Instructions](MOBILE-BUILD.md)

## Support

For issues or questions:
1. Check this guide first
2. Try the troubleshooting steps
3. Test with different settings
4. Contact technical support with printer model details

---

**Feature Version:** 1.0  
**Last Updated:** January 2026  
**Compatibility:** All ESC/POS thermal printers
