import './globals.css';
import Providers from './components/Providers';

export const metadata = {
  title: 'CaseCoach AI',
  description: 'AI-powered case coaching with structured executive hierarchy',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
