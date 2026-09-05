import * as googleTTS from 'google-tts-api';

const LANG_MAP: Record<string, string> = {
  'English': 'en',
  'Spanish': 'es',
  'French': 'fr',
  'German': 'de',
  'Hindi': 'hi',
  'Chinese': 'zh',
  'Japanese': 'ja',
};

export async function generateTTS(text: string, language: string = 'English'): Promise<Buffer | null> {
  try {
    const langCode = LANG_MAP[language] || 'en';
    
    // google-tts-api limits to ~200 characters. For safety, we truncate.
    const safeText = text.slice(0, 200);

    const url = googleTTS.getAudioUrl(safeText, {
      lang: langCode,
      slow: false,
      host: 'https://translate.google.com',
    });
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Google TTS returned status ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.error('Error generating TTS:', err);
    return null;
  }
}
