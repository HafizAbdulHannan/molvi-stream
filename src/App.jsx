import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Play, X, Search, Star, Calendar, Users, Film, Info, User, Settings, LogOut, Moon, Sun, Camera, Eye, EyeOff, Send, Trash2, UserMinus } from 'lucide-react';

// FIREBASE IMPORTS
import { db, auth } from './firebase';
import { doc, setDoc, getDoc, updateDoc, arrayUnion, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, signOut, onAuthStateChanged, sendPasswordResetEmail, deleteUser } from 'firebase/auth';

// --- CONFIGURATION ---
const API_KEY = "ff3f8ca9b03bf02785f32952261d8f05"; 
const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p/original";
const FORMSPREE_ENDPOINT = "https://formspree.io/f/xrenzogq";

const requests = [
  { title: "Trending Now", url: `/trending/all/week?api_key=${API_KEY}`, isLarge: true },
  { title: "Netflix Originals", url: `/discover/tv?api_key=${API_KEY}&with_networks=213` },
  { title: "Upcoming Movies", url: `/movie/upcoming?api_key=${API_KEY}` }, 
  { title: "Popular Web Series", url: `/tv/popular?api_key=${API_KEY}` },
  { title: "Indian Web Series", url: `/discover/tv?api_key=${API_KEY}&with_origin_country=IN` },
  { title: "Anime Series", url: `/discover/tv?api_key=${API_KEY}&with_genres=16&with_original_language=ja` },
  { title: "Indian Cinema", url: `/discover/movie?api_key=${API_KEY}&with_origin_country=IN` },
  { title: "Pakistani Movies", url: `/discover/movie?api_key=${API_KEY}&with_origin_country=PK` },
  { title: "Action & Adventure", url: `/discover/movie?api_key=${API_KEY}&with_genres=28,12` },
  { title: "Sci-Fi & Cyberpunk", url: `/discover/movie?api_key=${API_KEY}&with_genres=878` },
  { title: "Mystery & Thriller", url: `/discover/movie?api_key=${API_KEY}&with_genres=9648,53` },
  { title: "Comedy Gold", url: `/discover/movie?api_key=${API_KEY}&with_genres=35` },
  { title: "Horror Night", url: `/discover/movie?api_key=${API_KEY}&with_genres=27` },
];

const MOOD_GENRES = {
  "Happy / Laugh": "35",
  "Sad / Emotional": "18",
  "Thrilled / On Edge": "53",
  "Adventurous": "28,12",
  "Spooky": "27",
  "Romantic": "10749"
};

const isComingSoon = (releaseDate) => {
  if (!releaseDate) return false;
  return new Date(releaseDate) > new Date();
};

function App() {
  // Movie States
  const [movie, setMovie] = useState(null);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [movieDetails, setMovieDetails] = useState(null);
  const [cast, setCast] = useState([]);
  const [similarMovies, setSimilarMovies] = useState([]);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Dynamic Database States
  const [continueWatching, setContinueWatching] = useState([]);
  const [historyRecommendations, setHistoryRecommendations] = useState([]);
  const [lastWatchedMovieName, setLastWatchedMovieName] = useState("");
  
  // Mood States
  const [moodMovies, setMoodMovies] = useState([]);
  const [selectedMood, setSelectedMood] = useState("");

  // Theme & Auth States
  const [theme, setTheme] = useState('dark');
  const [currentUser, setCurrentUser] = useState(null);
  const [authView, setAuthView] = useState(null); 
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState("");

  // Password Visibility States
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Sign-up, Login & Reset State
  const [signUpData, setSignUpData] = useState({
    firstName: '', middleName: '', lastName: '',
    country: '', age: '', dob: '', gender: '', email: '',
    password: '', confirmPassword: ''
  });
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [resetEmail, setResetEmail] = useState(""); 

  // 1. Fetch Banner & Handle Firebase Persistent Authentication
  useEffect(() => {
    async function fetchBanner() {
      try {
        const res = await axios.get(`${BASE_URL}${requests[0].url}`);
        const releasedOnly = res.data.results.filter(m => !isComingSoon(m.release_date || m.first_air_date));
        if (releasedOnly.length > 0) {
          setMovie(releasedOnly[Math.floor(Math.random() * releasedOnly.length)]);
        } else {
          setMovie(res.data.results[0]);
        }
      } catch (e) { 
        console.error(e); 
      }
    }
    fetchBanner();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.emailVerified) {
        const userSnap = await getDoc(doc(db, "users", user.email));
        if (userSnap.exists()) {
          setCurrentUser(userSnap.data());
        }
      } else {
        setCurrentUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // 2. Fetch User Specific Data from Firestore
  useEffect(() => {
    if (!currentUser) {
      setContinueWatching([]);
      setHistoryRecommendations([]);
      return;
    }

    async function fetchUserData() {
      try {
        const userRef = doc(db, "users", currentUser.email);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const data = userSnap.data();
          setContinueWatching(data.continueWatching || []);
          
          const history = data.watchHistory || [];
          if (history.length > 0) {
            const lastItem = history[history.length - 1];
            const lastId = lastItem?.id || lastItem;
            const itemType = lastItem?.type || 'movie'; 

            const detailRes = await axios.get(`${BASE_URL}/${itemType}/${lastId}?api_key=${API_KEY}`);
            setLastWatchedMovieName(detailRes.data.title || detailRes.data.name);

            const recRes = await axios.get(`${BASE_URL}/${itemType}/${lastId}/recommendations?api_key=${API_KEY}`);
            const releasedRecs = recRes.data.results.filter(m => !isComingSoon(m.release_date || m.first_air_date));
            
            const formattedRecs = releasedRecs.map(m => ({
              ...m, 
              media_type: m.media_type || itemType
            }));
            setHistoryRecommendations(formattedRecs.slice(0, 12));
          }
        }
      } catch (e) {
        console.error("Error loading user dynamic rows: ", e);
      }
    }
    fetchUserData();
  }, [currentUser]);

  // 3. Fetch Movie Details
  useEffect(() => {
    if (selectedMovie) {
      async function fetchDetails() {
        try {
          const itemType = selectedMovie.media_type || (selectedMovie.first_air_date ? 'tv' : 'movie');
          
          const detailRes = await axios.get(`${BASE_URL}/${itemType}/${selectedMovie.id}?api_key=${API_KEY}`);
          setMovieDetails(detailRes.data);
          
          const cRes = await axios.get(`${BASE_URL}/${itemType}/${selectedMovie.id}/credits?api_key=${API_KEY}`);
          const sRes = await axios.get(`${BASE_URL}/${itemType}/${selectedMovie.id}/similar?api_key=${API_KEY}`);
          
          setCast(cRes.data.cast.slice(0, 6));
          
          const releasedSimilar = sRes.data.results.filter(m => !isComingSoon(m.release_date || m.first_air_date));
          const formattedSimilar = releasedSimilar.map(m => ({
            ...m, 
            media_type: itemType
          }));
          
          setSimilarMovies(formattedSimilar.slice(0, 12));
        } catch (e) { 
          console.error(e); 
        }
      }
      fetchDetails();
    }
  }, [selectedMovie]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setIsSearching(true);
      const res = await axios.get(`${BASE_URL}/search/multi?api_key=${API_KEY}&query=${searchQuery}`);
      const releasedSearch = res.data.results.filter(m => !isComingSoon(m.release_date || m.first_air_date));
      setSearchResults(releasedSearch);
    } else {
      setIsSearching(false);
    }
  };

  const closeDetails = () => {
    setSelectedMovie(null);
    setMovieDetails(null); 
    setIsPlayerOpen(false);
    document.body.style.overflow = 'unset';
  };

  const openDetails = (m) => {
    setSelectedMovie(m);
    setIsPlayerOpen(false);
    document.body.style.overflow = 'hidden';
  };

  const playDirectly = async (m) => {
    if (isComingSoon(m?.release_date || m?.first_air_date)) {
      return;
    }

    setSelectedMovie(m);
    setIsPlayerOpen(true); 
    document.body.style.overflow = 'hidden';

    if (currentUser) {
      try {
        const itemType = m.media_type || (m.first_air_date ? 'tv' : 'movie');
        const userRef = doc(db, "users", currentUser.email);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          let currentCW = userSnap.data().continueWatching || [];
          currentCW = currentCW.filter(item => item.id !== m.id);
          
          currentCW.unshift({
            id: m.id,
            title: m.title || m.name,
            backdrop_path: m.backdrop_path,
            poster_path: m.poster_path,
            timestamp: new Date().toISOString(),
            media_type: itemType
          });

          await updateDoc(userRef, {
            continueWatching: currentCW.slice(0, 10),
            watchHistory: arrayUnion({ id: m.id, type: itemType })
          });
          
          setContinueWatching(currentCW.slice(0, 10));
        }
      } catch (e) {
        console.error("Tracking watch progress failed: ", e);
      }
    }
  };

  const removeMovieFromHistory = async (e, movieId) => {
    e.stopPropagation(); 
    if (currentUser) {
      try {
        const updatedCW = continueWatching.filter(m => m.id !== movieId);
        setContinueWatching(updatedCW); 
        
        const userRef = doc(db, "users", currentUser.email);
        await updateDoc(userRef, {
          continueWatching: updatedCW
        });
      } catch (error) {
        console.error("Movie hatane mein masla hua: ", error);
      }
    }
  };

  const handleMoodSelect = async (mood) => {
    setSelectedMood(mood);
    const genreId = MOOD_GENRES[mood];
    if (genreId) {
      try {
        const res = await axios.get(`${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=${genreId}`);
        const releasedMood = res.data.results.filter(m => !isComingSoon(m.release_date || m.first_air_date));
        setMoodMovies(releasedMood.slice(0, 12));
      } catch (e) {
        console.error(e);
      }
    }
  };

  // --- FIREBASE AUTHENTICATION LOGIC ---
  const handleSignUpChange = (e) => {
    setSignUpData({ 
      ...signUpData, 
      [e.target.name]: e.target.value 
    });
  };

  const completeSignUp = async () => {
    if (signUpData.password !== signUpData.confirmPassword) {
      alert("Passwords match nahi ho rahay!");
      return;
    }
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, signUpData.email, signUpData.password);
      await sendEmailVerification(userCredential.user);

      const newUser = { 
        firstName: signUpData.firstName, 
        middleName: signUpData.middleName, 
        lastName: signUpData.lastName,
        country: signUpData.country, 
        age: signUpData.age, 
        dob: signUpData.dob, 
        gender: signUpData.gender,
        email: signUpData.email, 
        profilePic: null
      };

      await setDoc(doc(db, "users", signUpData.email), newUser, { merge: true });
      
      alert("Account register ho gaya hai! Verification link aapki email par bhej diya gaya hai. Log in karne se pehle apna inbox check karein.");
      
      setSignUpData({ 
        firstName: '', middleName: '', lastName: '', 
        country: '', age: '', dob: '', gender: '', 
        email: '', password: '', confirmPassword: '' 
      });
      setShowSignupPassword(false);
      setShowConfirmPassword(false);
      setAuthView('login');
      
      await signOut(auth);

    } catch (error) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
        alert("Is email par pehle se account bana hua hai.");
      } else if (error.code === 'auth/weak-password') {
        alert("Password kam az kam 6 characters ka hona chahiye.");
      } else {
        alert("Signup failed. Internet connection check karein.");
      }
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, loginData.email, loginData.password);
      
      if (!userCredential.user.emailVerified) {
        alert("Aapne abhi tak apna email verify nahi kiya. Please inbox ya spam folder check karein.");
        await signOut(auth);
        return;
      }

      setAuthView(null);
      setIsDropdownOpen(false);
      setLoginData({ email: '', password: '' });
      setShowLoginPassword(false);
      
    } catch (error) {
      console.error(error);
      alert("Email ya Password ghalat hai!");
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!resetEmail) {
      alert("Pehle apna email address likhein!");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      alert("Password reset link aapki email par bhej diya gaya hai! Apna inbox check karein.");
      setAuthView('login');
      setResetEmail("");
    } catch (error) {
      console.error(error);
      if (error.code === 'auth/user-not-found') {
        alert("Is email ka koi account nahi mila.");
      } else {
        alert("Reset link bhejne mein masla aya: " + error.message);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setAuthView(null);
      setIsDropdownOpen(false);
    } catch (error) {
      console.error("Logout error", error);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm("Kya aap waqai apna account delete karna chahte hain? Aapki watch history aur sab data hamesha ke liye khatam ho jayega.");
    
    if (!confirmDelete) {
      return;
    }

    try {
      if (currentUser && currentUser.email) {
        await deleteDoc(doc(db, "users", currentUser.email));
      }
      
      if (auth.currentUser) {
        await deleteUser(auth.currentUser);
      }
      
      localStorage.removeItem('molviStreamUser');
      setCurrentUser(null);
      setAuthView(null);
      setIsDropdownOpen(false);
      alert("Aapka account aur data mukammal taur par delete ho gaya hai.");

    } catch (error) {
      console.error(error);
      if (error.code === 'auth/requires-recent-login') {
        alert("Account delete karne ke liye security verification zaroori hai. Please pehle logout karein, dobara login karein, aur phir try karein.");
      } else {
        alert("Account delete karne mein masla aya.");
      }
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      const userRef = doc(db, "users", currentUser.email);
      await updateDoc(userRef, {
        firstName: currentUser.firstName,
        middleName: currentUser.middleName,
        lastName: currentUser.lastName,
        dob: currentUser.dob
      });
      
      const updatedUser = { 
        ...currentUser, 
        firstName: currentUser.firstName,
        middleName: currentUser.middleName,
        lastName: currentUser.lastName,
        dob: currentUser.dob 
      };
      
      setCurrentUser(updatedUser);

      alert("Profile update ho gayi hai!");
      setAuthView(null);
    } catch (error) {
      console.error(error);
      alert("Profile update karne mein masla aya.");
    }
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (!feedbackMsg.trim()) {
      return;
    }
    
    try {
      await fetch(FORMSPREE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          subject: "Feedback from User", 
          email: currentUser?.email || "Guest", 
          message: feedbackMsg 
        }),
      });
      alert("Aapka message bhej diya gaya hai!");
      setFeedbackMsg("");
    } catch (error) {
      alert("Message bhejne mein masla hua.");
    }
  };

  const handleProfilePicUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      const updatedUser = { ...currentUser, profilePic: imageUrl };
      setCurrentUser(updatedUser);
    }
  };

  const isStep1Valid = signUpData.firstName && signUpData.lastName;
  const isStep2Valid = signUpData.country && signUpData.age && signUpData.dob && signUpData.gender && signUpData.email;
  const isPasswordMatching = signUpData.password && signUpData.password === signUpData.confirmPassword;

  const getFullName = (user) => {
    if (!user) return "";
    return `${user.firstName} ${user.middleName ? user.middleName + ' ' : ''}${user.lastName}`.trim();
  };

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${theme === 'dark' ? 'bg-[#141414] text-white selection:bg-red-600' : 'bg-gray-100 text-gray-900 selection:bg-red-500'}`}>
      
      {/* NAVBAR */}
      <nav className={`fixed top-0 w-full p-4 z-[100] flex justify-between items-center backdrop-blur-sm ${theme === 'dark' ? 'bg-gradient-to-b from-black/90 to-transparent' : 'bg-white/90 shadow-md'}`}>
        <h1 className="text-red-600 text-2xl md:text-4xl font-black cursor-pointer tracking-tighter" onClick={() => setIsSearching(false)}>
          MOLVI-Stream
        </h1>
        
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-4">
            <form onSubmit={handleSearch} className={`flex items-center px-3 py-1 rounded-full border ${theme === 'dark' ? 'bg-black/50 border-gray-700' : 'bg-gray-200 border-gray-300'}`}>
              <Search size={16} />
              <input 
                type="text" 
                placeholder="Search..." 
                className="bg-transparent border-none outline-none px-2 w-24 md:w-64 text-sm"
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </form>

            <div className="relative">
              <button 
                onClick={() => !isDropdownOpen ? setIsDropdownOpen(true) : setIsDropdownOpen(false)} 
                className="flex items-center justify-center w-10 h-10 rounded-full bg-red-600 text-white overflow-hidden border-2 border-transparent hover:border-white transition"
              >
                {currentUser?.profilePic ? (
                  <img src={currentUser.profilePic} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User size={20} />
                )}
              </button>

              {isDropdownOpen && (
                <div className={`absolute right-0 mt-2 w-48 rounded-md shadow-xl py-1 z-[150] border ${theme === 'dark' ? 'bg-[#181818] border-gray-700' : 'bg-white border-gray-200'}`}>
                  {currentUser ? (
                    <>
                      <button onClick={() => { setAuthView('profile'); setIsDropdownOpen(false); }} className={`block w-full text-left px-4 py-2 text-sm ${theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}>Profile</button>
                      <button onClick={() => { setAuthView('settings'); setIsDropdownOpen(false); }} className={`block w-full text-left px-4 py-2 text-sm ${theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}>Settings</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setAuthView('login'); setIsDropdownOpen(false); }} className={`block w-full text-left px-4 py-2 text-sm ${theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}>Login</button>
                      <button onClick={() => { setAuthView('settings'); setIsDropdownOpen(false); }} className={`block w-full text-left px-4 py-2 text-sm ${theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}>Settings</button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {currentUser && (
            <span className={`text-[10px] md:text-xs font-semibold mr-1 tracking-wide ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
              {getFullName(currentUser)}
            </span>
          )}
        </div>
      </nav>

      {/* AUTHENTICATION & SETTINGS MODALS */}
      {authView && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className={`w-full max-w-md p-8 rounded-xl shadow-2xl relative max-h-[90vh] overflow-y-auto ${theme === 'dark' ? 'bg-[#181818] text-white' : 'bg-white text-gray-900'}`}>
            <button onClick={() => setAuthView(null)} className="absolute top-4 right-4 p-1 rounded-full hover:bg-red-600 hover:text-white transition">
              <X size={20} />
            </button>

            {/* LOGIN FORM */}
            {authView === 'login' && (
              <div className="space-y-6">
                <h2 className="text-3xl font-bold mb-6">Login</h2>
                
                <input 
                  type="email" 
                  placeholder="Email Address" 
                  value={loginData.email} 
                  onChange={(e) => setLoginData({...loginData, email: e.target.value})} 
                  className={`w-full p-3 rounded ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100 border border-gray-300'}`} 
                />
                
                <div className="relative">
                  <input 
                    type={showLoginPassword ? "text" : "password"} 
                    placeholder="Password" 
                    value={loginData.password} 
                    onChange={(e) => setLoginData({...loginData, password: e.target.value})} 
                    className={`w-full p-3 pr-10 rounded ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100 border border-gray-300'}`} 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowLoginPassword(!showLoginPassword)} 
                    className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-200"
                  >
                    {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                
                {/* FORGOT PASSWORD LINK */}
                <div className="text-right">
                  <span onClick={() => setAuthView('forgotPassword')} className="text-sm text-red-500 cursor-pointer font-semibold hover:underline">
                    Forgot Password?
                  </span>
                </div>

                <button onClick={handleLogin} className="w-full bg-red-600 text-white font-bold py-3 rounded hover:bg-red-700 transition">
                  Sign In
                </button>
                
                <p className="text-center mt-4">
                  Naya account banayein? <span onClick={() => setAuthView('signup1')} className="text-red-500 cursor-pointer font-bold hover:underline">Sign up now</span>
                </p>
              </div>
            )}

            {/* FORGOT PASSWORD FORM */}
            {authView === 'forgotPassword' && (
              <div className="space-y-6">
                <h2 className="text-3xl font-bold mb-2">Reset Password</h2>
                <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  Apna registered email darj karein, hum aapko password reset link bhejenge.
                </p>
                <input 
                  type="email" 
                  placeholder="Email Address" 
                  value={resetEmail} 
                  onChange={(e) => setResetEmail(e.target.value)} 
                  className={`w-full p-3 rounded ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100 border border-gray-300'}`} 
                />
                <button onClick={handleForgotPassword} className="w-full bg-red-600 text-white font-bold py-3 rounded hover:bg-red-700 transition">
                  Send Reset Link
                </button>
                <p className="text-center mt-4 cursor-pointer text-gray-400 hover:text-white" onClick={() => setAuthView('login')}>
                  Back to Login
                </p>
              </div>
            )}

            {/* SIGN UP STEP 1 */}
            {authView === 'signup1' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold mb-2">Step 1: Your Name</h2>
                <input type="text" name="firstName" placeholder="First Name *" value={signUpData.firstName} onChange={handleSignUpChange} className={`w-full p-3 rounded ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100 border'}`} />
                <input type="text" name="middleName" placeholder="Middle Name (Optional)" value={signUpData.middleName} onChange={handleSignUpChange} className={`w-full p-3 rounded ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100 border'}`} />
                <input type="text" name="lastName" placeholder="Last Name *" value={signUpData.lastName} onChange={handleSignUpChange} className={`w-full p-3 rounded ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100 border'}`} />
                <button 
                  onClick={() => setAuthView('signup2')} 
                  disabled={!isStep1Valid} 
                  className={`w-full font-bold py-3 rounded transition mt-4 ${isStep1Valid ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-gray-600 cursor-not-allowed text-gray-400'}`}
                >
                  Next
                </button>
              </div>
            )}

            {/* SIGN UP STEP 2 */}
            {authView === 'signup2' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold mb-2">Step 2: Details</h2>
                <input type="text" name="country" placeholder="Country" value={signUpData.country} onChange={handleSignUpChange} className={`w-full p-2 rounded ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100 border'}`} />
                <input type="number" name="age" placeholder="Age" value={signUpData.age} onChange={handleSignUpChange} className={`w-full p-2 rounded ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100 border'}`} />
                <input type="date" name="dob" value={signUpData.dob} onChange={handleSignUpChange} className={`w-full p-2 rounded ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100 border'}`} />
                <select name="gender" value={signUpData.gender} onChange={handleSignUpChange} className={`w-full p-2 rounded ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100 border'}`}>
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
                <input type="email" name="email" placeholder="Email Address" value={signUpData.email} onChange={handleSignUpChange} className={`w-full p-2 rounded ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100 border'}`} />
                <button 
                  onClick={() => setAuthView('signup3')} 
                  disabled={!isStep2Valid} 
                  className={`w-full font-bold py-3 rounded transition mt-4 ${isStep2Valid ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-gray-600 cursor-not-allowed text-gray-400'}`}
                >
                  Next
                </button>
              </div>
            )}

            {/* SIGN UP STEP 3 (Password & Complete) */}
            {authView === 'signup3' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold mb-2">Final Step: Password</h2>
                <p className="text-sm text-gray-400 mb-2">Password kam az kam 6 characters ka hona chahiye.</p>
                
                <div className="relative">
                  <input 
                    type={showSignupPassword ? "text" : "password"} 
                    name="password" 
                    placeholder="Create Password" 
                    value={signUpData.password} 
                    onChange={handleSignUpChange} 
                    className={`w-full p-3 pr-10 rounded ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100 border'}`} 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowSignupPassword(!showSignupPassword)} 
                    className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-200"
                  >
                    {showSignupPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <div className="relative">
                  <input 
                    type={showConfirmPassword ? "text" : "password"} 
                    name="confirmPassword" 
                    placeholder="Confirm Password" 
                    value={signUpData.confirmPassword} 
                    onChange={handleSignUpChange} 
                    className={`w-full p-3 pr-10 rounded ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100 border'}`} 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)} 
                    className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-200"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {signUpData.confirmPassword.length > 0 && signUpData.password !== signUpData.confirmPassword && (
                  <p className="text-red-500 text-sm font-semibold">Passwords match nahi ho rahay!</p>
                )}

                <button 
                  onClick={completeSignUp} 
                  disabled={!isPasswordMatching || signUpData.password.length < 6} 
                  className={`w-full font-bold py-3 rounded transition mt-4 ${isPasswordMatching && signUpData.password.length >= 6 ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-gray-600 cursor-not-allowed text-gray-400'}`}
                >
                  Create Account
                </button>
              </div>
            )}

            {/* PROFILE EDIT */}
            {authView === 'profile' && currentUser && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold mb-4">Edit Profile</h2>
                <div className="flex flex-col items-center mb-6">
                  <div className="w-24 h-24 rounded-full bg-gray-700 overflow-hidden relative group border-4 border-gray-600">
                    {currentUser.profilePic ? (
                      <img src={currentUser.profilePic} className="w-full h-full object-cover" />
                    ) : (
                      <User size={40} className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-gray-400" />
                    )}
                    <label className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition">
                      <Camera size={24} className="text-white" />
                      <input type="file" accept="image/*" className="hidden" onChange={handleProfilePicUpload} />
                    </label>
                  </div>
                  <p className="text-xs mt-2 text-gray-400">Click to change picture</p>
                </div>
                
                <input type="text" placeholder="First Name" value={currentUser.firstName} onChange={(e) => setCurrentUser({...currentUser, firstName: e.target.value})} className={`w-full p-2 rounded ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100 border'}`} />
                <input type="text" placeholder="Middle Name" value={currentUser.middleName} onChange={(e) => setCurrentUser({...currentUser, middleName: e.target.value})} className={`w-full p-2 rounded ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100 border'}`} />
                <input type="text" placeholder="Last Name" value={currentUser.lastName} onChange={(e) => setCurrentUser({...currentUser, lastName: e.target.value})} className={`w-full p-2 rounded ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100 border'}`} />
                <input type="date" value={currentUser.dob} onChange={(e) => setCurrentUser({...currentUser, dob: e.target.value})} className={`w-full p-2 rounded ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100 border'}`} />
                
                <button onClick={handleProfileUpdate} className="w-full bg-green-600 text-white font-bold py-3 rounded hover:bg-green-700 transition mt-4">
                  Save Changes
                </button>
              </div>
            )}

            {/* SETTINGS & FORMSPREE FEEDBACK */}
            {authView === 'settings' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><Settings size={24}/> Settings</h2>
                
                <div className={`flex items-center justify-between p-4 rounded-lg border ${theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-100 border-gray-300'}`}>
                  <span>Theme Mode</span>
                  <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2 bg-gray-700 rounded-full hover:bg-gray-600 transition">
                    {theme === 'dark' ? <Sun size={20} className="text-yellow-400"/> : <Moon size={20} className="text-gray-300"/>}
                  </button>
                </div>

                <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-100 border-gray-300'}`}>
                  <h3 className="font-bold mb-2 flex items-center gap-2">Send Feedback</h3>
                  <form onSubmit={handleFeedbackSubmit} className="flex flex-col gap-2">
                    <textarea 
                      placeholder="Report a bug or request a feature..." 
                      value={feedbackMsg} 
                      onChange={(e) => setFeedbackMsg(e.target.value)}
                      className={`w-full p-2 rounded text-sm resize-none ${theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300 border'}`} 
                      rows="3"
                    ></textarea>
                    <button type="submit" className="bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-700 transition flex justify-center items-center gap-2 text-sm">
                      <Send size={16} /> Submit
                    </button>
                  </form>
                </div>

                {currentUser && (
                  <>
                    {/* DANGER ZONE - DELETE ACCOUNT */}
                    <div className={`p-4 rounded-lg border border-red-900/50 bg-red-900/10 mt-6`}>
                      <h3 className="font-bold mb-2 text-red-500 flex items-center gap-2">Danger Zone</h3>
                      <p className={`text-xs mb-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        Apna account aur sara data hamesha ke liye delete karein.
                      </p>
                      <button 
                        onClick={handleDeleteAccount} 
                        className="w-full flex items-center justify-center gap-2 bg-red-600/20 text-red-500 border border-red-600/50 font-bold py-2 rounded hover:bg-red-600 hover:text-white transition text-sm"
                      >
                        <UserMinus size={16} /> Delete My Account
                      </button>
                    </div>

                    <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 bg-gray-700 text-white font-bold py-3 rounded hover:bg-gray-600 transition mt-4">
                      <LogOut size={20} /> Logout
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SEARCH OR MAIN CONTENT */}
      {isSearching ? (
        <div className="pt-24 px-4 md:px-12 pb-10">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold text-gray-400">Search Results</h2>
            <button onClick={() => { setIsSearching(false); setSearchQuery(""); }} className="bg-black/60 p-2 rounded-full border border-gray-700 hover:bg-red-600 transition text-white">
              <X size={24} />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-4">
            {searchResults.map(m => {
              const unreleased = isComingSoon(m.release_date || m.first_air_date);
              return m.poster_path && (
                <div key={m.id} className="relative rounded cursor-pointer hover:scale-105 transition duration-300" onClick={() => openDetails(m)}>
                  <img src={`${IMAGE_BASE}${m.poster_path}`} className="w-full h-full rounded" />
                  {unreleased && (
                    <div className="absolute top-2 right-2 bg-red-600/90 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg border border-red-500/50">
                      Coming Soon
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          {/* HERO BANNER */}
          <header className="relative h-[65vh] md:h-[85vh] bg-cover bg-top flex items-end pb-20 md:pb-32" style={{ backgroundImage: `url(${IMAGE_BASE}${movie?.backdrop_path})` }}>
            <div className={`absolute inset-0 bg-gradient-to-t ${theme === 'dark' ? 'from-[#141414] via-transparent to-black/20' : 'from-gray-100 via-transparent to-black/20'}`} />
            
            <div className="relative z-10 px-6 md:px-16 max-w-3xl space-y-4">
              <h1 className="text-3xl md:text-7xl font-black uppercase drop-shadow-2xl leading-tight text-white">
                {movie?.title || movie?.name}
              </h1>
              
              <div className="flex gap-4">
                {isComingSoon(movie?.release_date || movie?.first_air_date) ? (
                  <button disabled className="bg-gray-600/80 text-gray-300 px-6 md:px-10 py-2 md:py-3 rounded font-bold flex items-center gap-2 cursor-not-allowed border border-gray-500">
                    <Calendar size={20} /> Coming Soon
                  </button>
                ) : (
                  <button onClick={() => playDirectly(movie)} className="bg-white text-black px-6 md:px-10 py-2 md:py-3 rounded font-bold flex items-center gap-2 hover:bg-gray-200 transition">
                    <Play fill="black" size={20} /> Play
                  </button>
                )}
                
                <button onClick={() => openDetails(movie)} className="bg-gray-500/50 text-white px-6 md:px-10 py-2 md:py-3 rounded font-bold flex items-center gap-2 backdrop-blur-md hover:bg-gray-500/80 transition">
                  <Info size={20} /> More Info
                </button>
              </div>
            </div>
          </header>

          {/* DYNAMIC & STATIC ROWS SECTION */}
          <div className="relative -mt-10 md:-mt-20 z-20 space-y-16 pl-4 md:pl-12 pb-20 bg-transparent">
            
            {/* CONTINUE WATCHING ROW WITH TRASH ICON */}
            {currentUser && continueWatching.length > 0 && (
              <div className="mb-10">
                <h2 className="text-xl md:text-3xl font-bold mb-4 ml-1">Continue Watching</h2>
                <div className="flex overflow-x-auto space-x-4 scrollbar-hide p-2 pb-6">
                  {continueWatching.map(m => (
                    <div key={m.id} className="flex-none transition-all duration-300 md:hover:scale-110 w-56 md:w-80 group relative">
                      <img 
                        onClick={() => openDetails(m)} 
                        src={`${IMAGE_BASE}${m.backdrop_path || m.poster_path}`} 
                        className="rounded-lg w-full shadow-2xl border border-white/5 cursor-pointer" 
                        alt={m.title} 
                      />
                      
                      <button 
                        onClick={(e) => removeMovieFromHistory(e, m.id)}
                        className="absolute top-2 right-2 bg-black/80 p-2 rounded-full text-gray-300 hover:text-red-500 hover:bg-black opacity-0 group-hover:opacity-100 transition-all z-10 shadow-lg"
                        title="Remove from history"
                      >
                        <Trash2 size={16} />
                      </button>

                      <p onClick={() => openDetails(m)} className="mt-4 text-[10px] md:text-sm font-semibold truncate transition-colors text-gray-400 group-hover:text-current cursor-pointer">
                        {m.title || m.name}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* HISTORY RECOMMENDATIONS ROW */}
            {currentUser && historyRecommendations.length > 0 && (
              <Row title={`Because You Watched "${lastWatchedMovieName}"`} moviesList={historyRecommendations} onSelect={openDetails} />
            )}

            {/* MOOD PICKER SECTION */}
            <div className="mb-10 pr-4 md:pr-12">
              <h2 className="text-xl md:text-3xl font-bold mb-4 ml-1">What's your mood today?</h2>
              <div className="flex flex-wrap gap-3 mb-6 ml-1">
                {Object.keys(MOOD_GENRES).map(mood => (
                  <button 
                    key={mood} 
                    onClick={() => handleMoodSelect(mood)} 
                    className={`px-5 py-2.5 rounded-full text-sm font-bold transition duration-200 ${selectedMood === mood ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                  >
                    {mood}
                  </button>
                ))}
              </div>
              
              {moodMovies.length > 0 && (
                <div className="flex overflow-x-auto space-x-4 scrollbar-hide p-2 pb-6">
                  {moodMovies.map(m => {
                    const unreleased = isComingSoon(m.release_date || m.first_air_date);
                    return (
                      <div key={m.id} onClick={() => openDetails(m)} className="flex-none cursor-pointer transition-all duration-300 md:hover:scale-110 w-36 md:w-56">
                        <div className="relative">
                          <img src={`${IMAGE_BASE}${m.poster_path}`} className="rounded-lg w-full shadow-2xl" alt={m.title} />
                          {unreleased && (
                            <div className="absolute top-2 right-2 bg-red-600/90 backdrop-blur text-white text-[10px] md:text-xs font-bold px-2 py-1 rounded shadow-lg border border-red-500/50">
                              Coming Soon
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* DEFAULT TMDB STATIC ROWS */}
            {requests.map((row, idx) => (
              <Row key={idx} title={row.title} fetchUrl={row.url} onSelect={openDetails} isLarge={row.isLarge} />
            ))}
          </div>
        </>
      )}

      {/* MOVIE DETAILS MODAL */}
      {selectedMovie && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex items-start justify-center overflow-y-auto md:p-10 pt-0">
          <div className={`w-full max-w-5xl md:rounded-xl overflow-hidden relative shadow-2xl mb-0 md:mb-10 ${theme === 'dark' ? 'bg-[#181818] text-white' : 'bg-gray-100 text-gray-900'}`}>
            <button onClick={closeDetails} className="fixed top-6 right-6 z-[250] bg-black/60 p-2 rounded-full border border-gray-700 hover:bg-red-600 transition text-white">
              <X size={24} />
            </button>

            {isPlayerOpen ? (
              /* MOBILE FIX: Added min-h-[250px] to prevent height collapse on phones */
              <div className="aspect-video w-full bg-black min-h-[250px] md:min-h-[500px]">
                {/* MOBILE FIX: Changed server to embed.su for both TV and Movies as it is much lighter and mobile-friendly */}
                <iframe 
                  src={selectedMovie.media_type === 'tv' || selectedMovie.first_air_date 
                        ? `https://vidsrc.net/embed/tv?tmdb=${selectedMovie.id}` 
                        : `https://multiembed.mov/?video_id=${selectedMovie.id}&tmdb=1`} 
                  width="100%" 
                  height="100%" 
                  allowFullScreen 
                  allow="autoplay; fullscreen; picture-in-picture"
                  frameBorder="0"
                  scrolling="no"
                  className="w-full h-full" 
                />
              </div>
            ) : (
              <div>
                <div className="relative h-64 md:h-[500px]">
                   <img src={`${IMAGE_BASE}${selectedMovie.backdrop_path}`} className="w-full h-full object-cover" />
                   <div className={`absolute inset-0 bg-gradient-to-t ${theme === 'dark' ? 'from-[#181818]' : 'from-gray-100'} to-transparent`} />
                   
                   <div className="absolute bottom-8 left-8">
                      <h2 className="text-2xl md:text-5xl font-black mb-6 drop-shadow-lg text-white">
                        {selectedMovie.title || selectedMovie.name}
                      </h2>
                      
                      {isComingSoon(selectedMovie.release_date || selectedMovie.first_air_date) ? (
                        <button disabled className="bg-gray-600 px-12 py-4 rounded-full font-black text-lg flex items-center gap-3 shadow-2xl text-gray-400 cursor-not-allowed border border-gray-500">
                          <Calendar size={24} /> COMING SOON
                        </button>
                      ) : (
                        <button onClick={() => playDirectly(selectedMovie)} className="bg-red-600 px-12 py-4 rounded-full font-black text-lg hover:bg-red-700 transition flex items-center gap-3 active:scale-95 shadow-2xl text-white">
                          <Play fill="white" size={24} /> WATCH NOW
                        </button>
                      )}
                   </div>
                </div>

                <div className="p-6 md:p-12 grid grid-cols-1 md:grid-cols-3 gap-10">
                  <div className="md:col-span-2 space-y-6">
                    <div className="flex items-center gap-4">
                      <span className="text-green-500 font-bold text-lg">{selectedMovie.vote_average?.toFixed(1)} Rating</span>
                      <span className="text-gray-500">{(selectedMovie.release_date || selectedMovie.first_air_date)?.split('-')[0]}</span>
                    </div>

                    {movieDetails?.spoken_languages && (
                      <div className="flex flex-wrap items-center gap-2 mt-3 mb-4">
                        <span className={`text-sm font-bold ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Languages:</span>
                        {movieDetails.spoken_languages.map(lang => (
                          <span key={lang.iso_639_1} className={`text-xs px-2 py-1 rounded-md border ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-gray-200 border-gray-300 text-gray-800'}`}>
                            {lang.english_name}
                          </span>
                        ))}
                      </div>
                    )}

                    <p className={`text-lg leading-relaxed ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                      {selectedMovie.overview}
                    </p>
                    
                    <div className={`pt-10 border-t ${theme === 'dark' ? 'border-gray-800' : 'border-gray-300'}`}>
                       <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><Film size={20}/> RECOMMENDED</h3>
                       <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                          {similarMovies.map(sm => {
                            const unreleased = isComingSoon(sm.release_date || sm.first_air_date);
                            return (
                              <div key={sm.id} onClick={() => openDetails(sm)} className="relative rounded cursor-pointer hover:scale-105 transition aspect-[2/3]">
                                <img src={`${IMAGE_BASE}${sm.poster_path}`} className="w-full h-full object-cover rounded" />
                                {unreleased && (
                                  <div className="absolute top-1 right-1 bg-red-600/90 backdrop-blur text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-lg border border-red-500/50">
                                    Coming Soon
                                  </div>
                                )}
                              </div>
                            );
                          })}
                       </div>
                    </div>
                  </div>

                  <div className={`space-y-8 p-6 rounded-xl ${theme === 'dark' ? 'bg-black/20' : 'bg-gray-200'}`}>
                    <div>
                      <h3 className="text-gray-500 font-bold text-xs uppercase tracking-widest mb-4">Cast</h3>
                      <div className="flex flex-wrap gap-2">
                        {cast.map(c => (
                          <span key={c.id} className={`px-3 py-1.5 rounded-md text-xs ${theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-300 text-gray-800'}`}>
                            {c.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Updated Row component
function Row({ title, fetchUrl, moviesList, onSelect, isLarge }) {
  const [movies, setMovies] = useState([]);

  useEffect(() => {
    if (moviesList) {
      setMovies(moviesList);
      return;
    }
    
    if (fetchUrl) {
      async function getData() {
        try {
          let fetchedMovies = [];
          
          if (title === "Upcoming Movies") {
            const page1 = await axios.get(`${BASE_URL}${fetchUrl}&page=1`);
            const page2 = await axios.get(`${BASE_URL}${fetchUrl}&page=2`);
            const page3 = await axios.get(`${BASE_URL}${fetchUrl}&page=3`);
            
            const combined = [...page1.data.results, ...page2.data.results, ...page3.data.results];
            fetchedMovies = combined.filter(m => isComingSoon(m.release_date || m.first_air_date));
          } else {
            const res = await axios.get(`${BASE_URL}${fetchUrl}`);
            fetchedMovies = res.data.results.filter(m => !isComingSoon(m.release_date || m.first_air_date));
          }

          // INTELLIGENT MEDIA TYPE INJECTOR
          fetchedMovies = fetchedMovies.map(m => ({
            ...m,
            media_type: m.media_type || (fetchUrl.includes('/tv') || m.first_air_date ? 'tv' : 'movie')
          }));
          
          setMovies(fetchedMovies);
        } catch (e) { 
          console.error(e); 
        }
      }
      getData();
    }
  }, [fetchUrl, moviesList, title]); 

  return (
    <div className="mb-10">
      <h2 className="text-xl md:text-3xl font-bold mb-4 ml-1">{title}</h2>
      <div className="flex overflow-x-auto space-x-4 scrollbar-hide p-2 pb-12"> 
        {movies.map(m => {
          const unreleased = isComingSoon(m.release_date || m.first_air_date);

          return (
            <div key={m.id} onClick={() => onSelect(m)} className={`flex-none cursor-pointer transition-all duration-300 md:hover:scale-110 group ${isLarge ? 'w-36 md:w-56' : 'w-56 md:w-80'}`}>
              <div className="relative">
                <img 
                  src={`${IMAGE_BASE}${isLarge ? m.poster_path : m.backdrop_path}`} 
                  className="rounded-lg w-full shadow-2xl border border-white/5" 
                  alt={m.title} 
                  loading="lazy"
                />
                
                {unreleased && (
                  <div className="absolute top-2 right-2 bg-red-600/90 backdrop-blur text-white text-[10px] md:text-xs font-bold px-2 py-1 rounded shadow-lg border border-red-500/50">
                    Coming Soon
                  </div>
                )}
              </div>
              
              <p className="mt-4 text-[10px] md:text-sm font-semibold truncate transition-colors text-gray-400 group-hover:text-current">
                {m.title || m.name || m.original_name}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default App;