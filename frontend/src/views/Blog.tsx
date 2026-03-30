import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../i18n';
import { postsAPI } from '../api';
import type { Post } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Search, Calendar } from 'lucide-react';

export function Blog() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const limit = 10;

  const tag = searchParams.get('tag') || undefined;

  useEffect(() => {
    fetchPosts();
  }, [page, tag]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const response = await postsAPI.getAll({
        page,
        limit,
        tag,
        search: searchQuery || undefined,
      });
      setPosts(response.posts);
      setTotal(response.total);
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchPosts();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="container mx-auto px-4 py-12" data-testid="blog-page">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">{t('blog.title')}</h1>
        <p className="text-muted-foreground">
          {t('blog.description')}
        </p>
      </div>

      {/* Search and Filter */}
      <div className="mb-8 flex flex-col md:flex-row gap-4">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t('blog.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="blog-search-input"
            />
          </div>
          <Button type="submit" data-testid="blog-search-btn">{t('blog.searchBtn')}</Button>
        </form>
        {tag && (
          <Button
            variant="outline"
            onClick={() => {
              setSearchParams({});
              setSearchQuery('');
            }}
            data-testid="clear-filter-btn"
          >
            {t('blog.clearFilter')}: {tag}
          </Button>
        )}
      </div>

      {/* Posts Grid */}
      {loading ? (
        <div className="text-center py-12">{t('common.loading')}</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">{t('blog.noPostsFound')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {posts.map((post) => (
            <Link key={post.id} to={`/blog/${post.slug}`} data-testid="post-card">
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                {post.cover_image && (
                  <img
                    src={post.cover_image}
                    alt={post.title}
                    className="w-full h-48 object-cover rounded-t-lg"
                  />
                )}
                <CardHeader>
                  <CardTitle className="line-clamp-2">{post.title}</CardTitle>
                  <CardDescription className="line-clamp-3">
                    {post.summary || post.content.substring(0, 150)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {post.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag.id} variant="secondary">
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(post.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span>{post.view_count} {t('common.views')}</span>
                      <span>{post.like_count} {t('common.likes')}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            data-testid="pagination-prev"
          >
            {t('common.previous')}
          </Button>
          <div className="flex items-center px-4">
            {t('blog.pageOf', { page, total: totalPages })}
          </div>
          <Button
            variant="outline"
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
            data-testid="pagination-next"
          >
            {t('common.next')}
          </Button>
        </div>
      )}
    </div>
  );
}