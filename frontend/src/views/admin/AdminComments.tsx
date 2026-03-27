import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { commentsAPI } from '../../api';
import type { Comment } from '../../types';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Trash2, MessageCircle, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';

const PAGE_SIZE = 20;

export function AdminComments() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    fetchComments(page);
  }, [page]);

  const fetchComments = async (page: number) => {
    setLoading(true);
    try {
      const response = await commentsAPI.getAll({ page, page_size: PAGE_SIZE });
      setComments(response.comments || []);
      setTotal(response.total || 0);
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
      const remaining = comments.filter((c) => c.id !== id);
      setComments(remaining);
      setTotal((t) => t - 1);
      if (remaining.length === 0 && page > 1) {
        setPage((p) => p - 1); // triggers refetch via useEffect
      }
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

  const handleUpdateStatus = async (id: number, status: 'approved' | 'rejected') => {
    try {
      const updated = await commentsAPI.updateStatus(id, status);
      setComments((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: updated.status || status } : c))
      );
      toast({
        title: 'Success',
        description: `Comment ${status}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to ${status === 'approved' ? 'approve' : 'reject'} comment`,
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
    return comment.author_name || 'Anonymous';
  };

  const getAuthorEmail = (comment: Comment) => {
    if (comment.author) {
      return comment.author.email;
    }
    return comment.author_email || '';
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
                      <Badge
                        variant={
                          comment.status === 'approved'
                            ? 'default'
                            : comment.status === 'rejected'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {comment.status === 'approved'
                          ? 'Approved'
                          : comment.status === 'rejected'
                          ? 'Rejected'
                          : 'Pending'}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(comment.created_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {comment.status !== 'approved' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Approve"
                        onClick={() => handleUpdateStatus(comment.id, 'approved')}
                      >
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </Button>
                    )}
                    {comment.status !== 'rejected' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Reject"
                        onClick={() => handleUpdateStatus(comment.id, 'rejected')}
                      >
                        <XCircle className="h-4 w-4 text-orange-500" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(comment.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{comment.content}</p>
                {(comment.post?.slug || comment.post_slug) && (
                  <div className="mt-4 text-sm text-muted-foreground">
                    <Link
                      to={`/blog/${comment.post?.slug || comment.post_slug}`}
                      className="text-primary hover:underline"
                    >
                      View Post
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <Button
                variant="outline"
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {Math.ceil(total / PAGE_SIZE)}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= Math.ceil(total / PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}