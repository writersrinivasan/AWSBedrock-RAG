import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bedrock RAG Lab",
  description: "Hands-on, credit-free sandbox for Retrieval-Augmented Generation with Amazon Bedrock Knowledge Bases, orchestrated by LangGraph.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
