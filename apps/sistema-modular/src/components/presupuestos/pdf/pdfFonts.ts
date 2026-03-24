import { Font } from '@react-pdf/renderer';

import InterRegular from '../../../assets/fonts/Inter-Regular.ttf';
import InterSemiBold from '../../../assets/fonts/Inter-SemiBold.ttf';
import InterBold from '../../../assets/fonts/Inter-Bold.ttf';

export function registerFonts() {
  Font.register({
    family: 'Inter',
    fonts: [
      { src: InterRegular, fontWeight: 'normal' },
      { src: InterRegular, fontWeight: 'normal', fontStyle: 'italic' },
      { src: InterSemiBold, fontWeight: 600 },
      { src: InterBold, fontWeight: 'bold' },
    ],
  });

  Font.registerHyphenationCallback((word: string) => [word]);
}

registerFonts();
