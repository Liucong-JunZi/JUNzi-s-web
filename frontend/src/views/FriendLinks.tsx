import { useTranslation } from 'react-i18next';
import { ExternalLink, Link2, Rss } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { friendLinks, isSafeFriendUrl } from '../data/friendLinks';

export function FriendLinks() {
  const { t } = useTranslation();
  const links = friendLinks.filter((link) => isSafeFriendUrl(link.url));

  return (
    <div className="container mx-auto px-4 py-12" data-testid="friend-links-page" data-display-headings>
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold mb-4">{t('friends.title')}</h1>
        <p className="text-muted-foreground">{t('friends.description')}</p>
      </header>

      {links.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground" data-testid="friend-links-empty">
          <Link2 className="mx-auto mb-4 h-10 w-10" aria-hidden="true" />
          <p>{t('friends.empty')}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {links.map((link) => (
            <li key={link.url}>
              <Card className="h-full transition-shadow hover:shadow-lg">
                <CardContent className="p-6">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 rounded-md hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Avatar className="h-14 w-14 shrink-0">
                      <AvatarImage
                        src={link.avatarUrl && isSafeFriendUrl(link.avatarUrl) ? link.avatarUrl : undefined}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                      <AvatarFallback>{link.name.slice(0, 1).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <h2 className="min-w-0 break-words text-lg font-semibold">{link.name}</h2>
                    <ExternalLink className="ml-auto h-4 w-4 shrink-0" aria-hidden="true" />
                  </a>
                  <p className="mt-4 break-words text-sm text-muted-foreground">{link.description}</p>
                  {link.rssUrl && isSafeFriendUrl(link.rssUrl) && (
                    <Button asChild variant="outline" size="sm" className="mt-5">
                      <a href={link.rssUrl} target="_blank" rel="noopener noreferrer" aria-label={t('friends.rssLabel', { name: link.name })}>
                        <Rss className="mr-2 h-4 w-4" aria-hidden="true" />
                        {t('friends.rss')}
                      </a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
