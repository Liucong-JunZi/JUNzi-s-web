import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { AsciiPetersenBackground } from './AsciiPetersenBackground';

export function Layout() {
  return (
    <div className="relative isolate flex min-h-screen flex-col">
      <AsciiPetersenBackground />
      <Header />
      <main className="relative z-10 flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}