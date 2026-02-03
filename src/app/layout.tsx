import "./globals.css";

export const metadata = {
  title: "Token Calculator",
  description: "Offline token count + cost estimate (OpenAI / Claude / Gemini / OpenRouter)",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
