import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { postsAPI, commentsAPI } from '../api';
import type { Post, Comment as CommentType } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Textarea } from '../components/ui/textarea';
import { Calendar, Clock, Heart, MessageCircle, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../hooks/use-toast';

export function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<CommentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const { isAuthenticated } = useAuthStore();
  const { toast } = useToast();

  useEffect(() => {
    if (slug) {
      fetchPost();
      fetchComments();
    }
  }, [slug]);

  const fetchPost = async () => {
    setLoading(true);
    try {
      const data = await postsAPI.getBySlug(slug!);
      setPost(data);
    } catch (error) {
      console.error('Failed to fetch post:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const data = await commentsAPI.getByPostId(Number(slug));
      setComments(data);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    }
  };

  const handleLike = async () => {
    if (!post) return;
    try {
      const result = await postsAPI.like(post.id);
      setPost({ ...post, likeCount: result.likeCount });
      toast({
        title: 'Success',
        description: 'You liked this post!',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to like post',
        variant: 'destructive',
      });
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!post || !commentText.trim()) return;

    try {
      await commentsAPI.create(post.id, { content: commentText });
      setCommentText('');
      fetchComments();
      toast({
        title: 'Success',
        description: 'Comment added successfully!',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add comment',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Post not found</h1>
          <Button asChild>
            <Link to="/blog">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Blog
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Back Button */}
      <Button variant="ghost" asChild className="mb-6">
        <Link to="/blog">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Blog
        </Link>
      </Button>

      {/* Post Header */}
      <article className="max-w-4xl mx-auto mb-12">
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-muted-foreground mb-4">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(post.createdAt)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{Math.ceil(post.content.length / 200)} min read</span>
            </div>
            <div className="flex items-center gap-1">
              <span>{post.viewCount} views</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <Link key={tag.id} to={`/blog?tag=${tag.slug}`}>
                <Badge variant="secondary" className="hover:bg-secondary/80">
                  {tag.name}
                </Badge>
              </Link>
            ))}
          </div>
        </header>

        {/* Cover Image */}
        {post.coverImage && (
          <img
            src={post.coverImage}
            alt={post.title}
            className="w-full h-[400px] object-cover rounded-lg mb-8"
          />
        )}

        {/* Post Content */}
        <div className="prose prose-neutral dark:prose-invert max-w-none mb-8">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4 py-4 border-t">
          <Button variant="outline" onClick={handleLike}>
            <Heart className="mr-2 h-4 w-4" />
            Like ({post.likeCount})
          </Button>
          <div className="flex items-center text-muted-foreground">
            <MessageCircle className="mr-2 h-4 w-4" />
            {comments.length} Comments
          </div>
        </div>
      </article>

      {/* Comments Section */}
      <section className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Comments ({comments.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Comment Form */}
            {isAuthenticated ? (
              <form onSubmit={handleSubmitComment} className="space-y-4">
                <Textarea
                  placeholder="Write a comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={4}
                />
                <Button type="submit" disabled={!commentText.trim()}>
                  Post Comment
                </Button>
              </form>
            ) : (
              <p className="text-muted-foreground">
                Please{' '}
                <Link to="/login" className="text-primary hover:underline">
                  login
                </Link>{' '}
                to comment.
              </p>
            )}

            {/* Comments List */}
            <div className="space-y-4 pt-4 border-t">
              {comments.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No comments yet. Be the first to comment!
                </p>
              ) : (
                comments.map((comment) => (
                  <CommentItem key={comment.id} comment={comment} />
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function CommentItem({ comment }: { comment: CommentType }) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="font-semibold">{comment.author.username}</div>
        <div className="text-sm text-muted-foreground">{formatDate(comment.createdAt)}</div>
      </div>
      <p className="text-sm">{comment.content}</p>
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-4 ml-6 space-y-3">
          {comment.replies.map((reply) => (
            <CommentItem key={reply.id} comment={reply} />
          ))}
        </div>
      )}
    </div>
  );
}