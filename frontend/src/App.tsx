import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Home } from './views/Home';
import { Blog } from './views/Blog';
import { BlogPost } from './views/BlogPost';
import { Portfolio } from './views/Portfolio';
import { PortfolioDetail } from './views/PortfolioDetail';
import { Resume } from './views/Resume';
import { Login } from './views/Login';
import { NotFound } from './views/NotFound';
import { AdminDashboard } from './views/admin/Dashboard';
import { AdminPosts } from './views/admin/AdminPosts';
import { PostEditor } from './views/admin/PostEditor';
import { AdminProjects } from './views/admin/AdminProjects';
import { AdminResume } from './views/admin/AdminResume';
import { Toaster } from './components/ui/toaster';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          {/* Public Routes */}
          <Route index element={<Home />} />
          <Route path="blog" element={<Blog />} />
          <Route path="blog/:slug" element={<BlogPost />} />
          <Route path="portfolio" element={<Portfolio />} />
          <Route path="portfolio/:slug" element={<PortfolioDetail />} />
          <Route path="resume" element={<Resume />} />
          <Route path="login" element={<Login />} />

          {/* Admin Routes */}
          <Route
            path="admin"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/posts"
            element={
              <ProtectedRoute>
                <AdminPosts />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/posts/new"
            element={
              <ProtectedRoute>
                <PostEditor />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/posts/:id"
            element={
              <ProtectedRoute>
                <PostEditor />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/projects"
            element={
              <ProtectedRoute>
                <AdminProjects />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/resume"
            element={
              <ProtectedRoute>
                <AdminResume />
              </ProtectedRoute>
            }
          />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      <Toaster />
    </Router>
  );
}

export default App;