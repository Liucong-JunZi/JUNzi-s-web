import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { commentsAPI } from '../../api';
import type { Comment } from '../../types';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Trash2, MessageCircle } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';

export function AdminComments() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchComments();
  }, []);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const response = await commentsAPI.getAll();
      setComments(response.comments || []);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
      toast({
        title: 'Error',
        description: 'Failed to load comments',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this comment?')) {
      return;
    }

    try {
      await commentsAPI.delete(id);
      setComments(comments.filter((c) => c.id !== id));
      toast({
        title: 'Success',
        description: 'Comment deleted successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete comment',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getAuthorDisplay = (comment: Comment) => {
    if (comment.author) {
      return comment.author.username;
    }
    return comment.authorName || 'Anonymous';
  };

  const getAuthorEmail = (comment: Comment) => {
    if (comment.author) {
      return comment.author.email;
    }
    return comment.authorEmail || '';
  };

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Manage Comments</h1>
          <p className="text-muted-foreground">Review and moderate comments</p>
        </div>
      </div>

      {/* Comments List */}
      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : comments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No comments yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <Card key={comment.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-lg">{getAuthorDisplay(comment)}</CardTitle>
                      {getAuthorEmail(comment) && (
                        <Badge variant="outline">{getAuthorEmail(comment)}</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(comment.createdAt)}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(comment.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{comment.content}</p>
                {(comment.postSlug || comment.postId) && (
                  <div className="mt-4 text-sm text-muted-foreground">
                    <Link
                      to={`/blog/${comment.postSlug || comment.postId}`}
                      className="text-primary hover:underline"
                    >
                      View Post
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}