import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { FileText, Briefcase, User } from 'lucide-react';

export function Home() {
  return (
    <div className="container mx-auto px-4 py-12">
      {/* Hero Section */}
      <section className="text-center mb-16">
        <h1 className="text-4xl md:text-6xl font-bold mb-6">
          Welcome to <span className="text-primary">JUNzi</span>
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          A personal website featuring blog posts, portfolio projects, and professional resume.
          Built with React, TypeScript, and modern web technologies.
        </p>
        <div className="flex justify-center gap-4">
          <Button asChild size="lg" data-testid="home-blog-cta">
            <Link to="/blog">Read Blog</Link>
          </Button>
          <Button asChild variant="outline" size="lg" data-testid="home-portfolio-cta">
            <Link to="/portfolio">View Portfolio</Link>
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <FileText className="h-12 w-12 mb-4 text-primary" />
            <CardTitle>Blog</CardTitle>
            <CardDescription>
              Technical articles, tutorials, and thoughts on software development.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="ghost" className="w-full">
              <Link to="/blog">Read Articles</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <Briefcase className="h-12 w-12 mb-4 text-primary" />
            <CardTitle>Portfolio</CardTitle>
            <CardDescription>
              Showcase of projects and applications I've built and contributed to.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="ghost" className="w-full">
              <Link to="/portfolio">View Projects</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <User className="h-12 w-12 mb-4 text-primary" />
            <CardTitle>Resume</CardTitle>
            <CardDescription>
              Professional experience, skills, and educational background.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="ghost" className="w-full" data-testid="home-resume-cta">
              <Link to="/resume">View Resume</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* About Section */}
      <section className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl font-bold mb-6">About This Site</h2>
        <p className="text-muted-foreground mb-4">
          This is a personal website built with modern web technologies including React 18,
          TypeScript, Vite, Tailwind CSS, and shadcn/ui components on the frontend, paired with
          a Go backend using the Gin framework.
        </p>
        <p className="text-muted-foreground">
          The site features a full-featured blog with markdown support, project portfolio,
          resume section, comment system, admin dashboard, and GitHub OAuth authentication.
        </p>
      </section>
    </div>
  );
}