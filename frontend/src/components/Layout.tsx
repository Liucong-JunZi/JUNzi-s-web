import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { PetersenBackground } from './PetersenBackground';

export function Layout() {
  return (
    <div className="relative isolate flex min-h-screen flex-col">
      <PetersenBackground />
      <Header />
      <main className="relative z-10 flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}