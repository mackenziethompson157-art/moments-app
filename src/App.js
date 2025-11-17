import React, { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, Send, Search, Home, PlusSquare, User, ArrowLeft, ChevronLeft, ChevronRight, LogOut, Camera } from 'lucide-react';

// Supabase client setup
const SUPABASE_URL = 'https://emcnnvxvwmkmuudxbtqp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtY25udnh2d21rbXV1ZHhidHFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5ODQ3MDMsImV4cCI6MjA3ODU2MDcwM30.Xgqc7YysiTtQVSqIINaZXqEmANjqn4YWP83sgqTQbZg';

// Simple Supabase client
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

    const response = await fetch(`${this.url}${endpoint}`, {
      ...options,
      headers
    });

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

  async update(table, id, data) {
    return this.request(`/rest/v1/${table}?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      headers: { 'Prefer': 'return=representation' }
    });
  }

  async delete(table, id) {
    return this.request(`/rest/v1/${table}?id=eq.${id}`, {
      method: 'DELETE'
    });
  }

  async uploadFile(bucket, path, file) {
    this.token = localStorage.getItem('supabase_token');
    
    const response = await fetch(`${this.url}/storage/v1/object/${bucket}/${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'apikey': this.key
      },
      body: file
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Upload error:', error);
      throw new Error('Upload failed: ' + error);
    }

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
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      if (!supabase.user || !supabase.user.id) {
        console.log('No authenticated user found');
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
      console.error('Error loading data:', err);
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
      setNewMoment({
        ...newMoment,
        images: files,
        previews: previews
      });
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
        if (newLike && newLike.length > 0) {
          setLikes([...likes, newLike[0]]);
        }
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
          
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {authMode === 'signup' && (
              <input
                type="text"
                placeholder="Username"
                value={authForm.username}
                onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-400"
              />
            )}
            
            <input
              type="email"
              placeholder="Email"
              value={authForm.email}
              onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-400"
            />
            
            <input
              type="password"
              placeholder="Password"
              value={authForm.password}
              onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-400"
            />
            
            <button
              onClick={handleAuth}
              disabled={loading}
              className="w-full bg-black text-white py-3 rounded-lg hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? 'Loading...' : authMode === 'signup' ? 'Sign Up' : 'Sign In'}
            </button>
          </div>

          <button
            onClick={() => setAuthMode(authMode === 'signup' ? 'signin' : 'signup')}
            className="w-full mt-4 text-sm text-gray-600 hover:text-black"
          >
            {authMode === 'signup' ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
          </button>
        </div>
      </div>
    );
  }

  const followingUserIds = following.map(f => f.following_id);
  const feedMoments = moments
    .filter(m => followingUserIds.includes(m.user_id))
    .map(moment => {
      const user = users.find(u => u.id === moment.user_id);
      return { ...moment, user };
    })
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
        <button onClick={handleSignOut} className="text-gray-600 hover:text-black">
          <LogOut size={20} />
        </button>
      </div>
      
      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading...</div>
      ) : feedMoments.length === 0 ? (
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
                <button
                  key={moment.id}
                  onClick={() => {
                    setSelectedUserId(moment.user_id);
                    setCurrentView('album');
                    const userMoments = moments.filter(m => m.user_id === moment.user_id);
                    const index = userMoments.findIndex(m => m.id === moment.id);
                    setCurrentMomentIndex(index >= 0 ? index : 0);
                  }}
                  className="aspect-square bg-gray-50 rounded-2xl overflow-hidden hover:opacity-80 transition-opacity"
                >
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
          <div className="text-center py-6 text-sm text-gray-400">
            You're all caught up! ✨
          </div>
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

    const isLiked = currentMoment && likes.some(l => 
      l.user_id === supabase.user.id && l.moment_id === currentMoment.id
    );
    
    const likeCount = currentMoment ? likes.filter(l => l.moment_id === currentMoment.id).length : 0;

    React.useEffect(() => {
      if (currentMoment) {
        loadComments(currentMoment.id);
      }
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
          if (commentInputRef.current) {
            commentInputRef.current.textContent = '';
          }
        } catch (err) {
          setError(err.message);
        }
      }
    };

    return (
      <div className="min-h-screen bg-white pb-20">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
          <div className="flex items-center justify-between max-w-lg mx-auto">
            <button 
              onClick={() => setCurrentView('feed')} 
              className="text-gray-600"
            >
              <ArrowLeft size={24} />
            </button>
            <div className="text-center">
              <p className="text-sm font-medium">{momentUser?.username}</p>
              <p className="text-xs text-gray-500">
                {currentMomentIndex + 1} of {userMoments.length}
              </p>
            </div>
            <div className="w-6"></div>
          </div>
        </div>

        <div className="max-w-lg mx-auto">
          {imageUrls.map((imageUrl, imgIndex) => (
            <img 
              key={imgIndex}
              src={imageUrl} 
              alt="" 
              className="w-full"
            />
          ))}
          
          <div className="p-6">
            <div className="flex gap-4 mb-4">
              <button 
                onClick={() => toggleLike(currentMoment?.id)} 
                className="flex items-center gap-2 hover:opacity-70"
              >
                <Heart 
                  size={24} 
                  fill={isLiked ? 'white' : 'none'} 
                  stroke="white"
                  className="text-white"
                />
                {likeCount > 0 && <span className="text-sm text-white">{likeCount}</span>}
              </button>
              <button className="flex items-center gap-2 hover:opacity-70">
                <MessageCircle size={24} stroke="white" className="text-white" />
                {comments.length > 0 && <span className="text-sm text-white">{comments.length}</span>}
              </button>
            </div>
            
            <p className="text-base mb-2">
              <span className="font-medium mr-2">{momentUser?.username}</span>
              {currentMoment?.caption}
            </p>
            <p className="text-xs text-gray-500 mb-6">
              {new Date(currentMoment?.created_at).toLocaleString()}
            </p>

            <div className="border-t pt-6">
              <h3 className="font-medium text-lg mb-4">Comments</h3>
              
              <div className="space-y-3 mb-6">
                {comments.map(comment => {
                  const commentUser = users.find(u => u.id === comment.user_id);
                  return (
                    <div key={comment.id} className="bg-gray-50 p-3 rounded-lg">
                      <span className="font-medium text-sm mr-2">
                        {commentUser?.username || 'Unknown'}
                      </span>
                      <span className="text-sm">{comment.text}</span>
                    </div>
                  );
                })}
                {comments.length === 0 && (
                  <p className="text-gray-400 text-center py-6 text-sm">
                    No comments yet. Be the first!
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <div
                  ref={commentInputRef}
                  contentEditable
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-black min-h-[80px] max-h-[200px] overflow-y-auto"
                  placeholder="Write a comment..."
                  suppressContentEditableWarning
                  onInput={(e) => {
                    // Keep a backup in case we need it
                    e.currentTarget.dataset.value = e.currentTarget.textContent;
                  }}
                  style={{
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word'
                  }}
                />
                <button
                  onClick={handleAddCommentFromRef}
                  className="w-full py-3 bg-black text-white rounded-lg hover:bg-gray-800 font-medium"
                >
                  Post Comment
                </button>
                <p className="text-xs text-gray-500 text-center">
                  Click in box above, type your comment, then click Post
                </p>
              </div>
            </div>

            {userMoments.length > 1 && (
              <div className="flex gap-3 pt-6 border-t mt-8">
                {currentMomentIndex > 0 && (
                  <button
                    onClick={() => {
                      setCurrentMomentIndex(currentMomentIndex - 1);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="flex-1 py-3 px-4 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
                  >
                    ← Previous
                  </button>
                )}
                {currentMomentIndex < userMoments.length - 1 && (
                  <button
                    onClick={() => {
                      setCurrentMomentIndex(currentMomentIndex + 1);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="flex-1 py-3 px-4 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
                  >
                    Next →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const SearchView = () => {
    const filteredUsers = users.filter(u => 
      u.id !== supabase.user.id &&
      (u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
       u.email.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
      <div className="pb-20">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
          <h1 className="text-2xl font-light mb-4">Find Friends</h1>
          <input
            key="search-input"
            type="text"
            placeholder="Search username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoComplete="off"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-400"
          />
        </div>
        
        <div className="divide-y divide-gray-100">
          {filteredUsers.map(user => {
            const isFollowing = following.some(f => f.following_id === user.id);
            return (
              <div key={user.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-sm">{user.username}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
                <button
                  onClick={() => toggleFollow(user.id)}
                  className={`px-6 py-1.5 rounded-lg text-sm font-medium ${
                    isFollowing 
                      ? 'bg-gray-200 text-black' 
                      : 'bg-black text-white'
                  }`}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const PostView = () => (
    <div className="pb-20">
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10 flex items-center justify-between">
        <button onClick={() => setCurrentView('feed')} className="text-gray-600">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-light">Share a Moment</h1>
        <button
          onClick={handlePostMoment}
          disabled={!newMoment.caption.trim() || newMoment.images.length === 0 || loading}
          className={`text-sm font-medium ${
            newMoment.caption.trim() && newMoment.images.length > 0 && !loading ? 'text-black' : 'text-gray-300'
          }`}
        >
          {loading ? 'Posting...' : 'Post'}
        </button>
      </div>
      
      <div className="p-4">
        <label className="block bg-gray-50 rounded-lg p-8 mb-4 cursor-pointer hover:bg-gray-100">
          {newMoment.previews.length > 0 ? (
            <div className="space-y-2">
              {newMoment.previews.map((preview, index) => (
                <div key={index} className="relative">
                  <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-64 object-cover rounded-lg" />
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      const newImages = newMoment.images.filter((_, i) => i !== index);
                      const newPreviews = newMoment.previews.filter((_, i) => i !== index);
                      setNewMoment({ ...newMoment, images: newImages, previews: newPreviews });
                    }}
                    className="absolute top-2 right-2 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <p className="text-sm text-center text-gray-600 mt-4">
                {newMoment.images.length} photo{newMoment.images.length !== 1 ? 's' : ''} selected
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64">
              <Camera size={48} className="text-gray-400 mb-2" />
              <p className="text-sm text-gray-500">Tap to select photos</p>
              <p className="text-xs text-gray-400 mt-1">You can select multiple</p>
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageSelect}
            className="hidden"
          />
        </label>
        
        <textarea
          key="caption-input"
          placeholder="What's happening?..."
          value={newMoment.caption}
          onChange={(e) => setNewMoment(prev => ({ ...prev, caption: e.target.value }))}
          autoComplete="off"
          className="w-full p-4 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-400 resize-none"
          rows="4"
        />
      </div>
    </div>
  );

  const ProfileView = () => {
    const currentUserProfile = users.find(u => u.id === supabase.user?.id);
    const yourMoments = moments.filter(m => m.user_id === supabase.user?.id);
    
    return (
      <div className="pb-20">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
          <h1 className="text-2xl font-light">Profile</h1>
        </div>
        
        <div className="p-6">
          <div className="mb-6">
            <p className="text-xl font-medium">{currentUserProfile?.username || 'Loading...'}</p>
            <p className="text-sm text-gray-600">{currentUserProfile?.email || supabase.user?.email}</p>
          </div>
          
          <div className="flex gap-8 mb-6 text-center">
            <div>
              <p className="text-2xl font-light">{yourMoments.length}</p>
              <p className="text-xs text-gray-600">Moments</p>
            </div>
            <div>
              <p className="text-2xl font-light">{following.length}</p>
              <p className="text-xs text-gray-600">Following</p>
            </div>
          </div>
          
          <div className="border-t border-gray-200 pt-4">
            <p className="text-sm text-gray-600 mb-4">Your Moments</p>
            {yourMoments.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">No moments shared yet</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {yourMoments.map(moment => {
                  let firstImageUrl;
                  try {
                    const parsed = JSON.parse(moment.image_url);
                    firstImageUrl = Array.isArray(parsed) ? parsed[0] : parsed;
                  } catch {
                    firstImageUrl = moment.image_url;
                  }
                  
                  return (
                    <div key={moment.id} className="aspect-square bg-gray-50 rounded overflow-hidden">
                      <img src={firstImageUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen">
      {error && (
        <div className="bg-red-50 text-red-600 p-3 text-sm text-center">
          {error}
        </div>
      )}
      
      {currentView === 'feed' && <FeedView />}
      {currentView === 'album' && <AlbumView />}
      {currentView === 'search' && <SearchView />}
      {currentView === 'post' && <PostView />}
      {currentView === 'profile' && <ProfileView />}
      <NavBar />
    </div>
  );
};

export default App;
