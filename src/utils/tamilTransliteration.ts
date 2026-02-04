/**
 * Tamil to English Transliteration for Thermal Printing
 * Converts Tamil text to readable English equivalents for ASCII-only thermal printers
 */

export const transliterateTamil = (text: string): string => {
    if (!text) return '';
    
    // Common Tamil to English transliteration mapping
    const tamilMap: Record<string, string> = {
        // Common Words
        'பில்': 'Bill',
        'கடன்': 'Credit',
        'பணம்': 'Cash',
        'மொத்தம்': 'Total',
        'தள்ளுபடி': 'Discount',
        'சேமிப்பு': 'Savings',
        'வாடிக்கையாளர்': 'Customer',
        'பெயர்': 'Name',
        'தேதி': 'Date',
        'நேரம்': 'Time',
        'பொருள்': 'Item',
        'விலை': 'Price',
        'எண்ணிக்கை': 'Quantity',
        'எண்': 'Qty',
        'தொகை': 'Amount',
        'மொத்த தொகை': 'Grand Total',
        'நன்றி': 'Thank You',
        'முகவரி': 'Address',
        'தொலைபேசி': 'Phone',
        'மொபைல்': 'Mobile',
        
        // Payment Methods
        'யூபிஐ': 'UPI',
        'கார்டு': 'Card',
        'பணம் செலுத்தப்பட்டது': 'Paid',
        'நிலுவை': 'Balance',
        'செலுத்தப்பட்டது': 'Paid',
        
        // Numbers (Tamil digits to English)
        '௧': '1',
        '௨': '2',
        '௩': '3',
        '௪': '4',
        '௫': '5',
        '௬': '6',
        '௭': '7',
        '௮': '8',
        '௯': '9',
        '௦': '0',
        
        // Common Items
        'அரிசி': 'Rice',
        'தண்ணீர்': 'Water',
        'பால்': 'Milk',
        'சர்க்கரை': 'Sugar',
        'உப்பு': 'Salt',
        'எண்ணெய்': 'Oil',
        'தேநீர்': 'Tea',
        'காபி': 'Coffee',
        'சோப்பு': 'Soap',
        'சாமான்': 'Shampoo',
        'பேஸ்ட்': 'Paste',
        'பிரஷ்': 'Brush',
        'துணி': 'Cloth',
        'சட்டை': 'Shirt',
        'பேண்ட்': 'Pant',
        'காய்கறி': 'Vegetable',
        'பழம்': 'Fruit',
        
        // Units
        'கிலோ': 'kg',
        'கிராம்': 'gram',
        'லிட்டர்': 'liter',
        'துண்டு': 'piece',
        'துண்டுகள்': 'pieces',
        'பாக்கெட்': 'packet',
        
        // Business Terms
        'கடை': 'Store',
        'சேவை': 'Service',
        'தரம்': 'Quality',
        'பொருட்கள்': 'Goods',
        'விற்பனை': 'Sale',
        'கணக்கு': 'Account',
    };
    
    let result = text;
    
    // Replace Tamil words with English equivalents
    for (const [tamil, english] of Object.entries(tamilMap)) {
        const regex = new RegExp(tamil, 'g');
        result = result.replace(regex, english);
    }
    
    // If still contains Tamil characters, transliterate using character mapping
    result = transliterateCharacters(result);
    
    return result;
};

/**
 * Transliterate Tamil characters to Roman script
 */
const transliterateCharacters = (text: string): string => {
    const charMap: Record<string, string> = {
        // Vowels
        'அ': 'a', 'ஆ': 'aa', 'இ': 'i', 'ஈ': 'ii', 'உ': 'u', 'ஊ': 'uu',
        'எ': 'e', 'ஏ': 'ee', 'ஐ': 'ai', 'ஒ': 'o', 'ஓ': 'oo', 'ஔ': 'au',
        
        // Consonants
        'க': 'ka', 'ங': 'nga', 'ச': 'sa', 'ஞ': 'nja', 'ட': 'ta', 'ண': 'na',
        'த': 'tha', 'ந': 'na', 'ப': 'pa', 'ம': 'ma', 'ய': 'ya', 'ர': 'ra',
        'ல': 'la', 'வ': 'va', 'ழ': 'zha', 'ள': 'la', 'ற': 'ra', 'ன': 'na',
        
        // Combined characters (common combinations)
        'கா': 'kaa', 'கி': 'ki', 'கீ': 'kii', 'கு': 'ku', 'கூ': 'kuu',
        'கெ': 'ke', 'கே': 'kee', 'கை': 'kai', 'கொ': 'ko', 'கோ': 'koo',
        
        'சா': 'saa', 'சி': 'si', 'சீ': 'sii', 'சு': 'su', 'சூ': 'suu',
        'செ': 'se', 'சே': 'see', 'சை': 'sai', 'சொ': 'so', 'சோ': 'soo',
        
        'டா': 'taa', 'டி': 'ti', 'டீ': 'tii', 'டு': 'tu', 'டூ': 'tuu',
        'டெ': 'te', 'டே': 'tee', 'டை': 'tai', 'டொ': 'to', 'டோ': 'too',
        
        'தா': 'thaa', 'தி': 'thi', 'தீ': 'thii', 'து': 'thu', 'தூ': 'thuu',
        'தெ': 'the', 'தே': 'thee', 'தை': 'thai', 'தொ': 'tho', 'தோ': 'thoo',
        
        'பா': 'paa', 'பி': 'pi', 'பீ': 'pii', 'பு': 'pu', 'பூ': 'puu',
        'பெ': 'pe', 'பே': 'pee', 'பை': 'pai', 'பொ': 'po', 'போ': 'poo',
        
        'மா': 'maa', 'மி': 'mi', 'மீ': 'mii', 'மு': 'mu', 'மூ': 'muu',
        'மெ': 'me', 'மே': 'mee', 'மை': 'mai', 'மொ': 'mo', 'மோ': 'moo',
        
        'யா': 'yaa', 'யி': 'yi', 'யீ': 'yii', 'யு': 'yu', 'யூ': 'yuu',
        'யெ': 'ye', 'யே': 'yee', 'யை': 'yai', 'யொ': 'yo', 'யோ': 'yoo',
        
        'ரா': 'raa', 'ரி': 'ri', 'ரீ': 'rii', 'ரு': 'ru', 'ரூ': 'ruu',
        'ரெ': 're', 'ரே': 'ree', 'ரை': 'rai', 'ரொ': 'ro', 'ரோ': 'roo',
        
        'லா': 'laa', 'லி': 'li', 'லீ': 'lii', 'லு': 'lu', 'லூ': 'luu',
        'லெ': 'le', 'லே': 'lee', 'லை': 'lai', 'லொ': 'lo', 'லோ': 'loo',
        
        'வா': 'vaa', 'வி': 'vi', 'வீ': 'vii', 'வு': 'vu', 'வூ': 'vuu',
        'வெ': 've', 'வே': 'vee', 'வை': 'vai', 'வொ': 'vo', 'வோ': 'voo',
        
        'னா': 'naa', 'னி': 'ni', 'னீ': 'nii', 'னு': 'nu', 'னூ': 'nuu',
        'னெ': 'ne', 'னே': 'nee', 'னை': 'nai', 'னொ': 'no', 'னோ': 'noo',
        
        // Special characters
        'ஃ': 'ah',
        '்': '', // Pulli (virama) - removes inherent vowel
    };
    
    let result = text;
    
    // Replace longer sequences first to avoid partial replacements
    const sortedKeys = Object.keys(charMap).sort((a, b) => b.length - a.length);
    
    for (const tamil of sortedKeys) {
        const regex = new RegExp(tamil, 'g');
        result = result.replace(regex, charMap[tamil]);
    }
    
    return result;
};
