import React, { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, Send, Search, Home, PlusSquare, User, ArrowLeft, ChevronLeft, ChevronRight, LogOut, Camera } from 'lucide-react';

const SUPABASE_URL = 'https://emcnnvxvwmkmuudxbtqp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtY25udnh2d21rbXV1ZHhidHFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5ODQ3MDMsImV4cCI6MjA3ODU2MDcwM30.Xgqc7YysiTtQVSqIINaZXqEmANjqn4YWP83sgqTQbZg';

class SupabaseClient {
  constructor(url, key) {
    this.url = url;
    this.key = key;
    this.token = localStorage.getItem('supabase_token');
    const userStr = localStorage.getItem('supabase_user');
    this.user = userStr ? JSON.parse(userStr) : null;
  }

  async request(endpoint, options = {}) {
    this.token = localStorage.getItem('supabase_token');
    const headers = {
      'Content-Type': 'application/json',
      'apikey': this.key,
      ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
      ...options.headers
    };
    const response = await fetch(`${this.url}${endpoint}`, { ...options, headers });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Request failed');
    }
    return response.json();
  }

  async signUp(email, password, username) {
    const data = await this.request('/auth/v1/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, data: { username } })
    });
    if (data.access_token) {
      this.token = data.access_token;
      this.user = data.user;
      localStorage.setItem('supabase_token', this.token);
      localStorage.setItem('supabase_user', JSON.stringify(this.user));
    }
    return data;
  }

  async signIn(email, password) {
    const data = await this.request('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (data.access_token) {
      this.token = data.access_token;
      this.user = data.user;
      localStorage.setItem('supabase_token', this.token);
      localStorage.setItem('supabase_user', JSON.stringify(this.user));
    }
    return data;
  }

  signOut() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('supabase_token');
    localStorage.removeItem('supabase_user');
  }

  async select(table, query = '') {
    return this.request(`/rest/v1/${table}?${query}`, {
      headers: { 'Prefer': 'return=representation' }
    });
  }

  async insert(table, data) {
    return this.request(`/rest/v1/${table}`, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Prefer': 'return=representation' }
    });
  }

  async delete(table, id) {
    return this.request(`/rest/v1/${table}?id=eq.${id}`, { method: 'DELETE' });
  }

  async uploadFile(bucket, path, file) {
    this.token = localStorage.getItem('supabase_token');
    const response = await fetch(`${this.url}/storage/v1/object/${bucket}/${path}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.token}`, 'apikey': this.key },
      body: file
    });
    if (!response.ok) throw new Error('Upload failed');
    return response.json();
  }

  getPublicUrl(bucket, path) {
    return `${this.url}/storage/v1/object/public/${bucket}/${path}`;
  }
}

const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(!!supabase.user);
  const [currentView, setCurrentView] = useState('feed');
  const [moments, setMoments] = useState([]);
  const [users, setUsers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMoment, setNewMoment] = useState({ caption: '', images: [], previews: [] });
  const [currentMomentIndex, setCurrentMomentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [likes, setLikes] = useState([]);
  const [comments, setComments] = useState([]);
  const [authMode, setAuthMode] = useState('signin');
  const [authForm, setAuthForm] = useState({ email: '', password: '', username: '' });

  useEffect(() => {
    if (isAuthenticated) loadData();
  }, [isAuthenticated]);

  const loadData = async () => {
    try {
      setLoading(true);
      if (!supabase.user?.id) {
        setLoading(false);
        return;
      }
      const usersData = await supabase.select('profiles', 'select=*');
      setUsers(usersData);
      const followingData = await supabase.select('follows', `follower_id=eq.${supabase.user.id}`);
      setFollowing(followingData);
      const followedIds = followingData.map(f => f.following_id);
      const allUserIds = [...followedIds, supabase.user.id].join(',');
      if (allUserIds) {
        const momentsData = await supabase.select('moments', `user_id=in.(${allUserIds})&order=created_at.desc`);
        setMoments(momentsData);
      }
      const likesData = await supabase.select('likes', 'select=*');
      setLikes(likesData);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async () => {
    try {
      setLoading(true);
      setError(null);
      if (authMode === 'signup') {
        const authData = await supabase.signUp(authForm.email, authForm.password, authForm.username);
        await new Promise(resolve => setTimeout(resolve, 500));
        if (authData.user) {
          await supabase.insert('profiles', {
            id: authData.user.id,
            username: authForm.username,
            email: authForm.email
          });
        }
      } else {
        await supabase.signIn(authForm.email, authForm.password);
      }
      setIsAuthenticated(true);
      setAuthForm({ email: '', password: '', username: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    supabase.signOut();
    setIsAuthenticated(false);
    setCurrentView('feed');
  };

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      const previews = files.map(file => URL.createObjectURL(file));
      setNewMoment({ ...newMoment, images: files, previews: previews });
    }
  };

  const handlePostMoment = async () => {
    if (!newMoment.caption.trim() || newMoment.images.length === 0) return;
    try {
      setLoading(true);
      const imageUrls = [];
      for (const image of newMoment.images) {
        const fileName = `${Date.now()}_${Math.random()}_${image.name}`;
        await supabase.uploadFile('Moments', fileName, image);
        const imageUrl = supabase.getPublicUrl('Moments', fileName);
        imageUrls.push(imageUrl);
      }
      await supabase.insert('moments', {
        user_id: supabase.user.id,
        image_url: JSON.stringify(imageUrls),
        caption: newMoment.caption
      });
      await loadData();
      setNewMoment({ caption: '', images: [], previews: [] });
      setCurrentView('feed');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleFollow = async (userId) => {
    try {
      const isFollowing = following.some(f => f.following_id === userId);
      if (isFollowing) {
        const followRecord = following.find(f => f.following_id === userId);
        await supabase.delete('follows', followRecord.id);
      } else {
        await supabase.insert('follows', {
          follower_id: supabase.user.id,
          following_id: userId
        });
      }
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleLike = async (momentId) => {
    try {
      const userLike = likes.find(l => l.user_id === supabase.user.id && l.moment_id === momentId);
      if (userLike) {
        await supabase.delete('likes', userLike.id);
        setLikes(likes.filter(l => l.id !== userLike.id));
      } else {
        const newLike = await supabase.insert('likes', {
          user_id: supabase.user.id,
          moment_id: momentId
        });
        if (newLike && newLike.length > 0) setLikes([...likes, newLike[0]]);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const loadComments = async (momentId) => {
    try {
      const commentsData = await supabase.select('comments', `moment_id=eq.${momentId}&order=created_at.asc`);
      setComments(commentsData);
    } catch (err) {
      console.error('Error loading comments:', err);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto bg-white min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <h1 className="text-4xl font-light mb-2 text-center">Moments</h1>
          <p className="text-sm text-gray-500 mb-8 text-center">Share life with close friends</p>
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}
          <div className="space-y-4">
            {authMode === 'signup' && (
              <input type="text" placeholder="Username" value={authForm.username}
                onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-400" />
            )}
            <input type="email" placeholder="Email" value={authForm.email}
              onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-400" />
            <input type="password" placeholder="Password" value={authForm.password}
              onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-400" />
            <button onClick={handleAuth} disabled={loading}
              className="w-full bg-black text-white py-3 rounded-lg hover:bg-gray-800 disabled:opacity-50">
              {loading ? 'Loading...' : authMode === 'signup' ? 'Sign Up' : 'Sign In'}
            </button>
          </div>
          <button onClick={() => setAuthMode(authMode === 'signup' ? 'signin' : 'signup')}
            className="w-full mt-4 text-sm text-gray-600 hover:text-black">
            {authMode === 'signup' ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
          </button>
        </div>
      </div>
    );
  }

  const followingUserIds = following.map(f => f.following_id);
  const feedMoments = moments.filter(m => followingUserIds.includes(m.user_id))
    .map(moment => ({ ...moment, user: users.find(u => u.id === moment.user_id) }))
    .filter(m => m.user);

  const NavBar = () => (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around py-3">
      <button onClick={() => setCurrentView('feed')} className={`p-2 ${currentView === 'feed' ? 'text-black' : 'text-gray-400'}`}>
        <Home size={28} />
      </button>
      <button onClick={() => setCurrentView('search')} className={`p-2 ${currentView === 'search' ? 'text-black' : 'text-gray-400'}`}>
        <Search size={28} />
      </button>
      <button onClick={() => setCurrentView('post')} className={`p-2 ${currentView === 'post' ? 'text-black' : 'text-gray-400'}`}>
        <PlusSquare size={28} />
      </button>
      <button onClick={() => setCurrentView('profile')} className={`p-2 ${currentView === 'profile' ? 'text-black' : 'text-gray-400'}`}>
        <User size={28} />
      </button>
    </div>
  );

  const FeedView = () => (
    <div className="pb-20">
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10 flex justify-between items-center">
        <h1 className="text-2xl font-light">Moments</h1>
        <button onClick={handleSignOut} className="text-gray-600 hover:text-black"><LogOut size={20} /></button>
      </div>
      {loading ? <div className="p-8 text-center text-gray-500">Loading...</div> :
       feedMoments.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <p className="mb-2">No moments yet</p>
          <p className="text-sm">Follow friends to see their moments</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 p-4">
            {feedMoments.map(moment => {
              let imageUrl;
              try {
                const parsed = JSON.parse(moment.image_url);
                imageUrl = Array.isArray(parsed) ? parsed[0] : parsed;
              } catch {
                imageUrl = moment.image_url;
              }
              return (
                <button key={moment.id}
                  onClick={() => {
                    setSelectedUserId(moment.user_id);
                    setCurrentView('album');
                    const userMoments = moments.filter(m => m.user_id === moment.user_id);
                    const index = userMoments.findIndex(m => m.id === moment.id);
                    setCurrentMomentIndex(index >= 0 ? index : 0);
                  }}
                  className="aspect-square bg-gray-50 rounded-2xl overflow-hidden hover:opacity-80 transition-opacity">
                  <div className="h-full flex flex-col">
                    <div className="flex-1 overflow-hidden">
                      <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="bg-white p-3 border-t border-gray-100">
                      <p className="text-sm font-medium truncate">{moment.user.username}</p>
                      <p className="text-xs text-gray-500">{new Date(moment.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="text-center py-6 text-sm text-gray-400">You're all caught up! ✨</div>
        </>
      )}
    </div>
  );

  const AlbumView = () => {
    const userMoments = moments.filter(m => m.user_id === selectedUserId);
    const currentMoment = userMoments[currentMomentIndex];
    const momentUser = users.find(u => u.id === selectedUserId);
    const commentInputRef = useRef(null);
    let imageUrls = [];
    if (currentMoment) {
      try {
        const parsed = JSON.parse(currentMoment.image_url);
        imageUrls = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        imageUrls = [currentMoment.image_url];
      }
    }
    const isLiked = currentMoment && likes.some(l => l.user_id === supabase.user.id && l.moment_id === currentMoment.id);
    const likeCount = currentMoment ? likes.filter(l => l.moment_id === currentMoment.id).length : 0;

    React.useEffect(() => {
      if (currentMoment) loadComments(currentMoment.id);
    }, [currentMoment?.id]);

    const handleAddCommentFromRef = async () => {
      const commentText = commentInputRef.current?.textContent || '';
      if (commentText.trim() && currentMoment) {
        try {
          await supabase.insert('comments', {
            moment_id: currentMoment.id,
            user_id: supabase.user.id,
            text: commentText.trim()
          });
          await loadComments(currentMoment.id);
          if (commentInputRef.current) commentInputRef.current.textContent = '';
        } catch (err) {
          setError(err.message);
        }
      }
    };

    return (
      <div className="min-h-screen bg-white pb-20">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
          <div className="flex items-center justify-between max-w-lg mx-auto">
            <button onClick={() => setCurrentView('feed')} className="text-gray-600"><ArrowLeft size={24} /></button>
            <div className="text-center">
              <p className="text-sm font-medium">{momentUser?.username}</p>
              <p className="text-xs text-gray-500">{currentMomentIndex + 1} of {userMoments.length}</p>
            </div>
            <div className="w-6"></div>
          </div>
        </div>
        <div className="max-w-lg mx-auto" style={{
          backgroundColor: '#fff',
          WebkitOverflowScrolling: 'touch',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
          perspective: 1000
        }}>
          {imageUrls.map((imageUrl, imgIndex) => (
            <div key={`moment-${currentMoment?.id}-img-${imgIndex}`} style={{ width: '100%', overflow: 'hidden' }}>
              <img src={imageUrl} alt="" style={{
                width: '100%',
                height: 'auto',
                display: 'block',
                transform: 'translateZ(0)',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                willChange: 'transform'
              }} />
            </div>
          ))}
          <div className="p-6" style={{ transform: 'translateZ(0)' }}>
            <div className="flex gap-4 mb-4">
              <button onClick={() => toggleLike(currentMoment?.id)} className="flex items-center gap-2 hover:opacity-70">
                <Heart size={24} fill={isLiked ? 'black' : 'none'} stroke="black" />
                {likeCount > 0 && <span className="text-sm">{likeCount}</span>}
              </button>
              <button className="flex items-center gap-2 hover:opacity-70">
                <MessageCircle size={24} stroke="black" />
                {comments.length > 0 && <span className="text-sm">{comments.length}</span>}
              </button>
            </div>
            <p className="text-base mb-2">
              <span className="font-medium mr-2">{momentUser?.username}</span>
              {currentMoment?.caption}
            </p>
            <p className="text-xs text-gray-500 mb-6">{new Date(currentMoment?.created_at).toLocaleString()}</p>
            <div className="border-t pt-6">
              <h3 className="font-medium text-lg mb-4">Comments</h3>
              <div className="space-y-3 mb-6">
                {comments.map(comment => {
                  const commentUser = users.find(u => u.id === comment.user_id);
                  return (
                    <div key={comment.id} className="bg-gray-50 p-3 rounded-lg">
                      <span className="font-medium text-sm mr-2">{commentUser?.username || 'Unknown'}</span>
                      <span className="text-sm">{comment.text}</span>
                    </div>
                  );
                })}
                {comments.length === 0 && <p className="text-gray-400 text-center py-6 text-sm">No comments yet</p>}
              </div>
              <div className="space-y-3">
                <div ref={commentInputRef} contentEditable suppressContentEditableWarning
                  className="w-full px-4 py-3 border
