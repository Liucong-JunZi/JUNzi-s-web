import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { FileText, Briefcase, User } from 'lucide-react';

export function Home() {
  const { t } = useTranslation();

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Hero Section */}
      <section className="text-center mb-16">
        <h1 className="text-4xl md:text-6xl font-bold mb-6">
          {t('home.welcome')}
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          {t('home.heroDescription')}
        </p>
        <div className="flex justify-center gap-4">
          <Button asChild size="lg" data-testid="home-blog-cta">
            <Link to="/blog">{t('home.readBlog')}</Link>
          </Button>
          <Button asChild variant="outline" size="lg" data-testid="home-portfolio-cta">
            <Link to="/portfolio">{t('home.viewPortfolio')}</Link>
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <FileText className="h-12 w-12 mb-4 text-primary" />
            <CardTitle>{t('home.blogTitle')}</CardTitle>
            <CardDescription>
              {t('home.blogDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="ghost" className="w-full">
              <Link to="/blog">{t('home.readArticles')}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <Briefcase className="h-12 w-12 mb-4 text-primary" />
            <CardTitle>{t('home.portfolioTitle')}</CardTitle>
            <CardDescription>
              {t('home.portfolioDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="ghost" className="w-full">
              <Link to="/portfolio">{t('home.viewProjects')}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <User className="h-12 w-12 mb-4 text-primary" />
            <CardTitle>{t('home.resumeTitle')}</CardTitle>
            <CardDescription>
              {t('home.resumeDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="ghost" className="w-full" data-testid="home-resume-cta">
              <Link to="/resume">{t('home.viewResume')}</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* About Section */}
      <section className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl font-bold mb-6">{t('home.aboutTitle')}</h2>
        <p className="text-muted-foreground mb-4">
          {t('home.aboutDescription1')}
        </p>
        <p className="text-muted-foreground">
          {t('home.aboutDescription2')}
        </p>
      </section>
    </div>
  );
}