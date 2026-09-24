import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "JobPilot",
  description: "Local application preparation and tracking",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><a className="skip-link" href="#main-content">Skip to content</a><header className="site-header"><nav className="nav-shell" aria-label="Main navigation"><Link className="brand" href="/" aria-label="JobPilot home"><span className="brand-mark" aria-hidden="true">J</span><span>JobPilot</span></Link><div className="nav-links"><Link href="/">Pipeline</Link><Link href="/jobs/new">Add job</Link><Link href="/profile">Profile</Link></div></nav></header><div id="main-content" tabIndex={-1}>{children}</div><footer className="site-footer"><span>JobPilot · local application review</span><span>Always review AI drafts before use.</span></footer></body>
    </html>
  );
}
